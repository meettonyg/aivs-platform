/**
 * Knowledge Graph presence analyzer (Factor 4.7).
 *
 * Checks Google Knowledge Graph API for entity presence.
 * Free tier: 100K queries/day.
 */

import { request } from 'undici';
import type { KnowledgeGraphResult } from './authority-cache';

const KG_API_KEY = process.env.GOOGLE_KG_API_KEY;
const KG_API_URL = 'https://kgsearch.googleapis.com/v1/entities:search';

export async function analyzeKnowledgeGraph(domain: string): Promise<KnowledgeGraphResult> {
  if (!KG_API_KEY) {
    return { found: false, entityId: null, entityName: null, entityType: null, description: null, score: 0 };
  }

  // Extract brand name from domain (strip TLD)
  const brandName = domain
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[.-]/g, ' ');

  try {
    const url = `${KG_API_URL}?query=${encodeURIComponent(brandName)}&key=${KG_API_KEY}&limit=5&languages=en`;
    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return { found: false, entityId: null, entityName: null, entityType: null, description: null, score: 0 };
    }

    const data = await res.body.json() as {
      itemListElement?: {
        result: {
          '@id': string;
          name: string;
          '@type': string[];
          description?: string;
          detailedDescription?: { articleBody: string };
          url?: string;
        };
        resultScore: number;
      }[];
    };

    const items = data.itemListElement ?? [];

    // Find best match — look for entity whose URL matches the domain
    const match = items.find((item) => {
      const entityUrl = item.result.url ?? '';
      return entityUrl.includes(domain.replace(/^www\./, ''));
    }) ?? items[0];

    if (!match || match.resultScore < 10) {
      return { found: false, entityId: null, entityName: null, entityType: null, description: null, score: 15 };
    }

    const entityType = match.result['@type']?.[0] ?? null;

    // Scoring
    let score = 0;
    score += 30; // Entity found
    if (match.resultScore > 100) score += 20;
    if (match.resultScore > 500) score += 15;
    if (match.result.detailedDescription) score += 15;
    if (match.result.url?.includes(domain.replace(/^www\./, ''))) score += 20;

    return {
      found: true,
      entityId: match.result['@id'],
      entityName: match.result.name,
      entityType,
      description: match.result.description ?? match.result.detailedDescription?.articleBody ?? null,
      score: Math.min(100, score),
    };
  } catch {
    return { found: false, entityId: null, entityName: null, entityType: null, description: null, score: 0 };
  }
}
