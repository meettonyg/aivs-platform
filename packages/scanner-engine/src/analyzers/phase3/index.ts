/**
 * Phase 3 analyzers — off-site authority signals.
 *
 * Two-tier model:
 *   - Org authority: domain/brand signals
 *   - Person authority: individual signals
 */

// Orchestrators
export { analyzeDomainAuthority } from './domain-authority';
export { analyzeOrgAuthority } from './org-authority';
export { analyzePersonAuthority } from './person-authority';

// Org-level analyzers
export { analyzeKnowledgeGraph } from './knowledge-graph';
export { analyzeWikidata } from './wikidata';
export { analyzeBacklinks } from './backlinks';
export { analyzeYouTubeChannel, computeYouTubeAuthorityScore } from './youtube-channel';
export { analyzeOwnedPodcast, computeOwnedPodcastAuthorityScore } from './owned-podcast';
export { analyzeNewsMentions } from './news-mentions';
export { analyzeOrgSocialProfiles, analyzePersonSocialProfiles, computeSocialAuthorityScore, fetchPublicProfile } from './social-media';

// Person-level analyzers
export { analyzePodcastMentions } from './podcast-mentions';
export { analyzeAuthorBooks, computeBookAuthorityScore } from './author-books';
export { analyzeAcademicPapers, computeAcademicAuthorityScore } from './academic-papers';
export { analyzeGitHubProfile, computeGitHubAuthorityScore } from './github-profile';
export { analyzePatents, computePatentAuthorityScore } from './patents';
export { analyzeScreenPresence, computeScreenPresenceScore } from './screen-presence';

// Enrichment
export { lookupByItunesId, searchItunes, enrichWithItunesRatings, computeItunesRatingBonus } from './itunes-lookup';
export { isAmazonConfigured, searchByIsbn, searchByTitleAuthor, enrichBooksWithAmazon, computeAmazonBookBonus } from './amazon-client';

// Clients (for direct use / cross-system integration)
export { isTaddyConfigured, searchEpisodes, searchPodcasts } from './taddy-client';
export { isYouTubeConfigured, searchChannels, getChannelsByIds } from './youtube-client';
export {
  searchSemanticScholarAuthors,
  getSemanticScholarPapers,
  searchCrossrefWorks,
} from './academic-client';
export { isTmdbConfigured, searchTmdbPeople, getTmdbCredits } from './tmdb-client';

// Cache
export {
  getCachedAuthority, setCachedAuthority,
  getCachedOrgAuthority, setCachedOrgAuthority,
  getCachedPersonAuthority, setCachedPersonAuthority,
  clearAuthorityCache,
} from './authority-cache';

// Types
export type {
  DomainAuthorityData,
  OrgAuthorityData,
  PersonAuthorityData,
  AttributionRecord,
  AttributionStatus,
  AttributionType,
  KnowledgeGraphResult,
  WikidataResult,
  BacklinkResult,
  PodcastMentionResult,
  PodcastAppearance,
  AuthorBooksResult,
  BookCandidate,
  YouTubeChannelResult,
  YouTubeChannelCandidate,
  AcademicPapersResult,
  AcademicAuthorCandidate,
  AcademicPaperCandidate,
  GitHubProfileResult,
  GitHubProfileCandidate,
  OwnedPodcastResult,
  OwnedPodcastCandidate,
  PatentsResult,
  PatentCandidate,
  ScreenPresenceResult,
  ScreenPresenceCandidate,
  ScreenCredit,
  ConferenceSpeakingResult,
  ConferenceSpeakingEvent,
  NewsletterResult,
  BrandMentionResult,
  SocialProfileResult,
  CachedAuthorityData,
} from './authority-cache';
export type { TaddyPodcastSeries, TaddyPodcastEpisode } from './taddy-client';
export type { YouTubeChannelInfo } from './youtube-client';
export type { AcademicPaperInfo } from './academic-client';
export type { ItunesPodcastInfo } from './itunes-lookup';
export type { SocialPlatform, SocialProfileInfo } from './social-media';
export type { TmdbPersonResult, TmdbCredit } from './tmdb-client';
export type { AmazonBookEnrichment } from './amazon-client';
