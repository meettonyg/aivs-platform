/**
 * Author & E-E-A-T analyzer — named author presence, credentials, bio detection.
 * Factors 5.1, 5.2, 5.7, 5.9, 5.12 in the AEO taxonomy.
 */

import type { CheerioAPI } from 'cheerio';

export interface AuthorEeatResult {
  score: number;
  hasNamedAuthor: boolean;
  authorName: string | null;
  hasAuthorBio: boolean;
  hasAuthorCredentials: boolean;
  hasDateModified: boolean;
  dateModified: string | null;
  isFresh: boolean;
  hasTrustPages: { privacy: boolean; terms: boolean; contact: boolean; about: boolean };
  hasPrimarySourceCitations: boolean;
  citationCount: number;
  authorityDomainLinks: string[];
}

const AUTHORITY_DOMAINS = [
  'wikipedia.org', 'gov', 'edu', 'who.int', 'nih.gov', 'cdc.gov',
  'nature.com', 'sciencedirect.com', 'pubmed', 'ncbi.nlm.nih.gov',
  'reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com',
  'wsj.com', 'forbes.com', 'harvard.edu', 'mit.edu', 'stanford.edu',
];

const CREDENTIAL_PATTERNS = [
  /\b(ph\.?d|m\.?d|m\.?s|m\.?b\.?a|j\.?d|cpa|cfa|rn)\b/i,
  /\b(professor|doctor|dr\.|certified|licensed|registered)\b/i,
  /\b(expert|specialist|consultant|analyst|researcher)\b/i,
  /\b(\d+\+?\s+years?\s+(of\s+)?experience)\b/i,
];

export function analyzeAuthorEeat($: CheerioAPI, url: string): AuthorEeatResult {
  // Author detection
  let authorName: string | null = null;
  let hasAuthorBio = false;
  let hasAuthorCredentials = false;

  // Check schema for author
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const record = item as Record<string, unknown>;
        if (record['author'] && typeof record['author'] === 'object') {
          const author = record['author'] as Record<string, unknown>;
          if (author['name']) authorName = String(author['name']);
          if (author['description']) hasAuthorBio = true;
          if (author['jobTitle'] || author['knowsAbout']) hasAuthorCredentials = true;
        }
        if (Array.isArray(record['@graph'])) {
          for (const g of record['@graph'] as Record<string, unknown>[]) {
            if (g['@type'] === 'Person' && g['name']) {
              authorName = String(g['name']);
              if (g['description']) hasAuthorBio = true;
              if (g['jobTitle'] || g['knowsAbout']) hasAuthorCredentials = true;
            }
          }
        }
      }
    } catch { /* skip */ }
  });

  // HTML-based author detection
  if (!authorName) {
    const authorEl = $('[rel="author"], .author-name, .byline a, [class*="author"] a, [itemprop="author"]');
    if (authorEl.length > 0) {
      authorName = authorEl.first().text().trim() || null;
    }
  }

  // Author bio detection
  if (!hasAuthorBio) {
    const bioEl = $('.author-bio, .about-author, [class*="author-description"], [class*="author-info"]');
    if (bioEl.length > 0 && bioEl.text().trim().length > 50) {
      hasAuthorBio = true;
    }
  }

  // Credentials detection in author section
  if (!hasAuthorCredentials && authorName) {
    const authorSection = $('[class*="author"]').text();
    hasAuthorCredentials = CREDENTIAL_PATTERNS.some((p) => p.test(authorSection));
  }

  // Date freshness
  let dateModified: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const r = item as Record<string, unknown>;
        if (r['dateModified']) dateModified = String(r['dateModified']);
        else if (r['datePublished'] && !dateModified) dateModified = String(r['datePublished']);
      }
    } catch { /* skip */ }
  });
  if (!dateModified) {
    dateModified = $('meta[property="article:modified_time"]').attr('content')
      ?? $('meta[property="article:published_time"]').attr('content')
      ?? $('time[datetime]').first().attr('datetime')
      ?? null;
  }

  const isFresh = !!dateModified && isRecent(dateModified, 180);

  // Trust pages
  const allLinks = $('a[href]').toArray().map((el) => $(el).attr('href') ?? '').join(' ').toLowerCase();
  const hasTrustPages = {
    privacy: allLinks.includes('privacy'),
    terms: allLinks.includes('terms') || allLinks.includes('tos'),
    contact: allLinks.includes('contact'),
    about: allLinks.includes('about'),
  };

  // Primary-source citations (outbound links to authoritative domains)
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  const authorityDomainLinks: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname !== hostname && linkUrl.protocol.startsWith('http')) {
        if (AUTHORITY_DOMAINS.some((d) => linkUrl.hostname.includes(d))) {
          authorityDomainLinks.push(linkUrl.hostname);
        }
      }
    } catch { /* skip */ }
  });

  const uniqueAuthorityLinks = [...new Set(authorityDomainLinks)];

  // Scoring
  let score = 0;

  // Named author (20 pts)
  if (authorName) score += 20;

  // Author bio (15 pts)
  if (hasAuthorBio) score += 15;

  // Credentials (10 pts)
  if (hasAuthorCredentials) score += 10;

  // Date freshness (15 pts)
  if (dateModified) score += 5;
  if (isFresh) score += 10;

  // Trust pages (20 pts)
  const trustCount = Object.values(hasTrustPages).filter(Boolean).length;
  score += Math.min(trustCount * 5, 20);

  // Primary-source citations (20 pts)
  if (uniqueAuthorityLinks.length >= 1) score += 8;
  if (uniqueAuthorityLinks.length >= 3) score += 7;
  if (uniqueAuthorityLinks.length >= 5) score += 5;

  return {
    score: Math.min(100, score),
    hasNamedAuthor: !!authorName,
    authorName,
    hasAuthorBio,
    hasAuthorCredentials,
    hasDateModified: !!dateModified,
    dateModified,
    isFresh,
    hasTrustPages,
    hasPrimarySourceCitations: uniqueAuthorityLinks.length > 0,
    citationCount: uniqueAuthorityLinks.length,
    authorityDomainLinks: uniqueAuthorityLinks,
  };
}

function isRecent(dateStr: string, days: number): boolean {
  try {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    return diff > 0 && diff < days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
