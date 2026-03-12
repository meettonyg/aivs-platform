/**
 * IndexNow support detection (Factor 1.15).
 *
 * Checks if the site has IndexNow key verification file
 * and proper implementation for instant indexing notifications.
 */

import { request } from 'undici';

export interface IndexNowResult {
  score: number;
  hasIndexNowKey: boolean;
  keyLocation: string | null;
  hasApiEndpoint: boolean;
}

export async function analyzeIndexNow(domain: string): Promise<IndexNowResult> {
  const baseUrl = `https://${domain}`;
  let hasIndexNowKey = false;
  let keyLocation: string | null = null;
  let hasApiEndpoint = false;

  // Check common IndexNow key file locations
  const keyLocations = [
    `${baseUrl}/indexnow-key.txt`,
    `${baseUrl}/IndexNow-key.txt`,
  ];

  for (const loc of keyLocations) {
    try {
      const res = await request(loc, {
        signal: AbortSignal.timeout(5000),
        maxRedirections: 3,
      });
      if (res.statusCode === 200) {
        const text = await res.body.text();
        if (text.trim().length >= 8 && text.trim().length <= 128) {
          hasIndexNowKey = true;
          keyLocation = loc;
          break;
        }
      } else {
        await res.body.dump();
      }
    } catch { /* skip */ }
  }

  // Check robots.txt for IndexNow hints
  if (!hasIndexNowKey) {
    try {
      const res = await request(`${baseUrl}/robots.txt`, {
        signal: AbortSignal.timeout(5000),
        maxRedirections: 3,
      });
      if (res.statusCode === 200) {
        const robotsTxt = await res.body.text();
        if (/indexnow/i.test(robotsTxt)) {
          hasApiEndpoint = true;
        }
      } else {
        await res.body.dump();
      }
    } catch { /* skip */ }
  }

  // Check HTML meta tag for IndexNow key
  // Some implementations use <meta name="indexnow-key" content="xxx">
  // This would be checked during page scan, not here

  let score = 0;
  if (hasIndexNowKey) score += 80;
  if (hasApiEndpoint) score += 20;
  if (hasIndexNowKey && hasApiEndpoint) score = 100;

  return {
    score,
    hasIndexNowKey,
    keyLocation,
    hasApiEndpoint,
  };
}
