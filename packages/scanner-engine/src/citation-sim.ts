/**
 * Citation simulation engine.
 * Ported from aivs_generate_citation_simulation() in scanner-engine.php.
 *
 * Estimates likelihood of being cited by various AI platforms
 * based on structural readiness scores.
 */

import type { SubScores, LayerScores } from '@aivs/types';

export interface CitationSimulationResult {
  overall: number;
  platforms: {
    name: string;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  }[];
  strengths: string[];
  weaknesses: string[];
}

interface ExtractionSummary {
  schema?: { types?: string[]; details?: Record<string, boolean> };
  crawlAccess?: { isHttps?: boolean; isSpa?: boolean };
  contentRichness?: { hasAuthor?: boolean; hasFreshDate?: boolean; hasCitations?: boolean };
  feeds?: { hasSitemap?: boolean };
  faq?: { hasFaqSchema?: boolean };
  summary?: { hasDefinitionPattern?: boolean };
}

export function generateCitationSimulation(
  subScores: SubScores,
  layerScores: LayerScores,
  extraction: ExtractionSummary,
): CitationSimulationResult {
  // Google AI Overviews — favors schema + authority + organic ranking signals
  const googleAiScore = Math.round(
    subScores.schema * 0.30 +
    subScores.structure * 0.20 +
    subScores.entity * 0.15 +
    subScores.contentRichness * 0.20 +
    subScores.crawlAccess * 0.15,
  );

  // ChatGPT — favors structured content + authority + encyclopedic tone
  const chatGptScore = Math.round(
    subScores.structure * 0.25 +
    subScores.summary * 0.20 +
    subScores.entity * 0.20 +
    subScores.contentRichness * 0.20 +
    subScores.faq * 0.15,
  );

  // Perplexity — favors recency + citations + research depth
  const perplexityScore = Math.round(
    subScores.contentRichness * 0.30 +
    subScores.summary * 0.20 +
    subScores.structure * 0.20 +
    subScores.entity * 0.15 +
    subScores.feed * 0.15,
  );

  // Gemini — favors Google ecosystem signals + structured data
  const geminiScore = Math.round(
    subScores.schema * 0.30 +
    subScores.entity * 0.20 +
    subScores.structure * 0.20 +
    subScores.crawlAccess * 0.15 +
    subScores.contentRichness * 0.15,
  );

  // Voice Assistants — favors speakable + concise answers
  const voiceScore = Math.round(
    subScores.speakable * 0.30 +
    subScores.summary * 0.25 +
    subScores.faq * 0.20 +
    subScores.structure * 0.15 +
    subScores.schema * 0.10,
  );

  // Copilot — favors Bing-aligned signals
  const copilotScore = Math.round(
    subScores.structure * 0.25 +
    subScores.schema * 0.20 +
    subScores.entity * 0.20 +
    subScores.contentRichness * 0.20 +
    subScores.crawlAccess * 0.15,
  );

  const platforms = [
    {
      name: 'Google AI Overviews',
      score: googleAiScore,
      confidence: getConfidence(googleAiScore),
      reasoning: googleAiScore >= 70
        ? 'Strong schema and content structure align well with Google AI Overview selection criteria.'
        : googleAiScore >= 40
        ? 'Some structural elements present but gaps in schema or content depth limit citation likelihood.'
        : 'Significant gaps in structured data and content signals reduce visibility in AI Overviews.',
    },
    {
      name: 'ChatGPT',
      score: chatGptScore,
      confidence: getConfidence(chatGptScore),
      reasoning: chatGptScore >= 70
        ? 'Well-structured, authoritative content is likely to be referenced in ChatGPT responses.'
        : chatGptScore >= 40
        ? 'Content has some extractable elements but lacks the depth or authority for consistent citation.'
        : 'Content structure and authority signals are insufficient for reliable ChatGPT citation.',
    },
    {
      name: 'Perplexity',
      score: perplexityScore,
      confidence: getConfidence(perplexityScore),
      reasoning: perplexityScore >= 70
        ? 'Strong citation density and fresh content align with Perplexity\'s research-oriented approach.'
        : perplexityScore >= 40
        ? 'Some relevant signals present but recency or citation depth could be improved.'
        : 'Lacks the recency and citation signals that Perplexity prioritizes.',
    },
    {
      name: 'Gemini',
      score: geminiScore,
      confidence: getConfidence(geminiScore),
      reasoning: geminiScore >= 70
        ? 'Strong Google ecosystem alignment through structured data and entity signals.'
        : 'Improving schema markup and entity clarity would increase Gemini visibility.',
    },
    {
      name: 'Voice Assistants',
      score: voiceScore,
      confidence: getConfidence(voiceScore),
      reasoning: voiceScore >= 70
        ? 'Speakable markup and concise answer blocks make this content voice-assistant ready.'
        : 'Adding speakable schema and front-loaded direct answers would improve voice readiness.',
    },
    {
      name: 'Microsoft Copilot',
      score: copilotScore,
      confidence: getConfidence(copilotScore),
      reasoning: copilotScore >= 70
        ? 'Well-structured content with strong entity signals aligns with Copilot\'s approach.'
        : 'Strengthening content structure and entity clarity would improve Copilot citation likelihood.',
    },
  ] as CitationSimulationResult['platforms'];

  const overall = Math.round(
    platforms.reduce((sum, p) => sum + p.score, 0) / platforms.length,
  );

  // Identify strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (subScores.schema >= 70) strengths.push('Strong structured data implementation');
  if (subScores.structure >= 70) strengths.push('Well-organized content hierarchy');
  if (subScores.faq >= 60) strengths.push('FAQ content enhances extractability');
  if (subScores.contentRichness >= 60) strengths.push('Rich content with supporting evidence');
  if (subScores.crawlAccess >= 70) strengths.push('Excellent crawl accessibility');
  if (subScores.speakable > 0) strengths.push('Voice-assistant ready with speakable markup');
  if (extraction.contentRichness?.hasAuthor) strengths.push('Named author establishes authority');
  if (extraction.contentRichness?.hasFreshDate) strengths.push('Recent content date signals relevance');

  if (subScores.schema < 30) weaknesses.push('Missing or minimal structured data');
  if (subScores.structure < 40) weaknesses.push('Poor content organization and heading hierarchy');
  if (subScores.faq < 20) weaknesses.push('No FAQ or Q&A content for direct extraction');
  if (subScores.summary < 30) weaknesses.push('Lacks concise definitions and summaries');
  if (subScores.entity < 30) weaknesses.push('Low entity density reduces topical authority');
  if (subScores.feed < 20) weaknesses.push('Missing sitemap and feed discovery mechanisms');
  if (subScores.speakable === 0) weaknesses.push('No speakable markup for voice assistants');
  if (subScores.crawlAccess < 40) weaknesses.push('Crawl accessibility issues may block AI systems');

  return {
    overall,
    platforms,
    strengths,
    weaknesses,
  };
}

function getConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
