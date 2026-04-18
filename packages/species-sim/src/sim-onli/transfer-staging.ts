/**
 * TRANSFER_EXECUTION: AskToMove senderVault → senderLocker (per canon §3.9), before ChangeOwner to receiver.
 */
import type { SpeciesSimState, AssetOracleEntry } from '../state.js';
import { userLockerVaultId } from './vault-ids.js';
import { ensureUserVault, getUserMainVaultCount, getUserLockerCount } from './vaults.js';

let stagingOracleCounter = 0;

function nextOracleId(eventId: string): string {
  stagingOracleCounter++;
  return `ao-txfer-${eventId}-${stagingOracleCounter}`;
}

export function resetTransferStagingOracleCounter(): void {
  stagingOracleCounter = 0;
}

export interface StagingResult {
  success: boolean;
  oracleEntryId?: string;
  error?: string;
}

export function stageSenderVaultToSenderLocker(
  state: SpeciesSimState,
  senderId: string,
  count: number,
  eventId: string,
): StagingResult {
  ensureUserVault(state, senderId);
  const available = getUserMainVaultCount(state, senderId);
  if (available < count) {
    return {
      success: false,
      error: `Insufficient count in ${senderId} vault: has ${available}, needs ${count}`,
    };
  }

  const now = new Date().toISOString();
  const oracleEntryId = nextOracleId(eventId);
  const toLocker = userLockerVaultId(senderId);

  const user = state.vaults.users.get(senderId)!;
  user.count -= count;
  user.lockerCount += count;
  user.history.push({
    type: 'debit',
    count,
    from: senderId,
    to: toLocker,
    eventId,
    timestamp: now,
  });

  const entry: AssetOracleEntry = {
    id: oracleEntryId,
    eventId,
    type: 'ask_to_move',
    from: senderId,
    to: toLocker,
    count,
    timestamp: now,
  };
  state.assetOracleLog.push(entry);

  return { success: true, oracleEntryId };
}

/** Undo staging if ChangeOwner to receiver fails after AskToMove approved. */
export function unstageSenderLockerToVault(
  state: SpeciesSimState,
  senderId: string,
  count: number,
  eventId: string,
): StagingResult {
  ensureUserVault(state, senderId);
  const inLocker = getUserLockerCount(state, senderId);
  if (inLocker < count) {
    return {
      success: false,
      error: `Insufficient count in ${senderId} sender locker: has ${inLocker}, needs ${count}`,
    };
  }

  const now = new Date().toISOString();
  const oracleEntryId = nextOracleId(eventId);
  const fromLocker = userLockerVaultId(senderId);

  const user = state.vaults.users.get(senderId)!;
  user.lockerCount -= count;
  user.count += count;
  user.history.push({
    type: 'credit',
    count,
    from: fromLocker,
    to: senderId,
    eventId,
    timestamp: now,
  });

  state.assetOracleLog.push({
    id: oracleEntryId,
    eventId,
    type: 'ask_to_move',
    from: fromLocker,
    to: senderId,
    count,
    timestamp: now,
  });

  return { success: true, oracleEntryId };
}
