/**
 * Person-level authority orchestrator.
 *
 * Runs individual signals in parallel, cached for 30 days per person per domain.
 * Signals: podcast guest appearances, author books, academic papers,
 *          GitHub profile, patents, social profiles, screen presence.
 * Manual-entry signals (conference speaking) are null until user provides data.
 */

import { analyzePodcastMentions } from './podcast-mentions';
import { analyzeAuthorBooks } from './author-books';
import { analyzeAcademicPapers } from './academic-papers';
import { analyzeGitHubProfile } from './github-profile';
import { analyzePatents } from './patents';
import { analyzePersonSocialProfiles } from './social-media';
import { analyzeScreenPresence } from './screen-presence';
import {
  getCachedPersonAuthority,
  setCachedPersonAuthority,
  type PersonAuthorityData,
} from './authority-cache';

/** Weights for person-level signals (Batch 4 — 8 signals). */
const PERSON_WEIGHTS: Record<string, number> = {
  podcastMentions: 0.18,
  authorBooks: 0.18,
  academicPapers: 0.15,
  socialProfiles: 0.12,
  githubProfile: 0.10,
  patents: 0.09,
  screenPresence: 0.10,
  conferenceSpeaking: 0.08,
};

export async function analyzePersonAuthority(
  domain: string,
  personName: string,
): Promise<PersonAuthorityData> {
  if (!personName || personName.trim().length < 2) {
    return { personName: '', podcastMentions: null, authorBooks: null, academicPapers: null, githubProfile: null, patents: null, socialProfiles: null, screenPresence: null, conferenceSpeaking: null, score: 0 };
  }

  const name = personName.trim();
  const cached = await getCachedPersonAuthority(domain, name);
  if (cached) return cached;

  const [podcastMentions, authorBooks, academicPapers, githubProfile, patents, socialProfiles, screenPresence] = await Promise.all([
    analyzePodcastMentions(domain),
    analyzeAuthorBooks(name),
    analyzeAcademicPapers(name),
    analyzeGitHubProfile(name),
    analyzePatents(name),
    analyzePersonSocialProfiles(name),
    analyzeScreenPresence(name),
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
  if (screenPresence.score > 0) {
    signals.push({ score: screenPresence.score, weight: PERSON_WEIGHTS.screenPresence });
  }
  // conferenceSpeaking is manual-entry only — included when user provides data via API

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
    screenPresence,
    conferenceSpeaking: null, // Manual entry — populated via API
    score,
  };

  await setCachedPersonAuthority(domain, name, result);
  return result;
}
