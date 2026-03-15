/**
 * Scan-related types.
 * Mirrors the data shapes from aivs-scanner/inc/scanner-engine.php and rest-api.php.
 */

export interface ScanOptions {
  /** Page type hint (e.g., 'homepage', 'blog-post', 'product', 'service') */
  pageType?: string;
  /** Optional competitor URL for comparison */
  competitorUrl?: string;
  /** Enable deep scan with LLM analysis (Phase 4) */
  deepScan?: boolean;
}

export interface SubScores {
  schema: number;
  entity: number;
  speakable: number;
  structure: number;
  faq: number;
  summary: number;
  feed: number;
  crawlAccess: number;
  contentRichness: number;
  // Phase 2 sub-scores
  botBlocking: number;
  schemaAccuracy: number;
  authorEeat: number;
  contentQuality: number;
  // Phase 4 sub-scores (deep scan only)
  hallucinationRisk?: number;
  informationGain?: number;
  topicalDepth?: number;
  conversationalAlignment?: number;
  // Phase 5 sub-scores
  ymylSensitivity?: number;
  localRelevance?: number;
  intentClass?: number;
  indexNow?: number;
}

export interface LayerScores {
  /** Layer 1: Crawlability & Access */
  access: number;
  /** Layer 2: Machine Readability & Understanding */
  understanding: number;
  /** Layer 3: Content Extractability */
  extractability: number;
  /** Layer 4: Trust & Intelligence (Phase 4/5) */
  trust?: number;
}



export interface CitationSimulationResult {
  overall: number;
  platforms: {
    name: string;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  }[];
  strengths: string[];
  weaknesses: string[];
}

export interface ScanFix {
  /** Human-readable fix description */
  description: string;
  /** Estimated point improvement if fix is applied */
  points: number;
  /** Which layer this fix improves */
  layer: 'access' | 'understanding' | 'extractability';
  /** Taxonomy factor ID (e.g., '2.5', '3.4') */
  factorId: string;
  /** Priority: 1 = highest */
  priority: number;
}

export interface ScanResult {
  /** Scanned URL */
  url: string;
  /** Overall 0-100 score */
  score: number;
  /** Tier key: authority | extractable | readable | invisible */
  tier: string;
  /** Individual sub-scores */
  subScores: SubScores;
  /** Layer-level scores */
  layerScores: LayerScores;
  /** Raw extraction data */
  extraction: Record<string, unknown>;
  /** Recommended fixes, sorted by priority */
  fixes: ScanFix[];
  /** Citation simulation data */
  citationSimulation: CitationSimulationResult;
  /** robots.txt analysis */
  robotsData: Record<string, unknown>;
  /** Detected page type */
  pageType: string;
  /** Platform-specific visibility estimates (Category 8) */
  platformVisibility?: import('./platform-visibility').PlatformVisibilityResult;
  /** Scan timestamp */
  scannedAt: string;
  /** 12-char MD5 hash identifier */
  hash: string;
}
