/**
 * Main scan orchestrator.
 * Ported from aivs_scan_url() in aivs-scanner/inc/scanner-engine.php.
 *
 * TODO: Port each analyzer function from PHP to TypeScript.
 * See scanner-engine.php lines 30-180 for the full orchestration flow.
 */

import type { ScanResult, ScanOptions } from '@aivs/types';
import { getTier } from './tiers';

/**
 * Scoring weights — extracted from scanner-engine.php lines 184-192.
 * Configurable so they can evolve as new factors are added.
 */
export const SCORING_WEIGHTS = {
  schema: 0.20,
  entity: 0.15,
  speakable: 0.10,
  structure: 0.15,
  faq: 0.15,
  summary: 0.15,
  feed: 0.10,
} as const;

export async function scanUrl(
  url: string,
  options?: ScanOptions
): Promise<ScanResult> {
  // TODO: Implement — port from aivs_scan_url()
  // 1. Validate URL (SSRF protection)
  // 2. Fetch HTML via undici
  // 3. Parse with cheerio
  // 4. Run all analyzers
  // 5. Calculate weighted score
  // 6. Generate fixes
  // 7. Generate citation simulation
  throw new Error('Not yet implemented — port from scanner-engine.php');
}
