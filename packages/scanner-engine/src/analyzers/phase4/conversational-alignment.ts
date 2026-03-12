/**
 * Conversational language alignment analyzer (Factor 7.1).
 *
 * Measures how well content aligns with natural language query patterns
 * used in AI chat interfaces. Deterministic NLP approach.
 */

import type { CheerioAPI } from 'cheerio';

export interface ConversationalAlignmentResult {
  score: number;
  questionHeadingRatio: number;
  naturalLanguageRatio: number;
  directAnswerCount: number;
  conversationalTone: boolean;
  queryAlignedPhrases: number;
}

// Patterns typical of conversational/query-style language
const QUESTION_PATTERNS = [
  /^(what|how|why|when|where|who|which|can|does|is|are|should|could|will)\s/i,
];

const CONVERSATIONAL_STARTERS = [
  /^(here's|here is|the answer|in short|simply put|to put it simply)/i,
  /^(let me explain|think of it|imagine|for example|consider)/i,
  /^(the (best|easiest|quickest|simplest|most) way)/i,
  /^(you can|you should|you'll need|you might|first,)/i,
];

const DIRECT_ANSWER_PATTERNS = [
  /^[A-Z][^.!?]{10,80}[.]/,  // Declarative first sentence
  /^(yes|no)[,.]?\s/i,
  /^(the answer is|it (is|means|refers to|depends))/i,
  /^\d+[\s.]/,  // Starts with a number (lists, stats)
];

export function analyzeConversationalAlignment(
  $: CheerioAPI,
): ConversationalAlignmentResult {
  // Question-based headings
  const headings: string[] = [];
  $('h1, h2, h3, h4').each((_, el) => {
    headings.push($(el).text().trim());
  });

  const questionHeadings = headings.filter((h) =>
    QUESTION_PATTERNS.some((p) => p.test(h)) || h.endsWith('?'),
  );
  const questionHeadingRatio = headings.length > 0
    ? questionHeadings.length / headings.length
    : 0;

  // Natural language ratio — paragraphs that use conversational language
  let conversationalParagraphs = 0;
  let totalParagraphs = 0;
  let directAnswerCount = 0;

  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length < 30) return;
    totalParagraphs++;

    // Check for conversational starters
    if (CONVERSATIONAL_STARTERS.some((p) => p.test(text))) {
      conversationalParagraphs++;
    }

    // Check for direct answers (declarative opening sentences)
    if (DIRECT_ANSWER_PATTERNS.some((p) => p.test(text))) {
      directAnswerCount++;
    }

    // Second person ("you") indicates conversational tone
    if (/\byou(r|'re|'ll|'ve)?\b/i.test(text)) {
      conversationalParagraphs++;
    }
  });

  const naturalLanguageRatio = totalParagraphs > 0
    ? Math.min(1, conversationalParagraphs / totalParagraphs)
    : 0;

  // Query-aligned phrases — content that matches how people ask AI
  const bodyText = $('body').text().toLowerCase();
  let queryAlignedPhrases = 0;

  const queryPatterns = [
    /how to \w+/g,
    /what is \w+/g,
    /best \w+ for/g,
    /\w+ vs\.? \w+/g,
    /step[- ]by[- ]step/g,
    /pros and cons/g,
    /compared to/g,
    /alternatives to/g,
  ];

  for (const pattern of queryPatterns) {
    const matches = bodyText.match(pattern);
    if (matches) queryAlignedPhrases += matches.length;
  }

  // Conversational tone detection
  const conversationalTone =
    naturalLanguageRatio > 0.2 ||
    questionHeadingRatio > 0.3 ||
    /\b(you|your|you're)\b/i.test($('body').text().slice(0, 2000));

  // Scoring
  let score = 0;

  // Question headings (20 pts)
  if (questionHeadingRatio >= 0.1) score += 5;
  if (questionHeadingRatio >= 0.25) score += 10;
  if (questionHeadingRatio >= 0.5) score += 5;

  // Natural language ratio (20 pts)
  if (naturalLanguageRatio >= 0.1) score += 5;
  if (naturalLanguageRatio >= 0.2) score += 10;
  if (naturalLanguageRatio >= 0.4) score += 5;

  // Direct answers (20 pts)
  if (directAnswerCount >= 1) score += 5;
  if (directAnswerCount >= 3) score += 10;
  if (directAnswerCount >= 5) score += 5;

  // Query-aligned phrases (20 pts)
  if (queryAlignedPhrases >= 2) score += 5;
  if (queryAlignedPhrases >= 5) score += 10;
  if (queryAlignedPhrases >= 10) score += 5;

  // Conversational tone (20 pts)
  if (conversationalTone) score += 20;

  return {
    score: Math.min(100, score),
    questionHeadingRatio: Math.round(questionHeadingRatio * 100) / 100,
    naturalLanguageRatio: Math.round(naturalLanguageRatio * 100) / 100,
    directAnswerCount,
    conversationalTone,
    queryAlignedPhrases,
  };
}
