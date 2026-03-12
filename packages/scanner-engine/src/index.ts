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

// Phase 3 Analyzers — Off-site Authority
export { analyzeDomainAuthority } from './analyzers/phase3/domain-authority';
export { analyzeKnowledgeGraph } from './analyzers/phase3/knowledge-graph';
export { analyzeWikidata } from './analyzers/phase3/wikidata';
export { analyzeBacklinks } from './analyzers/phase3/backlinks';
export { getCachedAuthority, setCachedAuthority, clearAuthorityCache } from './analyzers/phase3/authority-cache';
export type {
  DomainAuthorityData,
  KnowledgeGraphResult,
  WikidataResult,
  BacklinkResult,
} from './analyzers/phase3/authority-cache';

// Platform Visibility Estimates
export { estimatePlatformVisibility } from './platform-visibility';

// Phase 4 Analyzers — LLM-powered Deep Scan
export { analyzeHallucinationRisk } from './analyzers/phase4/hallucination-risk';
export type { HallucinationRiskResult } from './analyzers/phase4/hallucination-risk';
export { analyzeInformationGain } from './analyzers/phase4/information-gain';
export type { InformationGainResult } from './analyzers/phase4/information-gain';
export { analyzeTopicalDepth } from './analyzers/phase4/topical-depth';
export type { TopicalDepthResult } from './analyzers/phase4/topical-depth';
export { analyzeConversationalAlignment } from './analyzers/phase4/conversational-alignment';
export type { ConversationalAlignmentResult } from './analyzers/phase4/conversational-alignment';

// Citation Monitoring
export { parseCrawlerLogs } from './citation-monitor/log-parser';
export type { CrawlerLogReport } from './citation-monitor/log-parser';
export { checkScoreAlerts, DEFAULT_ALERT_CONFIG } from './citation-monitor/score-alerts';
export type { ScoreAlert, AlertConfig } from './citation-monitor/score-alerts';

// Phase 5 Analyzers — Remaining Experimental Factors
export { analyzeIndexNow } from './analyzers/phase5/indexnow';
export type { IndexNowResult } from './analyzers/phase5/indexnow';
export { analyzeCrossPageEntities } from './analyzers/phase5/cross-page-entities';
export type { CrossPageEntityResult } from './analyzers/phase5/cross-page-entities';
export { analyzeYmylSensitivity } from './analyzers/phase5/ymyl-sensitivity';
export type { YmylResult } from './analyzers/phase5/ymyl-sensitivity';

// Crawl utilities
export { discoverPages } from './crawl/discover';
export { computeSiteScore } from './crawl/site-score';
