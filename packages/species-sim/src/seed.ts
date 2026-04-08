import type { SpeciesSimState, StageDelays } from './state.js';
import { createEmptyState } from './state.js';

// ---------------------------------------------------------------------------
// User mapping (matches marketsb-sim/src/seed.ts)
// ---------------------------------------------------------------------------
export const ONLI_USERS = {
  alex:    'onli-user-001',
  pepper:  'onli-user-456',
  tony:    'onli-user-789',
  happy:   'onli-user-012',
  steve:   'onli-user-555',
  natasha: 'onli-user-666',
} as const;

// ---------------------------------------------------------------------------
// Startup sequence — mirrors MarketSB seed
// ---------------------------------------------------------------------------
function runStartupSequence(state: SpeciesSimState): void {
  console.log('[SPECIES SEED] Running startup sequence...');

  // Treasury starts with 1 BILLION species
  state.vaults.treasury.count = 1_000_000_000;

  // Initialize all user vaults at 0 — clean seed, no history, no orders
  for (const onliId of Object.values(ONLI_USERS)) {
    state.vaults.users.set(onliId, { count: 0, history: [] });
  }

  // No seed listings, no seed trades — fresh market

  // Summary
  console.log('[SPECIES SEED] Clean seed:');
  console.log(`  Treasury: ${state.vaults.treasury.count.toLocaleString()} SPECIES`);
  for (const [id, vault] of state.vaults.users) {
    console.log(`  ${id}: ${vault.count.toLocaleString()} SPECIES`);
  }
  console.log(`  Active listings: 0`);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export function seedState(delays: StageDelays): SpeciesSimState {
  const state = createEmptyState(delays);
  runStartupSequence(state);
  return state;
}

export function seedClean(delays: StageDelays): SpeciesSimState {
  const state = createEmptyState(delays);
  state.vaults.treasury.count = 1_000_000_000;
  for (const onliId of Object.values(ONLI_USERS)) {
    state.vaults.users.set(onliId, { count: 0, history: [] });
  }
  return state;
}
