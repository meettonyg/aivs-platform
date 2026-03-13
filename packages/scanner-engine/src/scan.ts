/**
 * Main scan orchestrator.
 * Ported from aivs_scan_url() in aivs-scanner/inc/scanner-engine.php.
 */

import * as cheerio from 'cheerio';
import { request } from 'undici';
import type { ScanResult, ScanOptions, SubScores, LayerScores } from '@aivs/types';
import { getTier } from './tiers';
import { analyzeSchema } from './analyzers/schema';
import { analyzeStructure } from './analyzers/structure';
import { analyzeFaq } from './analyzers/faq';
import { analyzeSummaries } from './analyzers/summaries';
import { analyzeFeeds } from './analyzers/feeds';
import { analyzeEntities } from './analyzers/entities';
import { analyzeCrawlAccess } from './analyzers/crawl-access';
import { analyzeContentRichness } from './analyzers/content-richness';
import { analyzeSchemaAccuracy } from './analyzers/phase2/schema-accuracy';
import { analyzeAuthorEeat } from './analyzers/phase2/author-eeat';
import { analyzeContentQuality } from './analyzers/phase2/content-quality';
import { analyzeBotBlocking } from './analyzers/phase2/bot-blocking';
import { generateFixes } from './fixes';
import { generateCitationSimulation } from './citation-sim';
import { createHash, randomBytes } from 'crypto';

/**
 * Scoring weights — extracted from scanner-engine.php lines 184-192.
 * Configurable so they can evolve as new factors are added.
 */
export const SCORING_WEIGHTS = {
  // Phase 1 (rebalanced for 55-factor coverage)
  schema: 0.12,
  entity: 0.08,
  speakable: 0.05,
  structure: 0.10,
  faq: 0.08,
  summary: 0.08,
  feed: 0.05,
  crawlAccess: 0.08,
  contentRichness: 0.06,
  // Phase 2
  botBlocking: 0.08,
  schemaAccuracy: 0.06,
  authorEeat: 0.10,
  contentQuality: 0.06,
} as const;

const FETCH_TIMEOUT = 15_000;
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5 MB

function validateUrl(url: string): URL {
  const parsed = new URL(url);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Internal/private URLs are not allowed');
  }

  return parsed;
}

export async function scanUrl(
  url: string,
  options?: ScanOptions,
): Promise<ScanResult> {
  // 1. Validate URL (SSRF protection)
  const parsedUrl = validateUrl(url);
  const normalizedUrl = parsedUrl.toString();

  // 2. Fetch HTML via undici
  const startTime = Date.now();
  const { statusCode, headers, body } = await request(normalizedUrl, {
    method: 'GET',
    maxRedirections: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIVisibilityScanner/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const ttfbMs = Date.now() - startTime;

  if (statusCode >= 300 && statusCode < 400) {
    // Redirect was not followed (limit reached or unsupported)
    const location = headers['location'];
    await body.dump();
    throw new Error(`Redirect not followed (HTTP ${statusCode} → ${location ?? 'unknown'})`);
  }

  if (statusCode < 200 || statusCode >= 400) {
    await body.dump();
    throw new Error(`HTTP ${statusCode} fetching ${normalizedUrl}`);
  }

  const contentType = String(headers['content-type'] ?? '');
  // Only reject if content-type is explicitly set to something non-HTML.
  // Empty/missing content-type is allowed — many servers omit it for HTML responses.
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    await body.dump();
    throw new Error(`Non-HTML content type: ${contentType}`);
  }

  const html = await body.text();
  if (html.length > MAX_HTML_SIZE) {
    throw new Error('HTML exceeds maximum size limit');
  }

  // 3. Parse with cheerio
  const $ = cheerio.load(html);

  // 4. Fetch robots.txt
  let robotsTxt: string | undefined;
  try {
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    const robotsRes = await request(robotsUrl, {
      method: 'GET',
      maxRedirections: 5,
      signal: AbortSignal.timeout(5000),
    });
    if (robotsRes.statusCode === 200) {
      robotsTxt = await robotsRes.body.text();
    } else {
      await robotsRes.body.dump();
    }
  } catch {
    // robots.txt not available
  }

  // 5. Run all analyzers (Phase 1 + Phase 2)
  const schemaResult = analyzeSchema($);
  const structureResult = analyzeStructure($);
  const faqResult = analyzeFaq($);
  const summaryResult = analyzeSummaries($);
  const feedResult = analyzeFeeds($, normalizedUrl, robotsTxt);
  const entityResult = analyzeEntities($);
  const crawlAccessResult = analyzeCrawlAccess($, normalizedUrl, robotsTxt, ttfbMs);
  const contentRichnessResult = analyzeContentRichness($, normalizedUrl);

  // Phase 2 analyzers (synchronous)
  const schemaAccuracyResult = analyzeSchemaAccuracy($);
  const authorEeatResult = analyzeAuthorEeat($, normalizedUrl);
  const contentQualityResult = analyzeContentQuality($);

  // Phase 2 async: bot blocking (optional — network-dependent)
  let botBlockingScore = 100; // Default to 100 if skipped
  if (options?.deepScan !== false) {
    try {
      const botBlockingResult = await analyzeBotBlocking(normalizedUrl);
      botBlockingScore = botBlockingResult.score;
    } catch {
      // Bot blocking test failed — skip gracefully
    }
  }

  // 6. Build sub-scores
  const subScores: SubScores = {
    schema: schemaResult.score,
    entity: entityResult.score,
    speakable: schemaResult.details.speakable ? 100 : 0,
    structure: structureResult.score,
    faq: faqResult.score,
    summary: summaryResult.score,
    feed: feedResult.score,
    crawlAccess: crawlAccessResult.score,
    contentRichness: contentRichnessResult.score,
    // Phase 2
    botBlocking: botBlockingScore,
    schemaAccuracy: schemaAccuracyResult.score,
    authorEeat: authorEeatResult.score,
    contentQuality: contentQualityResult.score,
  };

  // 7. Calculate weighted overall score (~55 factors)
  let weightedScore = 0;
  for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
    weightedScore += (subScores[key as keyof SubScores] ?? 0) * weight;
  }

  const score = Math.round(weightedScore);
  const tier = getTier(score);

  // 8. Calculate layer scores (expanded for Phase 2)
  const layerScores: LayerScores = {
    access: Math.round(
      crawlAccessResult.score * 0.35 +
      feedResult.score * 0.25 +
      botBlockingScore * 0.40,
    ),
    understanding: Math.round(
      schemaResult.score * 0.25 +
      structureResult.score * 0.20 +
      entityResult.score * 0.20 +
      schemaAccuracyResult.score * 0.15 +
      authorEeatResult.score * 0.20,
    ),
    extractability: Math.round(
      faqResult.score * 0.20 +
      summaryResult.score * 0.20 +
      contentRichnessResult.score * 0.20 +
      contentQualityResult.score * 0.20 +
      subScores.speakable * 0.20,
    ),
  };

  // 9. Build extraction data
  const extraction = {
    schema: {
      types: schemaResult.types,
      details: schemaResult.details,
      jsonLdCount: schemaResult.jsonLdObjects.length,
    },
    structure: {
      headingCount: structureResult.headings.length,
      headingHierarchyValid: structureResult.headingHierarchyValid,
      wordCount: structureResult.wordCount,
      listCount: structureResult.listCount,
      tableCount: structureResult.tableCount,
    },
    faq: {
      hasFaqSchema: faqResult.hasFaqSchema,
      faqSchemaCount: faqResult.faqSchemaCount,
      questionPatterns: faqResult.questionPatterns.length,
    },
    summary: {
      metaDescriptionLength: summaryResult.metaDescriptionLength,
      hasOgDescription: !!summaryResult.ogDescription,
      hasDefinitionPattern: summaryResult.hasDefinitionPattern,
      hasTldr: summaryResult.hasTldr,
    },
    feeds: {
      hasRss: feedResult.hasRss,
      hasSitemap: feedResult.hasSitemap,
      hasLlmsTxt: feedResult.hasLlmsTxt,
    },
    entities: {
      entityDensity: entityResult.entityDensity,
      entityCount: entityResult.entityCount,
      hasAuthor: entityResult.hasAuthorEntity,
    },
    crawlAccess: {
      isHttps: crawlAccessResult.isHttps,
      hasCanonical: crawlAccessResult.hasCanonical,
      isIndexable: crawlAccessResult.isIndexable,
      isSpa: crawlAccessResult.isSpa,
      ttfbMs,
    },
    contentRichness: {
      hasStatistics: contentRichnessResult.hasStatistics,
      hasCitations: contentRichnessResult.hasCitations,
      hasImages: contentRichnessResult.hasImages,
      hasAuthor: contentRichnessResult.hasAuthor,
      hasFreshDate: contentRichnessResult.hasFreshDate,
    },
    // Phase 2
    schemaAccuracy: {
      issues: schemaAccuracyResult.issues,
      hasMatchingTitle: schemaAccuracyResult.hasMatchingTitle,
      hasMatchingDescription: schemaAccuracyResult.hasMatchingDescription,
      hasValidDates: schemaAccuracyResult.hasValidDates,
      hasMatchingAuthor: schemaAccuracyResult.hasMatchingAuthor,
    },
    authorEeat: {
      hasNamedAuthor: authorEeatResult.hasNamedAuthor,
      authorName: authorEeatResult.authorName,
      hasAuthorBio: authorEeatResult.hasAuthorBio,
      hasAuthorCredentials: authorEeatResult.hasAuthorCredentials,
      isFresh: authorEeatResult.isFresh,
      hasTrustPages: authorEeatResult.hasTrustPages,
      citationCount: authorEeatResult.citationCount,
    },
    contentQuality: {
      frontLoadedAnswers: contentQualityResult.frontLoadedAnswers,
      conciseAnswerBlocks: contentQualityResult.conciseAnswerBlocks,
      selfContainmentScore: contentQualityResult.selfContainmentScore,
      fluffScore: contentQualityResult.fluffScore,
      factDensity: contentQualityResult.factDensity,
      hasTldr: contentQualityResult.hasTldr,
      readabilityScore: contentQualityResult.readabilityScore,
      altTextCoverage: contentQualityResult.altTextCoverage,
    },
    botBlocking: {
      score: botBlockingScore,
    },
  };

  // 10. Generate fixes
  const fixes = generateFixes(subScores, extraction);

  // 11. Generate citation simulation
  const citationSimulation = generateCitationSimulation(subScores, layerScores, extraction);

  // 12. Detect page type
  const pageType = detectPageType($, options?.pageType);

  // 13. Generate hash
  const hash = createHash('md5')
    .update(`${normalizedUrl}:${Date.now()}:${randomBytes(6).toString('hex')}`)
    .digest('hex')
    .slice(0, 12);

  return {
    url: normalizedUrl,
    score,
    tier: tier.key,
    subScores,
    layerScores,
    extraction,
    fixes,
    citationSimulation,
    robotsData: crawlAccessResult.robotsTxt
      ? {
          exists: crawlAccessResult.robotsTxt.exists,
          allowsGptBot: crawlAccessResult.robotsTxt.allowsGptBot,
          allowsClaudeBot: crawlAccessResult.robotsTxt.allowsClaudeBot,
          hasSitemap: crawlAccessResult.robotsTxt.hasSitemap,
        }
      : {},
    pageType,
    scannedAt: new Date().toISOString(),
    hash,
  };
}

function detectPageType($: cheerio.CheerioAPI, hint?: string): string {
  if (hint) return hint;

  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const record = item as Record<string, unknown>;
        if (typeof record['@type'] === 'string') schemaTypes.add(record['@type']);
      }
    } catch {
      // skip
    }
  });

  if (schemaTypes.has('Product')) return 'product';
  if (schemaTypes.has('BlogPosting') || schemaTypes.has('NewsArticle')) return 'blog-post';
  if (schemaTypes.has('Article')) return 'article';
  if (schemaTypes.has('FAQPage')) return 'faq';
  if (schemaTypes.has('LocalBusiness')) return 'local-business';
  if (schemaTypes.has('Event')) return 'event';

  const url = $('link[rel="canonical"]').attr('href') ?? '';
  if (/\/(blog|news|post|article)\//i.test(url)) return 'blog-post';
  if (/\/(product|shop|store)\//i.test(url)) return 'product';
  if (/\/(service|services)\//i.test(url)) return 'service';
  if (/\/(about)\//i.test(url)) return 'about';
  if (/\/(contact)\//i.test(url)) return 'contact';

  try {
    const path = new URL(url || 'https://example.com').pathname;
    if (path === '/' || path === '') return 'homepage';
  } catch {
    // skip
  }

  return 'page';
}
