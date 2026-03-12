/**
 * Fix generation engine.
 * Ported from aivs_generate_fixes() in scanner-engine.php.
 *
 * Analyzes sub-scores and extraction data to produce prioritized fix recommendations.
 */

import type { ScanFix, SubScores } from '@aivs/types';

interface ExtractionData {
  schema?: { types?: string[]; details?: Record<string, boolean>; jsonLdCount?: number };
  structure?: { headingHierarchyValid?: boolean; wordCount?: number; listCount?: number; tableCount?: number };
  faq?: { hasFaqSchema?: boolean; questionPatterns?: number };
  summary?: { metaDescriptionLength?: number; hasOgDescription?: boolean; hasDefinitionPattern?: boolean; hasTldr?: boolean };
  feeds?: { hasRss?: boolean; hasSitemap?: boolean; hasLlmsTxt?: boolean };
  entities?: { entityDensity?: number; hasAuthor?: boolean };
  crawlAccess?: { isHttps?: boolean; hasCanonical?: boolean; isIndexable?: boolean; isSpa?: boolean };
  contentRichness?: { hasStatistics?: boolean; hasCitations?: boolean; hasImages?: boolean; hasAuthor?: boolean; hasFreshDate?: boolean };
}

export function generateFixes(
  subScores: SubScores,
  extraction: ExtractionData,
): ScanFix[] {
  const fixes: ScanFix[] = [];
  let priority = 1;

  // Crawl Access fixes
  if (subScores.crawlAccess < 60) {
    if (!extraction.crawlAccess?.isHttps) {
      fixes.push({
        description: 'Migrate to HTTPS. AI crawlers and search engines prefer secure connections.',
        points: 8,
        layer: 'access',
        factorId: '1.8',
        priority: priority++,
      });
    }
    if (!extraction.crawlAccess?.hasCanonical) {
      fixes.push({
        description: 'Add a canonical URL tag to prevent duplicate content issues with AI crawlers.',
        points: 5,
        layer: 'access',
        factorId: '1.12',
        priority: priority++,
      });
    }
    if (extraction.crawlAccess?.isSpa) {
      fixes.push({
        description: 'Implement server-side rendering (SSR). AI crawlers often cannot execute JavaScript to access your content.',
        points: 12,
        layer: 'access',
        factorId: '1.4',
        priority: priority++,
      });
    }
  }

  // Schema fixes
  if (subScores.schema < 50) {
    const schemaDetails = extraction.schema?.details;
    if (!extraction.schema?.jsonLdCount) {
      fixes.push({
        description: 'Add JSON-LD structured data. This is the preferred format for AI systems to understand your content.',
        points: 15,
        layer: 'understanding',
        factorId: '2.1',
        priority: priority++,
      });
    }
    if (schemaDetails && !schemaDetails.article && !schemaDetails.product && !schemaDetails.localBusiness) {
      fixes.push({
        description: 'Add a primary schema type (Article, Product, or LocalBusiness) that matches your page content.',
        points: 10,
        layer: 'understanding',
        factorId: '2.1',
        priority: priority++,
      });
    }
    if (schemaDetails && !schemaDetails.breadcrumb) {
      fixes.push({
        description: 'Add BreadcrumbList schema to help AI systems understand your site hierarchy.',
        points: 5,
        layer: 'understanding',
        factorId: '2.11',
        priority: priority++,
      });
    }
  }

  // Structure fixes
  if (subScores.structure < 60) {
    if (!extraction.structure?.headingHierarchyValid) {
      fixes.push({
        description: 'Fix heading hierarchy. Use a single H1 and maintain proper H2 > H3 > H4 nesting without skipping levels.',
        points: 8,
        layer: 'understanding',
        factorId: '3.4',
        priority: priority++,
      });
    }
    if (!extraction.structure?.listCount) {
      fixes.push({
        description: 'Add bulleted or numbered lists to break up content. AI systems extract list items as discrete facts.',
        points: 5,
        layer: 'extractability',
        factorId: '3.10',
        priority: priority++,
      });
    }
    if ((extraction.structure?.wordCount ?? 0) < 300) {
      fixes.push({
        description: 'Add more substantive content. Pages under 300 words provide insufficient signal for AI systems to extract.',
        points: 8,
        layer: 'extractability',
        factorId: '3.9',
        priority: priority++,
      });
    }
  }

  // FAQ fixes
  if (subScores.faq < 40) {
    if (!extraction.faq?.hasFaqSchema) {
      fixes.push({
        description: 'Add FAQPage structured data with at least 3 question-answer pairs relevant to your topic.',
        points: 12,
        layer: 'extractability',
        factorId: '2.5',
        priority: priority++,
      });
    }
    if (!extraction.faq?.questionPatterns) {
      fixes.push({
        description: 'Include question-format headings (Who, What, When, Where, Why, How) that mirror how users ask AI systems.',
        points: 8,
        layer: 'extractability',
        factorId: '3.6',
        priority: priority++,
      });
    }
  }

  // Summary fixes
  if (subScores.summary < 50) {
    if (!extraction.summary?.metaDescriptionLength) {
      fixes.push({
        description: 'Add a meta description (120-160 characters) that concisely defines what this page covers.',
        points: 8,
        layer: 'extractability',
        factorId: '3.5',
        priority: priority++,
      });
    }
    if (!extraction.summary?.hasDefinitionPattern) {
      fixes.push({
        description: 'Start your content with a clear definition or direct answer in the first paragraph.',
        points: 10,
        layer: 'extractability',
        factorId: '3.1',
        priority: priority++,
      });
    }
    if (!extraction.summary?.hasTldr) {
      fixes.push({
        description: 'Add a "Key Takeaways" or summary section at the top of long-form content.',
        points: 5,
        layer: 'extractability',
        factorId: '3.14',
        priority: priority++,
      });
    }
  }

  // Feed fixes
  if (subScores.feed < 40) {
    if (!extraction.feeds?.hasSitemap) {
      fixes.push({
        description: 'Create and submit an XML sitemap. This is essential for AI crawlers to discover all your content.',
        points: 10,
        layer: 'access',
        factorId: '1.10',
        priority: priority++,
      });
    }
    if (!extraction.feeds?.hasRss) {
      fixes.push({
        description: 'Add an RSS feed. Some AI systems use feeds to discover and track content updates.',
        points: 5,
        layer: 'access',
        factorId: '1.10',
        priority: priority++,
      });
    }
    if (!extraction.feeds?.hasLlmsTxt) {
      fixes.push({
        description: 'Add an llms.txt file to provide AI systems with a structured overview of your site content.',
        points: 8,
        layer: 'access',
        factorId: '1.16',
        priority: priority++,
      });
    }
  }

  // Entity fixes
  if (subScores.entity < 40) {
    if ((extraction.entities?.entityDensity ?? 0) < 1) {
      fixes.push({
        description: 'Increase named entity density. Use specific names, brands, locations, and technical terms rather than generic language.',
        points: 8,
        layer: 'understanding',
        factorId: '4.1',
        priority: priority++,
      });
    }
  }

  // Content richness fixes
  if (subScores.contentRichness < 50) {
    if (!extraction.contentRichness?.hasAuthor) {
      fixes.push({
        description: 'Add a named author with credentials. AI systems use author signals for E-E-A-T assessment.',
        points: 10,
        layer: 'extractability',
        factorId: '5.1',
        priority: priority++,
      });
    }
    if (!extraction.contentRichness?.hasFreshDate) {
      fixes.push({
        description: 'Add or update the dateModified in Article schema. AI systems strongly prefer recent content.',
        points: 8,
        layer: 'extractability',
        factorId: '5.12',
        priority: priority++,
      });
    }
    if (!extraction.contentRichness?.hasCitations) {
      fixes.push({
        description: 'Add outbound links to authoritative sources. Primary-source citations increase trust signals.',
        points: 7,
        layer: 'extractability',
        factorId: '5.9',
        priority: priority++,
      });
    }
    if (!extraction.contentRichness?.hasStatistics) {
      fixes.push({
        description: 'Include verifiable statistics and data points. Fact-dense content is more likely to be cited by AI.',
        points: 6,
        layer: 'extractability',
        factorId: '3.9',
        priority: priority++,
      });
    }
  }

  // Speakable fixes
  if (subScores.speakable === 0) {
    fixes.push({
      description: 'Add speakable structured data to indicate which content sections are suitable for voice assistant readout.',
      points: 5,
      layer: 'extractability',
      factorId: '2.10',
      priority: priority++,
    });
  }

  // Sort by points (highest impact first), then by priority
  fixes.sort((a, b) => b.points - a.points || a.priority - b.priority);

  // Re-assign priority after sorting
  return fixes.map((fix, i) => ({ ...fix, priority: i + 1 }));
}
