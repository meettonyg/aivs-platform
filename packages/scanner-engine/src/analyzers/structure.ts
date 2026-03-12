/**
 * Content structure analyzer — heading hierarchy, lists, tables.
 * Ported from aivs_analyze_structure() in scanner-engine.php.
 *
 * Category 3 in the AEO taxonomy (3.4).
 */

import type { CheerioAPI } from 'cheerio';

export interface StructureResult {
  score: number;
  headings: { level: number; text: string }[];
  headingHierarchyValid: boolean;
  hasLists: boolean;
  hasTables: boolean;
  listCount: number;
  tableCount: number;
  wordCount: number;
  paragraphCount: number;
  avgParagraphLength: number;
}

export function analyzeStructure($: CheerioAPI): StructureResult {
  const headings: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as unknown as { tagName: string }).tagName;
    const level = parseInt(tag.replace('h', ''), 10);
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  let headingHierarchyValid = true;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      headingHierarchyValid = false;
      break;
    }
  }

  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count !== 1) headingHierarchyValid = false;

  const listCount = $('ul, ol').length;
  const tableCount = $('table').length;

  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) paragraphs.push(text);
  });

  const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  const avgParagraphLength =
    paragraphs.length > 0
      ? Math.round(paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length)
      : 0;

  let score = 0;

  if (headings.length > 0) score += 10;
  if (headingHierarchyValid) score += 15;
  if (h1Count === 1) score += 5;

  const hasH2 = headings.some((h) => h.level === 2);
  const hasH3 = headings.some((h) => h.level === 3);
  if (hasH2) score += 10;
  if (hasH3) score += 5;

  if (listCount > 0) score += 10;
  if (listCount >= 3) score += 5;

  if (tableCount > 0) score += 10;

  if (wordCount >= 300) score += 5;
  if (wordCount >= 800) score += 5;
  if (wordCount >= 1500) score += 5;

  if (avgParagraphLength > 0 && avgParagraphLength <= 80) score += 10;
  if (avgParagraphLength > 0 && avgParagraphLength <= 50) score += 5;

  return {
    score: Math.min(100, score),
    headings,
    headingHierarchyValid,
    hasLists: listCount > 0,
    hasTables: tableCount > 0,
    listCount,
    tableCount,
    wordCount,
    paragraphCount: paragraphs.length,
    avgParagraphLength,
  };
}
