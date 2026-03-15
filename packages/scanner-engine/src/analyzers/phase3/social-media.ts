/**
 * Social media analyzer (both org-level and person-level).
 *
 * Two approaches:
 *   - Public scrape: Fetch profile pages, extract follower counts from meta tags
 *     or known HTML patterns. Works for any public profile without authentication.
 *   - OAuth (future): When access tokens are stored in SocialAccount model,
 *     fetch full metrics via platform APIs.
 *
 * This module provides:
 *   - analyzeOrgSocialProfiles(domain) → SocialProfileResult
 *   - analyzePersonSocialProfiles(personName) → SocialProfileResult
 *   - fetchPublicProfile(platform, handle) → partial metrics
 *   - computeSocialAuthorityScore(profiles) → score 0-100
 */

import type { SocialProfileResult } from './authority-cache';

export type SocialPlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok' | 'pinterest' | 'youtube';

export interface SocialProfileInfo {
  platform: SocialPlatform;
  handle: string;
  url: string;
  verified: boolean;
  followers: number | null;
  engagement: number | null; // engagement rate 0-1 if available
}

/**
 * Analyze social profiles for an organization by searching common profile URL patterns.
 * Falls back to homepage meta tag scraping for social links.
 */
export async function analyzeOrgSocialProfiles(domain: string): Promise<SocialProfileResult> {
  const brandName = extractBrandName(domain);
  if (!brandName || brandName.length < 2) {
    return { profiles: [], consistencyScore: 0, score: 0 };
  }

  try {
    // Try to discover social links from the domain's homepage
    const discoveredLinks = await discoverSocialLinksFromHomepage(domain);

    // Fetch public profile info for each discovered link
    const profiles = await Promise.all(
      discoveredLinks.map(async (link) => {
        const info = await fetchPublicProfile(link.platform, link.handle);
        return {
          platform: link.platform,
          url: link.url,
          verified: info?.verified ?? false,
          followers: info?.followers ?? null,
        };
      }),
    );

    const validProfiles = profiles.filter((p) => p.url);
    const consistencyScore = computeConsistencyScore(validProfiles, brandName);

    return {
      profiles: validProfiles,
      consistencyScore,
      score: computeSocialAuthorityScore(validProfiles),
    };
  } catch {
    return { profiles: [], consistencyScore: 0, score: 0 };
  }
}

/**
 * Analyze social profiles for a person by checking common platforms.
 */
export async function analyzePersonSocialProfiles(personName: string): Promise<SocialProfileResult> {
  if (!personName || personName.trim().length < 2) {
    return { profiles: [], consistencyScore: 0, score: 0 };
  }

  // For person-level, we rely on data already stored in SocialAccount model
  // (added via the API routes). This analyzer returns empty by default —
  // profiles are populated when users link their social accounts.
  return { profiles: [], consistencyScore: 0, score: 0 };
}

/**
 * Fetch basic public profile info by scraping meta tags from a profile page.
 * Returns null if the profile cannot be reached.
 */
export async function fetchPublicProfile(
  platform: SocialPlatform | string,
  handle: string,
): Promise<{ followers: number | null; verified: boolean } | null> {
  const url = buildProfileUrl(platform, handle);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIVS-Scanner/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    return extractProfileMetrics(html, platform);
  } catch {
    return null;
  }
}

/**
 * Compute social authority score from profile data (0-100).
 *
 * Per account: exists (10) + follower tiers (10/15/15/15) + active/verified (10/10)
 * Aggregate: best 3 platforms, cap at 100.
 */
export function computeSocialAuthorityScore(
  profiles: { platform: string; url: string; verified: boolean; followers?: number | null }[],
): number {
  if (profiles.length === 0) return 0;

  // Score each platform individually
  const platformScores = profiles.map((p) => {
    let score = 0;

    // Account exists
    score += 10;

    // Follower tiers
    const followers = p.followers ?? 0;
    if (followers >= 100) score += 10;
    if (followers >= 1000) score += 15;
    if (followers >= 10000) score += 15;
    if (followers >= 100000) score += 15;

    // Verified badge
    if (p.verified) score += 10;

    return score;
  });

  // Take top 3 platform scores, average them
  const sorted = platformScores.sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3);
  const avgScore = Math.round(top3.reduce((s, v) => s + v, 0) / top3.length);

  // Bonus for presence on multiple platforms
  const diversityBonus = profiles.length >= 3 ? 10 : profiles.length >= 2 ? 5 : 0;

  return Math.min(100, avgScore + diversityBonus);
}

// ── Homepage social link discovery ────────────────────────────────────

interface DiscoveredLink {
  platform: SocialPlatform;
  handle: string;
  url: string;
}

const SOCIAL_URL_PATTERNS: { platform: SocialPlatform; regex: RegExp; handleExtractor: (match: RegExpMatchArray) => string }[] = [
  { platform: 'twitter', regex: /https?:\/\/(?:www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi, handleExtractor: (m) => m[2] },
  { platform: 'linkedin', regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_-]+)/gi, handleExtractor: (m) => m[1] },
  { platform: 'instagram', regex: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/gi, handleExtractor: (m) => m[1] },
  { platform: 'facebook', regex: /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.]+)/gi, handleExtractor: (m) => m[1] },
  { platform: 'tiktok', regex: /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/gi, handleExtractor: (m) => m[1] },
  { platform: 'pinterest', regex: /https?:\/\/(?:www\.)?pinterest\.com\/([a-zA-Z0-9_]+)/gi, handleExtractor: (m) => m[1] },
  { platform: 'youtube', regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)/gi, handleExtractor: (m) => m[1] },
];

// Handles to skip (common false positives from social link patterns)
const SKIP_HANDLES = new Set(['share', 'sharer', 'intent', 'dialog', 'home', 'search', 'explore', 'hashtag', 'about', 'help', 'privacy', 'terms', 'login', 'signup']);

async function discoverSocialLinksFromHomepage(domain: string): Promise<DiscoveredLink[]> {
  try {
    const res = await fetch(`https://${domain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIVS-Scanner/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    return extractSocialLinks(html);
  } catch {
    return [];
  }
}

function extractSocialLinks(html: string): DiscoveredLink[] {
  const links: DiscoveredLink[] = [];
  const seenPlatforms = new Set<string>();

  for (const pattern of SOCIAL_URL_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const handle = pattern.handleExtractor(match);
      if (SKIP_HANDLES.has(handle.toLowerCase())) continue;
      // Take first match per platform (usually the header/footer link)
      if (!seenPlatforms.has(pattern.platform)) {
        seenPlatforms.add(pattern.platform);
        links.push({
          platform: pattern.platform,
          handle,
          url: match[0],
        });
      }
    }
  }

  return links;
}

// ── Profile URL builders ──────────────────────────────────────────────

function buildProfileUrl(platform: string, handle: string): string | null {
  switch (platform) {
    case 'twitter': return `https://x.com/${handle}`;
    case 'linkedin': return `https://www.linkedin.com/company/${handle}`;
    case 'instagram': return `https://www.instagram.com/${handle}/`;
    case 'facebook': return `https://www.facebook.com/${handle}`;
    case 'tiktok': return `https://www.tiktok.com/@${handle}`;
    case 'pinterest': return `https://www.pinterest.com/${handle}/`;
    case 'youtube': return `https://www.youtube.com/@${handle}`;
    default: return null;
  }
}

// ── Meta tag extraction ───────────────────────────────────────────────

function extractProfileMetrics(
  html: string,
  platform: string,
): { followers: number | null; verified: boolean } {
  let followers: number | null = null;
  let verified = false;

  // Try og:description or page description which often contains follower counts
  const descMatch = html.match(/<meta[^>]*(?:property="og:description"|name="description")[^>]*content="([^"]+)"/i);
  if (descMatch) {
    const desc = descMatch[1];
    followers = extractFollowerCount(desc, platform);
  }

  // Try title tag as fallback
  if (followers === null) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      followers = extractFollowerCount(titleMatch[1], platform);
    }
  }

  // Check for verification indicators
  if (html.includes('is_verified') || html.includes('"verified":true') || html.includes('verified-badge')) {
    verified = true;
  }

  return { followers, verified };
}

function extractFollowerCount(text: string, _platform: string): number | null {
  // Common patterns: "1.2M Followers", "15K followers", "1,234 followers"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*[Mm]\s*[Ff]ollow/,  // 1.2M followers
    /(\d+(?:\.\d+)?)\s*[Kk]\s*[Ff]ollow/,   // 15K followers
    /(\d{1,3}(?:,\d{3})*)\s*[Ff]ollow/,      // 1,234 followers
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const num = parseFloat(raw);
      if (text.match(/\d+(?:\.\d+)?\s*[Mm]\s*[Ff]ollow/)) return Math.round(num * 1_000_000);
      if (text.match(/\d+(?:\.\d+)?\s*[Kk]\s*[Ff]ollow/)) return Math.round(num * 1_000);
      return Math.round(num);
    }
  }

  return null;
}

// ── Consistency scoring ───────────────────────────────────────────────

function computeConsistencyScore(
  profiles: { platform: string; url: string }[],
  brandName: string,
): number {
  if (profiles.length === 0) return 0;

  const brandLower = brandName.toLowerCase().replace(/\s+/g, '');
  let matches = 0;

  for (const profile of profiles) {
    // Extract handle from URL and check if it contains the brand name
    const urlLower = profile.url.toLowerCase();
    if (urlLower.includes(brandLower)) matches++;
  }

  return profiles.length > 0 ? Math.round((matches / profiles.length) * 100) : 0;
}

// ── Helpers ───────────────────────────────────────────────────────────

function extractBrandName(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[.-]/g, ' ')
    .trim();
}
