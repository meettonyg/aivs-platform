/**
 * Content richness analyzer — statistics, citations, front-loaded answers, question density.
 * Ported from aivs_analyze_content_richness() in scanner-engine.php.
 *
 * Categories 3, 5 in the AEO taxonomy.
 */

import type { CheerioAPI } from 'cheerio';

export interface ContentRichnessResult {
  score: number;
  hasStatistics: boolean;
  statisticCount: number;
  hasCitations: boolean;
  citationCount: number;
  externalLinkCount: number;
  hasImages: boolean;
  imageCount: number;
  imagesWithAlt: number;
  hasVideo: boolean;
  hasFreshDate: boolean;
  dateModified: string | null;
  hasAuthor: boolean;
  authorName: string | null;
  hasTrustElements: boolean;
}

const STAT_PATTERNS = [
  /\d+(\.\d+)?%/,
  /\$[\d,]+(\.\d+)?/,
  /\d{1,3}(,\d{3})+/,
  /\d+(\.\d+)?\s*(million|billion|trillion)/i,
  /\d+x\s/,
  /(study|research|survey|report|data)\s+(shows?|finds?|found|reveals?|indicates?)/i,
  /according to/i,
];

export function analyzeContentRichness($: CheerioAPI, url: string): ContentRichnessResult {
  const mainContent = $('main, article, [role="main"], .content, #content');
  const container = mainContent.length > 0 ? mainContent.first() : $('body');

  const bodyText = container.text().replace(/\s+/g, ' ').trim();

  let statisticCount = 0;
  for (const pattern of STAT_PATTERNS) {
    const matches = bodyText.match(new RegExp(pattern.source, 'gi'));
    if (matches) statisticCount += matches.length;
  }
  const hasStatistics = statisticCount > 0;

  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  let externalLinkCount = 0;
  const citationDomains = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname !== hostname && linkUrl.protocol.startsWith('http')) {
        externalLinkCount++;
        citationDomains.add(linkUrl.hostname);
      }
    } catch {
      // skip
    }
  });

  const citationCount = citationDomains.size;
  const hasCitations = citationCount > 0;

  const images = $('img');
  const imageCount = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt')?.trim();
    if (alt && alt.length > 5) imagesWithAlt++;
  });
  const hasImages = imageCount > 0;

  const hasVideo =
    $('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]').length > 0;

  let dateModified: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const record = item as Record<string, unknown>;
        if (record['dateModified']) {
          dateModified = String(record['dateModified']);
        } else if (record['datePublished'] && !dateModified) {
          dateModified = String(record['datePublished']);
        }
      }
    } catch {
      // skip
    }
  });
  if (!dateModified) {
    const timeMeta = $('meta[property="article:modified_time"]').attr('content')
      ?? $('meta[property="article:published_time"]').attr('content')
      ?? $('time[datetime]').first().attr('datetime');
    if (timeMeta) dateModified = timeMeta;
  }

  const hasFreshDate = !!dateModified && isRecent(dateModified, 180);

  let authorName: string | null = null;
  const authorEl = $('[rel="author"], .author, .byline, [class*="author-name"]');
  if (authorEl.length > 0) {
    authorName = authorEl.first().text().trim() || null;
  }
  if (!authorName) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).text().trim());
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const record = item as Record<string, unknown>;
          if (record['author'] && typeof record['author'] === 'object') {
            const author = record['author'] as Record<string, unknown>;
            if (author['name']) authorName = String(author['name']);
          }
        }
      } catch {
        // skip
      }
    });
  }
  const hasAuthor = authorName !== null && authorName.length > 0;

  const hasTrustElements =
    $('a[href*="privacy"], a[href*="terms"], a[href*="contact"]').length >= 2;

  let score = 0;

  if (hasStatistics) score += 10;
  if (statisticCount >= 3) score += 5;
  if (statisticCount >= 5) score += 5;

  if (hasCitations) score += 10;
  if (citationCount >= 3) score += 5;
  if (citationCount >= 5) score += 5;

  if (hasImages) score += 5;
  if (imageCount >= 2) score += 5;
  if (imagesWithAlt > 0 && imagesWithAlt >= imageCount * 0.8) score += 5;

  if (hasVideo) score += 5;

  if (dateModified) score += 5;
  if (hasFreshDate) score += 10;

  if (hasAuthor) score += 15;

  if (hasTrustElements) score += 10;

  return {
    score: Math.min(100, score),
    hasStatistics,
    statisticCount,
    hasCitations,
    citationCount,
    externalLinkCount,
    hasImages,
    imageCount,
    imagesWithAlt,
    hasVideo,
    hasFreshDate,
    dateModified,
    hasAuthor,
    authorName,
    hasTrustElements,
  };
}

function isRecent(dateStr: string, days: number): boolean {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff < days * 24 * 60 * 60 * 1000 && diff > 0;
  } catch {
    return false;
  }
}
