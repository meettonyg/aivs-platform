/**
 * Entity analyzer — named entity extraction, type quality, disambiguation.
 * Ported from aivs_analyze_entities() in scanner-engine.php.
 *
 * Category 4 in the AEO taxonomy:
 * 4.1  Entity Density
 * 4.2  Entity Type Quality
 * 4.3  Entity Disambiguation (sameAs, KG links)
 * 4.10 Brand Entity Signals
 */

import type { CheerioAPI } from 'cheerio';

export interface EntityResult {
  score: number;
  entityDensity: number;
  uniqueEntities: string[];
  entityCount: number;
  properNouns: string[];
  hasAuthorEntity: boolean;
  hasOrgEntity: boolean;
  // 4.2 Entity Type Quality
  typedEntities: TypedEntity[];
  entityTypeVariety: number;
  // 4.3 Entity Disambiguation
  hasSameAsLinks: boolean;
  sameAsUrls: string[];
  hasWikipediaLinks: boolean;
  disambiguationScore: number;
  // 4.10 Brand Entity Signals
  brandConsistency: number;
  brandName: string | null;
}

export interface TypedEntity {
  name: string;
  type: 'Person' | 'Organization' | 'Place' | 'Product' | 'Event' | 'CreativeWork' | 'Unknown';
  source: 'schema' | 'microdata' | 'heuristic';
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'but', 'and', 'or', 'nor', 'not', 'so', 'yet',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'we', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his', 'i', 'me', 'my',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'if', 'then', 'else', 'when', 'up', 'down', 'out', 'off', 'over',
  'under', 'again', 'further', 'once', 'here', 'there', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
  'how', 'what', 'which', 'who', 'whom', 'why', 'where',
]);

export function analyzeEntities($: CheerioAPI): EntityResult {
  const mainContent = $('main, article, [role="main"], .content, #content');
  const container = mainContent.length > 0 ? mainContent.first() : $('body');

  const clone = container.clone();
  clone.find('script, style, nav, footer, header').remove();
  const bodyText = clone.text().replace(/\s+/g, ' ').trim();
  const words = bodyText.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  const properNouns = new Set<string>();
  const sentences = bodyText.split(/[.!?]+/);

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean);
    for (let i = 1; i < sentenceWords.length; i++) {
      const word = sentenceWords[i];
      if (/^[A-Z][a-z]+/.test(word) && !STOP_WORDS.has(word.toLowerCase())) {
        properNouns.add(word);
      }
    }
  }

  const multiWordEntities = new Set<string>();
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean);
    let currentEntity: string[] = [];

    for (let i = 1; i < sentenceWords.length; i++) {
      const word = sentenceWords[i];
      if (/^[A-Z][a-z]+/.test(word) && !STOP_WORDS.has(word.toLowerCase())) {
        currentEntity.push(word);
      } else {
        if (currentEntity.length >= 2) {
          multiWordEntities.add(currentEntity.join(' '));
        }
        currentEntity = [];
      }
    }
    if (currentEntity.length >= 2) {
      multiWordEntities.add(currentEntity.join(' '));
    }
  }

  const allEntities = new Set([...properNouns, ...multiWordEntities]);
  const entityCount = allEntities.size;
  const entityDensity = totalWords > 0 ? (entityCount / totalWords) * 100 : 0;

  let hasAuthorEntity = false;
  if ($('[rel="author"], .author, .byline, [class*="author"]').length > 0) {
    hasAuthorEntity = true;
  }

  let hasOrgEntity = false;

  // 4.2 Entity Type Quality — extract typed entities from schema
  const typedEntities: TypedEntity[] = [];
  const sameAsUrls: string[] = [];
  let brandName: string | null = null as string | null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        extractTypedEntities(item as Record<string, unknown>, typedEntities, sameAsUrls);
        const record = item as Record<string, unknown>;
        if (record['@type'] === 'Organization' || record['@type'] === 'Corporation') {
          hasOrgEntity = true;
          if (record['name'] && typeof record['name'] === 'string') {
            brandName = record['name'] as string;
          }
        }
        // Check @graph
        if (Array.isArray(record['@graph'])) {
          for (const g of record['@graph'] as Record<string, unknown>[]) {
            extractTypedEntities(g, typedEntities, sameAsUrls);
            if (g['@type'] === 'Organization' || g['@type'] === 'Corporation') {
              hasOrgEntity = true;
              if (g['name'] && typeof g['name'] === 'string' && !brandName) {
                brandName = g['name'] as string;
              }
            }
          }
        }
      }
    } catch {
      // skip
    }
  });

  // Deduplicate typed entities by name
  const seenNames = new Set<string>();
  const uniqueTypedEntities = typedEntities.filter((e) => {
    if (seenNames.has(e.name.toLowerCase())) return false;
    seenNames.add(e.name.toLowerCase());
    return true;
  });

  const entityTypes = new Set(uniqueTypedEntities.map((e) => e.type).filter((t) => t !== 'Unknown'));
  const entityTypeVariety = entityTypes.size;

  // 4.3 Entity Disambiguation
  const hasSameAsLinks = sameAsUrls.length > 0;
  const hasWikipediaLinks = sameAsUrls.some((u) =>
    u.includes('wikipedia.org') || u.includes('wikidata.org'),
  );

  // Also check for Wikipedia outbound links in content
  const wikiOutboundLinks = $('a[href*="wikipedia.org"], a[href*="wikidata.org"]').length;

  let disambiguationScore = 0;
  if (hasSameAsLinks) disambiguationScore += 30;
  if (hasWikipediaLinks) disambiguationScore += 25;
  if (wikiOutboundLinks > 0) disambiguationScore += 15;
  if (uniqueTypedEntities.length >= 3) disambiguationScore += 15;
  if (entityTypeVariety >= 2) disambiguationScore += 15;
  disambiguationScore = Math.min(100, disambiguationScore);

  // 4.10 Brand Entity Signals — check if brand name is consistent across title, meta, schema
  let brandConsistency = 0;
  if (brandName) {
    const brandLower = brandName.toLowerCase();
    const title = $('title').text().toLowerCase();
    const metaDesc = ($('meta[name="description"]').attr('content') ?? '').toLowerCase();
    const ogTitle = ($('meta[property="og:title"]').attr('content') ?? '').toLowerCase();
    const ogSiteName = ($('meta[property="og:site_name"]').attr('content') ?? '').toLowerCase();

    let matches = 0;
    let checks = 0;
    if (title) { checks++; if (title.includes(brandLower)) matches++; }
    if (metaDesc) { checks++; if (metaDesc.includes(brandLower)) matches++; }
    if (ogTitle) { checks++; if (ogTitle.includes(brandLower)) matches++; }
    if (ogSiteName) { checks++; if (ogSiteName.includes(brandLower)) matches++; }

    brandConsistency = checks > 0 ? Math.round((matches / checks) * 100) : 0;
  }

  // Scoring
  let score = 0;

  // 4.1 Entity Density
  if (entityDensity >= 1) score += 10;
  if (entityDensity >= 2) score += 10;
  if (entityDensity >= 3) score += 5;

  if (entityCount >= 5) score += 5;
  if (entityCount >= 10) score += 5;
  if (entityCount >= 20) score += 5;

  if (multiWordEntities.size >= 2) score += 5;
  if (multiWordEntities.size >= 5) score += 5;

  // 4.2 Entity Type Quality
  if (uniqueTypedEntities.length >= 1) score += 5;
  if (entityTypeVariety >= 2) score += 5;
  if (entityTypeVariety >= 3) score += 5;

  // 4.3 Entity Disambiguation
  if (hasSameAsLinks) score += 5;
  if (hasWikipediaLinks) score += 5;

  // 4.10 Brand Entity Signals
  if (hasAuthorEntity) score += 5;
  if (hasOrgEntity) score += 5;
  if (brandConsistency >= 50) score += 5;
  if (brandConsistency >= 75) score += 5;

  return {
    score: Math.min(100, score),
    entityDensity: Math.round(entityDensity * 100) / 100,
    uniqueEntities: Array.from(allEntities).slice(0, 50),
    entityCount,
    properNouns: Array.from(properNouns).slice(0, 30),
    hasAuthorEntity,
    hasOrgEntity,
    typedEntities: uniqueTypedEntities.slice(0, 30),
    entityTypeVariety,
    hasSameAsLinks,
    sameAsUrls: [...new Set(sameAsUrls)].slice(0, 20),
    hasWikipediaLinks: hasWikipediaLinks || wikiOutboundLinks > 0,
    disambiguationScore,
    brandConsistency,
    brandName,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

const SCHEMA_TYPE_MAP: Record<string, TypedEntity['type']> = {
  Person: 'Person',
  Organization: 'Organization',
  Corporation: 'Organization',
  LocalBusiness: 'Organization',
  Place: 'Place',
  City: 'Place',
  Country: 'Place',
  Product: 'Product',
  SoftwareApplication: 'Product',
  Event: 'Event',
  Article: 'CreativeWork',
  BlogPosting: 'CreativeWork',
  Book: 'CreativeWork',
  Movie: 'CreativeWork',
  WebPage: 'CreativeWork',
};

function extractTypedEntities(
  obj: Record<string, unknown>,
  entities: TypedEntity[],
  sameAsUrls: string[],
): void {
  const type = obj['@type'];
  const name = obj['name'];

  if (typeof type === 'string' && typeof name === 'string' && name.trim()) {
    const mappedType = SCHEMA_TYPE_MAP[type] ?? 'Unknown';
    entities.push({ name: name.trim(), type: mappedType, source: 'schema' });
  }

  // Collect sameAs links for disambiguation
  if (obj['sameAs']) {
    const sameAs = Array.isArray(obj['sameAs']) ? obj['sameAs'] : [obj['sameAs']];
    for (const link of sameAs) {
      if (typeof link === 'string') sameAsUrls.push(link);
    }
  }

  // Recurse into nested objects
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      extractTypedEntities(value as Record<string, unknown>, entities, sameAsUrls);
    }
  }
}
