/**
 * SELL_MARKET_LISTING + REDEMPTION staging: seller/main vault → shared sellerLocker (AskToMove),
 * not ChangeOwner — canon Species Core §3.9 (AskToMove for vault→locker same party).
 */
import type { SpeciesSimState, AssetOracleEntry } from '../state.js';
import { ensureUserVault, getUserMainVaultCount } from './vaults.js';

let escrowOracleCounter = 0;

function nextOracleId(eventId: string): string {
  escrowOracleCounter++;
  return `ao-atm-${eventId}-${escrowOracleCounter}`;
}

export function resetEscrowOracleCounter(): void {
  escrowOracleCounter = 0;
}

export interface EscrowMoveResult {
  success: boolean;
  oracleEntryId?: string;
  error?: string;
}

export function moveUserVaultToSellerLocker(
  state: SpeciesSimState,
  userId: string,
  count: number,
  eventId: string,
): EscrowMoveResult {
  ensureUserVault(state, userId);
  const available = getUserMainVaultCount(state, userId);
  if (available < count) {
    return {
      success: false,
      error: `Insufficient count in ${userId} vault: has ${available}, needs ${count}`,
    };
  }

  const now = new Date().toISOString();
  const oracleEntryId = nextOracleId(eventId);

  const user = state.vaults.users.get(userId)!;
  user.count -= count;
  user.history.push({
    type: 'debit',
    count,
    from: userId,
    to: 'sellerLocker',
    eventId,
    timestamp: now,
  });

  state.vaults.sellerLocker.count += count;

  const entry: AssetOracleEntry = {
    id: oracleEntryId,
    eventId,
    type: 'ask_to_move',
    from: userId,
    to: 'sellerLocker',
    count,
    timestamp: now,
  };
  state.assetOracleLog.push(entry);

  return { success: true, oracleEntryId };
}

/** Rollback listing staging: sellerLocker → user main vault (inverse AskToMove). */
export function moveSellerLockerToUserVault(
  state: SpeciesSimState,
  userId: string,
  count: number,
  eventId: string,
): EscrowMoveResult {
  ensureUserVault(state, userId);
  if (state.vaults.sellerLocker.count < count) {
    return {
      success: false,
      error: `Insufficient count in sellerLocker: has ${state.vaults.sellerLocker.count}, needs ${count}`,
    };
  }

  const now = new Date().toISOString();
  const oracleEntryId = nextOracleId(eventId);

  state.vaults.sellerLocker.count -= count;
  const user = state.vaults.users.get(userId)!;
  user.count += count;
  user.history.push({
    type: 'credit',
    count,
    from: 'sellerLocker',
    to: userId,
    eventId,
    timestamp: now,
  });

  state.assetOracleLog.push({
    id: oracleEntryId,
    eventId,
    type: 'ask_to_move',
    from: 'sellerLocker',
    to: userId,
    count,
    timestamp: now,
  });

  return { success: true, oracleEntryId };
}
