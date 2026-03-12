/**
 * AIVS Worker — BullMQ job processor for scan and crawl jobs.
 *
 * Consumes jobs from Redis queues and runs the scanner engine.
 * Deployed as a standalone container (see Dockerfile).
 */

import { Worker, Job } from 'bullmq';
import { scanUrl, discoverPages, computeSiteScore } from '@aivs/scanner-engine';
import { prisma } from '@aivs/db';
import { createHash } from 'crypto';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

console.log('AIVS Worker starting...');
console.log(`Connecting to Redis: ${REDIS_URL.replace(/\/\/.*@/, '//***@')}`);

// ──────────────────────────────────────
// Scan worker — processes single URL scans
// ──────────────────────────────────────
const scanWorker = new Worker(
  'scan',
  async (job: Job) => {
    const { url, projectId, organizationId, options } = job.data;

    console.log(`[scan] Processing: ${url} (job ${job.id})`);

    try {
      const result = await scanUrl(url, options);

      // Generate content hash for incremental re-scan support
      const contentHash = createHash('md5')
        .update(result.extraction ? JSON.stringify(result.extraction) : '')
        .digest('hex');

      // Save to database
      const scan = await prisma.scan.create({
        data: {
          projectId: projectId ?? null,
          url: result.url,
          hash: result.hash,
          score: result.score,
          tier: result.tier,
          subScores: result.subScores as object,
          layerScores: result.layerScores as object,
          extraction: result.extraction as object,
          fixes: result.fixes as object[],
          citationSimulation: result.citationSimulation as object,
          robotsData: result.robotsData as object,
          pageType: result.pageType,
          contentHash,
          factorVersion: 2, // Phase 2: ~55 factors
          crawlJobId: job.data.crawlJobId ?? null,
        },
      });

      // Store scan history for trend tracking
      if (projectId) {
        const prevScan = await prisma.scan.findFirst({
          where: { projectId, url: result.url, id: { not: scan.id } },
          orderBy: { createdAt: 'desc' },
        });

        await prisma.scanHistory.create({
          data: {
            projectId,
            url: result.url,
            score: result.score,
            prevScore: prevScan?.score ?? null,
            subScores: result.subScores as object,
            scannedAt: new Date(),
          },
        });
      }

      // Decrement credits
      if (organizationId) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: { crawlCreditsRemaining: { decrement: 1 } },
        });
      }

      console.log(`[scan] Complete: ${url} — score ${result.score} (${result.tier})`);

      return { scanId: scan.id, score: result.score, tier: result.tier };
    } catch (error) {
      console.error(`[scan] Failed: ${url}`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  },
);

// ──────────────────────────────────────
// Crawl worker — site-wide crawl with sitemap discovery
// ──────────────────────────────────────
const crawlWorker = new Worker(
  'crawl',
  async (job: Job) => {
    const { projectId, organizationId, maxPages, isIncremental } = job.data;

    console.log(`[crawl] Starting crawl for project ${projectId} (incremental: ${!!isIncremental})`);

    const crawlJob = await prisma.crawlJob.create({
      data: {
        projectId,
        status: 'running',
        isIncremental: !!isIncremental,
        maxPages: maxPages ?? null,
        startedAt: new Date(),
      },
    });

    try {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
      });

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });

      const pageLimit = Math.min(maxPages ?? 100, org.crawlCreditsRemaining);

      // Phase 2: Use sitemap-based page discovery
      console.log(`[crawl] Discovering pages for ${project.domain} (limit: ${pageLimit})`);
      const discoveredPages = await discoverPages(project.domain, {
        maxPages: pageLimit,
      });

      console.log(`[crawl] Discovered ${discoveredPages.length} pages to scan`);

      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { pagesTotal: discoveredPages.length },
      });

      // Load existing content hashes for incremental re-scan
      const existingHashes = new Map<string, string>();
      if (isIncremental) {
        const existingScans = await prisma.scan.findMany({
          where: { projectId },
          select: { url: true, contentHash: true },
          orderBy: { createdAt: 'desc' },
          distinct: ['url'],
        });
        for (const s of existingScans) {
          if (s.contentHash) existingHashes.set(s.url, s.contentHash);
        }
      }

      let pagesCompleted = 0;
      let pagesSkipped = 0;
      const pageScores: { url: string; score: number; tier: string; pageType: string; subScores: Record<string, number>; fixes: unknown[] }[] = [];
      const prevScores = new Map<string, number>();

      // Load previous scores for delta report
      if (isIncremental) {
        const prevScans = await prisma.scan.findMany({
          where: { projectId },
          select: { url: true, score: true },
          orderBy: { createdAt: 'desc' },
          distinct: ['url'],
        });
        for (const s of prevScans) {
          prevScores.set(s.url, s.score);
        }
      }

      // Crawl-delay: respect politeness (max 2 concurrent, 1s base delay)
      const POLITENESS_DELAY_MS = 1000;

      for (const page of discoveredPages) {
        if (pagesCompleted + pagesSkipped >= pageLimit) break;

        try {
          const result = await scanUrl(page.url, { deepScan: false });

          // Content hash for incremental comparison
          const contentHash = createHash('md5')
            .update(result.extraction ? JSON.stringify(result.extraction) : '')
            .digest('hex');

          // Skip if content hasn't changed (incremental mode)
          if (isIncremental && existingHashes.get(page.url) === contentHash) {
            pagesSkipped++;
            console.log(`[crawl] Skipped (unchanged): ${page.url}`);

            await prisma.crawlJob.update({
              where: { id: crawlJob.id },
              data: { pagesSkipped },
            });

            continue;
          }

          const scan = await prisma.scan.create({
            data: {
              projectId,
              url: result.url,
              hash: result.hash,
              score: result.score,
              tier: result.tier,
              subScores: result.subScores as object,
              layerScores: result.layerScores as object,
              extraction: result.extraction as object,
              fixes: result.fixes as object[],
              citationSimulation: result.citationSimulation as object,
              robotsData: result.robotsData as object,
              pageType: result.pageType,
              contentHash,
              factorVersion: 2,
              crawlJobId: crawlJob.id,
            },
          });

          // Track scan history
          const prevScore = prevScores.get(result.url) ?? null;
          await prisma.scanHistory.create({
            data: {
              projectId,
              url: result.url,
              score: result.score,
              prevScore,
              subScores: result.subScores as object,
              scannedAt: new Date(),
            },
          });

          pageScores.push({
            url: result.url,
            score: result.score,
            tier: result.tier,
            pageType: result.pageType,
            subScores: result.subScores as unknown as Record<string, number>,
            fixes: result.fixes,
          });

          pagesCompleted++;

          // Update crawl job progress
          await prisma.crawlJob.update({
            where: { id: crawlJob.id },
            data: {
              pagesCompleted,
              creditsUsed: pagesCompleted,
            },
          });

          await job.updateProgress(
            Math.round(((pagesCompleted + pagesSkipped) / discoveredPages.length) * 100),
          );

          console.log(`[crawl] Scanned ${page.url} — score ${result.score} (${pagesCompleted}/${discoveredPages.length})`);

          // Politeness delay
          await new Promise((resolve) => setTimeout(resolve, POLITENESS_DELAY_MS));
        } catch (err) {
          console.error(`[crawl] Failed to scan ${page.url}:`, err);
        }
      }

      // Compute site-level score
      const siteResult = computeSiteScore(
        pageScores.map((p) => ({
          url: p.url,
          score: p.score,
          tier: p.tier,
          pageType: p.pageType,
          subScores: p.subScores,
          fixes: p.fixes as { description: string; points: number; layer: 'access' | 'understanding' | 'extractability'; factorId: string; priority: number }[],
        })),
      );

      // Build delta report for incremental crawls
      let deltaReport = null;
      if (isIncremental && prevScores.size > 0) {
        const improved: { url: string; prevScore: number; newScore: number; delta: number }[] = [];
        const declined: { url: string; prevScore: number; newScore: number; delta: number }[] = [];
        const newPages: { url: string; score: number }[] = [];

        for (const page of pageScores) {
          const prev = prevScores.get(page.url);
          if (prev === undefined) {
            newPages.push({ url: page.url, score: page.score });
          } else if (page.score > prev) {
            improved.push({ url: page.url, prevScore: prev, newScore: page.score, delta: page.score - prev });
          } else if (page.score < prev) {
            declined.push({ url: page.url, prevScore: prev, newScore: page.score, delta: page.score - prev });
          }
        }

        deltaReport = {
          improved: improved.sort((a, b) => b.delta - a.delta),
          declined: declined.sort((a, b) => a.delta - b.delta),
          new: newPages,
          unchanged: pagesSkipped,
        };
      }

      // Decrement credits
      await prisma.organization.update({
        where: { id: organizationId },
        data: { crawlCreditsRemaining: { decrement: pagesCompleted } },
      });

      // Mark crawl complete with site score
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: {
          status: 'completed',
          pagesTotal: pagesCompleted + pagesSkipped,
          pagesCompleted,
          pagesSkipped,
          creditsUsed: pagesCompleted,
          siteScore: siteResult.siteScore,
          deltaReport: deltaReport as object ?? undefined,
          completedAt: new Date(),
        },
      });

      // Update project-level score
      await prisma.project.update({
        where: { id: projectId },
        data: {
          siteScore: siteResult.siteScore,
          siteTier: siteResult.siteTier,
          lastScheduledAt: new Date(),
        },
      });

      console.log(
        `[crawl] Complete: ${pagesCompleted} pages scanned, ${pagesSkipped} skipped for ${project.domain}. Site score: ${siteResult.siteScore}`,
      );

      return {
        crawlJobId: crawlJob.id,
        pagesCompleted,
        pagesSkipped,
        siteScore: siteResult.siteScore,
        siteTier: siteResult.siteTier,
        deltaReport,
      };
    } catch (error) {
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { status: 'failed', completedAt: new Date() },
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
  },
);

// ──────────────────────────────────────
// Event handlers
// ──────────────────────────────────────
scanWorker.on('completed', (job) => {
  console.log(`[scan] Job ${job.id} completed`);
});

scanWorker.on('failed', (job, err) => {
  console.error(`[scan] Job ${job?.id} failed:`, err.message);
});

crawlWorker.on('completed', (job) => {
  console.log(`[crawl] Job ${job.id} completed`);
});

crawlWorker.on('failed', (job, err) => {
  console.error(`[crawl] Job ${job?.id} failed:`, err.message);
});

console.log('AIVS Worker ready. Waiting for jobs...');

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  await scanWorker.close();
  await crawlWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
