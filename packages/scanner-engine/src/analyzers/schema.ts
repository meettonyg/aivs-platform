/**
 * Schema analyzer — JSON-LD, Microdata, RDFa parsing.
 * Ported from aivs_analyze_schema() in scanner-engine.php.
 *
 * Detects structured data types and scores based on variety and correctness.
 * Category 2 in the AEO taxonomy (2.1-2.16).
 */

import type { CheerioAPI } from 'cheerio';

export interface SchemaResult {
  score: number;
  types: string[];
  jsonLdObjects: Record<string, unknown>[];
  hasMicrodata: boolean;
  hasRdfa: boolean;
  details: {
    faqPage: boolean;
    howTo: boolean;
    product: boolean;
    review: boolean;
    localBusiness: boolean;
    article: boolean;
    organization: boolean;
    person: boolean;
    breadcrumb: boolean;
    event: boolean;
    webSite: boolean;
    speakable: boolean;
  };
}

const VALUABLE_TYPES = [
  'FAQPage', 'HowTo', 'Product', 'Review', 'AggregateRating',
  'LocalBusiness', 'Article', 'NewsArticle', 'BlogPosting',
  'Organization', 'Person', 'BreadcrumbList', 'Event',
  'WebSite', 'WebPage', 'ItemList', 'Recipe', 'Course',
  'VideoObject', 'SoftwareApplication',
];

export function analyzeSchema($: CheerioAPI): SchemaResult {
  const jsonLdObjects: Record<string, unknown>[] = [];
  const types = new Set<string>();

  // Parse JSON-LD blocks
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text().trim();
      if (!text) return;
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item && typeof item === 'object') {
          jsonLdObjects.push(item as Record<string, unknown>);
          extractTypes(item, types);
        }
      }
    } catch {
      // Invalid JSON-LD — skip
    }
  });

  // Detect Microdata
  const hasMicrodata = $('[itemscope]').length > 0;
  if (hasMicrodata) {
    $('[itemtype]').each((_, el) => {
      const itemType = $(el).attr('itemtype') ?? '';
      const match = itemType.match(/schema\.org\/(\w+)/);
      if (match) types.add(match[1]);
    });
  }

  // Detect RDFa
  const hasRdfa = $('[typeof]').length > 0;
  if (hasRdfa) {
    $('[typeof]').each((_, el) => {
      const typeOf = $(el).attr('typeof') ?? '';
      typeOf.split(/\s+/).forEach((t) => {
        const clean = t.replace(/^schema:/, '');
        if (clean) types.add(clean);
      });
    });
  }

  const typeArray = Array.from(types);

  const hasType = (patterns: string[]) =>
    typeArray.some((t) => patterns.some((p) => t.toLowerCase().includes(p.toLowerCase())));

  const details = {
    faqPage: hasType(['FAQPage']),
    howTo: hasType(['HowTo']),
    product: hasType(['Product']),
    review: hasType(['Review', 'AggregateRating']),
    localBusiness: hasType(['LocalBusiness']),
    article: hasType(['Article', 'NewsArticle', 'BlogPosting']),
    organization: hasType(['Organization']),
    person: hasType(['Person']),
    breadcrumb: hasType(['BreadcrumbList']),
    event: hasType(['Event']),
    webSite: hasType(['WebSite', 'WebPage']),
    speakable: hasSpeakable(jsonLdObjects, $),
  };

  // Scoring: base on type variety and valuable types present
  const valuableCount = typeArray.filter((t) =>
    VALUABLE_TYPES.some((v) => t.toLowerCase() === v.toLowerCase()),
  ).length;

  let score = 0;
  if (typeArray.length > 0) score += 20;
  if (typeArray.length >= 3) score += 15;
  score += Math.min(valuableCount * 10, 40);
  if (details.speakable) score += 10;
  if (jsonLdObjects.length > 0) score += 5;
  if (jsonLdObjects.length > 0 && hasMicrodata) score += 5;
  if (details.breadcrumb) score += 5;

  return {
    score: Math.min(100, score),
    types: typeArray,
    jsonLdObjects,
    hasMicrodata,
    hasRdfa,
    details,
  };
}

function extractTypes(obj: unknown, types: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;

  if (typeof record['@type'] === 'string') {
    types.add(record['@type']);
  } else if (Array.isArray(record['@type'])) {
    for (const t of record['@type']) {
      if (typeof t === 'string') types.add(t);
    }
  }

  if (Array.isArray(record['@graph'])) {
    for (const item of record['@graph']) {
      extractTypes(item, types);
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      extractTypes(value, types);
    }
  }
}

function hasSpeakable(jsonLdObjects: Record<string, unknown>[], $: CheerioAPI): boolean {
  for (const obj of jsonLdObjects) {
    if (findProperty(obj, 'speakable')) return true;
  }
  if ($('meta[name="speakable"]').length > 0) return true;
  return false;
}

function findProperty(obj: unknown, prop: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  if (prop in record) return true;
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      if (findProperty(value, prop)) return true;
    }
  }
  return false;
}
