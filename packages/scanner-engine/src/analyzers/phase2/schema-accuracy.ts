/**
 * Schema accuracy analyzer — cross-reference structured data vs visible content.
 * Factor 2.16 in the AEO taxonomy.
 *
 * Detects misleading or inaccurate schema markup.
 */

import type { CheerioAPI } from 'cheerio';

export interface SchemaAccuracyResult {
  score: number;
  issues: string[];
  hasMatchingTitle: boolean;
  hasMatchingDescription: boolean;
  hasValidDates: boolean;
  hasMatchingAuthor: boolean;
}

export function analyzeSchemaAccuracy($: CheerioAPI): SchemaAccuracyResult {
  const issues: string[] = [];
  let hasMatchingTitle = true;
  let hasMatchingDescription = true;
  let hasValidDates = true;
  let hasMatchingAuthor = true;

  const pageTitle = $('title').text().trim();
  const h1Text = $('h1').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() ?? '';

  // Extract JSON-LD data
  const schemas: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === 'object') schemas.push(item as Record<string, unknown>);
        // Also extract from @graph
        if (Array.isArray((item as Record<string, unknown>)['@graph'])) {
          for (const graphItem of (item as Record<string, unknown>)['@graph'] as unknown[]) {
            if (graphItem && typeof graphItem === 'object') schemas.push(graphItem as Record<string, unknown>);
          }
        }
      }
    } catch {
      issues.push('Invalid JSON-LD syntax detected');
    }
  });

  for (const schema of schemas) {
    const type = String(schema['@type'] ?? '');

    // Check title/name match
    if (schema['headline'] || schema['name']) {
      const schemaTitle = String(schema['headline'] ?? schema['name'] ?? '');
      if (schemaTitle && pageTitle && !fuzzyMatch(schemaTitle, pageTitle) && !fuzzyMatch(schemaTitle, h1Text)) {
        hasMatchingTitle = false;
        issues.push(`Schema ${type} headline "${schemaTitle.slice(0, 50)}" does not match page title`);
      }
    }

    // Check description match
    if (schema['description']) {
      const schemaDesc = String(schema['description'] ?? '');
      if (schemaDesc && metaDesc && schemaDesc.length > 10 && metaDesc.length > 10) {
        if (!fuzzyMatch(schemaDesc.slice(0, 80), metaDesc.slice(0, 80))) {
          hasMatchingDescription = false;
          issues.push(`Schema ${type} description diverges from meta description`);
        }
      }
    }

    // Check dates are valid and not in the future
    for (const dateField of ['datePublished', 'dateModified', 'dateCreated']) {
      if (schema[dateField]) {
        const dateStr = String(schema[dateField]);
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          hasValidDates = false;
          issues.push(`Schema ${type}.${dateField} has invalid date: "${dateStr}"`);
        } else if (date.getTime() > Date.now() + 86400000) {
          hasValidDates = false;
          issues.push(`Schema ${type}.${dateField} is in the future`);
        }
      }
    }

    // Check author exists on page
    if (schema['author']) {
      const authorObj = schema['author'] as Record<string, unknown>;
      const authorName = String(authorObj['name'] ?? schema['author'] ?? '');
      if (authorName && authorName.length > 2) {
        const bodyText = $('body').text();
        if (!bodyText.includes(authorName)) {
          hasMatchingAuthor = false;
          issues.push(`Schema author "${authorName}" not found in visible page content`);
        }
      }
    }

    // Check for empty required fields
    if (type === 'Product' && !schema['offers']) {
      issues.push('Product schema missing offers/pricing information');
    }
    if (type === 'Article' && !schema['author']) {
      issues.push('Article schema missing author');
    }
    if ((type === 'Review' || type === 'AggregateRating') && !schema['reviewRating'] && !schema['ratingValue']) {
      issues.push('Review schema missing rating value');
    }
  }

  // Scoring
  let score = 100;
  if (!hasMatchingTitle) score -= 20;
  if (!hasMatchingDescription) score -= 15;
  if (!hasValidDates) score -= 20;
  if (!hasMatchingAuthor) score -= 15;
  score -= Math.min(issues.length * 5, 30);

  return {
    score: Math.max(0, score),
    issues,
    hasMatchingTitle,
    hasMatchingDescription,
    hasValidDates,
    hasMatchingAuthor,
  };
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}
