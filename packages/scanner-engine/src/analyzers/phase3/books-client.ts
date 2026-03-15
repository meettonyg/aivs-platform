/**
 * Book authorship API clients — Open Library + Google Books.
 *
 * Both APIs are free with no key required (Google Books has 1K/day free).
 * Results include enough metadata for the user to disambiguate
 * common author names (publisher, year, cover image, ISBN).
 */

import { request } from 'undici';
import type { BookCandidate } from './authority-cache';

export interface OpenLibraryAuthor {
  key: string;
  name: string;
  work_count: number;
  top_work: string | null;
  top_subjects: string[];
}

// ── Open Library ─────────────────────────────────────────────────────

/**
 * Search Open Library for authors matching a name.
 * Returns candidate authors the user can pick from to disambiguate.
 */
export async function searchOpenLibraryAuthors(
  authorName: string,
  limit = 5,
): Promise<OpenLibraryAuthor[]> {
  try {
    const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}&limit=${limit}`;
    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'AIVisibilityScanner/1.0' },
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      docs?: {
        key: string;
        name: string;
        work_count?: number;
        top_work?: string;
        top_subjects?: string[];
      }[];
    };

    return (data.docs ?? []).map((doc) => ({
      key: doc.key,
      name: doc.name,
      work_count: doc.work_count ?? 0,
      top_work: doc.top_work ?? null,
      top_subjects: doc.top_subjects ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch books by a specific Open Library author ID.
 * Called after the user has confirmed which author they are.
 */
export async function getOpenLibraryWorks(
  authorKey: string,
  limit = 25,
): Promise<BookCandidate[]> {
  try {
    const url = `https://openlibrary.org/authors/${authorKey}/works.json?limit=${limit}`;
    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'AIVisibilityScanner/1.0' },
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      entries?: {
        key: string;
        title: string;
        covers?: number[];
        first_publish_date?: string;
        subjects?: string[];
        description?: string | { value: string };
      }[];
    };

    return (data.entries ?? []).map((entry) => {
      const coverId = entry.covers?.[0];
      const desc = typeof entry.description === 'string'
        ? entry.description
        : entry.description?.value ?? null;

      return {
        id: `ol:${entry.key}`,
        title: entry.title,
        authors: [],
        publisher: null,
        publishedDate: entry.first_publish_date ?? null,
        isbn: null,
        pageCount: null,
        description: desc,
        coverImageUrl: coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
          : null,
        subjects: (entry.subjects ?? []).slice(0, 5),
        source: 'openlibrary' as const,
        infoUrl: `https://openlibrary.org${entry.key}`,
      };
    });
  } catch {
    return [];
  }
}

// ── Google Books ─────────────────────────────────────────────────────

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY; // Optional — works without key at lower rate limit

/**
 * Search Google Books for books by an author name.
 * Returns candidates with enough detail for the user to disambiguate.
 */
export async function searchGoogleBooks(
  authorName: string,
  limit = 20,
): Promise<BookCandidate[]> {
  try {
    let url = `https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(authorName)}&maxResults=${Math.min(limit, 40)}&orderBy=relevance`;
    if (GOOGLE_BOOKS_API_KEY) {
      url += `&key=${GOOGLE_BOOKS_API_KEY}`;
    }

    const res = await request(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      items?: {
        id: string;
        selfLink: string;
        volumeInfo: {
          title: string;
          authors?: string[];
          publisher?: string;
          publishedDate?: string;
          description?: string;
          pageCount?: number;
          categories?: string[];
          imageLinks?: { thumbnail?: string; smallThumbnail?: string };
          industryIdentifiers?: { type: string; identifier: string }[];
          infoLink?: string;
        };
      }[];
    };

    return (data.items ?? []).map((item) => {
      const vol = item.volumeInfo;
      const isbn = vol.industryIdentifiers?.find(
        (id) => id.type === 'ISBN_13' || id.type === 'ISBN_10',
      )?.identifier ?? null;

      return {
        id: `gb:${item.id}`,
        title: vol.title,
        authors: vol.authors ?? [],
        publisher: vol.publisher ?? null,
        publishedDate: vol.publishedDate ?? null,
        isbn,
        pageCount: vol.pageCount ?? null,
        description: vol.description ?? null,
        coverImageUrl: vol.imageLinks?.thumbnail ?? vol.imageLinks?.smallThumbnail ?? null,
        subjects: (vol.categories ?? []).slice(0, 5),
        source: 'googlebooks' as const,
        infoUrl: vol.infoLink ?? null,
      };
    });
  } catch {
    return [];
  }
}
