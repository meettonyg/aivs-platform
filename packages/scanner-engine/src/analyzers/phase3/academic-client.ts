/**
 * Academic citation API clients — Crossref + Semantic Scholar.
 *
 * Both APIs are free with no key required.
 * Crossref: works search by author name.
 * Semantic Scholar: author search with citation metrics and h-index.
 */

import { request } from 'undici';

// ── Types ────────────────────────────────────────────────────────────

export interface AcademicAuthorCandidate {
  /** Source-specific ID. */
  id: string;
  name: string;
  affiliations: string[];
  paperCount: number;
  citationCount: number;
  hIndex: number;
  source: 'semanticscholar' | 'crossref';
  profileUrl: string | null;
}

export interface AcademicPaperInfo {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  citationCount: number;
  venue: string | null;
  doi: string | null;
  url: string | null;
  source: 'semanticscholar' | 'crossref';
}

// ── Semantic Scholar ─────────────────────────────────────────────────

const S2_API_BASE = 'https://api.semanticscholar.org/graph/v1';

/**
 * Search for authors by name on Semantic Scholar.
 * Free, no key needed. 100 requests/second limit.
 */
export async function searchSemanticScholarAuthors(
  authorName: string,
  limit = 5,
): Promise<AcademicAuthorCandidate[]> {
  try {
    const url = `${S2_API_BASE}/author/search?query=${encodeURIComponent(authorName)}&limit=${limit}&fields=name,affiliations,paperCount,citationCount,hIndex,url`;
    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'AIVisibilityScanner/1.0' },
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      data?: {
        authorId: string;
        name: string;
        affiliations?: string[];
        paperCount?: number;
        citationCount?: number;
        hIndex?: number;
        url?: string;
      }[];
    };

    return (data.data ?? []).map((author) => ({
      id: `s2:${author.authorId}`,
      name: author.name,
      affiliations: author.affiliations ?? [],
      paperCount: author.paperCount ?? 0,
      citationCount: author.citationCount ?? 0,
      hIndex: author.hIndex ?? 0,
      source: 'semanticscholar' as const,
      profileUrl: author.url ?? `https://www.semanticscholar.org/author/${author.authorId}`,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch papers by a specific Semantic Scholar author ID.
 */
export async function getSemanticScholarPapers(
  authorId: string,
  limit = 20,
): Promise<AcademicPaperInfo[]> {
  try {
    // authorId comes as "s2:12345" — strip the prefix
    const cleanId = authorId.replace(/^s2:/, '');
    const url = `${S2_API_BASE}/author/${cleanId}/papers?limit=${limit}&fields=title,authors,year,citationCount,venue,externalIds,url`;
    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'AIVisibilityScanner/1.0' },
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      data?: {
        paperId: string;
        title: string;
        authors?: { name: string }[];
        year?: number;
        citationCount?: number;
        venue?: string;
        externalIds?: { DOI?: string };
        url?: string;
      }[];
    };

    return (data.data ?? []).map((paper) => ({
      id: `s2p:${paper.paperId}`,
      title: paper.title,
      authors: (paper.authors ?? []).map((a) => a.name),
      year: paper.year ?? null,
      citationCount: paper.citationCount ?? 0,
      venue: paper.venue || null,
      doi: paper.externalIds?.DOI ?? null,
      url: paper.url ?? null,
      source: 'semanticscholar' as const,
    }));
  } catch {
    return [];
  }
}

// ── Crossref ─────────────────────────────────────────────────────────

const CROSSREF_API_BASE = 'https://api.crossref.org';

/**
 * Search Crossref for works by an author.
 * Free, no key needed. Polite pool with mailto.
 */
export async function searchCrossrefWorks(
  authorName: string,
  limit = 20,
): Promise<AcademicPaperInfo[]> {
  try {
    const url = `${CROSSREF_API_BASE}/works?query.author=${encodeURIComponent(authorName)}&rows=${limit}&select=DOI,title,author,published-print,is-referenced-by-count,container-title&mailto=scanner@aivs.app`;
    const res = await request(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'AIVisibilityScanner/1.0 (mailto:scanner@aivs.app)' },
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      message?: {
        items?: {
          DOI: string;
          title?: string[];
          author?: { given?: string; family?: string }[];
          'published-print'?: { 'date-parts'?: number[][] };
          'is-referenced-by-count'?: number;
          'container-title'?: string[];
        }[];
      };
    };

    return (data.message?.items ?? []).map((item) => ({
      id: `cr:${item.DOI}`,
      title: item.title?.[0] ?? 'Untitled',
      authors: (item.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ')),
      year: item['published-print']?.['date-parts']?.[0]?.[0] ?? null,
      citationCount: item['is-referenced-by-count'] ?? 0,
      venue: item['container-title']?.[0] ?? null,
      doi: item.DOI,
      url: `https://doi.org/${item.DOI}`,
      source: 'crossref' as const,
    }));
  } catch {
    return [];
  }
}
