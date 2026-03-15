/**
 * GitHub profile analyzer (individual-level authority signal).
 *
 * Uses GitHub REST API (free, 5K req/hr unauthenticated, 15K with token).
 * Returns candidates for user disambiguation.
 * Score is 0 until the user confirms which profile is theirs.
 */

import { request } from 'undici';
import type { AttributionRecord } from './authority-cache';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubProfileResult {
  candidates: GitHubProfileCandidate[];
  confirmed: AttributionRecord[];
  score: number;
}

export interface GitHubProfileCandidate {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  totalStars: number;
  topRepos: { name: string; stars: number; language: string | null }[];
  avatarUrl: string | null;
  profileUrl: string;
}

export async function analyzeGitHubProfile(personName: string): Promise<GitHubProfileResult> {
  if (!personName || personName.trim().length < 2) {
    return { candidates: [], confirmed: [], score: 0 };
  }

  try {
    // Search for users matching the name
    const candidates = await searchGitHubUsers(personName.trim(), 5);

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
 * Compute GitHub authority score from confirmed profile.
 */
export function computeGitHubAuthorityScore(
  confirmed: AttributionRecord[],
  candidates: GitHubProfileCandidate[],
): number {
  const confirmedIds = new Set(
    confirmed.filter((a) => a.status === 'confirmed').map((a) => a.candidateId),
  );
  const confirmedProfiles = candidates.filter((c) => confirmedIds.has(c.id));
  if (confirmedProfiles.length === 0) return 0;

  const best = confirmedProfiles[0];
  let score = 0;

  // Profile found
  score += 15;

  // Public repos
  if (best.publicRepos >= 10) score += 10;
  if (best.publicRepos >= 50) score += 10;

  // Followers
  if (best.followers >= 100) score += 15;
  if (best.followers >= 1_000) score += 15;

  // Stars
  if (best.totalStars >= 100) score += 15;
  if (best.totalStars >= 1_000) score += 10;

  // Has bio/company (completeness signal)
  if (best.bio || best.company) score += 10;

  return Math.min(100, score);
}

// ── GitHub API helpers ───────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'AIVisibilityScanner/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

async function searchGitHubUsers(name: string, limit: number): Promise<GitHubProfileCandidate[]> {
  try {
    const url = `${GITHUB_API_BASE}/search/users?q=${encodeURIComponent(name)}+type:user&per_page=${limit}`;
    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
      headers: getHeaders(),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      items?: { login: string }[];
    };

    const usernames = (data.items ?? []).map((item) => item.login);

    // Fetch full profiles + top repos in parallel
    const profiles = await Promise.all(
      usernames.map((username) => fetchUserProfile(username)),
    );

    return profiles.filter((p): p is GitHubProfileCandidate => p !== null);
  } catch {
    return [];
  }
}

async function fetchUserProfile(username: string): Promise<GitHubProfileCandidate | null> {
  try {
    const [userRes, reposRes] = await Promise.all([
      request(`${GITHUB_API_BASE}/users/${username}`, {
        signal: AbortSignal.timeout(10_000),
        headers: getHeaders(),
      }),
      request(`${GITHUB_API_BASE}/users/${username}/repos?sort=stars&per_page=5&direction=desc`, {
        signal: AbortSignal.timeout(10_000),
        headers: getHeaders(),
      }),
    ]);

    if (userRes.statusCode !== 200) {
      await userRes.body.dump();
      await reposRes.body.dump();
      return null;
    }

    const user = await userRes.body.json() as {
      login: string;
      name?: string;
      bio?: string;
      company?: string;
      blog?: string;
      location?: string;
      public_repos?: number;
      followers?: number;
      avatar_url?: string;
      html_url: string;
    };

    let topRepos: { name: string; stars: number; language: string | null }[] = [];
    let totalStars = 0;

    if (reposRes.statusCode === 200) {
      const repos = await reposRes.body.json() as {
        name: string;
        stargazers_count?: number;
        language?: string;
      }[];

      topRepos = repos.map((r) => ({
        name: r.name,
        stars: r.stargazers_count ?? 0,
        language: r.language ?? null,
      }));
      totalStars = topRepos.reduce((s, r) => s + r.stars, 0);
    } else {
      await reposRes.body.dump();
    }

    return {
      id: `gh:${user.login}`,
      username: user.login,
      name: user.name ?? null,
      bio: user.bio ?? null,
      company: user.company ?? null,
      blog: user.blog || null,
      location: user.location ?? null,
      publicRepos: user.public_repos ?? 0,
      followers: user.followers ?? 0,
      totalStars,
      topRepos,
      avatarUrl: user.avatar_url ?? null,
      profileUrl: user.html_url,
    };
  } catch {
    return null;
  }
}
