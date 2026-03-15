/**
 * TMDb (The Movie Database) API client.
 *
 * Free API key required (https://www.themoviedb.org/settings/api).
 * Searches for people (actors, directors, producers) and fetches credits.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';

export function isTmdbConfigured(): boolean {
  return !!process.env.TMDB_API_KEY;
}

export interface TmdbPersonResult {
  id: number;
  name: string;
  known_for_department: string | null;
  popularity: number;
  profile_path: string | null;
  gender: number; // 0=unspecified, 1=female, 2=male, 3=non-binary
}

export interface TmdbCredit {
  id: number;
  title: string;        // movie title or TV show name
  media_type: 'movie' | 'tv';
  character: string | null;
  department: string | null;
  job: string | null;
  release_date: string | null;
  first_air_date: string | null;
  popularity: number;
  vote_average: number;
  vote_count: number;
}

/**
 * Search TMDb for a person by name.
 */
export async function searchTmdbPeople(name: string, limit = 5): Promise<TmdbPersonResult[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      query: name,
      language: 'en-US',
      page: '1',
    });

    const res = await fetch(`${TMDB_BASE}/search/person?${params}`, {
      headers: { 'User-Agent': 'AIVS-Scanner/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json() as { results?: TmdbPersonResult[] };
    return (data.results ?? []).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get combined credits (movie + TV) for a TMDb person ID.
 */
export async function getTmdbCredits(personId: number): Promise<TmdbCredit[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'en-US',
    });

    const res = await fetch(`${TMDB_BASE}/person/${personId}/combined_credits?${params}`, {
      headers: { 'User-Agent': 'AIVS-Scanner/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      cast?: RawTmdbCreditEntry[];
      crew?: RawTmdbCreditEntry[];
    };

    const cast: TmdbCredit[] = (data.cast ?? []).map((c) => ({
      id: c.id,
      title: c.title || c.name || '',
      media_type: c.media_type ?? 'movie',
      character: c.character ?? null,
      department: 'Acting',
      job: null,
      release_date: c.release_date ?? null,
      first_air_date: c.first_air_date ?? null,
      popularity: c.popularity ?? 0,
      vote_average: c.vote_average ?? 0,
      vote_count: c.vote_count ?? 0,
    }));

    const crew: TmdbCredit[] = (data.crew ?? []).map((c) => ({
      id: c.id,
      title: c.title || c.name || '',
      media_type: c.media_type ?? 'movie',
      character: null,
      department: c.department ?? null,
      job: c.job ?? null,
      release_date: c.release_date ?? null,
      first_air_date: c.first_air_date ?? null,
      popularity: c.popularity ?? 0,
      vote_average: c.vote_average ?? 0,
      vote_count: c.vote_count ?? 0,
    }));

    return [...cast, ...crew];
  } catch {
    return [];
  }
}

interface RawTmdbCreditEntry {
  id: number;
  title?: string;
  name?: string;
  media_type?: 'movie' | 'tv';
  character?: string;
  department?: string;
  job?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}
