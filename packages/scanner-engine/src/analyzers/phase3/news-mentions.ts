/**
 * News/Media Mentions analyzer (org-level authority signal).
 *
 * Uses the GDELT DOC 2.0 API (free, unlimited, no key required).
 * Searches for domain mentions in global news coverage.
 *
 * Wires into the existing BrandMentionResult placeholder in authority-cache.ts.
 */

import type { BrandMentionResult } from './authority-cache';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  sourcecountry: string;
  language: string;
  tone: number; // negative = negative, positive = positive
}

interface GdeltTimelinePoint {
  date: string;
  value: number;
}

/**
 * Search GDELT for news articles mentioning a domain/brand.
 */
export async function analyzeNewsMentions(domain: string): Promise<BrandMentionResult> {
  const brandName = extractBrandName(domain);
  if (!brandName || brandName.length < 2) {
    return { mentionCount: 0, sentimentScore: 0, topSources: [], score: 0 };
  }

  try {
    // Search for articles mentioning the brand in the last 3 months
    const [articles, timeline] = await Promise.all([
      fetchGdeltArticles(brandName, domain),
      fetchGdeltTimeline(brandName, domain),
    ]);

    if (articles.length === 0 && timeline.length === 0) {
      return { mentionCount: 0, sentimentScore: 0, topSources: [], score: 0 };
    }

    // Count mentions from timeline (more accurate than article count)
    const mentionCount = timeline.length > 0
      ? timeline.reduce((sum, p) => sum + p.value, 0)
      : articles.length;

    // Compute average sentiment from article tones (-100 to +100 → normalize to -1 to 1)
    const sentimentScore = articles.length > 0
      ? Math.max(-1, Math.min(1, articles.reduce((sum, a) => sum + a.tone, 0) / articles.length / 100))
      : 0;

    // Extract unique top sources (by domain), deduplicated
    const sourceCounts = new Map<string, number>();
    for (const article of articles) {
      const src = article.domain?.toLowerCase();
      if (src && src !== domain.toLowerCase()) {
        sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
      }
    }
    const topSources = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([src]) => src);

    const score = computeNewsMentionsScore(mentionCount, topSources.length, sentimentScore, articles);

    return { mentionCount, sentimentScore, topSources, score };
  } catch {
    return { mentionCount: 0, sentimentScore: 0, topSources: [], score: 0 };
  }
}

// ── GDELT API helpers ─────────────────────────────────────────────────

async function fetchGdeltArticles(brand: string, domain: string): Promise<GdeltArticle[]> {
  const query = encodeURIComponent(`"${brand}" OR "${domain}"`);
  const url = `${GDELT_DOC_API}?query=${query}&mode=ArtList&maxrecords=75&timespan=3months&format=json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'AIVS-Scanner/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const data = await res.json() as { articles?: GdeltArticle[] };
  return data.articles ?? [];
}

async function fetchGdeltTimeline(brand: string, domain: string): Promise<GdeltTimelinePoint[]> {
  const query = encodeURIComponent(`"${brand}" OR "${domain}"`);
  const url = `${GDELT_DOC_API}?query=${query}&mode=TimelineVolInfo&timespan=3months&format=json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'AIVS-Scanner/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const data = await res.json() as { timeline?: { data?: GdeltTimelinePoint[] }[] };
  return data.timeline?.[0]?.data ?? [];
}

// ── Scoring ───────────────────────────────────────────────────────────

const MAJOR_OUTLETS = new Set([
  'nytimes.com', 'washingtonpost.com', 'bbc.com', 'bbc.co.uk', 'reuters.com',
  'apnews.com', 'theguardian.com', 'cnn.com', 'forbes.com', 'bloomberg.com',
  'wsj.com', 'techcrunch.com', 'wired.com', 'arstechnica.com', 'theverge.com',
  'cnbc.com', 'ft.com', 'economist.com', 'time.com', 'newsweek.com',
  'usatoday.com', 'latimes.com', 'npr.org', 'abcnews.go.com', 'nbcnews.com',
  'cbsnews.com', 'foxnews.com', 'politico.com', 'axios.com', 'businessinsider.com',
]);

/**
 * Score news mentions authority (0-100).
 *
 * - Mentioned at all: 15
 * - Volume: 10+ mentions (15), 50+ (15)
 * - Source diversity: 3+ sources (15), 10+ sources (10)
 * - Sentiment positive (>0.1): 15
 * - Major outlet coverage: 15
 */
function computeNewsMentionsScore(
  mentionCount: number,
  sourceDiversity: number,
  sentiment: number,
  articles: GdeltArticle[],
): number {
  let score = 0;

  // Has mentions
  if (mentionCount >= 1) score += 15;

  // Volume tiers
  if (mentionCount >= 10) score += 15;
  if (mentionCount >= 50) score += 15;

  // Source diversity
  if (sourceDiversity >= 3) score += 15;
  if (sourceDiversity >= 10) score += 10;

  // Positive sentiment
  if (sentiment > 0.1) score += 15;

  // Major outlet coverage
  const hasMajorOutlet = articles.some((a) =>
    MAJOR_OUTLETS.has(a.domain?.toLowerCase()),
  );
  if (hasMajorOutlet) score += 15;

  return Math.min(100, score);
}

// ── Helpers ───────────────────────────────────────────────────────────

function extractBrandName(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[.-]/g, ' ')
    .trim();
}
