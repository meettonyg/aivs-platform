/**
 * FAQ/Q&A analyzer — FAQPage schema + semantic Q&A HTML detection.
 * Ported from aivs_analyze_faq() in scanner-engine.php.
 *
 * Categories 2.5 + 3.6 in the AEO taxonomy.
 */

import type { CheerioAPI } from 'cheerio';

export interface FaqResult {
  score: number;
  hasFaqSchema: boolean;
  faqSchemaCount: number;
  htmlQaBlocks: number;
  questionPatterns: string[];
}

const QUESTION_PATTERNS = [
  /^(what|who|where|when|why|how|is|are|can|do|does|should|will|would)\s/i,
  /\?$/,
];

export function analyzeFaq($: CheerioAPI): FaqResult {
  let hasFaqSchema = false;
  let faqSchemaCount = 0;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (checkFaqType(item)) {
          hasFaqSchema = true;
          const mainEntity = (item as Record<string, unknown>)['mainEntity'];
          if (Array.isArray(mainEntity)) {
            faqSchemaCount += mainEntity.length;
          }
        }
      }
    } catch {
      // skip
    }
  });

  const questionPatterns: string[] = [];
  let htmlQaBlocks = 0;

  $('[class*="faq"], [class*="FAQ"], [id*="faq"], [id*="FAQ"], [class*="accordion"], details').each(() => {
    htmlQaBlocks++;
  });

  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (QUESTION_PATTERNS.some((p) => p.test(text))) {
      questionPatterns.push(text);
    }
  });

  const dtCount = $('dt').length;
  if (dtCount > 0) {
    htmlQaBlocks += dtCount;
  }

  let score = 0;

  if (hasFaqSchema) {
    score += 25;
    if (faqSchemaCount >= 3) score += 10;
    if (faqSchemaCount >= 5) score += 5;
  }

  if (htmlQaBlocks > 0) score += 15;
  if (htmlQaBlocks >= 3) score += 10;
  if (htmlQaBlocks >= 5) score += 5;

  if (questionPatterns.length > 0) score += 15;
  if (questionPatterns.length >= 3) score += 10;
  if (questionPatterns.length >= 5) score += 5;

  return {
    score: Math.min(100, score),
    hasFaqSchema,
    faqSchemaCount,
    htmlQaBlocks,
    questionPatterns,
  };
}

function checkFaqType(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  if (record['@type'] === 'FAQPage') return true;
  if (Array.isArray(record['@graph'])) {
    return record['@graph'].some((item) => checkFaqType(item));
  }
  return false;
}
