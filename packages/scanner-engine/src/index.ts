/**
 * @aivs/scanner-engine
 *
 * Core AEO scanning logic — ported from aivs-scanner/inc/scanner-engine.php.
 * Used by both the web app (single-URL scans) and workers (crawl jobs).
 */

export { scanUrl } from './scan';
export { getTier, TIER_CONFIG } from './tiers';
export { generateFixes } from './fixes';
export { generateCitationSimulation } from './citation-sim';

// Analyzers
export { analyzeSchema } from './analyzers/schema';
export { analyzeStructure } from './analyzers/structure';
export { analyzeFaq } from './analyzers/faq';
export { analyzeSummaries } from './analyzers/summaries';
export { analyzeFeeds } from './analyzers/feeds';
export { analyzeEntities } from './analyzers/entities';
export { analyzeCrawlAccess } from './analyzers/crawl-access';
export { analyzeContentRichness } from './analyzers/content-richness';
