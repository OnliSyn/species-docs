// ── @marketsb/sim — Development seed data ──
// Multi-user seed with Treasury, Assurance, and 4 user accounts

import type { SimState, VirtualAccountState, OracleEntry } from './state.js';
import { createEmptyState } from './state.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function makeVA(
  vaId: string,
  ownerRef: string,
  subtype: VirtualAccountState['subtype'],
  tbCode: number,
  posted: bigint,
  depositAddress: string = '',
): VirtualAccountState {
  return {
    vaId,
    ownerRef,
    subtype,
    tbCode,
    posted,
    pending: 0n,
    depositAddress: depositAddress || `0x${vaId.replace(/[^a-z0-9]/g, '').slice(0, 40)}`,
    currency: 'USDC',
    status: 'active',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z',
  };
}

function addOracleEntry(state: SimState, entry: OracleEntry) {
  const existing = state.oracleLog.get(entry.vaId) ?? [];
  existing.push(entry);
  state.oracleLog.set(entry.vaId, existing);
}

// ---------------------------------------------------------------------------
// User account IDs
// ---------------------------------------------------------------------------
export const USERS = {
  alex:   { ref: 'user-001', name: 'Alex Morgan',  onliId: 'onli-user-001' },
  pepper: { ref: 'user-456', name: 'Pepper Potts',  onliId: 'onli-user-456' },
  tony:   { ref: 'user-789', name: 'Tony Stark',    onliId: 'onli-user-789' },
  happy:  { ref: 'user-012', name: 'Happy Hogan',   onliId: 'onli-user-012' },
} as const;

export function vaIds(userRef: string) {
  return {
    funding:   `va-funding-${userRef}`,
    species:   `va-species-${userRef}`,
    assurance: `va-assurance-${userRef}`,
  };
}

// ---------------------------------------------------------------------------
// Base seed — creates accounts with zero balances
// ---------------------------------------------------------------------------
export function seedBase(): SimState {
  const state = createEmptyState();

  // ── System accounts ──
  state.virtualAccounts.set('treasury-100', makeVA('treasury-100', 'system', 'system', 100, 0n));
  state.virtualAccounts.set('settlement-200', makeVA('settlement-200', 'system', 'system', 200, 0n));
  state.virtualAccounts.set('operating-300', makeVA('operating-300', 'system', 'system', 300, 0n));
  state.virtualAccounts.set('pending-deposit-400', makeVA('pending-deposit-400', 'system', 'system', 400, 0n));
  state.virtualAccounts.set('pending-withdrawal-450', makeVA('pending-withdrawal-450', 'system', 'system', 450, 0n));
  // Global assurance account (tracks total issuance proceeds)
  state.virtualAccounts.set('assurance-global', makeVA('assurance-global', 'system', 'assurance', 520, 0n));

  // ── User accounts (all start at 0) ──
  let tbCode = 500;
  for (const user of Object.values(USERS)) {
    const ids = vaIds(user.ref);
    state.virtualAccounts.set(ids.funding, makeVA(ids.funding, user.ref, 'funding', tbCode, 0n));
    state.virtualAccounts.set(ids.species, makeVA(ids.species, user.ref, 'species', tbCode + 10, 0n));
    state.virtualAccounts.set(ids.assurance, makeVA(ids.assurance, user.ref, 'assurance', tbCode + 20, 0n));
    tbCode += 30;
  }

  state.systemWallets = {
    incoming: 0n,
    market: 0n,
    outgoing: 0n,
    operating: 0n,
  };

  return state;
}

// ---------------------------------------------------------------------------
// Startup sequence — executes Pepper/Tony/Happy initial transactions
// ---------------------------------------------------------------------------
const USDC = 1_000_000n; // 1 USDC = 1,000,000 base units

function fund(state: SimState, userRef: string, amount: bigint) {
  const ids = vaIds(userRef);
  const va = state.virtualAccounts.get(ids.funding)!;
  const before = va.posted;
  va.posted += amount;
  va.updatedAt = new Date().toISOString();

  addOracleEntry(state, {
    entryId: `fo-fund-${userRef}-${Date.now()}`,
    vaId: ids.funding,
    type: 'deposit_credited',
    amount,
    balanceBefore: before,
    balanceAfter: va.posted,
    ref: `dep-${userRef}-init`,
    timestamp: new Date().toISOString(),
  });
}

function issueFromTreasury(state: SimState, userRef: string, specieCount: bigint) {
  const ids = vaIds(userRef);
  const cost = specieCount * USDC; // 1 Specie = $1 USDC
  const issuanceFee = specieCount * 10_000n; // $0.01 per Specie
  const liquidityFee = (cost * 200n) / 10_000n; // 2%
  const total = cost + issuanceFee + liquidityFee;

  // Deduct from user funding
  const fundingVA = state.virtualAccounts.get(ids.funding)!;
  fundingVA.posted -= total;
  fundingVA.updatedAt = new Date().toISOString();

  // Credit user species VA (value = species count in base units)
  const speciesVA = state.virtualAccounts.get(ids.species)!;
  speciesVA.posted += specieCount * USDC;
  speciesVA.updatedAt = new Date().toISOString();

  // Issuance proceeds go to global assurance
  const assuranceVA = state.virtualAccounts.get('assurance-global')!;
  assuranceVA.posted += cost; // full cost (not including fees) goes to assurance
  assuranceVA.updatedAt = new Date().toISOString();

  // Fees go to operating
  const operatingVA = state.virtualAccounts.get('operating-300')!;
  operatingVA.posted += issuanceFee + liquidityFee;
  operatingVA.updatedAt = new Date().toISOString();

  // Treasury species count tracked in species-sim, not here
  // But we track the USDC value in treasury VA
  const treasuryVA = state.virtualAccounts.get('treasury-100')!;
  treasuryVA.posted += cost; // treasury receives payment
  treasuryVA.updatedAt = new Date().toISOString();

  addOracleEntry(state, {
    entryId: `fo-issue-${userRef}-${Date.now()}`,
    vaId: ids.species,
    type: 'issuance_buy',
    amount: specieCount * USDC,
    balanceBefore: speciesVA.posted - specieCount * USDC,
    balanceAfter: speciesVA.posted,
    ref: `issue-${userRef}`,
    timestamp: new Date().toISOString(),
  });
}

export function runStartupSequence(state: SimState): void {
  console.log('[SEED] Running startup sequence...');

  // 1. Pepper Potts: fund $5M, issue 2M species
  fund(state, USERS.pepper.ref, 5_000_000n * USDC);
  issueFromTreasury(state, USERS.pepper.ref, 2_000_000n);
  console.log('[SEED] Pepper Potts: funded $5M, issued 2M species');

  // 2. Tony Stark: fund $100M, issue 90M species
  fund(state, USERS.tony.ref, 100_000_000n * USDC);
  issueFromTreasury(state, USERS.tony.ref, 90_000_000n);
  console.log('[SEED] Tony Stark: funded $100M, issued 90M species');

  // 3. Happy Hogan: fund $100K (buys from market — handled by species-sim)
  fund(state, USERS.happy.ref, 100_000n * USDC);
  console.log('[SEED] Happy Hogan: funded $100K');

  // 4. Alex Morgan: starts fresh with $0
  console.log('[SEED] Alex Morgan: fresh account (no balance)');

  console.log('[SEED] Startup sequence complete');
}

// ---------------------------------------------------------------------------
// Full development seed
// ---------------------------------------------------------------------------
export function seedDevelopment(): SimState {
  const state = seedBase();
  runStartupSequence(state);
  return state;
}

export function seedTest(): SimState {
  return seedBase(); // clean state for testing
}
