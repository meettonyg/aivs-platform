/**
 * Main scan orchestrator.
 * Ported from aivs_scan_url() in aivs-scanner/inc/scanner-engine.php.
 *
 * Phase 1-2: Always run (deterministic, on-page)
 * Phase 4: Run only when deepScan=true (LLM-powered, higher cost)
 * Phase 5: Lightweight experimental factors (indexnow, YMYL)
 * Phase 3: Authority signals run separately via /api/projects/[id]/authority
 */

import * as cheerio from 'cheerio';
import { request, BROWSER_HEADERS, BROWSER_UA, extractCookies } from './http-client';
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
// Phase 4 — LLM-powered (deep scan only)
import { analyzeHallucinationRisk } from './analyzers/phase4/hallucination-risk';
import { analyzeInformationGain } from './analyzers/phase4/information-gain';
import { analyzeTopicalDepth } from './analyzers/phase4/topical-depth';
import { analyzeConversationalAlignment } from './analyzers/phase4/conversational-alignment';
// Phase 5 — Experimental
import { analyzeIndexNow } from './analyzers/phase5/indexnow';
import { analyzeYmylSensitivity } from './analyzers/phase5/ymyl-sensitivity';
import { analyzeLocalRelevance } from './analyzers/phase5/local-relevance';
import { analyzeIntentClass } from './analyzers/phase5/intent-class';
// Platform visibility estimates
import { estimatePlatformVisibility } from './platform-visibility';
import { generateFixes } from './fixes';
import { generateCitationSimulation } from './citation-sim';
import { createHash, randomBytes } from 'crypto';

/**
 * Scoring weights — rebalanced for full-spectrum coverage.
 *
 * Phase 1-2 weights (always applied): sum = 0.82
 * Phase 4-5 weights (when available): sum = 0.18
 * When Phase 4/5 scores are absent, Phase 1-2 weights are
 * normalized to sum to 1.0 automatically.
 */
export const SCORING_WEIGHTS: Record<string, number> = {
  // Phase 1
  schema: 0.10,
  entity: 0.06,
  speakable: 0.04,
  structure: 0.08,
  faq: 0.06,
  summary: 0.06,
  feed: 0.04,
  crawlAccess: 0.07,
  contentRichness: 0.05,
  // Phase 2
  botBlocking: 0.07,
  schemaAccuracy: 0.05,
  authorEeat: 0.08,
  contentQuality: 0.06,
  // Phase 4 (deep scan)
  hallucinationRisk: 0.04,
  informationGain: 0.04,
  topicalDepth: 0.04,
  conversationalAlignment: 0.03,
  // Phase 5
  ymylSensitivity: 0.02,
  localRelevance: 0.02,
  intentClass: 0.02,
  indexNow: 0.01,
};

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

  // 2. Fetch HTML via undici (with retry on 403 for WAF-protected sites)
  const startTime = Date.now();
  let statusCode: number;
  let headers: Record<string, string | string[] | undefined>;
  let body: import('undici').Dispatcher.ResponseData['body'];

  const fetchPage = async (extraHeaders?: Record<string, string>) => {
    return request(normalizedUrl, {
      method: 'GET',
      headers: { ...BROWSER_HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
  };

  let res = await fetchPage();
  statusCode = res.statusCode;
  headers = res.headers;
  body = res.body;

  // Retry on retryable status codes.  Covers two scenarios:
  //  - 403: WAFs (Akamai, Cloudflare) set tracking cookies and expect them back
  //  - 502/503/504: CDN edge errors or WAF bot challenges that resolve on retry
  // Cookies from every response are accumulated and sent on subsequent attempts.
  const RETRYABLE_CODES = new Set([403, 502, 503, 504]);
  let accumulatedCookies = '';
  for (let attempt = 0; attempt < 3 && RETRYABLE_CODES.has(statusCode); attempt++) {
    const newCookies = extractCookies(headers as Record<string, string | string[] | undefined>);
    if (newCookies) {
      accumulatedCookies = accumulatedCookies
        ? `${accumulatedCookies}; ${newCookies}`
        : newCookies;
    }
    await body.dump();
    // Backoff: 500ms, 1s, 2s for 403; 1s, 2s, 4s for 5xx
    const delay = statusCode === 403 ? 500 * (attempt + 1) : 1000 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, delay));
    const extra: Record<string, string> = {};
    if (accumulatedCookies) extra['Cookie'] = accumulatedCookies;
    res = await fetchPage(extra);
    statusCode = res.statusCode;
    headers = res.headers;
    body = res.body;
  }

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

  // Phase 5 analyzers (lightweight, always run)
  const ymylResult = analyzeYmylSensitivity($, normalizedUrl);
  const localRelevanceResult = analyzeLocalRelevance($);
  const intentClassResult = analyzeIntentClass($, normalizedUrl);
  let indexNowScore = 0;
  try {
    const indexNowResult = await analyzeIndexNow(parsedUrl.hostname);
    indexNowScore = indexNowResult.score;
  } catch {
    // IndexNow check failed — skip gracefully
  }

  // Phase 4 analyzers (LLM-powered — only on deep scan)
  let hallucinationRiskScore: number | undefined;
  let informationGainScore: number | undefined;
  let topicalDepthScore: number | undefined;
  let conversationalAlignmentScore: number | undefined;

  if (options?.deepScan) {
    const [hallucinationResult, informationGainResult, topicalDepthResult, conversationalResult] = await Promise.all([
      analyzeHallucinationRisk($).catch(() => null),
      analyzeInformationGain($).catch(() => null),
      Promise.resolve(analyzeTopicalDepth($, normalizedUrl)),
      Promise.resolve(analyzeConversationalAlignment($)),
    ]);

    hallucinationRiskScore = hallucinationResult?.score;
    informationGainScore = informationGainResult?.score;
    topicalDepthScore = topicalDepthResult.score;
    conversationalAlignmentScore = conversationalResult.score;
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
    // Phase 4 (undefined when not run)
    hallucinationRisk: hallucinationRiskScore,
    informationGain: informationGainScore,
    topicalDepth: topicalDepthScore,
    conversationalAlignment: conversationalAlignmentScore,
    // Phase 5
    ymylSensitivity: ymylResult.score,
    localRelevance: localRelevanceResult.score,
    intentClass: intentClassResult.score,
    indexNow: indexNowScore,
  };

  // 7. Calculate weighted overall score
  // Only include weights for scores that are available (Phase 4 may be absent)
  let weightedScore = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
    const value = subScores[key as keyof SubScores];
    if (value !== undefined) {
      weightedScore += value * weight;
      totalWeight += weight;
    }
  }

  // Normalize: if only Phase 1-2 ran (totalWeight ~0.82), scale up proportionally
  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  const tier = getTier(score);

  // 8. Calculate layer scores
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

  // Layer 4: Trust & Intelligence (only when Phase 4 scores are available)
  if (hallucinationRiskScore !== undefined || ymylResult.score > 0) {
    const trustComponents: number[] = [];
    if (hallucinationRiskScore !== undefined) trustComponents.push(hallucinationRiskScore);
    if (informationGainScore !== undefined) trustComponents.push(informationGainScore);
    if (topicalDepthScore !== undefined) trustComponents.push(topicalDepthScore);
    if (conversationalAlignmentScore !== undefined) trustComponents.push(conversationalAlignmentScore);
    if (ymylResult.score > 0) trustComponents.push(ymylResult.score);
    if (trustComponents.length > 0) {
      layerScores.trust = Math.round(
        trustComponents.reduce((s, v) => s + v, 0) / trustComponents.length,
      );
    }
  }

  // 9. Build extraction data
  const extraction: Record<string, unknown> = {
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
      hasOrg: entityResult.hasOrgEntity,
      // 4.2 Entity Type Quality
      typedEntities: entityResult.typedEntities,
      entityTypeVariety: entityResult.entityTypeVariety,
      // 4.3 Entity Disambiguation
      hasSameAsLinks: entityResult.hasSameAsLinks,
      hasWikipediaLinks: entityResult.hasWikipediaLinks,
      disambiguationScore: entityResult.disambiguationScore,
      // 4.10 Brand Entity Signals
      brandConsistency: entityResult.brandConsistency,
      brandName: entityResult.brandName,
    },
    crawlAccess: {
      isHttps: crawlAccessResult.isHttps,
      hasCanonical: crawlAccessResult.hasCanonical,
      isIndexable: crawlAccessResult.isIndexable,
      isSpa: crawlAccessResult.isSpa,
      ttfbMs,
      jsRenderingDependency: crawlAccessResult.jsRenderingDependency,
      heavyJsFrameworks: crawlAccessResult.heavyJsFrameworks,
      hasContentBehindInteraction: crawlAccessResult.hasContentBehindInteraction,
      interactiveElementCount: crawlAccessResult.interactiveElementCount,
      hasLlmsFullJson: crawlAccessResult.hasLlmsFullJson,
      hasMobileViewport: crawlAccessResult.hasMobileViewport,
      hasResponsiveDesign: crawlAccessResult.hasResponsiveDesign,
      hasCleanExport: crawlAccessResult.hasCleanExport,
      cleanExportFormats: crawlAccessResult.cleanExportFormats,
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
      hasAuthorPage: authorEeatResult.hasAuthorPage,
      hasFirstHandExperience: authorEeatResult.hasFirstHandExperience,
      experienceSignals: authorEeatResult.experienceSignals,
      hasExpertiseSignals: authorEeatResult.hasExpertiseSignals,
      hasOriginalResearch: authorEeatResult.hasOriginalResearch,
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
    // Phase 5
    ymylSensitivity: {
      score: ymylResult.score,
      isYmyl: ymylResult.isYmyl,
      ymylCategory: ymylResult.ymylCategory,
    },
    localRelevance: {
      isLocalContent: localRelevanceResult.isLocalContent,
      hasLocalBusinessSchema: localRelevanceResult.hasLocalBusinessSchema,
      hasGeoMeta: localRelevanceResult.hasGeoMeta,
      hasNapData: localRelevanceResult.hasNapData,
      localSignals: localRelevanceResult.localSignals,
    },
    intentClass: {
      detectedIntent: intentClassResult.detectedIntent,
      intentConfidence: intentClassResult.intentConfidence,
      structureAlignment: intentClassResult.structureAlignment,
      intentSignals: intentClassResult.intentSignals,
    },
    indexNow: {
      score: indexNowScore,
    },
  };

  // Phase 4 extraction (when available)
  if (options?.deepScan) {
    extraction.deepScan = {
      hallucinationRisk: hallucinationRiskScore,
      informationGain: informationGainScore,
      topicalDepth: topicalDepthScore,
      conversationalAlignment: conversationalAlignmentScore,
    };
  }

  // 10. Generate fixes
  const fixes = generateFixes(subScores, extraction);

  // 11. Generate citation simulation
  const citationSimulation = generateCitationSimulation(subScores, layerScores, extraction);

  // 12. Detect page type
  const pageType = detectPageType($, options?.pageType);

  // 13. Platform visibility estimates
  const platformVisibility = estimatePlatformVisibility({
    subScores,
    layerScores,
    extraction,
    pageType,
  });

  // 14. Generate hash
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
    platformVisibility,
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
