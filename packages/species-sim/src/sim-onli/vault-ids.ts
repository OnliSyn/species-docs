/** Synthetic vault id for a user's sender locker (TRANSFER_EXECUTION AskToMove staging). */
export const USER_LOCKER_PREFIX = 'locker:';

export function userLockerVaultId(onliId: string): string {
  return `${USER_LOCKER_PREFIX}${onliId}`;
}

export function tryParseUserLockerVaultId(vaultId: string): string | undefined {
  if (!vaultId.startsWith(USER_LOCKER_PREFIX)) return undefined;
  return vaultId.slice(USER_LOCKER_PREFIX.length);
}
