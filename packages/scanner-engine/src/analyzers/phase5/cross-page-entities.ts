/**
 * Cross-page entity consistency analyzer (Factor 4.5).
 *
 * Requires multi-page crawl data from Phase 2.
 * Checks that entities (org name, author names, product names) are
 * consistent across all pages in a site crawl.
 */

export interface CrossPageEntityResult {
  score: number;
  organizationConsistency: number;
  authorConsistency: number;
  entityOverlap: number;
  inconsistencies: EntityInconsistency[];
}

export interface EntityInconsistency {
  entityType: string;
  variants: string[];
  affectedUrls: string[];
  description: string;
}

interface PageEntityData {
  url: string;
  organizationNames: string[];
  authorNames: string[];
  topEntities: string[];
}

export function analyzeCrossPageEntities(
  pages: PageEntityData[],
): CrossPageEntityResult {
  if (pages.length < 2) {
    return {
      score: 100,
      organizationConsistency: 100,
      authorConsistency: 100,
      entityOverlap: 100,
      inconsistencies: [],
    };
  }

  const inconsistencies: EntityInconsistency[] = [];

  // Organization name consistency
  const orgNames = new Map<string, string[]>();
  for (const page of pages) {
    for (const name of page.organizationNames) {
      const key = normalize(name);
      if (!orgNames.has(key)) orgNames.set(key, []);
      orgNames.get(key)!.push(page.url);
    }
  }
  // Find variant spellings of the same org
  const orgVariants = findVariants(
    pages.flatMap((p) => p.organizationNames),
  );

  if (orgVariants.length > 0) {
    inconsistencies.push({
      entityType: 'Organization',
      variants: orgVariants,
      affectedUrls: pages.filter((p) =>
        p.organizationNames.some((n) => orgVariants.some((v) => fuzzyMatch(n, v))),
      ).map((p) => p.url),
      description: `Organization name appears in ${orgVariants.length} different forms`,
    });
  }

  const organizationConsistency = orgVariants.length <= 1 ? 100 : Math.max(0, 100 - orgVariants.length * 20);

  // Author name consistency
  const allAuthors = pages.flatMap((p) => p.authorNames).filter(Boolean);
  const authorVariants = findVariants(allAuthors);
  const authorConsistency = authorVariants.length <= 1 ? 100 : Math.max(0, 100 - authorVariants.length * 15);

  if (authorVariants.length > 1) {
    inconsistencies.push({
      entityType: 'Author',
      variants: authorVariants,
      affectedUrls: pages.filter((p) =>
        p.authorNames.some((n) => authorVariants.some((v) => fuzzyMatch(n, v))),
      ).map((p) => p.url),
      description: `Author names have ${authorVariants.length} variant spellings`,
    });
  }

  // Entity overlap across pages (shared entities = good topical coherence)
  const entitySets = pages.map((p) => new Set(p.topEntities.map(normalize)));
  let overlapSum = 0;
  let overlapCount = 0;

  for (let i = 0; i < entitySets.length; i++) {
    for (let j = i + 1; j < entitySets.length; j++) {
      const a = entitySets[i];
      const b = entitySets[j];
      const intersection = [...a].filter((e) => b.has(e)).length;
      const union = new Set([...a, ...b]).size;
      if (union > 0) {
        overlapSum += intersection / union;
        overlapCount++;
      }
    }
  }

  const entityOverlap = overlapCount > 0
    ? Math.round((overlapSum / overlapCount) * 100)
    : 50;

  // Overall score
  let score = 0;
  score += organizationConsistency * 0.35;
  score += authorConsistency * 0.30;
  score += entityOverlap * 0.35;

  return {
    score: Math.round(Math.min(100, score)),
    organizationConsistency,
    authorConsistency,
    entityOverlap,
    inconsistencies,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function findVariants(names: string[]): string[] {
  if (names.length === 0) return [];

  // Group by normalized form
  const groups = new Map<string, Set<string>>();
  for (const name of names) {
    const key = normalize(name);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(name);
  }

  // Find the most common form and its variants
  const variants: string[] = [];
  for (const [, forms] of groups) {
    if (forms.size > 1) {
      variants.push(...forms);
    }
  }

  // Also check for similar names that may be variants
  const uniqueNames = [...new Set(names)];
  for (let i = 0; i < uniqueNames.length; i++) {
    for (let j = i + 1; j < uniqueNames.length; j++) {
      const a = normalize(uniqueNames[i]);
      const b = normalize(uniqueNames[j]);
      if (a !== b && (a.includes(b) || b.includes(a))) {
        if (!variants.includes(uniqueNames[i])) variants.push(uniqueNames[i]);
        if (!variants.includes(uniqueNames[j])) variants.push(uniqueNames[j]);
      }
    }
  }

  return [...new Set(variants)];
}
