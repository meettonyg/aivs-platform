/**
 * Topical depth & coverage analyzer (Factor 7.2).
 *
 * Measures how thoroughly a page covers its topic through:
 * - Subtopic coverage breadth (heading diversity)
 * - Internal linking depth (topic cluster signals)
 * - Semantic term coverage
 * - Content depth relative to topic complexity
 */

import type { CheerioAPI } from 'cheerio';

export interface TopicalDepthResult {
  score: number;
  topicBreadth: number;
  subtopicCount: number;
  internalLinkCount: number;
  semanticTermDensity: number;
  contentDepthRatio: number;
  headingDiversity: number;
}

export function analyzeTopicalDepth($: CheerioAPI, url: string): TopicalDepthResult {
  const mainContent = $('main, article, [role="main"]').first();
  const container = mainContent.length > 0 ? mainContent : $('body');
  const bodyText = container.text().replace(/\s+/g, ' ').trim();
  const words = bodyText.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Subtopic coverage via heading analysis
  const headings: string[] = [];
  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 3) headings.push(text.toLowerCase());
  });
  const subtopicCount = headings.length;

  // Heading diversity — unique word stems across headings
  const headingWords = new Set<string>();
  for (const h of headings) {
    for (const word of h.split(/\s+/)) {
      if (word.length > 3) headingWords.add(word);
    }
  }
  const headingDiversity = headingWords.size;

  // Internal link count (same-domain links)
  let internalLinkCount = 0;
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch { /* skip */ }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === hostname) internalLinkCount++;
    } catch {
      // Relative links count as internal
      if (href.startsWith('/') || href.startsWith('#') || href.startsWith('./')) {
        internalLinkCount++;
      }
    }
  });

  // Semantic term density — domain-specific terms (multi-word phrases)
  const bigramMap = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`;
    if (bigram.length > 6) {
      bigramMap.set(bigram, (bigramMap.get(bigram) ?? 0) + 1);
    }
  }
  // Count bigrams that appear 2+ times (indicating topical terms)
  const repeatedTerms = Array.from(bigramMap.values()).filter((c) => c >= 2).length;
  const semanticTermDensity = totalWords > 0 ? (repeatedTerms / totalWords) * 100 : 0;

  // Content depth ratio — words per subtopic
  const contentDepthRatio = subtopicCount > 0 ? totalWords / subtopicCount : totalWords;

  // Topic breadth score (0-100)
  let topicBreadth = 0;

  // Subtopic coverage
  if (subtopicCount >= 3) topicBreadth += 15;
  if (subtopicCount >= 5) topicBreadth += 10;
  if (subtopicCount >= 8) topicBreadth += 5;

  // Heading diversity
  if (headingDiversity >= 10) topicBreadth += 10;
  if (headingDiversity >= 20) topicBreadth += 5;

  // Internal linking (topic cluster)
  if (internalLinkCount >= 3) topicBreadth += 10;
  if (internalLinkCount >= 10) topicBreadth += 10;

  // Semantic term density
  if (semanticTermDensity >= 0.5) topicBreadth += 10;
  if (semanticTermDensity >= 1.0) topicBreadth += 5;

  // Content depth (sweet spot: 150-400 words per subtopic)
  if (contentDepthRatio >= 100 && contentDepthRatio <= 500) topicBreadth += 15;
  else if (contentDepthRatio >= 50) topicBreadth += 5;

  // Word count floor
  if (totalWords >= 500) topicBreadth += 5;

  return {
    score: Math.min(100, topicBreadth),
    topicBreadth,
    subtopicCount,
    internalLinkCount,
    semanticTermDensity: Math.round(semanticTermDensity * 100) / 100,
    contentDepthRatio: Math.round(contentDepthRatio),
    headingDiversity,
  };
}
