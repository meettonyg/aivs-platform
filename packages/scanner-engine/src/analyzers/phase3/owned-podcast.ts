/**
 * Owned podcast analyzer (org-level authority signal).
 *
 * Reuses the existing Taddy client to find podcasts the brand/domain hosts.
 * Distinguished from podcast-mentions.ts which finds GUEST appearances.
 *
 * Returns candidates for user attribution (confirm which show is theirs).
 * Score is 0 until confirmed.
 */

import {
  isTaddyConfigured,
  searchPodcasts,
  type TaddyPodcastSeries,
} from './taddy-client';
import type { AttributionRecord } from './authority-cache';

export interface OwnedPodcastResult {
  candidates: OwnedPodcastCandidate[];
  confirmed: AttributionRecord[];
  score: number;
}

export interface OwnedPodcastCandidate {
  id: string;
  /** Taddy series UUID. */
  uuid: string;
  name: string;
  authorName: string | null;
  description: string | null;
  imageUrl: string | null;
  genres: string[];
  totalEpisodes: number | null;
  /** Apple Podcasts ID — shared with ShowAuthority. */
  itunesId: number | null;
  /** RSS feed URL — primary dedup key with ShowAuthority. */
  rssUrl: string | null;
  websiteUrl: string | null;
}

export async function analyzeOwnedPodcast(domain: string): Promise<OwnedPodcastResult> {
  if (!isTaddyConfigured()) {
    return { candidates: [], confirmed: [], score: 0 };
  }

  const brandName = extractBrandName(domain);
  if (!brandName || brandName.length < 2) {
    return { candidates: [], confirmed: [], score: 0 };
  }

  try {
    const series = await searchPodcasts(brandName, { limit: 10 });

    // Filter for shows likely owned by this domain
    const relevant = series.filter((s) => isLikelyOwned(s, brandName, domain));

    const candidates: OwnedPodcastCandidate[] = relevant.map((s) => ({
      id: `taddy-show:${s.uuid}`,
      uuid: s.uuid,
      name: s.name,
      authorName: s.authorName,
      description: s.description,
      imageUrl: s.imageUrl,
      genres: s.genres,
      totalEpisodes: s.totalEpisodesCount,
      itunesId: s.itunesId,
      rssUrl: s.rssUrl,
      websiteUrl: s.websiteUrl,
    }));

    return {
      candidates,
      confirmed: [],
      score: 0, // 0 until confirmed
    };
  } catch {
    return { candidates: [], confirmed: [], score: 0 };
  }
}

/**
 * Compute owned podcast authority score from confirmed shows.
 */
export function computeOwnedPodcastAuthorityScore(
  confirmed: AttributionRecord[],
  candidates: OwnedPodcastCandidate[],
): number {
  const confirmedIds = new Set(
    confirmed.filter((a) => a.status === 'confirmed').map((a) => a.candidateId),
  );
  const confirmedShows = candidates.filter((c) => confirmedIds.has(c.id));

  if (confirmedShows.length === 0) return 0;

  let score = 0;

  // Owns at least one show
  score += 25;

  // Episode count (use best show)
  const bestEpisodes = Math.max(...confirmedShows.map((s) => s.totalEpisodes ?? 0));
  if (bestEpisodes >= 50) score += 15;
  if (bestEpisodes >= 200) score += 15;

  // Multiple shows
  if (confirmedShows.length >= 2) score += 10;

  // Has iTunes presence (discoverability)
  if (confirmedShows.some((s) => s.itunesId)) score += 10;

  // Has website URL matching domain
  // (already filtered by isLikelyOwned, but bonus for exact match)
  if (confirmedShows.some((s) => s.websiteUrl)) score += 10;

  return Math.min(100, score);
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractBrandName(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[.-]/g, ' ')
    .trim();
}

function isLikelyOwned(series: TaddyPodcastSeries, brand: string, domain: string): boolean {
  const brandLower = brand.toLowerCase();
  const domainLower = domain.replace(/^www\./, '').toLowerCase();

  const haystack = [
    series.name,
    series.authorName,
    series.description,
    series.websiteUrl,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Website URL contains the domain (strongest signal)
  if (series.websiteUrl && series.websiteUrl.toLowerCase().includes(domainLower)) return true;

  // Author name or show name contains the brand
  const wordBoundary = new RegExp(`\\b${escapeRegex(brandLower)}\\b`);
  return wordBoundary.test(haystack);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
