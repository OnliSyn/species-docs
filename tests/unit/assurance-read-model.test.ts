import { describe, it, expect } from 'vitest';
import {
  backingPerSpecieParts,
  circulationValueBaseUnits,
  coveragePercentFromPosted,
  coverageRatioPercentCanaryFromPosted,
  toPostedBigInt,
} from '@/lib/assurance-read-model';
import { USDC_SCALE } from '@/lib/amount';

describe('assurance-read-model', () => {
  it('circulationValueBaseUnits pegs 1 Specie to USDC scale', () => {
    expect(circulationValueBaseUnits(3)).toBe(3n * USDC_SCALE);
    expect(circulationValueBaseUnits(0)).toBe(0n);
  });

  it('coveragePercentFromPosted is 100 when no circulation', () => {
    expect(coveragePercentFromPosted(5_000_000n, 0n)).toBe(100);
    expect(coveragePercentFromPosted(0n, -1n)).toBe(100);
  });

  it('coveragePercentFromPosted clamps 0–100', () => {
    expect(coveragePercentFromPosted(USDC_SCALE, USDC_SCALE)).toBe(100);
    expect(coveragePercentFromPosted(USDC_SCALE / 2n, USDC_SCALE)).toBe(50);
    expect(coveragePercentFromPosted(USDC_SCALE * 2n, USDC_SCALE)).toBe(100);
  });

  it('coverageRatioPercentCanaryFromPosted does not cap above 100', () => {
    expect(coverageRatioPercentCanaryFromPosted(USDC_SCALE, USDC_SCALE)).toBe(100);
    expect(coverageRatioPercentCanaryFromPosted(USDC_SCALE * 2n, USDC_SCALE)).toBe(200);
    expect(coverageRatioPercentCanaryFromPosted(USDC_SCALE / 2n, USDC_SCALE)).toBe(50);
  });

  it('backingPerSpecieParts is null without circulation', () => {
    expect(backingPerSpecieParts(5_000_000n, 0)).toBeNull();
    expect(backingPerSpecieParts(5_000_000n, -1)).toBeNull();
  });

  it('backingPerSpecieParts splits dollars and cents', () => {
    const twoSpecie = 2_500_000n;
    const parts = backingPerSpecieParts(twoSpecie, 2);
    expect(parts).toEqual({ dollars: '1', cents: '25' });
  });

  it('toPostedBigInt coerces common inputs', () => {
    expect(toPostedBigInt('12000000')).toBe(12_000_000n);
    expect(toPostedBigInt(99)).toBe(99n);
    expect(toPostedBigInt(null)).toBe(0n);
  });
});
