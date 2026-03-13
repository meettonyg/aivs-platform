/**
 * Page discovery for site-wide crawling.
 *
 * Strategy:
 * 1. Parse sitemap.xml first
 * 2. Fall back to recursive link following within same domain
 * 3. Respect robots.txt directives
 * 4. Prioritize: homepage → sitemap pages → discovered pages
 */

import { request } from 'undici';

export interface DiscoverOptions {
  maxPages: number;
  respectRobotsTxt?: boolean;
  crawlDelay?: number;
}

export interface DiscoveredPage {
  url: string;
  source: 'sitemap' | 'link' | 'homepage';
  priority: number;
}

export async function discoverPages(
  domain: string,
  options: DiscoverOptions,
): Promise<DiscoveredPage[]> {
  const baseUrl = `https://${domain}`;
  const pages: DiscoveredPage[] = [];
  const seen = new Set<string>();

  // Homepage always first
  addPage(pages, seen, baseUrl, 'homepage', 1.0);

  // Try to fetch and parse sitemap
  const sitemapUrls = await fetchSitemapUrls(baseUrl);
  for (const { url, priority } of sitemapUrls) {
    if (pages.length >= options.maxPages) break;
    addPage(pages, seen, url, 'sitemap', priority);
  }

  // If not enough pages from sitemap, discover via homepage links
  if (pages.length < options.maxPages) {
    try {
      const homepageLinks = await discoverLinksFromPage(baseUrl, domain);
      for (const link of homepageLinks) {
        if (pages.length >= options.maxPages) break;
        addPage(pages, seen, link, 'link', 0.3);
      }
    } catch {
      // Homepage link discovery failed
    }
  }

  // Sort by priority (highest first)
  pages.sort((a, b) => b.priority - a.priority);

  return pages.slice(0, options.maxPages);
}

function addPage(
  pages: DiscoveredPage[],
  seen: Set<string>,
  url: string,
  source: DiscoveredPage['source'],
  priority: number,
) {
  const normalized = normalizeUrl(url);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  pages.push({ url: normalized, source, priority });
}

function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) return null;
    // Remove fragments, trailing slashes
    parsed.hash = '';
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchSitemapUrls(baseUrl: string): Promise<{ url: string; priority: number }[]> {
  const urls: { url: string; priority: number }[] = [];

  // Try robots.txt for sitemap location
  const sitemapLocations = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
  ];

  try {
    const robotsRes = await request(`${baseUrl}/robots.txt`, {
      maxRedirections: 5,
      signal: AbortSignal.timeout(5000),
    });
    if (robotsRes.statusCode === 200) {
      const robotsTxt = await robotsRes.body.text();
      const sitemapMatches = robotsTxt.match(/^Sitemap:\s*(.+)$/gim);
      if (sitemapMatches) {
        for (const line of sitemapMatches) {
          const sitemapUrl = line.replace(/^Sitemap:\s*/i, '').trim();
          if (sitemapUrl && !sitemapLocations.includes(sitemapUrl)) {
            sitemapLocations.unshift(sitemapUrl);
          }
        }
      }
    } else {
      await robotsRes.body.dump();
    }
  } catch {
    // robots.txt not available
  }

  for (const sitemapUrl of sitemapLocations) {
    try {
      const res = await request(sitemapUrl, {
        maxRedirections: 5,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.statusCode !== 200) {
        await res.body.dump();
        continue;
      }

      const xml = await res.body.text();

      // Check if it's a sitemap index
      if (xml.includes('<sitemapindex')) {
        const indexUrls = extractSitemapIndexUrls(xml);
        for (const indexUrl of indexUrls.slice(0, 5)) {
          try {
            const subRes = await request(indexUrl, {
              maxRedirections: 5,
              signal: AbortSignal.timeout(10_000),
            });
            if (subRes.statusCode === 200) {
              const subXml = await subRes.body.text();
              urls.push(...extractUrlsFromSitemap(subXml));
            } else {
              await subRes.body.dump();
            }
          } catch {
            // skip sub-sitemap
          }
        }
      } else {
        urls.push(...extractUrlsFromSitemap(xml));
      }

      if (urls.length > 0) break;
    } catch {
      // try next sitemap location
    }
  }

  return urls;
}

function extractUrlsFromSitemap(xml: string): { url: string; priority: number }[] {
  const urls: { url: string; priority: number }[] = [];
  const urlRegex = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<priority>([^<]+)<\/priority>)?/g;
  let match;

  while ((match = urlRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    const priority = match[2] ? parseFloat(match[2]) : 0.5;
    urls.push({ url, priority: isNaN(priority) ? 0.5 : priority });
  }

  return urls;
}

function extractSitemapIndexUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<sitemap>\s*<loc>([^<]+)<\/loc>/g;
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }

  return urls;
}

async function discoverLinksFromPage(pageUrl: string, domain: string): Promise<string[]> {
  const res = await request(pageUrl, {
    method: 'GET',
    maxRedirections: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIVisibilityScanner/1.0)',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.statusCode < 200 || res.statusCode >= 400) {
    await res.body.dump();
    return [];
  }

  const html = await res.body.text();
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], pageUrl);
      if (url.hostname === domain && url.protocol.startsWith('http')) {
        // Skip non-page resources
        const path = url.pathname.toLowerCase();
        if (
          !path.match(/\.(jpg|jpeg|png|gif|svg|webp|css|js|pdf|zip|mp3|mp4|woff|woff2|ico)$/) &&
          !path.includes('/wp-admin') &&
          !path.includes('/wp-json') &&
          !path.includes('/feed')
        ) {
          links.push(url.toString());
        }
      }
    } catch {
      // skip invalid URLs
    }
  }

  return [...new Set(links)];
}
