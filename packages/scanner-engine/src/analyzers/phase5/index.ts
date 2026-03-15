/**
 * Phase 5 analyzers — remaining experimental factors.
 */

export { analyzeIndexNow } from './indexnow';
export type { IndexNowResult } from './indexnow';
export { analyzeCrossPageEntities } from './cross-page-entities';
export type { CrossPageEntityResult, EntityInconsistency } from './cross-page-entities';
export { analyzeYmylSensitivity } from './ymyl-sensitivity';
export type { YmylResult, TrustEscalation } from './ymyl-sensitivity';
export { analyzeLocalRelevance } from './local-relevance';
export type { LocalRelevanceResult } from './local-relevance';
export { analyzeIntentClass } from './intent-class';
export type { IntentClassResult, IntentClass } from './intent-class';
