/**
 * Domain authority orchestrator — runs all off-site authority analyzers.
 *
 * Runs once per domain (not per page), cached for 30 days.
 * Only available on Pro+ tiers.
 */

import { analyzeKnowledgeGraph } from './knowledge-graph';
import { analyzeWikidata } from './wikidata';
import { analyzeBacklinks } from './backlinks';
import {
  getCachedAuthority,
  setCachedAuthority,
  type DomainAuthorityData,
} from './authority-cache';

export async function analyzeDomainAuthority(domain: string): Promise<DomainAuthorityData> {
  // Check cache first
  const cached = await getCachedAuthority(domain);
  if (cached) return cached;

  const cleanDomain = domain.replace(/^www\./, '');

  // Run all authority analyzers in parallel
  const [knowledgeGraph, wikidata, backlinks] = await Promise.all([
    analyzeKnowledgeGraph(cleanDomain),
    analyzeWikidata(cleanDomain),
    analyzeBacklinks(cleanDomain),
  ]);

  // Compute overall authority score (weighted average of available signals)
  const signals: { score: number; weight: number }[] = [];

  if (knowledgeGraph.found || knowledgeGraph.score > 0) {
    signals.push({ score: knowledgeGraph.score, weight: 0.25 });
  }
  if (wikidata.found || wikidata.score > 0) {
    signals.push({ score: wikidata.score, weight: 0.20 });
  }
  if (backlinks.score > 0) {
    signals.push({ score: backlinks.score, weight: 0.55 });
  }

  let overallAuthorityScore = 0;
  if (signals.length > 0) {
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    overallAuthorityScore = Math.round(
      signals.reduce((s, sig) => s + sig.score * (sig.weight / totalWeight), 0),
    );
  }

  const result: DomainAuthorityData = {
    knowledgeGraph,
    wikidata,
    backlinks,
    brandMentions: null, // Future: wire to GDELT or Mention API
    socialProfiles: null, // Future: wire to social profile scraper
    overallAuthorityScore,
  };

  // Cache the result
  await setCachedAuthority(domain, result);

  return result;
}
