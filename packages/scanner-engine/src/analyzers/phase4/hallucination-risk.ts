/**
 * Hallucination risk / contradiction detection (Factor 3.19).
 *
 * Uses LLM to compare schema claims vs body text and detect contradictions.
 * Falls back to deterministic heuristics when no LLM API key is configured.
 */

import type { CheerioAPI } from 'cheerio';
import { llmAnalyze } from './llm-client';

export interface HallucinationRiskResult {
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  contradictions: string[];
  inconsistencies: string[];
  usedLlm: boolean;
}

export async function analyzeHallucinationRisk(
  $: CheerioAPI,
): Promise<HallucinationRiskResult> {
  // Extract schema claims
  const schemaClaims: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const r = item as Record<string, unknown>;
        if (r['headline']) schemaClaims.push(`Title: ${r['headline']}`);
        if (r['description']) schemaClaims.push(`Description: ${r['description']}`);
        if (r['datePublished']) schemaClaims.push(`Published: ${r['datePublished']}`);
        if (r['dateModified']) schemaClaims.push(`Modified: ${r['dateModified']}`);
        if (r['author'] && typeof r['author'] === 'object') {
          const author = r['author'] as Record<string, unknown>;
          if (author['name']) schemaClaims.push(`Author: ${author['name']}`);
        }
        if (r['aggregateRating'] && typeof r['aggregateRating'] === 'object') {
          const rating = r['aggregateRating'] as Record<string, unknown>;
          schemaClaims.push(`Rating: ${rating['ratingValue']}/${rating['bestRating'] ?? 5} (${rating['reviewCount'] ?? '?'} reviews)`);
        }
      }
    } catch { /* skip */ }
  });

  const bodyText = $('main, article, [role="main"]').first().text().trim()
    || $('body').text().trim();
  const truncatedBody = bodyText.slice(0, 3000);

  // Try LLM analysis
  const llmResult = await llmAnalyze(
    `You are a fact-checking assistant. Compare the structured data claims against the visible page content. Identify any contradictions or inconsistencies. Return JSON: { "contradictions": ["..."], "inconsistencies": ["..."], "riskLevel": "low|medium|high" }`,
    `Schema claims:\n${schemaClaims.join('\n')}\n\nPage content (first 3000 chars):\n${truncatedBody}`,
    512,
  );

  if (llmResult) {
    try {
      const parsed = JSON.parse(llmResult.content);
      const contradictions = parsed.contradictions ?? [];
      const inconsistencies = parsed.inconsistencies ?? [];
      const riskLevel = parsed.riskLevel ?? 'low';

      let score = 100;
      score -= contradictions.length * 20;
      score -= inconsistencies.length * 10;

      return {
        score: Math.max(0, score),
        riskLevel,
        contradictions,
        inconsistencies,
        usedLlm: true,
      };
    } catch {
      // LLM returned unparseable response — fall through to heuristics
    }
  }

  // Deterministic fallback
  return deterministicHallucinationCheck($, schemaClaims, truncatedBody);
}

function deterministicHallucinationCheck(
  $: CheerioAPI,
  schemaClaims: string[],
  bodyText: string,
): HallucinationRiskResult {
  const contradictions: string[] = [];
  const inconsistencies: string[] = [];

  const bodyLower = bodyText.toLowerCase();

  for (const claim of schemaClaims) {
    if (claim.startsWith('Author: ')) {
      const authorName = claim.replace('Author: ', '');
      if (authorName.length > 2 && !bodyLower.includes(authorName.toLowerCase())) {
        inconsistencies.push(`Schema author "${authorName}" not found in page content`);
      }
    }

    if (claim.startsWith('Title: ')) {
      const title = claim.replace('Title: ', '');
      const h1 = $('h1').first().text().trim();
      if (title && h1 && !fuzzyContains(title, h1) && !fuzzyContains(h1, title)) {
        inconsistencies.push(`Schema title differs from H1`);
      }
    }

    if (claim.startsWith('Published: ') || claim.startsWith('Modified: ')) {
      const dateStr = claim.split(': ')[1];
      const date = new Date(dateStr);
      if (!isNaN(date.getTime()) && date.getTime() > Date.now() + 86400000) {
        contradictions.push(`Date ${dateStr} is in the future`);
      }
    }

    if (claim.startsWith('Rating: ')) {
      const ratingMatch = claim.match(/Rating: ([\d.]+)\/([\d.]+)/);
      if (ratingMatch) {
        const val = parseFloat(ratingMatch[1]);
        const best = parseFloat(ratingMatch[2]);
        if (val > best) {
          contradictions.push(`Rating value ${val} exceeds maximum ${best}`);
        }
      }
    }
  }

  let score = 100;
  score -= contradictions.length * 20;
  score -= inconsistencies.length * 10;

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (contradictions.length >= 2) riskLevel = 'high';
  else if (contradictions.length >= 1 || inconsistencies.length >= 3) riskLevel = 'medium';

  return {
    score: Math.max(0, score),
    riskLevel,
    contradictions,
    inconsistencies,
    usedLlm: false,
  };
}

function fuzzyContains(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return na.includes(nb) || nb.includes(na);
}
