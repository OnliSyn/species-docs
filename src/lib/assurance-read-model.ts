/**
 * Assurance / circulation read-model — single source for coverage and backing display.
 * Aligns with Species Core Canon: coupled variables; UI reads derived truth from server-shaped inputs only.
 */
import { USDC_SCALE, formatUsdcDisplay } from '@/lib/amount';

export function toPostedBigInt(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
  const s = String(v).trim();
  if (!s || s === 'null') return 0n;
  return BigInt(s.split('.')[0]);
}

/** Circulation value in USDC base units at canonical peg (1 Specie = 1 USDC base scale). */
export function circulationValueBaseUnits(circulationSpecieCount: number): bigint {
  return BigInt(Math.max(0, circulationSpecieCount)) * USDC_SCALE;
}

export function coveragePercentFromPosted(
  assurancePostedBase: bigint,
  circulationValuePostedBase: bigint,
): number {
  if (circulationValuePostedBase <= 0n) return 100;
  const raw = Number((assurancePostedBase * 100n) / circulationValuePostedBase);
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Same ratio as {@link coveragePercentFromPosted} but **no upper cap** — used by the
 * trade-panel Buy Back Guarantee canary so surplus assurance (broken 1:1 coupling) is visible.
 * When there is no circulation liability to measure against, returns 100.
 */
export function coverageRatioPercentCanaryFromPosted(
  assurancePostedBase: bigint,
  circulationValuePostedBase: bigint,
): number {
  if (circulationValuePostedBase <= 0n) return 100;
  const raw = Number((assurancePostedBase * 100n) / circulationValuePostedBase);
  return Math.max(0, Math.round(raw));
}

/**
 * Backing per Specie in display USD when circulation > 0; otherwise null (caller shows em dash).
 */
export function backingPerSpecieParts(
  assurancePostedBase: bigint,
  circulationSpecieCount: number,
): { dollars: string; cents: string } | null {
  if (circulationSpecieCount <= 0) return null;
  const n = BigInt(circulationSpecieCount);
  const perMicro = assurancePostedBase / n;
  const sign = perMicro < 0n ? -1n : 1n;
  const abs = perMicro < 0n ? -perMicro : perMicro;
  /** Round to nearest cent (half-up at micro scale). */
  const totalCents = (abs * 100n + USDC_SCALE / 2n) / USDC_SCALE;
  const signed = sign * totalCents;
  const out = signed < 0n ? -signed : signed;
  const wholeDollars = out / 100n;
  const centsPart = out % 100n;
  const dollars = wholeDollars.toString();
  const cents = centsPart.toString().padStart(2, '0');
  return { dollars, cents };
}

export function formatAssurancePosted(assurancePostedBase: bigint): string {
  return formatUsdcDisplay(assurancePostedBase);
}
