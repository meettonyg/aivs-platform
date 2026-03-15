/**
 * Academic papers analyzer (individual-level authority signal).
 *
 * Searches Semantic Scholar + Crossref for papers by the author.
 * Returns candidates for user disambiguation (common academic names).
 * Score is 0 until attributions are confirmed.
 */

import {
  searchSemanticScholarAuthors,
  getSemanticScholarPapers,
  searchCrossrefWorks,
  type AcademicAuthorCandidate,
  type AcademicPaperInfo,
} from './academic-client';
import type { AttributionRecord } from './authority-cache';

export interface AcademicPapersResult {
  authorName: string;
  /** Author candidates from Semantic Scholar for disambiguation. */
  authorCandidates: AcademicAuthorCandidate[];
  /** Paper candidates (fetched after author selection or from Crossref). */
  papers: AcademicPaperInfo[];
  totalPapers: number;
  totalCitations: number;
  hIndex: number;
  confirmed: AttributionRecord[];
  score: number;
}

export async function analyzeAcademicPapers(authorName: string): Promise<AcademicPapersResult> {
  const empty: AcademicPapersResult = {
    authorName: '', authorCandidates: [], papers: [], totalPapers: 0,
    totalCitations: 0, hIndex: 0, confirmed: [], score: 0,
  };

  if (!authorName || authorName.trim().length < 2) return empty;

  const name = authorName.trim();

  // Run both APIs in parallel
  const [s2Authors, crossrefPapers] = await Promise.all([
    searchSemanticScholarAuthors(name, 5),
    searchCrossrefWorks(name, 20),
  ]);

  // For Semantic Scholar, fetch papers from the best-matching author
  let s2Papers: AcademicPaperInfo[] = [];
  let bestAuthor: AcademicAuthorCandidate | null = null;

  if (s2Authors.length > 0) {
    bestAuthor = s2Authors.reduce((a, b) =>
      b.citationCount > a.citationCount ? b : a,
    );
    s2Papers = await getSemanticScholarPapers(bestAuthor.id, 20);
  }

  // Merge and deduplicate papers by DOI
  const papers = deduplicatePapers([...s2Papers, ...crossrefPapers]);

  // Use Semantic Scholar metrics if available (more reliable than computing from papers)
  const totalCitations = bestAuthor?.citationCount ?? papers.reduce((s, p) => s + p.citationCount, 0);
  const hIndex = bestAuthor?.hIndex ?? 0;
  const totalPapers = bestAuthor?.paperCount ?? papers.length;

  return {
    authorName: name,
    authorCandidates: s2Authors,
    papers: papers.slice(0, 25),
    totalPapers,
    totalCitations,
    hIndex,
    confirmed: [],
    score: 0, // 0 until user confirms which author they are
  };
}

/**
 * Compute academic authority score from confirmed attribution.
 */
export function computeAcademicAuthorityScore(result: AcademicPapersResult): number {
  // Score is based on the selected author's metrics
  // (confirmed means user picked which S2 author they are)
  const confirmedAuthor = result.confirmed.some((a) => a.status === 'confirmed');
  if (!confirmedAuthor && result.confirmed.length > 0) return 0;

  // If no confirmation flow yet but papers were found, allow scoring
  // (this handles the case where there's only one obvious match)
  if (result.totalPapers === 0) return 0;

  let score = 0;

  // Paper count
  if (result.totalPapers >= 1) score += 20;
  if (result.totalPapers >= 5) score += 10;
  if (result.totalPapers >= 20) score += 10;

  // Citation count
  if (result.totalCitations >= 50) score += 15;
  if (result.totalCitations >= 500) score += 15;

  // h-index
  if (result.hIndex >= 5) score += 15;
  if (result.hIndex >= 15) score += 15;

  return Math.min(100, score);
}

function deduplicatePapers(papers: AcademicPaperInfo[]): AcademicPaperInfo[] {
  const seen = new Map<string, AcademicPaperInfo>();

  for (const paper of papers) {
    if (paper.doi) {
      const doiKey = `doi:${paper.doi.toLowerCase()}`;
      if (!seen.has(doiKey)) {
        seen.set(doiKey, paper);
      }
      continue;
    }

    const titleKey = `title:${paper.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (!seen.has(titleKey)) {
      seen.set(titleKey, paper);
    }
  }

  return Array.from(seen.values());
}
