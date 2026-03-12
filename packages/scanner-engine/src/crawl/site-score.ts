/**
 * Site-level scoring — aggregates page scores into a domain-level score.
 *
 * - Homepage weighted 2x
 * - Aggregate issue surfacing
 * - Priority fix list ranked by impact across all pages
 */

import type { ScanFix } from '@aivs/types';

export interface PageScore {
  url: string;
  score: number;
  tier: string;
  pageType: string;
  subScores: Record<string, number>;
  fixes: ScanFix[];
}

export interface SiteScoreResult {
  siteScore: number;
  siteTier: string;
  totalPages: number;
  avgScore: number;
  pageBreakdown: {
    authority: number;
    extractable: number;
    readable: number;
    invisible: number;
  };
  aggregateIssues: AggregateIssue[];
  priorityFixes: AggregateFix[];
  subScoreAverages: Record<string, number>;
}

export interface AggregateIssue {
  description: string;
  affectedPages: number;
  totalPages: number;
  percentage: number;
}

export interface AggregateFix {
  description: string;
  avgPoints: number;
  affectedPages: number;
  totalImpact: number;
  layer: string;
  factorId: string;
}

export function computeSiteScore(pages: PageScore[]): SiteScoreResult {
  if (pages.length === 0) {
    return {
      siteScore: 0,
      siteTier: 'invisible',
      totalPages: 0,
      avgScore: 0,
      pageBreakdown: { authority: 0, extractable: 0, readable: 0, invisible: 0 },
      aggregateIssues: [],
      priorityFixes: [],
      subScoreAverages: {},
    };
  }

  // Weighted average: homepage gets 2x weight
  let totalWeight = 0;
  let weightedSum = 0;

  for (const page of pages) {
    const weight = page.pageType === 'homepage' ? 2 : 1;
    weightedSum += page.score * weight;
    totalWeight += weight;
  }

  const siteScore = Math.round(weightedSum / totalWeight);
  const avgScore = Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length);

  // Tier breakdown
  const pageBreakdown = {
    authority: pages.filter((p) => p.score >= 90).length,
    extractable: pages.filter((p) => p.score >= 70 && p.score < 90).length,
    readable: pages.filter((p) => p.score >= 40 && p.score < 70).length,
    invisible: pages.filter((p) => p.score < 40).length,
  };

  // Site tier
  let siteTier = 'invisible';
  if (siteScore >= 90) siteTier = 'authority';
  else if (siteScore >= 70) siteTier = 'extractable';
  else if (siteScore >= 40) siteTier = 'readable';

  // Sub-score averages
  const subScoreKeys = new Set<string>();
  for (const page of pages) {
    for (const key of Object.keys(page.subScores)) subScoreKeys.add(key);
  }

  const subScoreAverages: Record<string, number> = {};
  for (const key of subScoreKeys) {
    const values = pages.map((p) => p.subScores[key] ?? 0);
    subScoreAverages[key] = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  }

  // Aggregate issues
  const aggregateIssues: AggregateIssue[] = [];
  const totalPages = pages.length;

  const issueChecks: { key: string; check: (p: PageScore) => boolean; desc: string }[] = [
    { key: 'faq', check: (p) => (p.subScores.faq ?? 0) < 20, desc: 'Missing FAQ/Q&A content' },
    { key: 'schema', check: (p) => (p.subScores.schema ?? 0) < 30, desc: 'Missing or minimal structured data' },
    { key: 'summary', check: (p) => (p.subScores.summary ?? 0) < 30, desc: 'No meta description or front-loaded summary' },
    { key: 'feed', check: (p) => (p.subScores.feed ?? 0) < 20, desc: 'Missing sitemap/feed references' },
    { key: 'entity', check: (p) => (p.subScores.entity ?? 0) < 30, desc: 'Low entity density' },
    { key: 'structure', check: (p) => (p.subScores.structure ?? 0) < 40, desc: 'Poor heading hierarchy or content structure' },
    { key: 'crawlAccess', check: (p) => (p.subScores.crawlAccess ?? 0) < 50, desc: 'Crawl access issues (missing canonical, noindex, etc.)' },
  ];

  for (const ic of issueChecks) {
    const affected = pages.filter(ic.check).length;
    if (affected > 0) {
      aggregateIssues.push({
        description: ic.desc,
        affectedPages: affected,
        totalPages,
        percentage: Math.round((affected / totalPages) * 100),
      });
    }
  }

  aggregateIssues.sort((a, b) => b.affectedPages - a.affectedPages);

  // Aggregate fixes (deduplicate and rank by total impact)
  const fixMap = new Map<string, { fix: ScanFix; count: number; totalPoints: number }>();

  for (const page of pages) {
    for (const fix of page.fixes) {
      const key = fix.factorId + ':' + fix.description.slice(0, 50);
      const existing = fixMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalPoints += fix.points;
      } else {
        fixMap.set(key, { fix, count: 1, totalPoints: fix.points });
      }
    }
  }

  const priorityFixes: AggregateFix[] = Array.from(fixMap.values())
    .map((entry) => ({
      description: entry.fix.description,
      avgPoints: Math.round(entry.totalPoints / entry.count),
      affectedPages: entry.count,
      totalImpact: entry.totalPoints,
      layer: entry.fix.layer,
      factorId: entry.fix.factorId,
    }))
    .sort((a, b) => b.totalImpact - a.totalImpact)
    .slice(0, 20);

  return {
    siteScore,
    siteTier,
    totalPages,
    avgScore,
    pageBreakdown,
    aggregateIssues,
    priorityFixes,
    subScoreAverages,
  };
}
