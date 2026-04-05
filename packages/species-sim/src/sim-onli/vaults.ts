import type { SpeciesSimState, VaultEvent } from '../state.js';

export function getVaultBalance(
  state: SpeciesSimState,
  vaultId: string,
): { vaultId: string; count: number } | null {
  if (vaultId === 'treasury') {
    return { vaultId: 'treasury', count: state.vaults.treasury.count };
  }
  if (vaultId === 'settlement') {
    return { vaultId: 'settlement', count: state.vaults.settlement.count };
  }
  const user = state.vaults.users.get(vaultId);
  if (!user) return null;
  return { vaultId, count: user.count };
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
    state.vaults.users.set(onliId, { count: 0, history: [] });
  }
}

export function getVaultCount(state: SpeciesSimState, vaultId: string): number {
  if (vaultId === 'treasury') return state.vaults.treasury.count;
  if (vaultId === 'settlement') return state.vaults.settlement.count;
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
  if (vaultId === 'settlement') {
    state.vaults.settlement.count += delta;
    return;
  }
  const user = state.vaults.users.get(vaultId);
  if (user) {
    user.count += delta;
    user.history.push(event);
  }
}
