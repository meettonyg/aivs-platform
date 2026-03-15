/**
 * Organization-level authority orchestrator.
 *
 * Runs domain/brand signals in parallel, cached for 30 days.
 * Signals: backlinks, Knowledge Graph, Wikidata, YouTube channel,
 *          owned podcast, news mentions (GDELT), social profiles.
 */

import { analyzeKnowledgeGraph } from './knowledge-graph';
import { analyzeWikidata } from './wikidata';
import { analyzeBacklinks } from './backlinks';
import { analyzeYouTubeChannel } from './youtube-channel';
import { analyzeOwnedPodcast } from './owned-podcast';
import { analyzeNewsMentions } from './news-mentions';
import { analyzeOrgSocialProfiles } from './social-media';
import {
  getCachedOrgAuthority,
  setCachedOrgAuthority,
  type OrgAuthorityData,
} from './authority-cache';

/** Weights for org-level signals (Batch 3 rebalanced — 7 signals). */
const ORG_WEIGHTS: Record<string, number> = {
  backlinks: 0.24,
  brandMentions: 0.16,
  knowledgeGraph: 0.14,
  youtubeChannel: 0.12,
  ownedPodcast: 0.12,
  wikidata: 0.10,
  socialProfiles: 0.12,
};

export async function analyzeOrgAuthority(domain: string): Promise<OrgAuthorityData> {
  const cached = await getCachedOrgAuthority(domain);
  if (cached) return cached;

  const cleanDomain = domain.replace(/^www\./, '');

  const [knowledgeGraph, wikidata, backlinks, youtubeChannel, ownedPodcast, brandMentions, socialProfiles] = await Promise.all([
    analyzeKnowledgeGraph(cleanDomain),
    analyzeWikidata(cleanDomain),
    analyzeBacklinks(cleanDomain),
    analyzeYouTubeChannel(cleanDomain),
    analyzeOwnedPodcast(cleanDomain),
    analyzeNewsMentions(cleanDomain),
    analyzeOrgSocialProfiles(cleanDomain),
  ]);

  // Weighted average of available signals
  const signals: { score: number; weight: number }[] = [];

  if (knowledgeGraph.found || knowledgeGraph.score > 0) {
    signals.push({ score: knowledgeGraph.score, weight: ORG_WEIGHTS.knowledgeGraph });
  }
  if (wikidata.found || wikidata.score > 0) {
    signals.push({ score: wikidata.score, weight: ORG_WEIGHTS.wikidata });
  }
  if (backlinks.score > 0) {
    signals.push({ score: backlinks.score, weight: ORG_WEIGHTS.backlinks });
  }
  if (youtubeChannel.score > 0) {
    signals.push({ score: youtubeChannel.score, weight: ORG_WEIGHTS.youtubeChannel });
  }
  if (ownedPodcast.score > 0) {
    signals.push({ score: ownedPodcast.score, weight: ORG_WEIGHTS.ownedPodcast });
  }
  if (brandMentions.score > 0) {
    signals.push({ score: brandMentions.score, weight: ORG_WEIGHTS.brandMentions });
  }
  if (socialProfiles.score > 0) {
    signals.push({ score: socialProfiles.score, weight: ORG_WEIGHTS.socialProfiles });
  }

  let score = 0;
  if (signals.length > 0) {
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    score = Math.round(
      signals.reduce((s, sig) => s + sig.score * (sig.weight / totalWeight), 0),
    );
  }

  const result: OrgAuthorityData = {
    knowledgeGraph,
    wikidata,
    backlinks,
    youtubeChannel,
    ownedPodcast,
    brandMentions,
    socialProfiles,
    newsletter: null, // Manual entry — populated via API
    score,
  };

  await setCachedOrgAuthority(domain, result);
  return result;
}
