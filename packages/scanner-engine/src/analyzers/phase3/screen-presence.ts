/**
 * Screen presence analyzer (person-level authority signal).
 *
 * Uses TMDb (The Movie Database) to find TV/film appearances.
 * Returns candidates for user attribution (confirm which person is theirs).
 *
 * Score is 0 until confirmed.
 */

import { isTmdbConfigured, searchTmdbPeople, getTmdbCredits, type TmdbCredit } from './tmdb-client';
import type {
  AttributionRecord,
  ScreenPresenceResult,
  ScreenPresenceCandidate,
  ScreenCredit,
} from './authority-cache';

export type { ScreenPresenceResult, ScreenPresenceCandidate, ScreenCredit };

/**
 * Search TMDb for a person's screen credits.
 */
export async function analyzeScreenPresence(personName: string): Promise<ScreenPresenceResult> {
  if (!personName || personName.trim().length < 2 || !isTmdbConfigured()) {
    return { personName: personName ?? '', candidates: [], totalCredits: 0, confirmed: [], score: 0 };
  }

  const name = personName.trim();

  try {
    const people = await searchTmdbPeople(name, 5);

    const candidates: ScreenPresenceCandidate[] = await Promise.all(
      people.map(async (person) => {
        const credits = await getTmdbCredits(person.id);
        const topCredits = credits
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 20);

        return {
          id: `tmdb:${person.id}`,
          tmdbId: person.id,
          name: person.name,
          knownForDepartment: person.known_for_department,
          popularity: person.popularity,
          profileImageUrl: person.profile_path
            ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
            : null,
          credits: topCredits.map(mapCredit),
          totalCredits: credits.length,
        };
      }),
    );

    const totalCredits = candidates.reduce((s, c) => s + c.totalCredits, 0);

    return {
      personName: name,
      candidates,
      totalCredits,
      confirmed: [],
      score: 0, // 0 until confirmed
    };
  } catch {
    return { personName: name, candidates: [], totalCredits: 0, confirmed: [], score: 0 };
  }
}

/**
 * Compute screen presence authority score from confirmed candidates.
 */
export function computeScreenPresenceScore(
  confirmed: AttributionRecord[],
  candidates: ScreenPresenceCandidate[],
): number {
  const confirmedIds = new Set(
    confirmed.filter((a) => a.status === 'confirmed').map((a) => a.candidateId),
  );
  const confirmedPeople = candidates.filter((c) => confirmedIds.has(c.id));

  if (confirmedPeople.length === 0) return 0;

  const best = confirmedPeople.sort((a, b) => b.totalCredits - a.totalCredits)[0];
  let score = 0;

  // Found in TMDb
  score += 20;

  // Credit count tiers
  if (best.totalCredits >= 3) score += 15;
  if (best.totalCredits >= 10) score += 15;

  // TMDb popularity score (global rank indicator)
  if (best.popularity >= 5) score += 15;
  if (best.popularity >= 20) score += 15;

  // Known department (directing/producing is higher signal than acting bit parts)
  const dept = best.knownForDepartment?.toLowerCase();
  if (dept === 'directing' || dept === 'production' || dept === 'writing') score += 10;

  // Recent credit (within 5 years)
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const hasRecent = best.credits.some((c) => {
    const date = c.releaseDate;
    if (!date) return false;
    return new Date(date) > fiveYearsAgo;
  });
  if (hasRecent) score += 10;

  return Math.min(100, score);
}

// ── Helpers ───────────────────────────────────────────────────────────

function mapCredit(c: TmdbCredit): ScreenCredit {
  return {
    title: c.title,
    mediaType: c.media_type,
    character: c.character,
    department: c.department,
    job: c.job,
    releaseDate: c.release_date ?? c.first_air_date,
    popularity: c.popularity,
    voteAverage: c.vote_average,
  };
}
