import type { AssuranceCoverageSnapshot } from '@/lib/sim-client';

const USDC_SCALE = 1_000_000n;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Coerce tool / gen-ui payloads to {@link AssuranceCoverageSnapshot}.
 * Supports the current field names and legacy `{ balance, outstanding, coverage }`
 * where `outstanding` was historically a Specie count (not base units).
 */
export function normalizeAssuranceCoveragePayload(raw: unknown): AssuranceCoverageSnapshot {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  if (
    isFiniteNumber(d.assurancePosted)
    && isFiniteNumber(d.circulationSpecieCount)
    && isFiniteNumber(d.circulationValuePosted)
  ) {
    const derivedPct = d.circulationValuePosted > 0
      ? Math.min(100, Math.max(0, Math.round((d.assurancePosted / d.circulationValuePosted) * 100)))
      : 100;
    const coveragePercent = isFiniteNumber(d.coveragePercent)
      ? Math.min(100, Math.max(0, Math.round(d.coveragePercent)))
      : derivedPct;
    return {
      assurancePosted: d.assurancePosted,
      circulationSpecieCount: d.circulationSpecieCount,
      circulationValuePosted: d.circulationValuePosted,
      coveragePercent,
    };
  }

  const assurancePosted = isFiniteNumber(d.assurancePosted)
    ? d.assurancePosted
    : isFiniteNumber(d.balance)
      ? d.balance
      : 0;

  const legacyOutstanding = isFiniteNumber(d.outstanding) ? d.outstanding : 0;
  const legacyCoverage = isFiniteNumber(d.coverage) ? d.coverage : NaN;

  if (legacyOutstanding >= 1e12) {
    const circulationValuePosted = Math.trunc(legacyOutstanding);
    const circulationSpecieCount = Math.round(circulationValuePosted / 1_000_000);
    const coveragePercent = circulationValuePosted > 0
      ? Math.min(100, Math.max(0, Math.round((assurancePosted / circulationValuePosted) * 100)))
      : 100;
    return {
      assurancePosted,
      circulationSpecieCount,
      circulationValuePosted,
      coveragePercent,
    };
  }

  if (legacyOutstanding > 0) {
    const circulationSpecieCount = Math.trunc(legacyOutstanding);
    const circulationValuePosted = Number(BigInt(circulationSpecieCount) * USDC_SCALE);
    let coveragePercent = Number.isFinite(legacyCoverage) && legacyCoverage >= 0 && legacyCoverage <= 100
      ? Math.round(legacyCoverage)
      : circulationValuePosted > 0
        ? Math.min(100, Math.max(0, Math.round((assurancePosted / circulationValuePosted) * 100)))
        : 100;
    coveragePercent = Math.min(100, Math.max(0, coveragePercent));
    return {
      assurancePosted,
      circulationSpecieCount,
      circulationValuePosted,
      coveragePercent,
    };
  }

  return {
    assurancePosted,
    circulationSpecieCount: 0,
    circulationValuePosted: 0,
    coveragePercent: Number.isFinite(legacyCoverage) ? Math.min(100, Math.max(0, Math.round(legacyCoverage))) : 100,
  };
}
