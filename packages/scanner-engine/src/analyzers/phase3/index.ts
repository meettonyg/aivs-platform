/**
 * Phase 3 analyzers — off-site authority signals.
 */

export { analyzeDomainAuthority } from './domain-authority';
export { analyzeKnowledgeGraph } from './knowledge-graph';
export { analyzeWikidata } from './wikidata';
export { analyzeBacklinks } from './backlinks';
export { analyzePodcastMentions } from './podcast-mentions';
export {
  isTaddyConfigured,
  searchEpisodes,
  searchPodcasts,
} from './taddy-client';
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
  PodcastMentionResult,
  PodcastAppearance,
  BrandMentionResult,
  SocialProfileResult,
  CachedAuthorityData,
} from './authority-cache';
export type {
  TaddyPodcastSeries,
  TaddyPodcastEpisode,
} from './taddy-client';
