/**
 * Summary analyzer — meta descriptions, opening paragraphs, og:description.
 * Ported from aivs_analyze_summaries() in scanner-engine.php.
 *
 * Category 3 (3.5) — definition and summary density.
 */

import type { CheerioAPI } from 'cheerio';

export interface SummaryResult {
  score: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  ogDescription: string | null;
  openingParagraph: string | null;
  openingParagraphLength: number;
  hasDefinitionPattern: boolean;
  hasTldr: boolean;
}

const DEFINITION_PATTERNS = [
  /\bis\s+(a|an|the)\s+/i,
  /\brefers?\s+to\b/i,
  /\bis\s+defined\s+as\b/i,
  /\bmeans?\s+that\b/i,
  /\bknown\s+as\b/i,
];

export function analyzeSummaries($: CheerioAPI): SummaryResult {
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ?? null;
  const metaDescriptionLength = metaDescription?.length ?? 0;

  const ogDescription =
    $('meta[property="og:description"]').attr('content')?.trim() ?? null;

  let openingParagraph: string | null = null;
  const mainContent = $('main, article, [role="main"], .content, #content');
  const container = mainContent.length > 0 ? mainContent.first() : $('body');

  container.find('p').each((_, el) => {
    if (openingParagraph) return;
    const text = $(el).text().trim();
    if (text.length >= 50) {
      openingParagraph = text;
    }
  });
  const openingParagraphText = openingParagraph ?? '';
  const openingParagraphLength = openingParagraphText.length > 0
    ? openingParagraphText.split(/\s+/).length
    : 0;

  let hasDefinitionPattern = false;
  let pCount = 0;
  container.find('p').each((_, el) => {
    if (pCount >= 3) return;
    const text = $(el).text().trim();
    if (text.length < 30) return;
    pCount++;
    if (DEFINITION_PATTERNS.some((p) => p.test(text))) {
      hasDefinitionPattern = true;
    }
  });

  let hasTldr = false;
  $('h1, h2, h3, h4, h5, h6, strong, b').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (
      text.includes('tl;dr') ||
      text.includes('tldr') ||
      text.includes('summary') ||
      text.includes('key takeaway') ||
      text.includes('executive summary') ||
      text.includes('in brief') ||
      text.includes('at a glance')
    ) {
      hasTldr = true;
    }
  });

  let score = 0;

  if (metaDescription) {
    score += 10;
    if (metaDescriptionLength >= 120 && metaDescriptionLength <= 160) score += 15;
    else if (metaDescriptionLength >= 70) score += 8;
  }

  if (ogDescription) score += 10;

  if (openingParagraph) {
    score += 10;
    if (openingParagraphLength >= 30 && openingParagraphLength <= 80) score += 15;
    else if (openingParagraphLength >= 20) score += 8;
  }

  if (hasDefinitionPattern) score += 20;

  if (hasTldr) score += 20;

  return {
    score: Math.min(100, score),
    metaDescription,
    metaDescriptionLength,
    ogDescription,
    openingParagraph,
    openingParagraphLength,
    hasDefinitionPattern,
    hasTldr,
  };
}
