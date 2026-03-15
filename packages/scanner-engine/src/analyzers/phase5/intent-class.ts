/**
 * Intent class alignment analyzer — Factor 7.5 in the AEO taxonomy.
 *
 * Classifies page intent (informational, commercial, transactional,
 * navigational, local) and evaluates how well the page's structure
 * matches expected patterns for that intent class.
 *
 * Deterministic / heuristic — runs in Phase 5.
 */

import type { CheerioAPI } from 'cheerio';

export type IntentClass = 'informational' | 'commercial' | 'transactional' | 'navigational' | 'local';

export interface IntentClassResult {
  score: number;
  detectedIntent: IntentClass;
  intentConfidence: number;
  intentSignals: string[];
  structureAlignment: number;
}

interface IntentSignal {
  intent: IntentClass;
  weight: number;
  signal: string;
}

export function analyzeIntentClass($: CheerioAPI, url: string): IntentClassResult {
  const signals: IntentSignal[] = [];

  const bodyText = $('body').text().toLowerCase();
  const headings = $('h1, h2, h3').text().toLowerCase();
  const title = $('title').text().toLowerCase();
  const parsedUrl = safeParseUrl(url);
  const path = parsedUrl?.pathname?.toLowerCase() ?? '';

  // ── Informational signals ─────────────────────────────────────────
  if (/\b(what is|how to|why|guide|tutorial|learn|explained|definition|overview)\b/.test(title + ' ' + headings)) {
    signals.push({ intent: 'informational', weight: 3, signal: 'informational heading patterns' });
  }
  if ($('article, [itemtype*="Article"], [itemtype*="BlogPosting"]').length > 0) {
    signals.push({ intent: 'informational', weight: 2, signal: 'article schema/element' });
  }
  if (/\/(blog|guide|tutorial|learn|wiki|help|faq|how-to)\//i.test(path)) {
    signals.push({ intent: 'informational', weight: 2, signal: 'informational URL path' });
  }
  if ($('[itemtype*="FAQPage"], .faq, #faq').length > 0) {
    signals.push({ intent: 'informational', weight: 2, signal: 'FAQ content' });
  }

  // ── Commercial signals ────────────────────────────────────────────
  if (/\b(best|top|review|comparison|vs\.?|versus|compare|alternative|rated)\b/.test(title + ' ' + headings)) {
    signals.push({ intent: 'commercial', weight: 3, signal: 'comparison/review heading' });
  }
  if ($('[itemtype*="Review"], [itemtype*="AggregateRating"], .review, .rating').length > 0) {
    signals.push({ intent: 'commercial', weight: 2, signal: 'review/rating elements' });
  }
  if (/\b(pros and cons|features|pricing|plan|benchmark)\b/.test(bodyText.slice(0, 3000))) {
    signals.push({ intent: 'commercial', weight: 1, signal: 'commercial comparison language' });
  }

  // ── Transactional signals ─────────────────────────────────────────
  if ($('[itemtype*="Product"], [itemtype*="Offer"]').length > 0) {
    signals.push({ intent: 'transactional', weight: 3, signal: 'Product/Offer schema' });
  }
  if ($('button:contains("Buy"), button:contains("Add to Cart"), button:contains("Subscribe"), .add-to-cart, [class*="buy-button"], [class*="checkout"]').length > 0) {
    signals.push({ intent: 'transactional', weight: 3, signal: 'purchase CTAs' });
  }
  if (/\/(product|shop|store|cart|checkout|pricing)\//i.test(path)) {
    signals.push({ intent: 'transactional', weight: 2, signal: 'transactional URL path' });
  }
  if ($('[itemprop="price"], .price, [class*="price"]').length > 0) {
    signals.push({ intent: 'transactional', weight: 2, signal: 'price elements' });
  }

  // ── Navigational signals ──────────────────────────────────────────
  if (parsedUrl && (parsedUrl.pathname === '/' || parsedUrl.pathname === '')) {
    signals.push({ intent: 'navigational', weight: 2, signal: 'homepage' });
  }
  if (/\/(about|contact|team|careers|login|signup|dashboard)\//i.test(path) || /\/(about|contact|team|careers|login|signup)$/i.test(path)) {
    signals.push({ intent: 'navigational', weight: 3, signal: 'navigational page path' });
  }
  if ($('[itemtype*="Organization"]').length > 0 && path.length < 10) {
    signals.push({ intent: 'navigational', weight: 1, signal: 'organization schema on short path' });
  }

  // ── Local signals ─────────────────────────────────────────────────
  if ($('[itemtype*="LocalBusiness"]').length > 0) {
    signals.push({ intent: 'local', weight: 3, signal: 'LocalBusiness schema' });
  }
  if (/\b(near me|directions|hours|open now|visit us|our location)\b/.test(bodyText.slice(0, 3000))) {
    signals.push({ intent: 'local', weight: 2, signal: 'local language patterns' });
  }
  if ($('iframe[src*="google.com/maps"]').length > 0) {
    signals.push({ intent: 'local', weight: 2, signal: 'embedded map' });
  }

  // ── Tally scores per intent ───────────────────────────────────────
  const intentScores: Record<IntentClass, number> = {
    informational: 0,
    commercial: 0,
    transactional: 0,
    navigational: 0,
    local: 0,
  };
  for (const s of signals) {
    intentScores[s.intent] += s.weight;
  }

  const sorted = (Object.entries(intentScores) as [IntentClass, number][])
    .sort((a, b) => b[1] - a[1]);
  const detectedIntent = sorted[0][1] > 0 ? sorted[0][0] : 'informational';
  const totalSignalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const intentConfidence = totalSignalWeight > 0
    ? Math.min(100, Math.round((intentScores[detectedIntent] / totalSignalWeight) * 100))
    : 0;

  // ── Structure alignment — does the page structure match its intent? ──
  const structureAlignment = evaluateStructureAlignment($, detectedIntent, bodyText);

  // ── Scoring ───────────────────────────────────────────────────────
  let score = 0;
  // Intent detected with confidence
  if (signals.length >= 1) score += 15;
  if (signals.length >= 3) score += 10;
  if (intentConfidence >= 50) score += 15;
  if (intentConfidence >= 75) score += 10;
  // Structure alignment
  score += Math.round(structureAlignment * 0.5);

  return {
    score: Math.min(100, score),
    detectedIntent,
    intentConfidence,
    intentSignals: signals.map((s) => s.signal),
    structureAlignment,
  };
}

/**
 * Evaluate how well page structure matches the detected intent.
 * Each intent class has expected structural patterns.
 */
function evaluateStructureAlignment(
  $: CheerioAPI,
  intent: IntentClass,
  bodyText: string,
): number {
  let alignment = 0;
  const maxPoints = 100;

  switch (intent) {
    case 'informational': {
      // Expect: headings, long content, lists, clear structure
      const wordCount = bodyText.split(/\s+/).length;
      if (wordCount >= 500) alignment += 20;
      if (wordCount >= 1000) alignment += 10;
      if ($('h2, h3').length >= 3) alignment += 20;
      if ($('ul, ol').length >= 1) alignment += 15;
      if ($('p').length >= 5) alignment += 15;
      if ($('img').length >= 1) alignment += 10;
      if ($('table').length >= 1) alignment += 10;
      break;
    }
    case 'commercial': {
      // Expect: comparison tables, ratings, pros/cons, CTAs
      if ($('table').length >= 1) alignment += 25;
      if (/\b(pros|cons|advantages|disadvantages)\b/i.test(bodyText)) alignment += 20;
      if ($('[class*="rating"], [class*="star"], [itemprop="ratingValue"]').length > 0) alignment += 20;
      if ($('h2, h3').length >= 3) alignment += 15;
      if ($('a[href*="product"], a[href*="buy"], a[href*="pricing"]').length > 0) alignment += 20;
      break;
    }
    case 'transactional': {
      // Expect: price, CTA buttons, product images, schema
      if ($('[itemprop="price"], .price').length > 0) alignment += 25;
      if ($('button, [type="submit"], .cta').length > 0) alignment += 20;
      if ($('[itemtype*="Product"]').length > 0) alignment += 20;
      if ($('img').length >= 1) alignment += 15;
      if ($('[itemprop="availability"]').length > 0) alignment += 10;
      if ($('form').length > 0) alignment += 10;
      break;
    }
    case 'navigational': {
      // Expect: clear branding, navigation, contact info
      if ($('nav, [role="navigation"]').length > 0) alignment += 25;
      if ($('a[href*="contact"], a[href*="about"]').length > 0) alignment += 20;
      if ($('[itemtype*="Organization"]').length > 0) alignment += 20;
      if ($('header, [role="banner"]').length > 0) alignment += 15;
      if ($('footer').length > 0) alignment += 10;
      if ($('.logo, [class*="logo"], [class*="brand"]').length > 0) alignment += 10;
      break;
    }
    case 'local': {
      // Expect: address, map, phone, hours, directions
      if ($('[itemprop="address"], address').length > 0) alignment += 25;
      if ($('iframe[src*="maps"]').length > 0) alignment += 20;
      if (/\(\d{3}\)\s*\d{3}[-.]?\d{4}/.test(bodyText)) alignment += 15;
      if (/\b(hours|open|closed|monday|tuesday|wednesday|thursday|friday)\b/i.test(bodyText)) alignment += 20;
      if ($('[itemtype*="LocalBusiness"]').length > 0) alignment += 20;
      break;
    }
  }

  return Math.min(maxPoints, alignment);
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
