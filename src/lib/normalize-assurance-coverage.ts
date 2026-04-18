import type { AssuranceCoverageSnapshot } from '@/lib/sim-client';

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Coerce tool / gen-ui payloads to {@link AssuranceCoverageSnapshot}.
 * **Read-only:** does not derive coverage, peg value, or per-Specie backing — those must
 * come from the server (`getAssuranceBalance` / trade-panel read model).
 */
export function normalizeAssuranceCoveragePayload(raw: unknown): AssuranceCoverageSnapshot {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const assurancePosted = isFiniteNumber(d.assurancePosted)
    ? d.assurancePosted
    : isFiniteNumber(d.balance)
      ? d.balance
      : 0;

  const circulationSpecieCount = isFiniteNumber(d.circulationSpecieCount)
    ? Math.trunc(d.circulationSpecieCount)
    : 0;

  const circulationValuePosted = isFiniteNumber(d.circulationValuePosted)
    ? Math.trunc(d.circulationValuePosted)
    : 0;

  const coveragePercent = isFiniteNumber(d.coveragePercent) ? Math.round(d.coveragePercent) : 0;

  const buyBackGuaranteeDollars = isNonEmptyString(d.buyBackGuaranteeDollars) ? d.buyBackGuaranteeDollars : '0';
  const buyBackGuaranteeCents = isNonEmptyString(d.buyBackGuaranteeCents) ? d.buyBackGuaranteeCents : '00';

  const assurancePostedDisplay = isNonEmptyString(d.assurancePostedDisplay)
    ? d.assurancePostedDisplay
    : '$0.00';

  const circulationValuePostedDisplay = isNonEmptyString(d.circulationValuePostedDisplay)
    ? d.circulationValuePostedDisplay
    : '$0.00';

  return {
    assurancePosted,
    circulationSpecieCount,
    circulationValuePosted,
    coveragePercent,
    buyBackGuaranteeDollars,
    buyBackGuaranteeCents,
    assurancePostedDisplay,
    circulationValuePostedDisplay,
  };
}
