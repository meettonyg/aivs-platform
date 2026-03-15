/**
 * Domain authority orchestrator — backward-compatible wrapper.
 *
 * Delegates to the two-tier orchestrators (org + person) and combines
 * results into the legacy DomainAuthorityData shape.
 *
 * Runs once per domain (not per page), cached for 30 days.
 * Only available on Pro+ tiers.
 */

import { analyzeOrgAuthority } from './org-authority';
import { analyzePersonAuthority } from './person-authority';
import {
  getCachedAuthority,
  setCachedAuthority,
  type DomainAuthorityData,
} from './authority-cache';

/**
 * Analyze full domain authority (org + people).
 *
 * @param domain - The domain to analyze
 * @param people - Optional list of person names to analyze individually.
 *                 If omitted, only org-level authority is returned.
 */
export async function analyzeDomainAuthority(
  domain: string,
  people?: string[],
): Promise<DomainAuthorityData> {
  // Check legacy cache first
  const cached = await getCachedAuthority(domain);
  if (cached) return cached;

  // Run org authority
  const org = await analyzeOrgAuthority(domain);

  // Run person authority for each individual in parallel
  const personResults = await Promise.all(
    (people ?? []).map((name) => analyzePersonAuthority(domain, name)),
  );

  // Overall score: org score (primary), boosted by best person score if available
  const bestPersonScore = personResults.length > 0
    ? Math.max(...personResults.map((p) => p.score))
    : 0;

  const overallAuthorityScore = bestPersonScore > 0
    ? Math.round(org.score * 0.7 + bestPersonScore * 0.3)
    : org.score;

  const result: DomainAuthorityData = {
    org,
    people: personResults,
    overallAuthorityScore,
  };

  await setCachedAuthority(domain, result);
  return result;
}
