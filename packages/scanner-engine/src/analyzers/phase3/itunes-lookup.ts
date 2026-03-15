/**
 * iTunes / Apple Podcasts lookup — enrichment module.
 *
 * Uses the iTunes Search API (free, no key required) to enrich
 * owned-podcast and podcast-mentions results with:
 *   - Average rating
 *   - Rating count
 *   - Apple Podcasts URL
 *
 * Not a standalone authority signal — provides bonus points on related analyzers.
 */

const ITUNES_SEARCH_API = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_API = 'https://itunes.apple.com/lookup';

export interface ItunesPodcastInfo {
  trackId: number;        // iTunes ID
  trackName: string;
  artistName: string;
  collectionViewUrl: string; // Apple Podcasts URL
  artworkUrl600: string | null;
  genreIds: string[];
  averageRating: number | null;   // 0-5 stars
  ratingCount: number | null;
  trackCount: number | null;      // Episode count per Apple
}

/**
 * Look up a podcast by iTunes ID.
 * Returns enrichment data including ratings.
 */
export async function lookupByItunesId(itunesId: number): Promise<ItunesPodcastInfo | null> {
  try {
    const url = `${ITUNES_LOOKUP_API}?id=${itunesId}&entity=podcast`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AIVS-Scanner/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json() as { resultCount: number; results: RawItunesResult[] };
    if (data.resultCount === 0) return null;

    return mapResult(data.results[0]);
  } catch {
    return null;
  }
}

/**
 * Search for a podcast by name in Apple Podcasts.
 */
export async function searchItunes(query: string, limit = 10): Promise<ItunesPodcastInfo[]> {
  try {
    const params = new URLSearchParams({
      term: query,
      media: 'podcast',
      entity: 'podcast',
      limit: String(limit),
    });

    const res = await fetch(`${ITUNES_SEARCH_API}?${params}`, {
      headers: { 'User-Agent': 'AIVS-Scanner/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json() as { resultCount: number; results: RawItunesResult[] };
    return data.results.map(mapResult);
  } catch {
    return [];
  }
}

/**
 * Enrich a list of owned podcasts or podcast mentions with iTunes ratings.
 * Matches by iTunes ID (primary) or name search (fallback).
 *
 * Returns a map of candidateId → enrichment data.
 */
export async function enrichWithItunesRatings(
  candidates: { id: string; name: string; itunesId: number | null }[],
): Promise<Map<string, ItunesPodcastInfo>> {
  const results = new Map<string, ItunesPodcastInfo>();

  await Promise.all(
    candidates.map(async (candidate) => {
      let info: ItunesPodcastInfo | null = null;

      // Primary: lookup by iTunes ID
      if (candidate.itunesId) {
        info = await lookupByItunesId(candidate.itunesId);
      }

      // Fallback: search by name
      if (!info && candidate.name) {
        const searchResults = await searchItunes(candidate.name, 3);
        // Find best match by name similarity
        info = searchResults.find((r) =>
          r.trackName.toLowerCase().includes(candidate.name.toLowerCase()) ||
          candidate.name.toLowerCase().includes(r.trackName.toLowerCase()),
        ) ?? null;
      }

      if (info) {
        results.set(candidate.id, info);
      }
    }),
  );

  return results;
}

/**
 * Compute bonus authority points from iTunes ratings (0-15).
 * Used by owned-podcast and podcast-mentions scorers.
 */
export function computeItunesRatingBonus(info: ItunesPodcastInfo): number {
  let bonus = 0;

  // Has ratings at all
  if (info.ratingCount && info.ratingCount > 0) bonus += 3;

  // Rating count tiers
  if (info.ratingCount && info.ratingCount >= 50) bonus += 3;
  if (info.ratingCount && info.ratingCount >= 500) bonus += 3;

  // High average rating (4+ stars)
  if (info.averageRating && info.averageRating >= 4.0) bonus += 3;
  if (info.averageRating && info.averageRating >= 4.5) bonus += 3;

  return Math.min(15, bonus);
}

// ── Internal types ────────────────────────────────────────────────────

interface RawItunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionViewUrl?: string;
  artworkUrl600?: string;
  genreIds?: string[];
  averageUserRating?: number;
  userRatingCount?: number;
  trackCount?: number;
}

function mapResult(raw: RawItunesResult): ItunesPodcastInfo {
  return {
    trackId: raw.trackId,
    trackName: raw.trackName,
    artistName: raw.artistName,
    collectionViewUrl: raw.collectionViewUrl ?? '',
    artworkUrl600: raw.artworkUrl600 ?? null,
    genreIds: raw.genreIds ?? [],
    averageRating: raw.averageUserRating ?? null,
    ratingCount: raw.userRatingCount ?? null,
    trackCount: raw.trackCount ?? null,
  };
}
