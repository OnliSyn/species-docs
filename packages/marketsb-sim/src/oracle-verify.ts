// ── Strict VA oracle ledger verification (balance chain) ──

import type { OracleEntry } from './state.js';

export interface LedgerVerifyResult {
  isValid: boolean;
  entryCount: number;
  finalComputedBalance: bigint;
  actualBalance: bigint;
  variance: bigint;
  detail?: string;
}

/** Entries must form a strict chain: each balanceBefore matches running balance from prior entry. */
export function verifyVaOracleLedger(vaPosted: bigint, entries: OracleEntry[]): LedgerVerifyResult {
  if (entries.length === 0) {
    const z = 0n;
    return {
      isValid: vaPosted === z,
      entryCount: 0,
      finalComputedBalance: z,
      actualBalance: vaPosted,
      variance: vaPosted - z,
    };
  }

  const sorted = [...entries].sort((a, b) => {
    const c = a.timestamp.localeCompare(b.timestamp);
    return c !== 0 ? c : a.entryId.localeCompare(b.entryId);
  });

  let running = sorted[0].balanceBefore;
  for (const e of sorted) {
    if (e.balanceBefore !== running) {
      return {
        isValid: false,
        entryCount: entries.length,
        finalComputedBalance: running,
        actualBalance: vaPosted,
        variance: vaPosted - running,
        detail: `Chain break at ${e.entryId}: expected balanceBefore ${running}, got ${e.balanceBefore}`,
      };
    }
    running = e.balanceAfter;
  }

  const isValid = running === vaPosted;
  return {
    isValid,
    entryCount: entries.length,
    finalComputedBalance: running,
    actualBalance: vaPosted,
    variance: vaPosted - running,
    detail: isValid ? undefined : 'Final chain balance does not match VA posted',
  };
}
