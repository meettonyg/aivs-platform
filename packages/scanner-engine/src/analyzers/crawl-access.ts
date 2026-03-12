/**
 * Crawl access analyzer — robots.txt, SSR detection, TTFB, canonical tags.
 * Ported from aivs_analyze_crawl_access() in scanner-engine.php.
 *
 * Category 1 in the AEO taxonomy.
 */

import type { CheerioAPI } from 'cheerio';

export interface CrawlAccessResult {
  score: number;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  hasMetaRobots: boolean;
  metaRobotsContent: string | null;
  isIndexable: boolean;
  hasHreflang: boolean;
  isHttps: boolean;
  hasCleanUrl: boolean;
  robotsTxt: RobotsTxtResult | null;
  ttfbMs: number | null;
  isSpa: boolean;
}

export interface RobotsTxtResult {
  exists: boolean;
  allowsGooglebot: boolean;
  allowsGptBot: boolean;
  allowsClaudeBot: boolean;
  allowsPerplexityBot: boolean;
  hasSitemap: boolean;
  crawlDelay: number | null;
  raw: string;
}

export function analyzeCrawlAccess(
  $: CheerioAPI,
  url: string,
  robotsTxt?: string,
  ttfbMs?: number,
): CrawlAccessResult {
  const parsedUrl = new URL(url);

  const canonicalUrl = $('link[rel="canonical"]').attr('href') ?? null;
  const hasCanonical = canonicalUrl !== null;

  const metaRobotsContent = $('meta[name="robots"]').attr('content') ?? null;
  const hasMetaRobots = metaRobotsContent !== null;

  let isIndexable = true;
  if (metaRobotsContent) {
    const directives = metaRobotsContent.toLowerCase();
    if (directives.includes('noindex')) isIndexable = false;
  }

  const hasHreflang = $('link[hreflang]').length > 0;
  const isHttps = parsedUrl.protocol === 'https:';

  const hasCleanUrl =
    !parsedUrl.search ||
    parsedUrl.searchParams.toString().split('&').length <= 2;

  const bodyText = $('body').text().trim();
  const isSpa =
    (bodyText.length < 100 && $('script').length > 3) ||
    ($('#root').length > 0 && bodyText.length < 200) ||
    ($('#app').length > 0 && bodyText.length < 200) ||
    $('[data-reactroot]').length > 0;

  let robotsTxtResult: RobotsTxtResult | null = null;
  if (robotsTxt !== undefined) {
    robotsTxtResult = parseRobotsTxt(robotsTxt);
  }

  let score = 0;

  if (isHttps) score += 15;
  if (hasCanonical) score += 15;
  if (isIndexable) score += 15;
  if (hasCleanUrl) score += 10;
  if (hasHreflang) score += 5;
  if (!isSpa) score += 10;

  if (robotsTxtResult) {
    if (robotsTxtResult.exists) score += 5;
    if (robotsTxtResult.allowsGooglebot) score += 5;
    if (robotsTxtResult.allowsGptBot) score += 5;
    if (robotsTxtResult.allowsClaudeBot) score += 5;
  }

  if (ttfbMs !== undefined && ttfbMs !== null) {
    if (ttfbMs < 200) score += 10;
    else if (ttfbMs < 500) score += 7;
    else if (ttfbMs < 1000) score += 3;
  }

  return {
    score: Math.min(100, score),
    hasCanonical,
    canonicalUrl,
    hasMetaRobots,
    metaRobotsContent,
    isIndexable,
    hasHreflang,
    isHttps,
    hasCleanUrl,
    robotsTxt: robotsTxtResult,
    ttfbMs: ttfbMs ?? null,
    isSpa,
  };
}

function parseRobotsTxt(raw: string): RobotsTxtResult {
  if (!raw || raw.trim().length === 0) {
    return {
      exists: false,
      allowsGooglebot: true,
      allowsGptBot: true,
      allowsClaudeBot: true,
      allowsPerplexityBot: true,
      hasSitemap: false,
      crawlDelay: null,
      raw: '',
    };
  }

  const lines = raw.split('\n').map((l) => l.trim());
  const hasSitemap = lines.some((l) => /^sitemap:/i.test(l));

  let crawlDelay: number | null = null;
  const delayMatch = raw.match(/^crawl-delay:\s*(\d+)/im);
  if (delayMatch) crawlDelay = parseInt(delayMatch[1], 10);

  return {
    exists: true,
    allowsGooglebot: isBotAllowed(lines, 'Googlebot'),
    allowsGptBot: isBotAllowed(lines, 'GPTBot'),
    allowsClaudeBot: isBotAllowed(lines, 'ClaudeBot'),
    allowsPerplexityBot: isBotAllowed(lines, 'PerplexityBot'),
    hasSitemap,
    crawlDelay,
    raw,
  };
}

function isBotAllowed(lines: string[], botName: string): boolean {
  let inSection = false;
  let allowed = true;

  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.replace(/^user-agent:\s*/i, '').trim();
      inSection = agent === '*' || agent.toLowerCase() === botName.toLowerCase();
    } else if (inSection) {
      if (/^disallow:\s*\/$/i.test(line)) {
        allowed = false;
      } else if (/^allow:\s*\/$/i.test(line)) {
        allowed = true;
      }
    }
  }

  return allowed;
}
