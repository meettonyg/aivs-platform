/**
 * Shared HTTP client configured for undici v7.
 *
 * In undici v7, `maxRedirections` was removed from request options.
 * Redirects must be handled via the redirect interceptor instead.
 */

import { Agent, interceptors, request as undiciRequest } from 'undici';
import type { Dispatcher } from 'undici';

const redirectAgent = new Agent().compose(
  interceptors.redirect({ maxRedirections: 5 }),
);

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Standard browser headers that pass WAF/CDN bot detection.
 * Sites like adp.com use strict fingerprinting that rejects requests
 * missing Sec-Fetch-* and other modern browser headers.
 */
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

/**
 * Extract Set-Cookie values from response headers and format them
 * as a single Cookie header string for subsequent requests.
 * WAFs like Akamai set tracking cookies (ak_bmsc, bm_sz) on 403
 * responses and require them on retry.
 */
export function extractCookies(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers['set-cookie'];
  if (!raw) return undefined;

  const values = Array.isArray(raw) ? raw : [raw];
  const cookies = values
    .map((v) => v.split(';')[0].trim())
    .filter(Boolean);

  return cookies.length > 0 ? cookies.join('; ') : undefined;
}

/**
 * Pre-configured `request` wrapper that follows up to 5 redirects.
 * Mirrors undici's `request()` signature (method defaults to GET).
 */
export function request(
  url: string | URL,
  options?: { signal?: AbortSignal } & Record<string, unknown>,
) {
  return undiciRequest(url, {
    ...options,
    dispatcher: redirectAgent,
  } as unknown as Dispatcher.RequestOptions);
}
