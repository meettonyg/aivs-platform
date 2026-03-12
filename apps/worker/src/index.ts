/**
 * AIVS Worker — BullMQ job processor for scan and crawl jobs.
 *
 * Consumes jobs from Redis queues and runs the scanner engine.
 * Deployed as a standalone container (see Dockerfile).
 */

import { Worker, Job } from 'bullmq';
import { scanUrl } from '@aivs/scanner-engine';
import { prisma } from '@aivs/db';

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

// Scan worker — processes single URL scans
const scanWorker = new Worker(
  'scan',
  async (job: Job) => {
    const { url, projectId, organizationId, options } = job.data;

    console.log(`[scan] Processing: ${url} (job ${job.id})`);

    try {
      const result = await scanUrl(url, options);

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
          crawlJobId: job.data.crawlJobId ?? null,
        },
      });

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

// Crawl worker — processes site-wide crawl jobs
const crawlWorker = new Worker(
  'crawl',
  async (job: Job) => {
    const { projectId, organizationId, maxPages } = job.data;

    console.log(`[crawl] Starting crawl for project ${projectId}`);

    const crawlJob = await prisma.crawlJob.create({
      data: {
        projectId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      // Get project domain
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
      });

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });

      // Start with homepage
      const homepageUrl = `https://${project.domain}`;
      const pagesToScan = [homepageUrl];
      const scannedUrls = new Set<string>();
      let pagesCompleted = 0;
      const pageLimit = Math.min(maxPages ?? 100, org.crawlCreditsRemaining);

      while (pagesToScan.length > 0 && pagesCompleted < pageLimit) {
        const url = pagesToScan.shift()!;
        if (scannedUrls.has(url)) continue;
        scannedUrls.add(url);

        try {
          const result = await scanUrl(url);

          await prisma.scan.create({
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
              crawlJobId: crawlJob.id,
            },
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

          // Update progress
          await job.updateProgress(
            Math.round((pagesCompleted / pageLimit) * 100),
          );

          // Politeness delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`[crawl] Failed to scan ${url}:`, err);
        }
      }

      // Decrement credits
      await prisma.organization.update({
        where: { id: organizationId },
        data: { crawlCreditsRemaining: { decrement: pagesCompleted } },
      });

      // Mark crawl complete
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: {
          status: 'completed',
          pagesTotal: pagesCompleted,
          pagesCompleted,
          creditsUsed: pagesCompleted,
          completedAt: new Date(),
        },
      });

      console.log(`[crawl] Complete: ${pagesCompleted} pages crawled for ${project.domain}`);

      return { crawlJobId: crawlJob.id, pagesCompleted };
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

// Event handlers
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
