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

const CACHE_TTL_DAYS = 30;
const CACHE_TTL_SECONDS = CACHE_TTL_DAYS * 24 * 60 * 60;
const CACHE_PREFIX = 'authority-cache:';

// Fallback used when Redis is unavailable in local/dev environments.
const fallbackCache = new Map<string, CachedAuthorityData>();

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
    fallbackCache.delete(key);
    if (redis) {
      try {
        await redis.del(key);
      } catch {
        // noop
      }
    }
    return;
  }

  fallbackCache.clear();
  if (redis) {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // noop
    }
  }
}
