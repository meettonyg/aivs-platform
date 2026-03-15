/**
 * Taddy API GraphQL client.
 *
 * Mirrors the integration pattern used in Podcast Prospector
 * (meettonyg/prospector) for consistency across the platform ecosystem.
 *
 * Auth: X-USER-ID + X-API-KEY headers.
 * Endpoint: https://api.taddy.org (GraphQL POST).
 */

import { request } from 'undici';

const TADDY_API_URL = 'https://api.taddy.org';
const TADDY_USER_ID = process.env.TADDY_USER_ID;
const TADDY_API_KEY = process.env.TADDY_API_KEY;

// ── GraphQL types matching Taddy schema ──────────────────────────────

export interface TaddyPodcastSeries {
  uuid: string;
  name: string;
  authorName: string | null;
  description: string | null;
  imageUrl: string | null;
  genres: string[];
  totalEpisodesCount: number | null;
  itunesId: number | null;
  language: string | null;
  isExplicitContent: boolean | null;
  rssUrl: string | null;
  websiteUrl: string | null;
}

export interface TaddyPodcastEpisode {
  uuid: string;
  name: string;
  guid: string | null;
  audioUrl: string | null;
  datePublished: number | null;
  description: string | null;
  duration: number | null;
  podcastSeries: TaddyPodcastSeries | null;
}

export interface TaddySearchResponse {
  searchId: string | null;
  podcastEpisodes?: TaddyPodcastEpisode[];
  podcastSeries?: TaddyPodcastSeries[];
}

// ── Public API ───────────────────────────────────────────────────────

export function isTaddyConfigured(): boolean {
  return !!(TADDY_USER_ID && TADDY_API_KEY);
}

/**
 * Search Taddy for podcast episodes mentioning a term.
 * Consistent with Prospector's `search_episodes` GraphQL query.
 */
export async function searchEpisodes(
  term: string,
  opts: { limit?: number; page?: number } = {},
): Promise<TaddyPodcastEpisode[]> {
  const limit = Math.min(opts.limit ?? 25, 25);
  const page = opts.page ?? 1;

  const query = `{
    searchForTerm(
      term: "${escapeGraphQL(term)}"
      limitPerPage: ${limit}
      page: ${page}
      filterForTypes: PODCASTEPISODE
      includeSearchOperator: AND
      isSafeMode: true
    ) {
      searchId
      podcastEpisodes {
        uuid
        name
        guid
        audioUrl
        datePublished
        description
        duration
        podcastSeries {
          uuid
          name
          authorName
          description
          imageUrl
          genres
          itunesId
          language
          isExplicitContent
          rssUrl
          websiteUrl
        }
      }
    }
  }`;

  const data = await executeQuery<{ searchForTerm: TaddySearchResponse }>(query);
  return data?.searchForTerm?.podcastEpisodes ?? [];
}

/**
 * Search Taddy for podcast series mentioning a term.
 * Consistent with Prospector's `search_podcasts` GraphQL query.
 */
export async function searchPodcasts(
  term: string,
  opts: { limit?: number; page?: number } = {},
): Promise<TaddyPodcastSeries[]> {
  const limit = Math.min(opts.limit ?? 25, 25);
  const page = opts.page ?? 1;

  const query = `{
    searchForTerm(
      term: "${escapeGraphQL(term)}"
      limitPerPage: ${limit}
      page: ${page}
      filterForTypes: PODCASTSERIES
      includeSearchOperator: AND
      isSafeMode: true
    ) {
      searchId
      podcastSeries {
        uuid
        name
        authorName
        description
        imageUrl
        genres
        totalEpisodesCount
        itunesId
        language
        isExplicitContent
        rssUrl
        websiteUrl
        episodes(sortOrder: LATEST, limitPerPage: 1) {
          uuid
          datePublished
        }
      }
    }
  }`;

  const data = await executeQuery<{ searchForTerm: TaddySearchResponse }>(query);
  return data?.searchForTerm?.podcastSeries ?? [];
}

// ── Internals ────────────────────────────────────────────────────────

async function executeQuery<T>(query: string): Promise<T | null> {
  if (!TADDY_USER_ID || !TADDY_API_KEY) return null;

  try {
    const res = await request(TADDY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-USER-ID': TADDY_USER_ID,
        'X-API-KEY': TADDY_API_KEY,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return null;
    }

    const body = await res.body.json() as { data?: T; errors?: unknown[] };
    if (body.errors) return null;
    return body.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Escape user input for GraphQL string interpolation.
 * Matches the sanitisation in Prospector's `escape_graphql_string()`.
 */
function escapeGraphQL(str: string): string {
  return str
    .replace(/\0/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
