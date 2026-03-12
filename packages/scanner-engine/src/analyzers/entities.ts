/**
 * Entity analyzer — named entity extraction, type quality, density scoring.
 * Ported from aivs_analyze_entities() in scanner-engine.php.
 *
 * Category 4 (4.1, 4.2) in the AEO taxonomy.
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
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const record = item as Record<string, unknown>;
        if (record['@type'] === 'Organization' || record['@type'] === 'Corporation') {
          hasOrgEntity = true;
        }
      }
    } catch {
      // skip
    }
  });

  let score = 0;

  if (entityDensity >= 1) score += 15;
  if (entityDensity >= 2) score += 15;
  if (entityDensity >= 3) score += 10;

  if (entityCount >= 5) score += 10;
  if (entityCount >= 10) score += 10;
  if (entityCount >= 20) score += 5;

  if (multiWordEntities.size >= 2) score += 10;
  if (multiWordEntities.size >= 5) score += 5;

  if (hasAuthorEntity) score += 10;
  if (hasOrgEntity) score += 10;

  return {
    score: Math.min(100, score),
    entityDensity: Math.round(entityDensity * 100) / 100,
    uniqueEntities: Array.from(allEntities).slice(0, 50),
    entityCount,
    properNouns: Array.from(properNouns).slice(0, 30),
    hasAuthorEntity,
    hasOrgEntity,
  };
}
