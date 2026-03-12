/**
 * Backlink authority analyzer (Factor 6.1).
 *
 * Uses DataForSEO or Moz Links API for backlink data.
 * Stub implementation — wire to real API in production.
 */

import { request } from 'undici';
import type { BacklinkResult } from './authority-cache';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

export async function analyzeBacklinks(domain: string): Promise<BacklinkResult> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    // Return empty result when API not configured
    return {
      totalBacklinks: 0,
      referringDomains: 0,
      domainAuthority: 0,
      trustFlow: 0,
      score: 0,
    };
  }

  try {
    const authToken = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    const res = await request('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain,
        internal_list_limit: 0,
        include_subdomains: true,
      }]),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return { totalBacklinks: 0, referringDomains: 0, domainAuthority: 0, trustFlow: 0, score: 0 };
    }

    const data = await res.body.json() as {
      tasks?: {
        result?: {
          backlinks: number;
          referring_domains: number;
          rank: number;
        }[];
      }[];
    };

    const result = data.tasks?.[0]?.result?.[0];
    if (!result) {
      return { totalBacklinks: 0, referringDomains: 0, domainAuthority: 0, trustFlow: 0, score: 0 };
    }

    const totalBacklinks = result.backlinks ?? 0;
    const referringDomains = result.referring_domains ?? 0;
    const domainAuthority = result.rank ?? 0;

    // Estimate trust flow from domain rank (0-1000 scale)
    const trustFlow = Math.min(100, Math.round(domainAuthority / 10));

    // Scoring
    let score = 0;

    // Referring domains
    if (referringDomains >= 10) score += 10;
    if (referringDomains >= 50) score += 10;
    if (referringDomains >= 200) score += 10;
    if (referringDomains >= 1000) score += 10;

    // Total backlinks
    if (totalBacklinks >= 100) score += 10;
    if (totalBacklinks >= 1000) score += 10;
    if (totalBacklinks >= 10000) score += 10;

    // Domain authority / rank
    if (domainAuthority >= 100) score += 10;
    if (domainAuthority >= 300) score += 10;
    if (domainAuthority >= 500) score += 10;

    return {
      totalBacklinks,
      referringDomains,
      domainAuthority,
      trustFlow,
      score: Math.min(100, score),
    };
  } catch {
    return { totalBacklinks: 0, referringDomains: 0, domainAuthority: 0, trustFlow: 0, score: 0 };
  }
}
