/**
 * Crawl access analyzer — robots.txt, SSR detection, TTFB, canonical tags,
 * JS dependency, interactive content, llms-full.json.
 *
 * Category 1 in the AEO taxonomy.
 * Factors: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.11, 1.12, 1.17
 */

import type { CheerioAPI } from 'cheerio';

export interface CrawlAccessResult {
  score: number;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  hasMetaRobots: boolean;
  metaRobotsContent: string | null;
  isIndexable: boolean;
  hasHreflang: boolean;
  isHttps: boolean;
  hasCleanUrl: boolean;
  robotsTxt: RobotsTxtResult | null;
  ttfbMs: number | null;
  isSpa: boolean;
  // 1.4 JS Rendering Dependency
  jsRenderingDependency: 'none' | 'partial' | 'heavy';
  heavyJsFrameworks: string[];
  // 1.5 Content Behind Interactive Elements
  hasContentBehindInteraction: boolean;
  interactiveElementCount: number;
  // 1.17 llms-full.json
  hasLlmsFullJson: boolean;
  // 1.9 Mobile Accessibility
  hasMobileViewport: boolean;
  hasResponsiveDesign: boolean;
  // 1.18 Markdown / Clean Export
  hasCleanExport: boolean;
  cleanExportFormats: string[];
}

export interface RobotsTxtResult {
  exists: boolean;
  allowsGooglebot: boolean;
  allowsGptBot: boolean;
  allowsClaudeBot: boolean;
  allowsPerplexityBot: boolean;
  hasSitemap: boolean;
  crawlDelay: number | null;
  raw: string;
}

export function analyzeCrawlAccess(
  $: CheerioAPI,
  url: string,
  robotsTxt?: string,
  ttfbMs?: number,
): CrawlAccessResult {
  const parsedUrl = new URL(url);

  const canonicalUrl = $('link[rel="canonical"]').attr('href') ?? null;
  const hasCanonical = canonicalUrl !== null;

  const metaRobotsContent = $('meta[name="robots"]').attr('content') ?? null;
  const hasMetaRobots = metaRobotsContent !== null;

  let isIndexable = true;
  if (metaRobotsContent) {
    const directives = metaRobotsContent.toLowerCase();
    if (directives.includes('noindex')) isIndexable = false;
  }

  const hasHreflang = $('link[hreflang]').length > 0;
  const isHttps = parsedUrl.protocol === 'https:';

  const hasCleanUrl =
    !parsedUrl.search ||
    parsedUrl.searchParams.toString().split('&').length <= 2;

  const bodyText = $('body').text().trim();
  const isSpa =
    (bodyText.length < 100 && $('script').length > 3) ||
    ($('#root').length > 0 && bodyText.length < 200) ||
    ($('#app').length > 0 && bodyText.length < 200) ||
    $('[data-reactroot]').length > 0;

  let robotsTxtResult: RobotsTxtResult | null = null;
  if (robotsTxt !== undefined) {
    robotsTxtResult = parseRobotsTxt(robotsTxt);
  }

  // 1.4 JS rendering dependency detection
  const scripts = $('script[src]');
  const heavyJsFrameworks: string[] = [];
  const frameworkPatterns: [RegExp, string][] = [
    [/react/i, 'React'],
    [/angular/i, 'Angular'],
    [/vue/i, 'Vue'],
    [/next/i, 'Next.js'],
    [/nuxt/i, 'Nuxt'],
    [/svelte/i, 'Svelte'],
    [/ember/i, 'Ember'],
  ];
  scripts.each((_, el) => {
    const src = $(el).attr('src') ?? '';
    for (const [pattern, name] of frameworkPatterns) {
      if (pattern.test(src) && !heavyJsFrameworks.includes(name)) {
        heavyJsFrameworks.push(name);
      }
    }
  });

  let jsRenderingDependency: 'none' | 'partial' | 'heavy' = 'none';
  if (isSpa) {
    jsRenderingDependency = 'heavy';
  } else if (heavyJsFrameworks.length > 0) {
    // Framework detected but content is present — likely SSR with hydration
    jsRenderingDependency = bodyText.length > 500 ? 'partial' : 'heavy';
  }

  // 1.5 Content behind interactive elements (tabs, accordions, modals)
  const interactiveSelectors = [
    '[data-toggle]', '[data-bs-toggle]', '.accordion', '.tab-pane',
    '[role="tabpanel"]', '.collapse', '.modal', '[aria-hidden="true"]',
    'details:not([open])', '.expandable', '[class*="accordion"]',
    '[class*="collapsible"]', '[class*="dropdown-content"]',
  ];
  const interactiveElements = $(interactiveSelectors.join(', '));
  const interactiveElementCount = interactiveElements.length;
  const hasContentBehindInteraction = interactiveElementCount > 3;

  // 1.17 llms-full.json detection (from robots.txt or link tag)
  let hasLlmsFullJson = false;
  if (robotsTxt && robotsTxt.includes('llms-full.json')) {
    hasLlmsFullJson = true;
  }
  if ($('link[rel="llms-full"]').length > 0 || $('link[href*="llms-full.json"]').length > 0) {
    hasLlmsFullJson = true;
  }

  // 1.9 Mobile accessibility
  const viewportMeta = $('meta[name="viewport"]').attr('content') ?? '';
  const hasMobileViewport = viewportMeta.includes('width=device-width');
  const hasResponsiveDesign = hasMobileViewport || (
    $('link[media*="max-width"], link[media*="min-width"], style').text().includes('@media')
  );

  // 1.18 Markdown / Clean export versions
  const cleanExportFormats: string[] = [];
  // Check link tags for alternate formats
  $('link[rel="alternate"]').each((_, el) => {
    const type = $(el).attr('type') ?? '';
    const href = $(el).attr('href') ?? '';
    if (type.includes('markdown') || href.endsWith('.md')) cleanExportFormats.push('markdown');
    if (type.includes('text/plain') || href.endsWith('.txt')) cleanExportFormats.push('text');
    if (type === 'application/pdf' || href.endsWith('.pdf')) cleanExportFormats.push('pdf');
  });
  // Check for API/export endpoints in page
  if ($('a[href*="/api/"], a[href*="format=json"], a[href*="format=md"]').length > 0) {
    cleanExportFormats.push('api');
  }
  // llms.txt counts as clean export
  if ($('link[href*="llms.txt"]').length > 0 || (robotsTxt && robotsTxt.includes('llms.txt'))) {
    cleanExportFormats.push('llms-txt');
  }
  const hasCleanExport = cleanExportFormats.length > 0;

  let score = 0;

  if (isHttps) score += 15;
  if (hasCanonical) score += 15;
  if (isIndexable) score += 15;
  if (hasCleanUrl) score += 10;
  if (hasHreflang) score += 5;
  if (!isSpa) score += 10;

  if (robotsTxtResult) {
    if (robotsTxtResult.exists) score += 5;
    if (robotsTxtResult.allowsGooglebot) score += 5;
    if (robotsTxtResult.allowsGptBot) score += 5;
    if (robotsTxtResult.allowsClaudeBot) score += 5;
  }

  if (ttfbMs !== undefined && ttfbMs !== null) {
    if (ttfbMs < 200) score += 8;
    else if (ttfbMs < 500) score += 5;
    else if (ttfbMs < 1000) score += 2;
  }

  // 1.4 JS rendering penalty
  if (jsRenderingDependency === 'none') score += 5;
  else if (jsRenderingDependency === 'partial') score += 2;
  // 'heavy' = 0

  // 1.5 Content behind interaction penalty
  if (!hasContentBehindInteraction) score += 4;

  // 1.17 llms-full.json bonus
  if (hasLlmsFullJson) score += 3;

  // 1.9 Mobile accessibility
  if (hasMobileViewport) score += 3;
  if (hasResponsiveDesign) score += 2;

  // 1.18 Markdown / Clean export
  if (hasCleanExport) score += 2;

  return {
    score: Math.min(100, score),
    hasCanonical,
    canonicalUrl,
    hasMetaRobots,
    metaRobotsContent,
    isIndexable,
    hasHreflang,
    isHttps,
    hasCleanUrl,
    robotsTxt: robotsTxtResult,
    ttfbMs: ttfbMs ?? null,
    isSpa,
    jsRenderingDependency,
    heavyJsFrameworks,
    hasContentBehindInteraction,
    interactiveElementCount,
    hasLlmsFullJson,
    hasMobileViewport,
    hasResponsiveDesign,
    hasCleanExport,
    cleanExportFormats: [...new Set(cleanExportFormats)],
  };
}

function parseRobotsTxt(raw: string): RobotsTxtResult {
  if (!raw || raw.trim().length === 0) {
    return {
      exists: false,
      allowsGooglebot: true,
      allowsGptBot: true,
      allowsClaudeBot: true,
      allowsPerplexityBot: true,
      hasSitemap: false,
      crawlDelay: null,
      raw: '',
    };
  }

  const lines = raw.split('\n').map((l) => l.trim());
  const hasSitemap = lines.some((l) => /^sitemap:/i.test(l));

  let crawlDelay: number | null = null;
  const delayMatch = raw.match(/^crawl-delay:\s*(\d+)/im);
  if (delayMatch) crawlDelay = parseInt(delayMatch[1], 10);

  return {
    exists: true,
    allowsGooglebot: isBotAllowed(lines, 'Googlebot'),
    allowsGptBot: isBotAllowed(lines, 'GPTBot'),
    allowsClaudeBot: isBotAllowed(lines, 'ClaudeBot'),
    allowsPerplexityBot: isBotAllowed(lines, 'PerplexityBot'),
    hasSitemap,
    crawlDelay,
    raw,
  };
}

function isBotAllowed(lines: string[], botName: string): boolean {
  let inSection = false;
  let allowed = true;

  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.replace(/^user-agent:\s*/i, '').trim();
      inSection = agent === '*' || agent.toLowerCase() === botName.toLowerCase();
    } else if (inSection) {
      if (/^disallow:\s*\/$/i.test(line)) {
        allowed = false;
      } else if (/^allow:\s*\/$/i.test(line)) {
        allowed = true;
      }
    }
  }

  return allowed;
}
