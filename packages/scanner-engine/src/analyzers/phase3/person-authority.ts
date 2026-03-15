/**
 * Person-level authority orchestrator.
 *
 * Runs individual signals in parallel, cached for 30 days per person per domain.
 * Signals: podcast guest appearances, author books.
 */

import { analyzePodcastMentions } from './podcast-mentions';
import { analyzeAuthorBooks } from './author-books';
import {
  getCachedPersonAuthority,
  setCachedPersonAuthority,
  type PersonAuthorityData,
} from './authority-cache';

/** Weights for person-level signals. */
const PERSON_WEIGHTS: Record<string, number> = {
  podcastMentions: 0.50,
  authorBooks: 0.50,
};

export async function analyzePersonAuthority(
  domain: string,
  personName: string,
): Promise<PersonAuthorityData> {
  if (!personName || personName.trim().length < 2) {
    return { personName: '', podcastMentions: null, authorBooks: null, score: 0 };
  }

  const name = personName.trim();
  const cached = await getCachedPersonAuthority(domain, name);
  if (cached) return cached;

  const [podcastMentions, authorBooks] = await Promise.all([
    analyzePodcastMentions(domain),
    analyzeAuthorBooks(name),
  ]);

  // Weighted average of available signals
  const signals: { score: number; weight: number }[] = [];

  if (podcastMentions.score > 0) {
    signals.push({ score: podcastMentions.score, weight: PERSON_WEIGHTS.podcastMentions });
  }
  if (authorBooks.score > 0) {
    signals.push({ score: authorBooks.score, weight: PERSON_WEIGHTS.authorBooks });
  }

  let score = 0;
  if (signals.length > 0) {
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    score = Math.round(
      signals.reduce((s, sig) => s + sig.score * (sig.weight / totalWeight), 0),
    );
  }

  const result: PersonAuthorityData = {
    personName: name,
    podcastMentions,
    authorBooks,
    score,
  };

  await setCachedPersonAuthority(domain, name, result);
  return result;
}
