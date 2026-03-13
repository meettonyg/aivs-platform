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

/**
 * Pre-configured `request` wrapper that follows up to 5 redirects.
 */
export function request(
  url: string | URL,
  options?: Omit<Dispatcher.RequestOptions, 'origin' | 'path'> & {
    signal?: AbortSignal;
  },
) {
  return undiciRequest(url, {
    ...options,
    dispatcher: redirectAgent,
  } as Dispatcher.RequestOptions);
}
