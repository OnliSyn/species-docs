import type { SpeciesSimState, AssetOracleEntry } from '../state.js';
import { getVaultCount, adjustVault, ensureUserVault } from './vaults.js';

let oracleCounter = 0;

export function resetOracleCounter(): void {
  oracleCounter = 0;
}

export interface ChangeOwnerResult {
  success: boolean;
  oracleEntryId?: string;
  error?: string;
}

export function changeOwner(
  state: SpeciesSimState,
  from: string,
  to: string,
  count: number,
  eventId: string,
): ChangeOwnerResult {
  // Ensure user vaults exist
  if (from !== 'treasury' && from !== 'sellerLocker' && from !== 'marketMaker') {
    ensureUserVault(state, from);
  }
  if (to !== 'treasury' && to !== 'sellerLocker' && to !== 'marketMaker') {
    ensureUserVault(state, to);
  }

  // Validate source has sufficient count
  const sourceCount = getVaultCount(state, from);
  if (sourceCount < count) {
    return {
      success: false,
      error: `Insufficient count in ${from}: has ${sourceCount}, needs ${count}`,
    };
  }

  const now = new Date().toISOString();
  oracleCounter++;
  const oracleEntryId = `ao-${eventId}-${oracleCounter}`;

  // Debit source
  adjustVault(state, from, -count, {
    type: 'debit',
    count,
    from,
    to,
    eventId,
    timestamp: now,
  });

  // Credit destination
  adjustVault(state, to, count, {
    type: 'credit',
    count,
    from,
    to,
    eventId,
    timestamp: now,
  });

  // Write oracle log
  const entry: AssetOracleEntry = {
    id: oracleEntryId,
    eventId,
    type: 'change_owner',
    from,
    to,
    count,
    timestamp: now,
  };
  state.assetOracleLog.push(entry);

  return { success: true, oracleEntryId };
}
