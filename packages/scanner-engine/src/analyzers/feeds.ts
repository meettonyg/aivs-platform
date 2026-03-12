/**
 * Feed analyzer — RSS/Atom, llms.txt, llms-full.json, sitemap detection.
 * Ported from aivs_analyze_feeds() in scanner-engine.php.
 *
 * Category 1 (1.10, 1.16, 1.17) in the AEO taxonomy.
 */

import type { CheerioAPI } from 'cheerio';

export interface FeedResult {
  score: number;
  hasRss: boolean;
  hasAtom: boolean;
  hasSitemap: boolean;
  hasLlmsTxt: boolean;
  hasManifest: boolean;
  feedUrls: string[];
  sitemapUrls: string[];
}

export function analyzeFeeds(
  $: CheerioAPI,
  url: string,
  robotsTxt?: string,
): FeedResult {
  const feedUrls: string[] = [];
  const sitemapUrls: string[] = [];

  let hasRss = false;
  let hasAtom = false;
  let hasManifest = false;
  let hasSitemap = false;
  let hasLlmsTxt = false;

  $('link[type="application/rss+xml"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hasRss = true;
      feedUrls.push(resolveUrl(href, url));
    }
  });

  $('link[type="application/atom+xml"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hasAtom = true;
      feedUrls.push(resolveUrl(href, url));
    }
  });

  $('a[href*="sitemap"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /sitemap.*\.xml/i.test(href)) {
      hasSitemap = true;
      sitemapUrls.push(resolveUrl(href, url));
    }
  });

  if (robotsTxt) {
    const sitemapMatches = robotsTxt.match(/^Sitemap:\s*(.+)$/gim);
    if (sitemapMatches) {
      hasSitemap = true;
      for (const line of sitemapMatches) {
        const sitemapUrl = line.replace(/^Sitemap:\s*/i, '').trim();
        if (sitemapUrl) sitemapUrls.push(sitemapUrl);
      }
    }
  }

  if ($('link[rel="manifest"]').length > 0) {
    hasManifest = true;
  }

  $('link[href*="llms.txt"], link[href*="llms-full"], a[href*="llms.txt"]').each(() => {
    hasLlmsTxt = true;
  });

  let score = 0;
  if (hasRss || hasAtom) score += 25;
  if (hasSitemap) score += 30;
  if (hasManifest) score += 10;
  if (hasLlmsTxt) score += 25;
  if (hasRss && hasAtom) score += 5;
  if (feedUrls.length >= 2) score += 5;

  return {
    score: Math.min(100, score),
    hasRss,
    hasAtom,
    hasSitemap,
    hasLlmsTxt,
    hasManifest,
    feedUrls: [...new Set(feedUrls)],
    sitemapUrls: [...new Set(sitemapUrls)],
  };
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}
