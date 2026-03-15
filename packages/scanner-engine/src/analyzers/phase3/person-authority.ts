/**
 * Person-level authority orchestrator.
 *
 * Runs individual signals in parallel, cached for 30 days per person per domain.
 * Signals: podcast guest appearances, author books, academic papers,
 *          GitHub profile, patents, social profiles.
 */

import { analyzePodcastMentions } from './podcast-mentions';
import { analyzeAuthorBooks } from './author-books';
import { analyzeAcademicPapers } from './academic-papers';
import { analyzeGitHubProfile } from './github-profile';
import { analyzePatents } from './patents';
import { analyzePersonSocialProfiles } from './social-media';
import {
  getCachedPersonAuthority,
  setCachedPersonAuthority,
  type PersonAuthorityData,
} from './authority-cache';

/** Weights for person-level signals (Batch 3 rebalanced — 6 signals). */
const PERSON_WEIGHTS: Record<string, number> = {
  podcastMentions: 0.22,
  authorBooks: 0.22,
  academicPapers: 0.18,
  socialProfiles: 0.15,
  githubProfile: 0.12,
  patents: 0.11,
};

export async function analyzePersonAuthority(
  domain: string,
  personName: string,
): Promise<PersonAuthorityData> {
  if (!personName || personName.trim().length < 2) {
    return { personName: '', podcastMentions: null, authorBooks: null, academicPapers: null, githubProfile: null, patents: null, socialProfiles: null, score: 0 };
  }

  const name = personName.trim();
  const cached = await getCachedPersonAuthority(domain, name);
  if (cached) return cached;

  const [podcastMentions, authorBooks, academicPapers, githubProfile, patents, socialProfiles] = await Promise.all([
    analyzePodcastMentions(domain),
    analyzeAuthorBooks(name),
    analyzeAcademicPapers(name),
    analyzeGitHubProfile(name),
    analyzePatents(name),
    analyzePersonSocialProfiles(name),
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
  if (patents.score > 0) {
    signals.push({ score: patents.score, weight: PERSON_WEIGHTS.patents });
  }
  if (socialProfiles.score > 0) {
    signals.push({ score: socialProfiles.score, weight: PERSON_WEIGHTS.socialProfiles });
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
    patents,
    socialProfiles,
    score,
  };

  await setCachedPersonAuthority(domain, name, result);
  return result;
}
