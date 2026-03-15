/**
 * Organization-level authority orchestrator.
 *
 * Runs domain/brand signals in parallel, cached for 30 days.
 * Signals: backlinks, Knowledge Graph, Wikidata, YouTube channel.
 */

import { analyzeKnowledgeGraph } from './knowledge-graph';
import { analyzeWikidata } from './wikidata';
import { analyzeBacklinks } from './backlinks';
import { analyzeYouTubeChannel } from './youtube-channel';
import { analyzeOwnedPodcast } from './owned-podcast';
import {
  getCachedOrgAuthority,
  setCachedOrgAuthority,
  type OrgAuthorityData,
} from './authority-cache';

/** Weights for org-level signals. */
const ORG_WEIGHTS: Record<string, number> = {
  backlinks: 0.32,
  knowledgeGraph: 0.18,
  youtubeChannel: 0.16,
  wikidata: 0.16,
  ownedPodcast: 0.18,
};

export async function analyzeOrgAuthority(domain: string): Promise<OrgAuthorityData> {
  const cached = await getCachedOrgAuthority(domain);
  if (cached) return cached;

  const cleanDomain = domain.replace(/^www\./, '');

  const [knowledgeGraph, wikidata, backlinks, youtubeChannel, ownedPodcast] = await Promise.all([
    analyzeKnowledgeGraph(cleanDomain),
    analyzeWikidata(cleanDomain),
    analyzeBacklinks(cleanDomain),
    analyzeYouTubeChannel(cleanDomain),
    analyzeOwnedPodcast(cleanDomain),
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
    brandMentions: null,   // Batch 3: GDELT
    socialProfiles: null,  // Batch 3: social media
    score,
  };

  await setCachedOrgAuthority(domain, result);
  return result;
}
