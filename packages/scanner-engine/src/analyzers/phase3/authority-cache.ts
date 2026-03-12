/**
 * Authority data caching layer.
 *
 * Off-site authority factors are expensive (external API calls).
 * They run once per domain (not per page) and are cached for 30 days.
 */

export interface CachedAuthorityData {
  domain: string;
  data: DomainAuthorityData;
  fetchedAt: string;
  expiresAt: string;
}

export interface DomainAuthorityData {
  knowledgeGraph: KnowledgeGraphResult | null;
  wikidata: WikidataResult | null;
  backlinks: BacklinkResult | null;
  brandMentions: BrandMentionResult | null;
  socialProfiles: SocialProfileResult | null;
  overallAuthorityScore: number;
}

export interface KnowledgeGraphResult {
  found: boolean;
  entityId: string | null;
  entityName: string | null;
  entityType: string | null;
  description: string | null;
  score: number;
}

export interface WikidataResult {
  found: boolean;
  entityId: string | null;
  label: string | null;
  description: string | null;
  sitelinks: number;
  score: number;
}

export interface BacklinkResult {
  totalBacklinks: number;
  referringDomains: number;
  domainAuthority: number;
  trustFlow: number;
  score: number;
}

export interface BrandMentionResult {
  mentionCount: number;
  sentimentScore: number; // -1 to 1
  topSources: string[];
  score: number;
}

export interface SocialProfileResult {
  profiles: { platform: string; url: string; verified: boolean }[];
  consistencyScore: number;
  score: number;
}

// In-memory cache (production would use Redis)
const authorityCache = new Map<string, CachedAuthorityData>();
const CACHE_TTL_DAYS = 30;

export function getCachedAuthority(domain: string): DomainAuthorityData | null {
  const cached = authorityCache.get(domain);
  if (!cached) return null;
  if (new Date(cached.expiresAt) < new Date()) {
    authorityCache.delete(domain);
    return null;
  }
  return cached.data;
}

export function setCachedAuthority(domain: string, data: DomainAuthorityData): void {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  authorityCache.set(domain, {
    domain,
    data,
    fetchedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
}

export function clearAuthorityCache(domain?: string): void {
  if (domain) {
    authorityCache.delete(domain);
  } else {
    authorityCache.clear();
  }
}
