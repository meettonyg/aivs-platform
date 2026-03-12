/**
 * Information gain scoring (Factor 5.11).
 *
 * Measures content novelty — does this page add unique value
 * beyond what's commonly available? Uses LLM for deep analysis,
 * with deterministic fallback based on content signals.
 */

import type { CheerioAPI } from 'cheerio';
import { llmAnalyze } from './llm-client';

export interface InformationGainResult {
  score: number;
  hasOriginalResearch: boolean;
  hasProprietaryData: boolean;
  hasUniqueInsights: boolean;
  hasFirstHandExperience: boolean;
  contentNoveltySignals: string[];
  usedLlm: boolean;
}

// Patterns indicating original/proprietary content
const ORIGINAL_RESEARCH_PATTERNS = [
  /\b(our (study|research|survey|analysis|data|findings))\b/i,
  /\b(we (found|discovered|analyzed|surveyed|tested|measured))\b/i,
  /\b(proprietary|exclusive|original research|our methodology)\b/i,
  /\b(internal data|our database|based on \d[\d,]+ (responses|data points|samples))\b/i,
];

const FIRST_HAND_PATTERNS = [
  /\b(i (tested|tried|used|experienced|reviewed|built|created))\b/i,
  /\b(we (tested|tried|used|experienced|reviewed|built|created))\b/i,
  /\b(hands-on|first-hand|in my experience|from our experience)\b/i,
  /\b(personal(ly)?|real-world (test|example|experience))\b/i,
];

const UNIQUE_INSIGHT_PATTERNS = [
  /\b(however|contrary to|unlike|what most .+ miss|overlooked)\b/i,
  /\b(counterintuitive|surprising(ly)?|unexpected(ly)?)\b/i,
  /\b(key (insight|takeaway|finding)|the real (reason|problem|solution))\b/i,
  /\b(myth|misconception|commonly (believed|assumed))\b/i,
];

export async function analyzeInformationGain(
  $: CheerioAPI,
): Promise<InformationGainResult> {
  const mainContent = $('main, article, [role="main"]').first();
  const container = mainContent.length > 0 ? mainContent : $('body');
  const bodyText = container.text().replace(/\s+/g, ' ').trim();
  const truncated = bodyText.slice(0, 4000);

  // Deterministic signal detection
  const hasOriginalResearch = ORIGINAL_RESEARCH_PATTERNS.some((p) => p.test(bodyText));
  const hasFirstHandExperience = FIRST_HAND_PATTERNS.some((p) => p.test(bodyText));
  const hasUniqueInsights = UNIQUE_INSIGHT_PATTERNS.some((p) => p.test(bodyText));

  // Check for proprietary data indicators
  const hasProprietaryData =
    /\b(our (data|dataset|database))\b/i.test(bodyText) ||
    /\b(proprietary|exclusive|internal)\s+(data|research|analysis)\b/i.test(bodyText) ||
    /\b(based on|analyzed)\s+[\d,]+\s+(data points|responses|entries|records)\b/i.test(bodyText);

  // Custom charts/graphs suggest original data
  const hasOriginalVisuals =
    $('canvas, svg.chart, [class*="chart"], [class*="graph"], [data-chart]').length > 0;

  const contentNoveltySignals: string[] = [];
  if (hasOriginalResearch) contentNoveltySignals.push('Original research detected');
  if (hasProprietaryData) contentNoveltySignals.push('Proprietary data references');
  if (hasFirstHandExperience) contentNoveltySignals.push('First-hand experience language');
  if (hasUniqueInsights) contentNoveltySignals.push('Unique/contrarian insights');
  if (hasOriginalVisuals) contentNoveltySignals.push('Custom data visualizations');

  // Try LLM for deeper novelty analysis
  const llmResult = await llmAnalyze(
    `You assess content novelty and information gain. Analyze whether this content adds unique value beyond commonly available information. Return JSON: { "noveltyScore": 0-100, "signals": ["..."], "hasOriginalResearch": bool, "hasFirstHandExperience": bool }`,
    truncated,
    256,
  );

  if (llmResult) {
    try {
      const parsed = JSON.parse(llmResult.content);
      const llmSignals = parsed.signals ?? [];
      contentNoveltySignals.push(...llmSignals);

      return {
        score: Math.min(100, parsed.noveltyScore ?? computeScore(contentNoveltySignals.length)),
        hasOriginalResearch: parsed.hasOriginalResearch ?? hasOriginalResearch,
        hasProprietaryData,
        hasUniqueInsights,
        hasFirstHandExperience: parsed.hasFirstHandExperience ?? hasFirstHandExperience,
        contentNoveltySignals: [...new Set(contentNoveltySignals)],
        usedLlm: true,
      };
    } catch { /* fall through */ }
  }

  return {
    score: computeScore(contentNoveltySignals.length),
    hasOriginalResearch,
    hasProprietaryData,
    hasUniqueInsights,
    hasFirstHandExperience,
    contentNoveltySignals,
    usedLlm: false,
  };
}

function computeScore(signalCount: number): number {
  // Base score + bonus per signal
  if (signalCount === 0) return 15;
  if (signalCount === 1) return 35;
  if (signalCount === 2) return 55;
  if (signalCount === 3) return 70;
  if (signalCount === 4) return 85;
  return Math.min(100, 85 + signalCount * 3);
}
