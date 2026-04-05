import type { SpeciesSimState, StageDelays } from './state.js';
import { createEmptyState } from './state.js';

// ---------------------------------------------------------------------------
// User mapping (matches marketsb-sim/src/seed.ts)
// ---------------------------------------------------------------------------
export const ONLI_USERS = {
  alex:   'onli-user-001',
  pepper: 'onli-user-456',
  tony:   'onli-user-789',
  happy:  'onli-user-012',
} as const;

// ---------------------------------------------------------------------------
// Startup sequence — mirrors MarketSB seed
// ---------------------------------------------------------------------------
function runStartupSequence(state: SpeciesSimState): void {
  console.log('[SPECIES SEED] Running startup sequence...');

  // Treasury starts with 1 BILLION species
  state.vaults.treasury.count = 1_000_000_000;

  // Initialize all user vaults at 0
  for (const onliId of Object.values(ONLI_USERS)) {
    state.vaults.users.set(onliId, { count: 0, history: [] });
  }

  // 1. Pepper Potts: issue 2M species from treasury, list 1M
  const pepperIssue = 2_000_000;
  state.vaults.treasury.count -= pepperIssue;
  const pepperVault = state.vaults.users.get(ONLI_USERS.pepper)!;
  pepperVault.count += pepperIssue;
  pepperVault.history.push({
    type: 'credit',
    count: pepperIssue,
    from: 'treasury',
    to: ONLI_USERS.pepper,
    eventId: 'seed-issue-pepper',
    timestamp: '2026-04-01T09:00:00Z',
  });

  // Pepper lists 1M for sale
  state.listings.set('listing-pepper-001', {
    listingId: 'listing-pepper-001',
    sellerOnliId: ONLI_USERS.pepper,
    quantity: 1_000_000,
    remainingQuantity: 1_000_000,
    unitPrice: 1_000_000,
    status: 'active',
    createdAt: '2026-04-01T09:05:00Z',
  });

  console.log('[SPECIES SEED] Pepper: issued 2M, listed 1M. Treasury:', state.vaults.treasury.count);

  // 2. Tony Stark: issue 90M species from treasury, list 25M
  const tonyIssue = 90_000_000;
  state.vaults.treasury.count -= tonyIssue;
  const tonyVault = state.vaults.users.get(ONLI_USERS.tony)!;
  tonyVault.count += tonyIssue;
  tonyVault.history.push({
    type: 'credit',
    count: tonyIssue,
    from: 'treasury',
    to: ONLI_USERS.tony,
    eventId: 'seed-issue-tony',
    timestamp: '2026-04-01T10:00:00Z',
  });

  // Tony lists 25M for sale
  state.listings.set('listing-tony-001', {
    listingId: 'listing-tony-001',
    sellerOnliId: ONLI_USERS.tony,
    quantity: 25_000_000,
    remainingQuantity: 25_000_000,
    unitPrice: 1_000_000,
    status: 'active',
    createdAt: '2026-04-01T10:05:00Z',
  });

  console.log('[SPECIES SEED] Tony: issued 90M, listed 25M. Treasury:', state.vaults.treasury.count);

  // 3. Happy Hogan: buys 20K from market (secondary — from Pepper's listing)
  const happyBuy = 20_000;
  const pepperListing = state.listings.get('listing-pepper-001')!;
  pepperListing.remainingQuantity -= happyBuy;

  // Move species: Pepper → Happy
  pepperVault.count -= happyBuy;
  pepperVault.history.push({
    type: 'debit',
    count: happyBuy,
    from: ONLI_USERS.pepper,
    to: ONLI_USERS.happy,
    eventId: 'seed-buy-happy',
    timestamp: '2026-04-02T11:00:00Z',
  });

  const happyVault = state.vaults.users.get(ONLI_USERS.happy)!;
  happyVault.count += happyBuy;
  happyVault.history.push({
    type: 'credit',
    count: happyBuy,
    from: ONLI_USERS.pepper,
    to: ONLI_USERS.happy,
    eventId: 'seed-buy-happy',
    timestamp: '2026-04-02T11:00:00Z',
  });

  console.log('[SPECIES SEED] Happy: bought 20K from market');

  // 4. Alex Morgan: starts fresh
  console.log('[SPECIES SEED] Alex: fresh vault (0 species)');

  // Asset oracle log
  state.assetOracleLog.push(
    { id: 'seed-ao-pepper', eventId: 'seed-issue-pepper', type: 'change_owner', from: 'treasury', to: ONLI_USERS.pepper, count: pepperIssue, timestamp: '2026-04-01T09:00:00Z' },
    { id: 'seed-ao-tony', eventId: 'seed-issue-tony', type: 'change_owner', from: 'treasury', to: ONLI_USERS.tony, count: tonyIssue, timestamp: '2026-04-01T10:00:00Z' },
    { id: 'seed-ao-happy', eventId: 'seed-buy-happy', type: 'change_owner', from: ONLI_USERS.pepper, to: ONLI_USERS.happy, count: happyBuy, timestamp: '2026-04-02T11:00:00Z' },
  );

  // Summary
  console.log('[SPECIES SEED] Final state:');
  console.log(`  Treasury: ${state.vaults.treasury.count.toLocaleString()} SPECIES`);
  for (const [id, vault] of state.vaults.users) {
    console.log(`  ${id}: ${vault.count.toLocaleString()} SPECIES`);
  }
  console.log(`  Active listings: ${state.listings.size}`);
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
