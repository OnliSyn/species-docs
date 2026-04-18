import type { SpeciesSimState, AssetOracleEntry } from '../state.js';
import { tryParseUserLockerVaultId } from './vault-ids.js';
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

function ensurePartyVault(state: SpeciesSimState, vaultId: string): void {
  const lockerUser = tryParseUserLockerVaultId(vaultId);
  if (lockerUser) {
    ensureUserVault(state, lockerUser);
    return;
  }
  if (vaultId !== 'treasury' && vaultId !== 'sellerLocker' && vaultId !== 'marketMaker') {
    ensureUserVault(state, vaultId);
  }
}

/**
 * ChangeOwner — cross-party or system locker delivery (canon primitive).
 * Use {@link moveUserVaultToSellerLocker} for listing/redeem vault→market locker (AskToMove).
 */
export function changeOwner(
  state: SpeciesSimState,
  from: string,
  to: string,
  count: number,
  eventId: string,
): ChangeOwnerResult {
  ensurePartyVault(state, from);
  ensurePartyVault(state, to);

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

  adjustVault(state, from, -count, {
    type: 'debit',
    count,
    from,
    to,
    eventId,
    timestamp: now,
  });

  adjustVault(state, to, count, {
    type: 'credit',
    count,
    from,
    to,
    eventId,
    timestamp: now,
  });

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
