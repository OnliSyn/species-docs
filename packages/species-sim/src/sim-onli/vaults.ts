import type { SpeciesSimState, VaultEvent } from '../state.js';
import { tryParseUserLockerVaultId } from './vault-ids.js';

/** Canon Part III: speciesInCirculation includes user vaults + listed locker + per-user transfer lockers (not treasury, not redeemed MM inventory). */
export function speciesInCirculationCount(state: SpeciesSimState): number {
  let usersTotal = 0;
  for (const v of state.vaults.users.values()) {
    usersTotal += v.count + v.lockerCount;
  }
  return state.vaults.sellerLocker.count + usersTotal;
}

export function getVaultBalance(
  state: SpeciesSimState,
  vaultId: string,
): { vaultId: string; count: number; lockerCount?: number } | null {
  if (vaultId === 'treasury') {
    return { vaultId: 'treasury', count: state.vaults.treasury.count };
  }
  if (vaultId === 'sellerLocker') {
    return { vaultId: 'sellerLocker', count: state.vaults.sellerLocker.count };
  }
  if (vaultId === 'marketMaker') {
    return { vaultId: 'marketMaker', count: state.vaults.marketMaker.count };
  }
  const lockerUser = tryParseUserLockerVaultId(vaultId);
  if (lockerUser) {
    const user = state.vaults.users.get(lockerUser);
    if (!user) return null;
    return { vaultId, count: user.lockerCount, lockerCount: user.lockerCount };
  }
  const user = state.vaults.users.get(vaultId);
  if (!user) return null;
  return { vaultId, count: user.count, lockerCount: user.lockerCount };
}

export function getVaultHistory(
  state: SpeciesSimState,
  vaultId: string,
): VaultEvent[] | null {
  const user = state.vaults.users.get(vaultId);
  if (!user) return null;
  return user.history;
}

export function ensureUserVault(state: SpeciesSimState, onliId: string): void {
  if (!state.vaults.users.has(onliId)) {
    state.vaults.users.set(onliId, { count: 0, lockerCount: 0, history: [] });
  }
}

/** Main vault balance only (IN_CIRCULATION in vault, not sender locker staging). */
export function getUserMainVaultCount(state: SpeciesSimState, onliId: string): number {
  const user = state.vaults.users.get(onliId);
  return user ? user.count : 0;
}

export function getUserLockerCount(state: SpeciesSimState, onliId: string): number {
  const user = state.vaults.users.get(onliId);
  return user ? user.lockerCount : 0;
}

export function getVaultCount(state: SpeciesSimState, vaultId: string): number {
  if (vaultId === 'treasury') return state.vaults.treasury.count;
  if (vaultId === 'sellerLocker') return state.vaults.sellerLocker.count;
  if (vaultId === 'marketMaker') return state.vaults.marketMaker.count;
  const lockerUser = tryParseUserLockerVaultId(vaultId);
  if (lockerUser) {
    const user = state.vaults.users.get(lockerUser);
    return user ? user.lockerCount : 0;
  }
  const user = state.vaults.users.get(vaultId);
  return user ? user.count : 0;
}

export function adjustVault(
  state: SpeciesSimState,
  vaultId: string,
  delta: number,
  event: VaultEvent,
): void {
  if (vaultId === 'treasury') {
    state.vaults.treasury.count += delta;
    return;
  }
  if (vaultId === 'sellerLocker') {
    state.vaults.sellerLocker.count += delta;
    return;
  }
  if (vaultId === 'marketMaker') {
    state.vaults.marketMaker.count += delta;
    return;
  }
  const lockerUser = tryParseUserLockerVaultId(vaultId);
  if (lockerUser) {
    ensureUserVault(state, lockerUser);
    const user = state.vaults.users.get(lockerUser)!;
    user.lockerCount += delta;
    user.history.push(event);
    return;
  }
  const user = state.vaults.users.get(vaultId);
  if (user) {
    user.count += delta;
    user.history.push(event);
  }
}
