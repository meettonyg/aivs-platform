/**
 * Podcast / Interview Mentions analyzer (Factor 6.6).
 *
 * Searches Taddy for podcast episodes that mention the brand or domain.
 * Returns identifiers (uuid, itunesId, rssUrl) consistent with the
 * ShowAuthority (Guestify) interview graph so results can cross-reference
 * the guest directory and speaking credits.
 *
 * Runs once per domain, cached for 30 days alongside other authority data.
 */

import {
  isTaddyConfigured,
  searchEpisodes,
  type TaddyPodcastEpisode,
} from './taddy-client';

export interface PodcastMentionResult {
  /** Total episode mentions found. */
  episodeCount: number;
  /** Unique podcast series that mentioned the brand. */
  uniqueShows: number;
  /** Summarised appearances, capped to keep cache size reasonable. */
  appearances: PodcastAppearance[];
  /** Authority score 0-100. */
  score: number;
}

export interface PodcastAppearance {
  /** Taddy episode UUID — matches ShowAuthority engagement UUIDs. */
  episodeUuid: string;
  episodeTitle: string;
  datePublished: string | null;
  /** Duration in seconds. */
  duration: number | null;
  show: {
    /** Taddy series UUID. */
    uuid: string;
    name: string;
    /** Apple Podcasts ID — shared identifier with Prospector/ShowAuthority. */
    itunesId: number | null;
    /** RSS feed URL — primary dedup key in ShowAuthority. */
    rssUrl: string | null;
    imageUrl: string | null;
    genres: string[];
  };
}

/**
 * Search Taddy for podcast episodes mentioning a domain's brand.
 * Brand name is extracted from the domain (strips TLD and separators).
 */
export async function analyzePodcastMentions(domain: string): Promise<PodcastMentionResult> {
  if (!isTaddyConfigured()) {
    return { episodeCount: 0, uniqueShows: 0, appearances: [], score: 0 };
  }

  const brandName = extractBrandName(domain);
  if (!brandName || brandName.length < 2) {
    return { episodeCount: 0, uniqueShows: 0, appearances: [], score: 0 };
  }

  try {
    // Fetch up to 2 pages (50 episodes max) to get a reasonable sample
    const [page1, page2] = await Promise.all([
      searchEpisodes(brandName, { limit: 25, page: 1 }),
      searchEpisodes(brandName, { limit: 25, page: 2 }),
    ]);

    const allEpisodes = [...page1, ...page2];

    // Filter for relevance — episode or show description should reference the brand
    const relevant = allEpisodes.filter((ep) => isRelevantMention(ep, brandName, domain));

    // Deduplicate by episode UUID
    const seen = new Set<string>();
    const unique: TaddyPodcastEpisode[] = [];
    for (const ep of relevant) {
      if (!seen.has(ep.uuid)) {
        seen.add(ep.uuid);
        unique.push(ep);
      }
    }

    // Count unique shows
    const showUuids = new Set(
      unique.map((ep) => ep.podcastSeries?.uuid).filter(Boolean),
    );

    // Build appearance list (cap at 20 for cache size)
    const appearances: PodcastAppearance[] = unique.slice(0, 20).map((ep) => ({
      episodeUuid: ep.uuid,
      episodeTitle: ep.name,
      datePublished: ep.datePublished
        ? new Date(ep.datePublished * 1000).toISOString()
        : null,
      duration: ep.duration ?? null,
      show: {
        uuid: ep.podcastSeries?.uuid ?? '',
        name: ep.podcastSeries?.name ?? '',
        itunesId: ep.podcastSeries?.itunesId ?? null,
        rssUrl: ep.podcastSeries?.rssUrl ?? null,
        imageUrl: ep.podcastSeries?.imageUrl ?? null,
        genres: ep.podcastSeries?.genres ?? [],
      },
    }));

    const score = computeScore(unique.length, showUuids.size);

    return {
      episodeCount: unique.length,
      uniqueShows: showUuids.size,
      appearances,
      score,
    };
  } catch {
    return { episodeCount: 0, uniqueShows: 0, appearances: [], score: 0 };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractBrandName(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[.-]/g, ' ')
    .trim();
}

/**
 * Check whether an episode is a genuine mention of the brand/domain
 * rather than a false positive from a common word match.
 */
function isRelevantMention(
  ep: TaddyPodcastEpisode,
  brand: string,
  domain: string,
): boolean {
  const brandLower = brand.toLowerCase();
  const domainLower = domain.replace(/^www\./, '').toLowerCase();
  const haystack = [
    ep.name,
    ep.description,
    ep.podcastSeries?.name,
    ep.podcastSeries?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Check for domain reference (strongest signal)
  if (haystack.includes(domainLower)) return true;

  // Check for brand name as a whole word
  const wordBoundary = new RegExp(`\\b${escapeRegex(brandLower)}\\b`);
  return wordBoundary.test(haystack);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Score podcast authority (0-100).
 *
 * Thresholds:
 *  - 1+ episode mention: 20 pts
 *  - 3+ episodes: +15
 *  - 5+ episodes: +10
 *  - 10+ episodes: +10
 *  - 2+ unique shows: +15
 *  - 5+ unique shows: +15
 *  - 10+ unique shows: +15
 */
function computeScore(episodes: number, shows: number): number {
  let score = 0;

  if (episodes >= 1) score += 20;
  if (episodes >= 3) score += 15;
  if (episodes >= 5) score += 10;
  if (episodes >= 10) score += 10;

  if (shows >= 2) score += 15;
  if (shows >= 5) score += 15;
  if (shows >= 10) score += 15;

  return Math.min(100, score);
}
