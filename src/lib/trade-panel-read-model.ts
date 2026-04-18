/**
 * Pure trade-panel read model from MarketSB + Species sim /sim/state payloads.
 * Single place for coupled-variable math (canon contract tests import this).
 */
import {
  backingPerSpecieParts,
  circulationValueBaseUnits,
  coverageRatioPercentCanaryFromPosted,
  toPostedBigInt,
} from '@/lib/assurance-read-model';
import { formatUsdcDisplay } from '@/lib/amount';

export interface TradePanelReadModel {
  userRef: string;
  onliId: string;
  fundingPosted: bigint;
  speciesVaPosted: bigint;
  fundingPostedDisplay: string;
  speciesVaPostedDisplay: string;
  vaultSpecieCount: number;
  assuranceGlobalPosted: bigint;
  circulationSpecieCount: number;
  circulationValuePosted: bigint;
  coveragePercent: number;
  buyBackGuaranteeDollars: string;
  buyBackGuaranteeCents: string;
  /** Server-formatted USDC — UI must not re-derive from base units. */
  assuranceGlobalPostedDisplay: string;
  circulationValuePostedDisplay: string;
}

function onliIdForUserRef(userRef: string): string {
  return `onli-${userRef}`;
}

export function buildTradePanelReadModel(
  msb: unknown,
  spec: unknown,
  userRef: string,
): TradePanelReadModel {
  const m = msb && typeof msb === 'object' ? (msb as Record<string, unknown>) : {};
  const s = spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : {};

  const vas = (m.virtualAccounts ?? {}) as Record<string, { posted?: unknown; pending?: unknown }>;

  const fundingKey = `va-funding-${userRef}`;
  const speciesKey = `va-species-${userRef}`;
  const onliId = onliIdForUserRef(userRef);

  const fundingPosted = toPostedBigInt(vas[fundingKey]?.posted);
  const speciesVaPosted = vas[speciesKey] != null ? toPostedBigInt(vas[speciesKey]?.posted) : 0n;

  const vaults = s.vaults as { users?: Record<string, { count?: unknown }> } | undefined;
  const vaultUser = vaults?.users?.[onliId];
  const vaultSpecieCount = Number(vaultUser?.count ?? 0);

  const assuranceGlobalPosted = toPostedBigInt(vas['assurance-global']?.posted);

  const circulationSpecieCount = typeof s.circulation === 'number' ? s.circulation : 0;
  const circulationValuePosted = circulationValueBaseUnits(circulationSpecieCount);
  const coveragePercent = coverageRatioPercentCanaryFromPosted(assuranceGlobalPosted, circulationValuePosted);
  const ratio = backingPerSpecieParts(assuranceGlobalPosted, circulationSpecieCount);

  return {
    userRef,
    onliId,
    fundingPosted,
    speciesVaPosted,
    fundingPostedDisplay: formatUsdcDisplay(fundingPosted),
    speciesVaPostedDisplay: formatUsdcDisplay(speciesVaPosted),
    vaultSpecieCount,
    assuranceGlobalPosted,
    circulationSpecieCount,
    circulationValuePosted,
    coveragePercent,
    buyBackGuaranteeDollars: ratio?.dollars ?? '0',
    buyBackGuaranteeCents: ratio?.cents ?? '00',
    assuranceGlobalPostedDisplay: formatUsdcDisplay(assuranceGlobalPosted),
    circulationValuePostedDisplay: formatUsdcDisplay(circulationValuePosted),
  };
}
