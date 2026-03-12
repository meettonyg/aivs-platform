/**
 * Phase 3 analyzers — off-site authority signals.
 */

export { analyzeDomainAuthority } from './domain-authority';
export { analyzeKnowledgeGraph } from './knowledge-graph';
export { analyzeWikidata } from './wikidata';
export { analyzeBacklinks } from './backlinks';
export {
  getCachedAuthority,
  setCachedAuthority,
  clearAuthorityCache,
} from './authority-cache';
export type {
  DomainAuthorityData,
  KnowledgeGraphResult,
  WikidataResult,
  BacklinkResult,
  BrandMentionResult,
  SocialProfileResult,
  CachedAuthorityData,
} from './authority-cache';
