/**
 * Author & E-E-A-T analyzer — comprehensive trust signals.
 * Factors 5.1–5.5, 5.7, 5.9, 5.10, 5.12 in the AEO taxonomy.
 *
 * 5.1  Named Author Presence
 * 5.2  Author Bio & Credentials
 * 5.3  Dedicated Author Pages
 * 5.4  First-Hand Experience Signals
 * 5.5  Demonstrable Expertise
 * 5.7  Trust Elements on Site
 * 5.9  Primary-Source Citations
 * 5.10 Original Research / Proprietary Data
 * 5.12 Freshness / dateModified
 */

import type { CheerioAPI } from 'cheerio';

export interface AuthorEeatResult {
  score: number;
  // 5.1 Named Author
  hasNamedAuthor: boolean;
  authorName: string | null;
  // 5.2 Author Bio & Credentials
  hasAuthorBio: boolean;
  hasAuthorCredentials: boolean;
  // 5.3 Dedicated Author Pages
  hasAuthorPage: boolean;
  authorPageUrl: string | null;
  // 5.4 First-Hand Experience
  hasFirstHandExperience: boolean;
  experienceSignals: string[];
  // 5.5 Demonstrable Expertise
  hasExpertiseSignals: boolean;
  // 5.7 Trust Elements
  hasTrustPages: { privacy: boolean; terms: boolean; contact: boolean; about: boolean };
  // 5.9 Primary-Source Citations
  hasPrimarySourceCitations: boolean;
  citationCount: number;
  authorityDomainLinks: string[];
  // 5.10 Original Research
  hasOriginalResearch: boolean;
  // 5.12 Freshness
  hasDateModified: boolean;
  dateModified: string | null;
  isFresh: boolean;
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

  // 5.3 Dedicated author page detection
  let hasAuthorPage = false;
  let authorPageUrl: string | null = null;
  if (authorName) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (/\/(author|team|people|staff|about)\//i.test(href)) {
        const linkText = $(el).text().trim();
        if (linkText && authorName && linkText.toLowerCase().includes(authorName.toLowerCase().split(' ')[0])) {
          hasAuthorPage = true;
          try {
            authorPageUrl = new URL(href, url).toString();
          } catch {
            authorPageUrl = href;
          }
          return false; // break
        }
      }
    });
  }

  // 5.4 First-hand experience signals
  const bodyText = $('article, [role="main"], main, .content, .entry-content, .post-content').text()
    || $('body').text();
  const experienceSignals: string[] = [];
  const EXPERIENCE_PATTERNS: [RegExp, string][] = [
    [/\b(I|we)\s+(tested|tried|used|built|created|developed|implemented|measured|analyzed|reviewed)\b/gi, 'first-person action'],
    [/\b(in my|in our|from my|from our)\s+(experience|testing|research|analysis|work)\b/gi, 'personal experience'],
    [/\b(our team|our company|our organization)\b/gi, 'team reference'],
    [/\b(hands-on|firsthand|first-hand|real-world)\s+(experience|testing|test|results?)\b/gi, 'hands-on reference'],
    [/\b(case study|case studies|client result|customer result)\b/gi, 'case study'],
    [/\b(screenshot|photo|video)\s+(of|from|showing)\b/gi, 'evidence documentation'],
  ];
  for (const [pattern, signal] of EXPERIENCE_PATTERNS) {
    if (pattern.test(bodyText)) experienceSignals.push(signal);
  }
  const hasFirstHandExperience = experienceSignals.length >= 2;

  // 5.5 Demonstrable expertise signals
  const hasExpertiseSignals = hasAuthorCredentials || hasAuthorBio || (
    /\b(methodology|framework|proprietary|patent|peer-reviewed|published)\b/i.test(bodyText)
  );

  // 5.10 Original research / proprietary data
  const hasOriginalResearch = detectOriginalResearch($, bodyText);

  // Scoring (rebalanced for 10 factors)
  let score = 0;

  // 5.1 Named author (15 pts)
  if (authorName) score += 15;

  // 5.2 Author bio + credentials (12 pts)
  if (hasAuthorBio) score += 7;
  if (hasAuthorCredentials) score += 5;

  // 5.3 Dedicated author page (5 pts)
  if (hasAuthorPage) score += 5;

  // 5.4 First-hand experience (10 pts)
  if (experienceSignals.length >= 1) score += 5;
  if (experienceSignals.length >= 3) score += 5;

  // 5.5 Demonstrable expertise (5 pts)
  if (hasExpertiseSignals) score += 5;

  // 5.7 Trust pages (15 pts)
  const trustCount = Object.values(hasTrustPages).filter(Boolean).length;
  score += Math.min(trustCount * 4, 15);

  // 5.9 Primary-source citations (15 pts)
  if (uniqueAuthorityLinks.length >= 1) score += 6;
  if (uniqueAuthorityLinks.length >= 3) score += 5;
  if (uniqueAuthorityLinks.length >= 5) score += 4;

  // 5.10 Original research (8 pts)
  if (hasOriginalResearch) score += 8;

  // 5.12 Date freshness (10 pts)
  if (dateModified) score += 4;
  if (isFresh) score += 6;

  return {
    score: Math.min(100, score),
    hasNamedAuthor: !!authorName,
    authorName,
    hasAuthorBio,
    hasAuthorCredentials,
    hasAuthorPage,
    authorPageUrl,
    hasFirstHandExperience,
    experienceSignals,
    hasExpertiseSignals,
    hasTrustPages,
    hasPrimarySourceCitations: uniqueAuthorityLinks.length > 0,
    citationCount: uniqueAuthorityLinks.length,
    authorityDomainLinks: uniqueAuthorityLinks,
    hasOriginalResearch,
    hasDateModified: !!dateModified,
    dateModified,
    isFresh,
  };
}

/**
 * Detect original research / proprietary data signals.
 * Looks for: data tables, charts/graphs, survey results, unique datasets.
 */
function detectOriginalResearch($: CheerioAPI, bodyText: string): boolean {
  // Has data tables with meaningful data
  const tables = $('table');
  const hasDataTables = tables.length > 0 && tables.find('td').length >= 6;

  // Has charts/graphs (canvas, svg, chart libraries)
  const hasCharts = $('canvas, svg.chart, [class*="chart"], [class*="graph"], [data-chart]').length > 0;

  // Has survey/study language
  const hasStudyLanguage = /\b(our (study|survey|research|data|findings|analysis)|we (found|discovered|measured|surveyed|analyzed)|n\s*=\s*\d+|sample size|respondents?|participants?)\b/i.test(bodyText);

  // Has proprietary data references
  const hasProprietaryData = /\b(proprietary|exclusive|original|internal)\s+(data|research|study|analysis|findings)\b/i.test(bodyText);

  return hasDataTables || hasCharts || hasStudyLanguage || hasProprietaryData;
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
