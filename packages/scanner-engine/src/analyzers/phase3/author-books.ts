/**
 * Author book authorship analyzer (E-E-A-T authority signal).
 *
 * Searches Open Library + Google Books for books by the author found
 * on-page. Returns unconfirmed candidates that require user attribution
 * before counting toward the authority score.
 *
 * Disambiguation flow:
 *   1. Scanner detects author name on page (via author-eeat.ts)
 *   2. This analyzer searches book APIs → returns BookCandidate[]
 *   3. UI presents candidates to the user for confirmation
 *   4. User marks each as "mine" / "not mine" / "skip"
 *   5. Confirmed books are persisted as AttributionRecord[]
 *   6. Only confirmed attributions contribute to the authority score
 *
 * The same attribution pattern applies to podcast appearances (6.6).
 */

import {
  searchOpenLibraryAuthors,
  getOpenLibraryWorks,
  searchGoogleBooks,
  type BookCandidate,
} from './books-client';

// ── Attribution types (shared with podcast mentions) ─────────────────

export type AttributionStatus = 'unconfirmed' | 'confirmed' | 'rejected';

export interface AttributionRecord {
  /** Stable ID from the source (e.g. "gb:abc123", "ol:/works/OL123W", "taddy:uuid"). */
  candidateId: string;
  /** What type of authority evidence this is. */
  type: 'book' | 'podcast_episode';
  /** User's attribution decision. */
  status: AttributionStatus;
  /** Title for display. */
  title: string;
  /** Additional context for display (publisher, show name, etc.). */
  subtitle: string | null;
  /** When the user made their attribution decision. */
  attributedAt: string | null;
  /** User ID who made the attribution (for audit). */
  attributedBy: string | null;
}

// ── Result types ─────────────────────────────────────────────────────

export interface AuthorBooksResult {
  /** Author name searched. */
  authorName: string;
  /** All candidates found across APIs (for user disambiguation). */
  candidates: BookCandidate[];
  /** Deduplicated candidate count. */
  totalFound: number;
  /**
   * Score based on confirmed attributions only.
   * Returns 0 until the user has confirmed at least one book.
   * Recalculated by computeBookAuthorityScore() after attribution.
   */
  score: number;
  /** Confirmed attributions (populated after user action). */
  confirmed: AttributionRecord[];
}

// ── Main analyzer ────────────────────────────────────────────────────

/**
 * Search book APIs for works by the given author.
 * Returns candidates for user disambiguation — score starts at 0
 * until attributions are confirmed.
 */
export async function analyzeAuthorBooks(authorName: string): Promise<AuthorBooksResult> {
  if (!authorName || authorName.trim().length < 2) {
    return { authorName: '', candidates: [], totalFound: 0, score: 0, confirmed: [] };
  }

  const name = authorName.trim();

  // Run both APIs in parallel
  const [googleResults, olAuthors] = await Promise.all([
    searchGoogleBooks(name, 20),
    searchOpenLibraryAuthors(name, 5),
  ]);

  // For Open Library, fetch works from the best-matching author
  let olResults: BookCandidate[] = [];
  if (olAuthors.length > 0) {
    // Pick the author with the highest work count as the most likely match
    const bestMatch = olAuthors.reduce((a, b) =>
      b.work_count > a.work_count ? b : a,
    );
    olResults = await getOpenLibraryWorks(bestMatch.key, 25);
  }

  // Merge and deduplicate by ISBN or title similarity
  const candidates = deduplicateCandidates([...googleResults, ...olResults]);

  return {
    authorName: name,
    candidates,
    totalFound: candidates.length,
    score: 0, // Always 0 until user confirms attributions
    confirmed: [],
  };
}

/**
 * Compute authority score from user-confirmed book attributions.
 * Called after the user has gone through the disambiguation flow.
 *
 * Scoring:
 *   1+ confirmed book:   25 pts
 *   3+ confirmed books:  +20 pts
 *   5+ confirmed books:  +15 pts
 *   Published by major publisher: +10 pts per (max 20)
 *   Recent publication (< 3 years): +10 pts
 */
export function computeBookAuthorityScore(confirmed: AttributionRecord[], candidates: BookCandidate[]): number {
  const confirmedIds = new Set(confirmed.filter((a) => a.status === 'confirmed').map((a) => a.candidateId));
  const confirmedBooks = candidates.filter((c) => confirmedIds.has(c.id));

  if (confirmedBooks.length === 0) return 0;

  let score = 0;

  // Volume thresholds
  if (confirmedBooks.length >= 1) score += 25;
  if (confirmedBooks.length >= 3) score += 20;
  if (confirmedBooks.length >= 5) score += 15;

  // Major publisher bonus
  const majorPublishers = confirmedBooks.filter((b) => isMajorPublisher(b.publisher));
  score += Math.min(majorPublishers.length * 10, 20);

  // Recency bonus — at least one book in the last 3 years
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const hasRecent = confirmedBooks.some((b) => {
    if (!b.publishedDate) return false;
    try {
      return new Date(b.publishedDate) > threeYearsAgo;
    } catch {
      return false;
    }
  });
  if (hasRecent) score += 10;

  return Math.min(100, score);
}

// ── Helpers ──────────────────────────────────────────────────────────

const MAJOR_PUBLISHERS = [
  'penguin', 'random house', 'harpercollins', 'simon & schuster', 'simon and schuster',
  'hachette', 'macmillan', 'wiley', 'mcgraw', 'pearson', 'oxford university press',
  'cambridge university press', 'springer', 'elsevier', "o'reilly", 'oreilly',
  'apress', 'addison-wesley', 'manning', 'pragmatic', 'no starch',
];

function isMajorPublisher(publisher: string | null): boolean {
  if (!publisher) return false;
  const lower = publisher.toLowerCase();
  return MAJOR_PUBLISHERS.some((p) => lower.includes(p));
}

/**
 * Deduplicate book candidates across APIs.
 * Match by ISBN first (exact), then by normalized title + year (fuzzy).
 */
function deduplicateCandidates(candidates: BookCandidate[]): BookCandidate[] {
  const seen = new Map<string, BookCandidate>();

  for (const book of candidates) {
    // Try ISBN match first
    if (book.isbn) {
      if (seen.has(`isbn:${book.isbn}`)) continue;
      seen.set(`isbn:${book.isbn}`, book);
      continue;
    }

    // Fall back to normalized title + year
    const year = book.publishedDate?.slice(0, 4) ?? 'unknown';
    const normTitle = normalizeTitle(book.title);
    const key = `title:${normTitle}:${year}`;

    if (seen.has(key)) {
      // Prefer Google Books (richer metadata) over Open Library
      const existing = seen.get(key)!;
      if (book.source === 'googlebooks' && existing.source === 'openlibrary') {
        seen.set(key, book);
      }
      continue;
    }

    seen.set(key, book);
  }

  return Array.from(seen.values());
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
