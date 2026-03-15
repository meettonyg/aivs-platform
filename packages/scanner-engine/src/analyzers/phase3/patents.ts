/**
 * Patents analyzer (person-level authority signal).
 *
 * Uses the USPTO PatentsView API (free, no key required).
 * Searches for patents by inventor name and returns candidates
 * for user attribution (confirm which patents are theirs).
 *
 * Score is 0 until confirmed.
 */

import type {
  AttributionRecord,
  PatentsResult,
  PatentCandidate,
} from './authority-cache';

export type { PatentsResult, PatentCandidate };

const PATENTSVIEW_API = 'https://api.patentsview.org/patents/query';

/**
 * Search USPTO PatentsView for patents by inventor name.
 */
export async function analyzePatents(personName: string): Promise<PatentsResult> {
  if (!personName || personName.trim().length < 2) {
    return { inventorName: '', candidates: [], totalPatents: 0, confirmedPatents: 0, confirmed: [], score: 0 };
  }

  const name = personName.trim();

  try {
    const candidates = await searchPatentsByInventor(name);

    return {
      inventorName: name,
      candidates,
      totalPatents: candidates.length,
      confirmedPatents: 0,
      confirmed: [],
      score: 0, // 0 until confirmed
    };
  } catch {
    return { inventorName: name, candidates: [], totalPatents: 0, confirmedPatents: 0, confirmed: [], score: 0 };
  }
}

/**
 * Compute patent authority score from confirmed patents.
 */
export function computePatentAuthorityScore(
  confirmed: AttributionRecord[],
  candidates: PatentCandidate[],
): number {
  const confirmedIds = new Set(
    confirmed.filter((a) => a.status === 'confirmed').map((a) => a.candidateId),
  );
  const confirmedPatents = candidates.filter((c) => confirmedIds.has(c.id));

  if (confirmedPatents.length === 0) return 0;

  let score = 0;

  // Has at least one patent
  score += 25;

  // Patent count tiers
  if (confirmedPatents.length >= 3) score += 20;
  if (confirmedPatents.length >= 10) score += 15;

  // Recent patent (within last 5 years)
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const hasRecent = confirmedPatents.some((p) => {
    if (!p.dateGranted) return false;
    return new Date(p.dateGranted) > fiveYearsAgo;
  });
  if (hasRecent) score += 15;

  // Category diversity (CPC classes)
  const allCategories = new Set<string>();
  for (const p of confirmedPatents) {
    for (const cat of p.cpcCategories) {
      // Use top-level CPC class (first character)
      if (cat.length > 0) allCategories.add(cat[0]);
    }
  }
  if (allCategories.size >= 2) score += 10;

  // All granted (vs just applications)
  const allGranted = confirmedPatents.every((p) => p.dateGranted);
  if (allGranted) score += 15;

  return Math.min(100, score);
}

// ── PatentsView API ───────────────────────────────────────────────────

interface PatentsViewResponse {
  patents?: PatentsViewPatent[];
  count?: number;
  total_patent_count?: number;
}

interface PatentsViewPatent {
  patent_number: string;
  patent_title: string;
  patent_abstract: string | null;
  patent_date: string | null;
  app_date: string | null;
  citedby_patent_count?: number;
  inventors?: { inventor_first_name: string; inventor_last_name: string }[];
  assignees?: { assignee_organization: string }[];
  cpcs?: { cpc_group_id: string }[];
}

async function searchPatentsByInventor(name: string): Promise<PatentCandidate[]> {
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ') || firstName;

  // PatentsView expects a specific query format
  const query = JSON.stringify({
    _and: [
      { inventor_first_name: firstName },
      { inventor_last_name: lastName },
    ],
  });

  const fields = [
    'patent_number', 'patent_title', 'patent_abstract', 'patent_date',
    'app_date', 'citedby_patent_count',
    'inventor_first_name', 'inventor_last_name',
    'assignee_organization',
    'cpc_group_id',
  ];

  const body = JSON.stringify({
    q: JSON.parse(query),
    f: fields,
    o: { per_page: 25, page: 1 },
    s: [{ patent_date: 'desc' }],
  });

  const res = await fetch(PATENTSVIEW_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AIVS-Scanner/1.0',
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const data = await res.json() as PatentsViewResponse;
  if (!data.patents) return [];

  return data.patents.map((p) => ({
    id: `patent:${p.patent_number}`,
    patentNumber: p.patent_number,
    title: p.patent_title,
    abstract: p.patent_abstract,
    dateGranted: p.patent_date,
    dateApplication: p.app_date,
    inventors: (p.inventors ?? []).map((i) => `${i.inventor_first_name} ${i.inventor_last_name}`),
    assignees: (p.assignees ?? []).map((a) => a.assignee_organization).filter(Boolean),
    cpcCategories: (p.cpcs ?? []).map((c) => c.cpc_group_id).filter(Boolean),
    citationCount: p.citedby_patent_count ?? 0,
    url: `https://patents.google.com/patent/US${p.patent_number}`,
  }));
}
