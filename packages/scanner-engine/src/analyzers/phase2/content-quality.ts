/**
 * Content quality analyzer (NLP Batch B) — front-loaded answers, concise blocks,
 * self-containment, fluff detection, fact density, TL;DR, modular design.
 * Factors 3.1, 3.2, 3.7, 3.8, 3.9, 3.14, 3.15, 3.20 in the AEO taxonomy.
 *
 * Uses deterministic NLP approaches per Scanner Design Principle 1.
 */

import type { CheerioAPI } from 'cheerio';

export interface ContentQualityResult {
  score: number;
  frontLoadedAnswers: number;
  conciseAnswerBlocks: number;
  selfContainmentScore: number;
  fluffScore: number;
  factDensity: number;
  hasTldr: boolean;
  modularSections: number;
  altTextCoverage: number;
  readabilityScore: number;
}

// Common filler words that dilute content signal
const FILLER_WORDS = [
  'actually', 'basically', 'clearly', 'definitely', 'essentially',
  'honestly', 'hopefully', 'importantly', 'interestingly', 'literally',
  'naturally', 'obviously', 'really', 'simply', 'surely', 'totally',
  'truly', 'very', 'absolutely', 'certainly', 'quite', 'rather',
  'somewhat', 'pretty much', 'kind of', 'sort of', 'in order to',
  'it is important to note', 'needless to say', 'it goes without saying',
  'at the end of the day', 'when all is said and done',
];

// Patterns that indicate verifiable facts
const FACT_PATTERNS = [
  /\d+(\.\d+)?%/,
  /\$[\d,]+/,
  /\d{4}/,  // Years
  /\b(study|research|survey|report|analysis)\b/i,
  /\b(according to|published in|found that|showed that)\b/i,
  /\b(increase|decrease|growth|decline|rose|fell)\s+\w*\s*\d/i,
  /\d+\s*(million|billion|thousand|hundred)/i,
];

export function analyzeContentQuality($: CheerioAPI): ContentQualityResult {
  const mainContent = $('main, article, [role="main"], .content, #content');
  const container = mainContent.length > 0 ? mainContent.first() : $('body');

  // Get sections (h2-delimited)
  const sections: { heading: string; text: string; wordCount: number }[] = [];
  let currentHeading = '';
  let currentText = '';

  container.children().each((_, el) => {
    const tag = (el as unknown as { tagName?: string }).tagName ?? '';
    const text = $(el).text().trim();

    if (/^h[2-3]$/i.test(tag)) {
      if (currentText.trim()) {
        const words = currentText.trim().split(/\s+/).filter(Boolean);
        sections.push({ heading: currentHeading, text: currentText.trim(), wordCount: words.length });
      }
      currentHeading = text;
      currentText = '';
    } else if (text) {
      currentText += ' ' + text;
    }
  });
  if (currentText.trim()) {
    const words = currentText.trim().split(/\s+/).filter(Boolean);
    sections.push({ heading: currentHeading, text: currentText.trim(), wordCount: words.length });
  }

  const bodyText = container.text().replace(/\s+/g, ' ').trim();
  const allWords = bodyText.split(/\s+/).filter(Boolean);
  const totalWords = allWords.length;

  // 3.1 Front-loaded direct answers: first 60 words after each heading
  let frontLoadedAnswers = 0;
  for (const section of sections) {
    const first60 = section.text.split(/\s+/).slice(0, 60).join(' ');
    // Front-loaded if starts with a direct statement (not a question or filler)
    if (first60.length > 30 && !first60.startsWith('In this') && !first60.startsWith('Here')) {
      // Check if first sentence is a declarative answer
      const firstSentence = first60.split(/[.!?]/)[0] ?? '';
      if (firstSentence.length > 20 && firstSentence.length < 200) {
        frontLoadedAnswers++;
      }
    }
  }

  // 3.2 Concise answer blocks: paragraphs between 40-60 words
  let conciseAnswerBlocks = 0;
  $('p').each((_, el) => {
    const words = $(el).text().trim().split(/\s+/).filter(Boolean);
    if (words.length >= 30 && words.length <= 70) {
      conciseAnswerBlocks++;
    }
  });

  // 3.7 Self-containment: check for pronoun-heavy paragraphs
  const pronouns = ['he', 'she', 'it', 'they', 'this', 'that', 'these', 'those', 'them', 'its'];
  let pronounHeavyParagraphs = 0;
  let totalParagraphs = 0;
  $('p').each((_, el) => {
    const words = $(el).text().trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length < 15) return;
    totalParagraphs++;
    const pronounCount = words.filter((w) => pronouns.includes(w)).length;
    const pronounRatio = pronounCount / words.length;
    if (pronounRatio > 0.08) pronounHeavyParagraphs++;
  });
  const selfContainmentScore = totalParagraphs > 0
    ? Math.round((1 - pronounHeavyParagraphs / totalParagraphs) * 100)
    : 50;

  // 3.8 Fluff / signal-to-noise
  const lowerText = bodyText.toLowerCase();
  let fillerCount = 0;
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) fillerCount += matches.length;
  }
  const fluffRatio = totalWords > 0 ? fillerCount / totalWords : 0;
  const fluffScore = Math.round(Math.max(0, (1 - fluffRatio * 20)) * 100);

  // 3.9 Fact density
  let factCount = 0;
  for (const pattern of FACT_PATTERNS) {
    const matches = bodyText.match(new RegExp(pattern.source, 'gi'));
    if (matches) factCount += matches.length;
  }
  const factDensity = totalWords > 0 ? (factCount / totalWords) * 100 : 0;

  // 3.14 TL;DR detection
  let hasTldr = false;
  $('h1, h2, h3, h4, strong, b').each((_, el) => {
    const t = $(el).text().trim().toLowerCase();
    if (t.includes('tl;dr') || t.includes('key takeaway') || t.includes('summary') ||
        t.includes('at a glance') || t.includes('in brief') || t.includes('bottom line')) {
      hasTldr = true;
    }
  });

  // 3.15 Modular content: count well-delimited sections
  const modularSections = sections.filter((s) => s.wordCount >= 50 && s.wordCount <= 500).length;

  // 3.20 Alt text coverage
  const images = $('img');
  const totalImages = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt')?.trim();
    if (alt && alt.length > 5) imagesWithAlt++;
  });
  const altTextCoverage = totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100;

  // Flesch-Kincaid-like readability (simplified)
  const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const avgWordsPerSentence = sentences.length > 0 ? totalWords / sentences.length : 20;
  const readabilityScore = Math.round(
    Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 15) * 3)),
  );

  // Overall scoring
  let score = 0;

  // Front-loaded answers (15 pts)
  if (frontLoadedAnswers >= 1) score += 5;
  if (frontLoadedAnswers >= 3) score += 5;
  if (frontLoadedAnswers >= 5) score += 5;

  // Concise answer blocks (10 pts)
  if (conciseAnswerBlocks >= 2) score += 5;
  if (conciseAnswerBlocks >= 5) score += 5;

  // Self-containment (10 pts)
  if (selfContainmentScore >= 70) score += 5;
  if (selfContainmentScore >= 85) score += 5;

  // Low fluff (15 pts)
  if (fluffScore >= 70) score += 5;
  if (fluffScore >= 85) score += 5;
  if (fluffScore >= 95) score += 5;

  // Fact density (15 pts)
  if (factDensity >= 0.5) score += 5;
  if (factDensity >= 1.0) score += 5;
  if (factDensity >= 2.0) score += 5;

  // TL;DR (10 pts)
  if (hasTldr) score += 10;

  // Modular sections (10 pts)
  if (modularSections >= 3) score += 5;
  if (modularSections >= 5) score += 5;

  // Alt text (10 pts)
  if (altTextCoverage >= 80) score += 5;
  if (altTextCoverage >= 95) score += 5;

  // Readability (5 pts)
  if (readabilityScore >= 60) score += 5;

  return {
    score: Math.min(100, score),
    frontLoadedAnswers,
    conciseAnswerBlocks,
    selfContainmentScore,
    fluffScore,
    factDensity: Math.round(factDensity * 100) / 100,
    hasTldr,
    modularSections,
    altTextCoverage,
    readabilityScore,
  };
}
