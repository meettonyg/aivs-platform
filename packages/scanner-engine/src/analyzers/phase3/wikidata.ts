/**
 * Wikidata presence analyzer (Factor 4.8).
 *
 * Checks Wikidata SPARQL endpoint for entity presence.
 * Free API — no API key required.
 */

import { request } from 'undici';
import type { WikidataResult } from './authority-cache';

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

export async function analyzeWikidata(domain: string): Promise<WikidataResult> {
  const cleanDomain = domain.replace(/^www\./, '');

  try {
    // Search for entities with official website matching this domain
    const sparql = `
      SELECT ?item ?itemLabel ?itemDescription (COUNT(?sitelink) AS ?sitelinks) WHERE {
        ?item wdt:P856 ?website .
        FILTER(CONTAINS(LCASE(STR(?website)), "${cleanDomain.toLowerCase()}"))
        OPTIONAL { ?sitelink schema:about ?item . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
      GROUP BY ?item ?itemLabel ?itemDescription
      LIMIT 1
    `;

    const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await request(url, {
      headers: {
        'User-Agent': 'AIVisibilityScanner/1.0 (https://aivs.app)',
        'Accept': 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return { found: false, entityId: null, label: null, description: null, sitelinks: 0, score: 0 };
    }

    const data = await res.body.json() as {
      results: {
        bindings: {
          item: { value: string };
          itemLabel: { value: string };
          itemDescription?: { value: string };
          sitelinks: { value: string };
        }[];
      };
    };

    const bindings = data.results?.bindings ?? [];
    if (bindings.length === 0) {
      return { found: false, entityId: null, label: null, description: null, sitelinks: 0, score: 0 };
    }

    const result = bindings[0];
    const entityId = result.item.value.split('/').pop() ?? null;
    const sitelinks = parseInt(result.sitelinks.value, 10) || 0;

    // Scoring
    let score = 0;
    score += 30; // Found on Wikidata
    if (sitelinks > 0) score += 15;
    if (sitelinks > 5) score += 15;
    if (sitelinks > 20) score += 15;
    if (result.itemDescription?.value) score += 10;
    if (entityId) score += 15;

    return {
      found: true,
      entityId,
      label: result.itemLabel.value,
      description: result.itemDescription?.value ?? null,
      sitelinks,
      score: Math.min(100, score),
    };
  } catch {
    return { found: false, entityId: null, label: null, description: null, sitelinks: 0, score: 0 };
  }
}
