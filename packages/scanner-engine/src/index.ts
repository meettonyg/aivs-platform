/**
 * @aivs/scanner-engine
 *
 * Core AEO scanning logic — ported from aivs-scanner/inc/scanner-engine.php.
 * Used by both the web app (single-URL scans) and workers (crawl jobs).
 */

export { scanUrl, SCORING_WEIGHTS } from './scan';
export { getTier, TIER_CONFIG } from './tiers';
export type { TierConfig } from './tiers';
export { generateFixes } from './fixes';
export { generateCitationSimulation } from './citation-sim';
export type { CitationSimulationResult } from './citation-sim';

// Analyzers
export { analyzeSchema } from './analyzers/schema';
export type { SchemaResult } from './analyzers/schema';
export { analyzeStructure } from './analyzers/structure';
export type { StructureResult } from './analyzers/structure';
export { analyzeFaq } from './analyzers/faq';
export type { FaqResult } from './analyzers/faq';
export { analyzeSummaries } from './analyzers/summaries';
export type { SummaryResult } from './analyzers/summaries';
export { analyzeFeeds } from './analyzers/feeds';
export type { FeedResult } from './analyzers/feeds';
export { analyzeEntities } from './analyzers/entities';
export type { EntityResult } from './analyzers/entities';
export { analyzeCrawlAccess } from './analyzers/crawl-access';
export type { CrawlAccessResult, RobotsTxtResult } from './analyzers/crawl-access';
export { analyzeContentRichness } from './analyzers/content-richness';
export type { ContentRichnessResult } from './analyzers/content-richness';

// Phase 2 Analyzers
export { analyzeBotBlocking } from './analyzers/phase2/bot-blocking';
export type { BotBlockingResult } from './analyzers/phase2/bot-blocking';
export { analyzeSchemaAccuracy } from './analyzers/phase2/schema-accuracy';
export type { SchemaAccuracyResult } from './analyzers/phase2/schema-accuracy';
export { analyzeAuthorEeat } from './analyzers/phase2/author-eeat';
export type { AuthorEeatResult } from './analyzers/phase2/author-eeat';
export { analyzeContentQuality } from './analyzers/phase2/content-quality';
export type { ContentQualityResult } from './analyzers/phase2/content-quality';

// Crawl utilities
export { discoverPages } from './crawl/discover';
export { computeSiteScore } from './crawl/site-score';
