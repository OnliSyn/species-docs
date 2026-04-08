// ── @marketsb/sim — Development seed data ──
// Multi-user seed with Treasury, Assurance, and 4 user accounts

import type { SimState, VirtualAccountState, OracleEntry } from './state.js';
import { createEmptyState } from './state.js';
import { bootstrapCashierFromState } from './cashier-bootstrap.js';

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
  alex:    { ref: 'user-001', name: 'Alex Morgan',       onliId: 'onli-user-001' },
  pepper:  { ref: 'user-456', name: 'Pepper Potts',      onliId: 'onli-user-456' },
  tony:    { ref: 'user-789', name: 'Tony Stark',        onliId: 'onli-user-789' },
  happy:   { ref: 'user-012', name: 'Happy Hogan',       onliId: 'onli-user-012' },
  steve:   { ref: 'user-555', name: 'Steve Rogers',      onliId: 'onli-user-555' },
  natasha: { ref: 'user-666', name: 'Natasha Romanoff',  onliId: 'onli-user-666' },
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
  // Global assurance account (tracks total issuance proceeds) — tbCode 125 avoids collision with per-user assurance (520, 550, …)
  state.virtualAccounts.set('assurance-global', makeVA('assurance-global', 'system', 'assurance', 125, 0n));

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

/** Fixed ids/timestamps so seeded state is reproducible (no Date.now()). */
interface SeedTxnMeta {
  entryId: string;
  timestamp: string;
}

function fund(state: SimState, userRef: string, amount: bigint, meta: SeedTxnMeta) {
  const ids = vaIds(userRef);
  const va = state.virtualAccounts.get(ids.funding)!;
  const before = va.posted;
  va.posted += amount;
  va.updatedAt = meta.timestamp;

  addOracleEntry(state, {
    entryId: meta.entryId,
    vaId: ids.funding,
    type: 'deposit_credited',
    amount,
    balanceBefore: before,
    balanceAfter: va.posted,
    ref: `dep-${userRef}-init`,
    timestamp: meta.timestamp,
  });
}

function issueFromTreasury(state: SimState, userRef: string, specieCount: bigint, meta: SeedTxnMeta) {
  const ids = vaIds(userRef);
  const cost = specieCount * USDC; // 1 Specie = $1 USDC
  const issuanceFee = specieCount * 50_000n; // $0.05 per Specie
  const liquidityFee = (cost * 100n) / 10_000n; // 1%
  const total = cost + issuanceFee + liquidityFee;
  const ts = meta.timestamp;

  // Deduct from user funding
  const fundingVA = state.virtualAccounts.get(ids.funding)!;
  fundingVA.posted -= total;
  fundingVA.updatedAt = ts;

  // Credit user species VA (value = species count in base units)
  const speciesVA = state.virtualAccounts.get(ids.species)!;
  const speciesBefore = speciesVA.posted;
  speciesVA.posted += specieCount * USDC;
  speciesVA.updatedAt = ts;

  // Issuance proceeds go to global assurance
  const assuranceVA = state.virtualAccounts.get('assurance-global')!;
  assuranceVA.posted += cost; // full cost (not including fees) goes to assurance
  assuranceVA.updatedAt = ts;

  // Fees go to operating
  const operatingVA = state.virtualAccounts.get('operating-300')!;
  operatingVA.posted += issuanceFee + liquidityFee;
  operatingVA.updatedAt = ts;

  // Treasury species count tracked in species-sim, not here
  // But we track the USDC value in treasury VA
  const treasuryVA = state.virtualAccounts.get('treasury-100')!;
  treasuryVA.posted += cost; // treasury receives payment
  treasuryVA.updatedAt = ts;

  addOracleEntry(state, {
    entryId: meta.entryId,
    vaId: ids.species,
    type: 'issuance_buy',
    amount: specieCount * USDC,
    balanceBefore: speciesBefore,
    balanceAfter: speciesVA.posted,
    ref: `issue-${userRef}`,
    timestamp: ts,
  });
}

/** Secondary market buy — mirrors POST /cashier/post-batch intent `sell` (buyer pays seller + liquidity fee). */
function secondaryMarketPurchase(
  state: SimState,
  buyerRef: string,
  sellerRef: string,
  quantity: bigint,
  unitPrice: bigint,
  meta: SeedTxnMeta,
) {
  const buyerIds = vaIds(buyerRef);
  const sellerIds = vaIds(sellerRef);
  const assetCost = quantity * unitPrice;
  const liquidityFee = 0n; // P2P trade — no fees
  const totalBuyerDebit = assetCost;
  const ts = meta.timestamp;

  const buyerFunding = state.virtualAccounts.get(buyerIds.funding)!;
  const sellerFunding = state.virtualAccounts.get(sellerIds.funding)!;
  const buyerSpecies = state.virtualAccounts.get(buyerIds.species)!;
  const sellerSpecies = state.virtualAccounts.get(sellerIds.species)!;
  const operating = state.virtualAccounts.get('operating-300')!;

  const bfBefore = buyerFunding.posted;
  buyerFunding.posted -= totalBuyerDebit;
  buyerFunding.updatedAt = ts;

  const sfBefore = sellerFunding.posted;
  sellerFunding.posted += assetCost;
  sellerFunding.updatedAt = ts;

  operating.posted += liquidityFee;
  operating.updatedAt = ts;

  const ssBefore = sellerSpecies.posted;
  sellerSpecies.posted -= assetCost;
  sellerSpecies.updatedAt = ts;

  const bsBefore = buyerSpecies.posted;
  buyerSpecies.posted += assetCost;
  buyerSpecies.updatedAt = ts;

  const ref = meta.entryId;
  addOracleEntry(state, {
    entryId: `${ref}-buyer-funding`,
    vaId: buyerIds.funding,
    type: 'cashier_sell_debit',
    amount: totalBuyerDebit,
    balanceBefore: bfBefore,
    balanceAfter: buyerFunding.posted,
    ref,
    timestamp: ts,
  });
  addOracleEntry(state, {
    entryId: `${ref}-seller-funding`,
    vaId: sellerIds.funding,
    type: 'cashier_sell_credit',
    amount: assetCost,
    balanceBefore: sfBefore,
    balanceAfter: sellerFunding.posted,
    ref,
    timestamp: ts,
  });
  addOracleEntry(state, {
    entryId: `${ref}-seller-species`,
    vaId: sellerIds.species,
    type: 'secondary_species_debit',
    amount: assetCost,
    balanceBefore: ssBefore,
    balanceAfter: sellerSpecies.posted,
    ref,
    timestamp: ts,
  });
  addOracleEntry(state, {
    entryId: `${ref}-buyer-species`,
    vaId: buyerIds.species,
    type: 'secondary_species_credit',
    amount: assetCost,
    balanceBefore: bsBefore,
    balanceAfter: buyerSpecies.posted,
    ref,
    timestamp: ts,
  });
}

export function runStartupSequence(state: SimState): void {
  console.log('[SEED] Running startup sequence...');
  // Clean seed — all users start at $0. Treasury backs 1B Specie.
  // No deposits, no trades, no history.
  console.log('[SEED] Clean seed: all users at $0, no transactions');
  console.log('[SEED] Startup sequence complete');
}

// ---------------------------------------------------------------------------
// Full development seed
// ---------------------------------------------------------------------------
export function seedDevelopment(): SimState {
  const state = seedBase();
  runStartupSequence(state);
  bootstrapCashierFromState(state);
  return state;
}

export function seedTest(): SimState {
  const state = seedBase();
  bootstrapCashierFromState(state);
  return state;
}
