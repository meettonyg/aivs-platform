/**
 * Platform-specific AI visibility estimates (Category 8).
 *
 * Structural readiness scores — not live predictions.
 * Framed as: "Your structural readiness for [platform] citation is X/100."
 *
 * Based on research into each platform's citation patterns:
 * - Google AI Overviews: 76% top-10 overlap, +73% schema boost
 * - ChatGPT: 8% Google overlap, favors encyclopedic content
 * - Perplexity: 28% Google overlap, strongest recency weight
 * - Copilot: Bing ranking + Microsoft ecosystem
 * - Gemini: Google KG + E-E-A-T + structured data
 * - Voice: Speakable + concise direct answers
 */

import type { SubScores, LayerScores } from '@aivs/types';
import type { PlatformVisibility, PlatformVisibilityResult, PlatformSignal } from '@aivs/types';

interface EstimateInput {
  subScores: SubScores;
  layerScores: LayerScores;
  extraction: Record<string, unknown>;
  pageType: string;
  authorityScore?: number; // Domain authority from Phase 3 off-site analyzers
}

export function estimatePlatformVisibility(input: EstimateInput): PlatformVisibilityResult {
  const platforms: PlatformVisibility[] = [
    estimateGoogleAIO(input),
    estimateChatGPT(input),
    estimatePerplexity(input),
    estimateGemini(input),
    estimateVoice(input),
    estimateCopilot(input),
  ];

  const overallReadiness = Math.round(
    platforms.reduce((s, p) => s + p.readinessScore, 0) / platforms.length,
  );

  const sorted = [...platforms].sort((a, b) => b.readinessScore - a.readinessScore);

  return {
    platforms,
    overallReadiness,
    strongestPlatform: sorted[0].platform,
    weakestPlatform: sorted[sorted.length - 1].platform,
  };
}

function estimateGoogleAIO(input: EstimateInput): PlatformVisibility {
  const { subScores, extraction } = input;
  const schema = extraction.schema as Record<string, unknown> | undefined;

  const signals: PlatformSignal[] = [
    { name: 'Schema Markup', present: subScores.schema >= 60, weight: 0.25, description: 'Rich structured data (+73% citation boost in AI Overviews)' },
    { name: 'Entity Density', present: subScores.entity >= 50, weight: 0.15, description: 'Clear entity identification for Knowledge Graph alignment' },
    { name: 'Content Structure', present: subScores.structure >= 60, weight: 0.15, description: 'Heading hierarchy and organized content' },
    { name: 'FAQ Content', present: subScores.faq >= 40, weight: 0.15, description: 'Question-answer patterns match AI Overview extraction' },
    { name: 'E-E-A-T Signals', present: subScores.authorEeat >= 50, weight: 0.15, description: 'Author authority and trust signals' },
    { name: 'Schema Accuracy', present: subScores.schemaAccuracy >= 70, weight: 0.10, description: 'Accurate structured data matches page content' },
    { name: 'Domain Authority', present: (input.authorityScore ?? 0) >= 40, weight: 0.05, description: 'Off-site authority signals (76% top-10 overlap)' },
  ];

  const score = computePlatformScore(signals);
  const recommendations = generateRecommendations(signals, 'Google AI Overviews');

  return {
    platform: 'google-aio',
    name: 'Google AI Overviews',
    readinessScore: score,
    confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
    keySignals: signals,
    recommendations,
  };
}

function estimateChatGPT(input: EstimateInput): PlatformVisibility {
  const { subScores } = input;

  const signals: PlatformSignal[] = [
    { name: 'Content Quality', present: subScores.contentQuality >= 50, weight: 0.25, description: 'Encyclopedic, well-structured content favored by ChatGPT' },
    { name: 'Content Structure', present: subScores.structure >= 50, weight: 0.20, description: 'Clean heading hierarchy for content extraction' },
    { name: 'Bot Access', present: subScores.botBlocking >= 80, weight: 0.20, description: 'GPTBot not blocked in robots.txt or by WAF' },
    { name: 'Entity Coverage', present: subScores.entity >= 40, weight: 0.10, description: 'Clear entity definitions for training data quality' },
    { name: 'Content Richness', present: subScores.contentRichness >= 50, weight: 0.10, description: 'Citations, statistics, and factual depth' },
    { name: 'Summary Density', present: subScores.summary >= 50, weight: 0.10, description: 'Clear meta descriptions and front-loaded summaries' },
    { name: 'Domain Authority', present: (input.authorityScore ?? 0) >= 30, weight: 0.05, description: 'Established domain credibility' },
  ];

  const score = computePlatformScore(signals);
  const recommendations = generateRecommendations(signals, 'ChatGPT');

  return {
    platform: 'chatgpt',
    name: 'ChatGPT',
    readinessScore: score,
    confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
    keySignals: signals,
    recommendations,
  };
}

function estimatePerplexity(input: EstimateInput): PlatformVisibility {
  const { subScores, extraction } = input;
  const authorEeat = extraction.authorEeat as Record<string, unknown> | undefined;
  const isFresh = !!(authorEeat?.isFresh);

  const signals: PlatformSignal[] = [
    { name: 'Content Freshness', present: isFresh, weight: 0.25, description: 'dateModified within 90 days (strongest recency weight among platforms)' },
    { name: 'Citation Density', present: subScores.contentRichness >= 50, weight: 0.20, description: 'Research-style citations and source references' },
    { name: 'Bot Access', present: subScores.botBlocking >= 80, weight: 0.20, description: 'PerplexityBot not blocked' },
    { name: 'Content Quality', present: subScores.contentQuality >= 50, weight: 0.15, description: 'Fact-dense, low-fluff content' },
    { name: 'Feed Presence', present: subScores.feed >= 40, weight: 0.10, description: 'RSS/Atom feeds for content discovery' },
    { name: 'Author Authority', present: subScores.authorEeat >= 50, weight: 0.10, description: 'Named author with credentials' },
  ];

  const score = computePlatformScore(signals);
  const recommendations = generateRecommendations(signals, 'Perplexity');

  return {
    platform: 'perplexity',
    name: 'Perplexity',
    readinessScore: score,
    confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
    keySignals: signals,
    recommendations,
  };
}

function estimateGemini(input: EstimateInput): PlatformVisibility {
  const { subScores } = input;

  const signals: PlatformSignal[] = [
    { name: 'Schema Completeness', present: subScores.schema >= 60, weight: 0.25, description: 'Rich structured data aligned with Google ecosystem' },
    { name: 'E-E-A-T Signals', present: subScores.authorEeat >= 50, weight: 0.25, description: 'Strong author credentials and trust pages' },
    { name: 'Entity Density', present: subScores.entity >= 50, weight: 0.15, description: 'Clear entities for Knowledge Graph alignment' },
    { name: 'Content Structure', present: subScores.structure >= 50, weight: 0.15, description: 'Well-organized content hierarchy' },
    { name: 'Schema Accuracy', present: subScores.schemaAccuracy >= 70, weight: 0.10, description: 'Structured data matches visible content' },
    { name: 'Domain Authority', present: (input.authorityScore ?? 0) >= 40, weight: 0.10, description: 'Knowledge Graph presence and authority signals' },
  ];

  const score = computePlatformScore(signals);
  const recommendations = generateRecommendations(signals, 'Gemini');

  return {
    platform: 'gemini',
    name: 'Gemini',
    readinessScore: score,
    confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
    keySignals: signals,
    recommendations,
  };
}

function estimateVoice(input: EstimateInput): PlatformVisibility {
  const { subScores } = input;

  const signals: PlatformSignal[] = [
    { name: 'Speakable Markup', present: subScores.speakable >= 50, weight: 0.30, description: 'Speakable schema markup for voice-optimized content' },
    { name: 'Direct Answers', present: subScores.contentQuality >= 50, weight: 0.25, description: 'Front-loaded, concise answers (40-60 word blocks)' },
    { name: 'FAQ Structure', present: subScores.faq >= 50, weight: 0.20, description: 'Question-answer pairs for voice assistant extraction' },
    { name: 'Summary Density', present: subScores.summary >= 50, weight: 0.15, description: 'Clear definitions and TL;DR summaries' },
    { name: 'Schema Markup', present: subScores.schema >= 50, weight: 0.10, description: 'Structured data for featured snippet eligibility' },
  ];

  const score = computePlatformScore(signals);
  const recommendations = generateRecommendations(signals, 'Voice Assistants');

  return {
    platform: 'voice',
    name: 'Voice Assistants',
    readinessScore: score,
    confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
    keySignals: signals,
    recommendations,
  };
}

function estimateCopilot(input: EstimateInput): PlatformVisibility {
  const { subScores } = input;

  const signals: PlatformSignal[] = [
    { name: 'Bot Access', present: subScores.botBlocking >= 80, weight: 0.20, description: 'Bingbot not blocked (Copilot uses Bing index)' },
    { name: 'Content Structure', present: subScores.structure >= 50, weight: 0.20, description: 'Clean hierarchy for Bing content extraction' },
    { name: 'Schema Markup', present: subScores.schema >= 50, weight: 0.20, description: 'Structured data for enhanced Bing indexing' },
    { name: 'E-E-A-T Signals', present: subScores.authorEeat >= 40, weight: 0.15, description: 'Enterprise verification and authority signals' },
    { name: 'Content Quality', present: subScores.contentQuality >= 40, weight: 0.15, description: 'Well-written, factual content' },
    { name: 'Domain Authority', present: (input.authorityScore ?? 0) >= 30, weight: 0.10, description: 'LinkedIn/GitHub ecosystem bias for Microsoft Copilot' },
  ];

  const score = computePlatformScore(signals);
  const recommendations = generateRecommendations(signals, 'Microsoft Copilot');

  return {
    platform: 'copilot',
    name: 'Microsoft Copilot',
    readinessScore: score,
    confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
    keySignals: signals,
    recommendations,
  };
}

function computePlatformScore(signals: PlatformSignal[]): number {
  let score = 0;
  for (const signal of signals) {
    if (signal.present) {
      score += signal.weight * 100;
    }
  }
  return Math.round(score);
}

function generateRecommendations(signals: PlatformSignal[], platformName: string): string[] {
  const missing = signals
    .filter((s) => !s.present)
    .sort((a, b) => b.weight - a.weight);

  return missing.slice(0, 3).map((s) => {
    const impact = Math.round(s.weight * 100);
    return `Improve ${s.name.toLowerCase()} for +${impact} points on ${platformName}: ${s.description}`;
  });
}
