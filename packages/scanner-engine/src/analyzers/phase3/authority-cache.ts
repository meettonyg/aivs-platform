/**
 * Authority data caching layer.
 *
 * Two-tier model:
 *   - Org authority: domain/brand signals (backlinks, KG, YouTube, etc.)
 *   - Person authority: individual signals (books, podcasts, papers, etc.)
 *
 * Both run once per key and are cached for 30 days.
 *   - Org: keyed by `org-authority:{domain}`
 *   - Person: keyed by `person-authority:{domain}:{personName}`
 */

// ── Legacy wrapper (backward compat) ────────────────────────────────

export interface CachedAuthorityData {
  domain: string;
  data: DomainAuthorityData;
  fetchedAt: string;
  expiresAt: string;
}

/** @deprecated Use OrgAuthorityData + PersonAuthorityData instead. */
export interface DomainAuthorityData {
  org: OrgAuthorityData;
  people: PersonAuthorityData[];
  /** Combined top-level score for backward compat. */
  overallAuthorityScore: number;
}

// ── Organization-level authority ─────────────────────────────────────

export interface OrgAuthorityData {
  knowledgeGraph: KnowledgeGraphResult | null;
  wikidata: WikidataResult | null;
  backlinks: BacklinkResult | null;
  youtubeChannel: YouTubeChannelResult | null;
  brandMentions: BrandMentionResult | null;
  socialProfiles: SocialProfileResult | null;
  score: number;
}

// ── Person-level authority ───────────────────────────────────────────

export interface PersonAuthorityData {
  personName: string;
  podcastMentions: PodcastMentionResult | null;
  authorBooks: AuthorBooksResult | null;
  score: number;
}

// ── Shared attribution types ─────────────────────────────────────────

export type AttributionStatus = 'unconfirmed' | 'confirmed' | 'rejected';
export type AttributionType =
  | 'book'
  | 'podcast_episode'
  | 'youtube_channel'
  | 'academic_paper'
  | 'patent'
  | 'screen_credit'
  | 'owned_podcast'
  | 'github_profile';

export interface AttributionRecord {
  candidateId: string;
  type: AttributionType;
  status: AttributionStatus;
  title: string;
  subtitle: string | null;
  attributedAt: string | null;
  attributedBy: string | null;
}

// ── Signal result types ──────────────────────────────────────────────

export interface PodcastMentionResult {
  episodeCount: number;
  uniqueShows: number;
  appearances: PodcastAppearance[];
  score: number;
}

export interface PodcastAppearance {
  episodeUuid: string;
  episodeTitle: string;
  datePublished: string | null;
  duration: number | null;
  show: {
    uuid: string;
    name: string;
    itunesId: number | null;
    rssUrl: string | null;
    imageUrl: string | null;
    genres: string[];
  };
}

export interface AuthorBooksResult {
  authorName: string;
  candidates: BookCandidate[];
  totalFound: number;
  score: number;
  confirmed: AttributionRecord[];
}

export interface BookCandidate {
  id: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  isbn: string | null;
  pageCount: number | null;
  description: string | null;
  coverImageUrl: string | null;
  subjects: string[];
  source: 'openlibrary' | 'googlebooks';
  infoUrl: string | null;
}

export interface YouTubeChannelResult {
  candidates: YouTubeChannelCandidate[];
  confirmed: AttributionRecord[];
  score: number;
}

export interface YouTubeChannelCandidate {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  customUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
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

const CACHE_TTL_DAYS = 30;
const CACHE_TTL_SECONDS = CACHE_TTL_DAYS * 24 * 60 * 60;
const ORG_CACHE_PREFIX = 'org-authority:';
const PERSON_CACHE_PREFIX = 'person-authority:';
/** @deprecated Legacy prefix for backward compat. */
const CACHE_PREFIX = 'authority-cache:';

// Fallback used when Redis is unavailable in local/dev environments.
const fallbackCache = new Map<string, CachedAuthorityData>();

interface CachedEntry<T> {
  data: T;
  fetchedAt: string;
  expiresAt: string;
}
const genericFallbackCache = new Map<string, CachedEntry<unknown>>();

type RedisLike = {
  connect: () => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttl: number) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
  scan: (cursor: string, command: 'MATCH', pattern: string, countCommand: 'COUNT', count: number) => Promise<[string, string[]]>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

let redisClient: RedisLike | null = null;

function getRedisClient(): RedisLike | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const RedisCtor = require('ioredis');
    redisClient = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    }) as RedisLike;
  } catch {
    return null;
  }

  redisClient.on('error', () => {
    // Redis outages should not crash scans; fallback cache remains available.
  });

  return redisClient;
}

function getCacheKey(domain: string): string {
  return `${CACHE_PREFIX}${domain.toLowerCase().trim()}`;
}

export async function getCachedAuthority(domain: string): Promise<DomainAuthorityData | null> {
  const key = getCacheKey(domain);
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.connect();
    } catch {
      // ignore connect races / already-connected state
    }

    try {
      const value = await redis.get(key);
      if (value) {
        const parsed = JSON.parse(value) as CachedAuthorityData;
        return parsed.data;
      }
    } catch {
      // Fallback to in-memory cache below.
    }
  }

  const cached = fallbackCache.get(key);
  if (!cached) return null;
  if (new Date(cached.expiresAt) < new Date()) {
    fallbackCache.delete(key);
    return null;
  }
  return cached.data;
}

export async function setCachedAuthority(domain: string, data: DomainAuthorityData): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);
  const key = getCacheKey(domain);

  const cached: CachedAuthorityData = {
    domain,
    data,
    fetchedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.connect();
    } catch {
      // ignore connect races / already-connected state
    }

    try {
      await redis.set(key, JSON.stringify(cached), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Fallback cache will still be populated.
    }
  }

  fallbackCache.set(key, cached);
}

export async function clearAuthorityCache(domain?: string): Promise<void> {
  const redis = getRedisClient();

  if (domain) {
    const key = getCacheKey(domain);
    const orgKey = getOrgCacheKey(domain);
    fallbackCache.delete(key);
    genericFallbackCache.delete(orgKey);
    // Also clear all person caches for this domain
    for (const k of genericFallbackCache.keys()) {
      if (k.startsWith(`${PERSON_CACHE_PREFIX}${domain.toLowerCase()}`)) {
        genericFallbackCache.delete(k);
      }
    }
    if (redis) {
      try {
        await redis.del(key, orgKey);
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${PERSON_CACHE_PREFIX}${domain.toLowerCase()}:*`, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) await redis.del(...keys);
        } while (cursor !== '0');
      } catch {
        // noop
      }
    }
    return;
  }

  fallbackCache.clear();
  genericFallbackCache.clear();
  if (redis) {
    try {
      for (const prefix of [CACHE_PREFIX, ORG_CACHE_PREFIX, PERSON_CACHE_PREFIX]) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) await redis.del(...keys);
        } while (cursor !== '0');
      }
    } catch {
      // noop
    }
  }
}

// ── Org-level cache ──────────────────────────────────────────────────

function getOrgCacheKey(domain: string): string {
  return `${ORG_CACHE_PREFIX}${domain.toLowerCase().trim()}`;
}

export async function getCachedOrgAuthority(domain: string): Promise<OrgAuthorityData | null> {
  return getCachedGeneric<OrgAuthorityData>(getOrgCacheKey(domain));
}

export async function setCachedOrgAuthority(domain: string, data: OrgAuthorityData): Promise<void> {
  return setCachedGeneric(getOrgCacheKey(domain), data);
}

// ── Person-level cache ───────────────────────────────────────────────

function getPersonCacheKey(domain: string, personName: string): string {
  const normalized = personName.toLowerCase().trim().replace(/\s+/g, '-');
  return `${PERSON_CACHE_PREFIX}${domain.toLowerCase().trim()}:${normalized}`;
}

export async function getCachedPersonAuthority(domain: string, personName: string): Promise<PersonAuthorityData | null> {
  return getCachedGeneric<PersonAuthorityData>(getPersonCacheKey(domain, personName));
}

export async function setCachedPersonAuthority(domain: string, personName: string, data: PersonAuthorityData): Promise<void> {
  return setCachedGeneric(getPersonCacheKey(domain, personName), data);
}

// ── Generic cache helpers ────────────────────────────────────────────

async function getCachedGeneric<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (redis) {
    try { await redis.connect(); } catch { /* ignore */ }
    try {
      const value = await redis.get(key);
      if (value) {
        const parsed = JSON.parse(value) as CachedEntry<T>;
        return parsed.data;
      }
    } catch { /* fall through */ }
  }

  const cached = genericFallbackCache.get(key) as CachedEntry<T> | undefined;
  if (!cached) return null;
  if (new Date(cached.expiresAt) < new Date()) {
    genericFallbackCache.delete(key);
    return null;
  }
  return cached.data;
}

async function setCachedGeneric<T>(key: string, data: T): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

  const entry: CachedEntry<T> = {
    data,
    fetchedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const redis = getRedisClient();
  if (redis) {
    try { await redis.connect(); } catch { /* ignore */ }
    try { await redis.set(key, JSON.stringify(entry), 'EX', CACHE_TTL_SECONDS); } catch { /* fall through */ }
  }

  genericFallbackCache.set(key, entry as CachedEntry<unknown>);
}
