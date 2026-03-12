import { describe, it, expect } from 'vitest';
import { getTier, TIER_CONFIG } from './tiers';

describe('getTier', () => {
  it('returns authority tier for score >= 90', () => {
    expect(getTier(95).key).toBe('authority');
  });

  it('returns extractable tier for score 70-89', () => {
    expect(getTier(75).key).toBe('extractable');
  });

  it('returns readable tier for score 40-69', () => {
    expect(getTier(50).key).toBe('readable');
  });

  it('returns invisible tier for score < 40', () => {
    expect(getTier(10).key).toBe('invisible');
  });

  it('clamps scores outside 0-100', () => {
    expect(getTier(-5).key).toBe('invisible');
    expect(getTier(150).key).toBe('authority');
  });

  it('covers full range with no gaps', () => {
    for (let i = 0; i <= 100; i++) {
      expect(getTier(i)).toBeDefined();
    }
  });
});
