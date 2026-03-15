/**
 * Person-level authority orchestrator.
 *
 * Runs individual signals in parallel, cached for 30 days per person per domain.
 * Signals: podcast guest appearances, author books, academic papers, GitHub profile.
 */

import { analyzePodcastMentions } from './podcast-mentions';
import { analyzeAuthorBooks } from './author-books';
import { analyzeAcademicPapers } from './academic-papers';
import { analyzeGitHubProfile } from './github-profile';
import {
  getCachedPersonAuthority,
  setCachedPersonAuthority,
  type PersonAuthorityData,
} from './authority-cache';

/** Weights for person-level signals. */
const PERSON_WEIGHTS: Record<string, number> = {
  podcastMentions: 0.30,
  authorBooks: 0.30,
  academicPapers: 0.25,
  githubProfile: 0.15,
};

export async function analyzePersonAuthority(
  domain: string,
  personName: string,
): Promise<PersonAuthorityData> {
  if (!personName || personName.trim().length < 2) {
    return { personName: '', podcastMentions: null, authorBooks: null, academicPapers: null, githubProfile: null, score: 0 };
  }

  const name = personName.trim();
  const cached = await getCachedPersonAuthority(domain, name);
  if (cached) return cached;

  const [podcastMentions, authorBooks, academicPapers, githubProfile] = await Promise.all([
    analyzePodcastMentions(domain),
    analyzeAuthorBooks(name),
    analyzeAcademicPapers(name),
    analyzeGitHubProfile(name),
  ]);

  // Weighted average of available signals
  const signals: { score: number; weight: number }[] = [];

  if (podcastMentions.score > 0) {
    signals.push({ score: podcastMentions.score, weight: PERSON_WEIGHTS.podcastMentions });
  }
  if (authorBooks.score > 0) {
    signals.push({ score: authorBooks.score, weight: PERSON_WEIGHTS.authorBooks });
  }
  if (academicPapers.score > 0) {
    signals.push({ score: academicPapers.score, weight: PERSON_WEIGHTS.academicPapers });
  }
  if (githubProfile.score > 0) {
    signals.push({ score: githubProfile.score, weight: PERSON_WEIGHTS.githubProfile });
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
    academicPapers,
    githubProfile,
    score,
  };

  await setCachedPersonAuthority(domain, name, result);
  return result;
}
