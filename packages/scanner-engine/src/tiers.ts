/**
 * AI Visibility Score tier configuration.
 * Ported from aivs-scanner/inc/score-tiers.php (AIVS_TIER_CONFIG).
 */

export interface TierConfig {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  min: number;
  max: number;
  message: string;
}

export const TIER_CONFIG: TierConfig[] = [
  {
    key: 'authority',
    label: 'AI Authority',
    shortLabel: 'Authority',
    color: '#22C55E',
    min: 90,
    max: 100,
    message: 'Healthy across all layers of the AI Visibility Stack.',
  },
  {
    key: 'extractable',
    label: 'AI Extractable',
    shortLabel: 'Extractable',
    color: '#3B82F6',
    min: 70,
    max: 89,
    message: 'Strong foundation but needs Layer 3 refinement.',
  },
  {
    key: 'readable',
    label: 'AI Readable',
    shortLabel: 'Readable',
    color: '#EAB308',
    min: 40,
    max: 69,
    message: 'Passable but poor extractability — AI can read it but won\'t cite it.',
  },
  {
    key: 'invisible',
    label: 'Invisible to AI',
    shortLabel: 'Invisible',
    color: '#EF4444',
    min: 0,
    max: 39,
    message: 'Failing early layers — AI systems cannot reliably access or understand this content.',
  },
];

export function getTier(score: number): TierConfig {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    TIER_CONFIG.find((t) => clamped >= t.min && clamped <= t.max) ??
    TIER_CONFIG[TIER_CONFIG.length - 1]
  );
}
