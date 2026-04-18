// Shared sim client — fetches live data from MarketSB and Species via @/lib/sim-gateway.

import { fetchMarketSb, fetchSpecies } from '@/lib/sim-gateway';
import { buildTradePanelReadModel } from '@/lib/trade-panel-read-model';
import { formatUsdcDisplay, postedBaseUnitsToUsdNumber } from '@/lib/amount';

// Current user — Alex Morgan
const CURRENT_USER = {
  ref: 'user-001',
  onliId: 'onli-user-001',
  name: 'Alex Morgan',
};

const USERS_BY_NAME: Record<string, { ref: string; onliId: string; name: string }> = {
  'pepper': { ref: 'user-456', onliId: 'onli-user-456', name: 'Pepper Potts' },
  'pepper potts': { ref: 'user-456', onliId: 'onli-user-456', name: 'Pepper Potts' },
  'tony': { ref: 'user-789', onliId: 'onli-user-789', name: 'Tony Stark' },
  'tony stark': { ref: 'user-789', onliId: 'onli-user-789', name: 'Tony Stark' },
  'happy': { ref: 'user-012', onliId: 'onli-user-012', name: 'Happy Hogan' },
  'happy hogan': { ref: 'user-012', onliId: 'onli-user-012', name: 'Happy Hogan' },
  'steve': { ref: 'user-555', onliId: 'onli-user-555', name: 'Steve Rogers' },
  'steve rogers': { ref: 'user-555', onliId: 'onli-user-555', name: 'Steve Rogers' },
  'natasha': { ref: 'user-666', onliId: 'onli-user-666', name: 'Natasha Romanoff' },
  'natasha romanoff': { ref: 'user-666', onliId: 'onli-user-666', name: 'Natasha Romanoff' },
};

export { CURRENT_USER, USERS_BY_NAME };

// ---------------------------------------------------------------------------
// MarketSB queries
// ---------------------------------------------------------------------------

export interface VABalance {
  vaId: string;
  posted: number; // base units as number (from serialized bigint)
  pending: number;
  available: number;
  currency: string;
  status: string;
  subtype: string;
}

export async function getFundingBalance(userRef = CURRENT_USER.ref): Promise<VABalance | null> {
  try {
    const res = await fetchMarketSb(`/api/v1/virtual-accounts/va-funding-${userRef}`);
    if (!res.ok) return null;
    const data = await res.json();
    // API returns { balance: { posted, pending, available } } with serialized bigints (strings)
    const bal = data.balance || {};
    return {
      vaId: data.vaId,
      posted: Number(bal.posted ?? data.posted ?? 0),
      pending: Number(bal.pending ?? data.pending ?? 0),
      available: Number(bal.available ?? bal.posted ?? 0),
      currency: data.currency || 'USDC',
      status: data.status || 'active',
      subtype: data.subtype || 'funding',
    };
  } catch {
    return null;
  }
}

/** Single snapshot for assurance vs circulation — same read model as GET /api/trade-panel (no client math). */
export interface AssuranceCoverageSnapshot {
  /** assurance-global posted, USDC base units (6 dp) */
  assurancePosted: number;
  /** Sum of Specie counts in all user vaults (excludes treasury) */
  circulationSpecieCount: number;
  /** circulationSpecieCount × $1 in base units */
  circulationValuePosted: number;
  /** assurance ÷ circulation value × 100 (uncapped canary; may exceed 100) */
  coveragePercent: number;
  buyBackGuaranteeDollars: string;
  buyBackGuaranteeCents: string;
  assurancePostedDisplay: string;
  circulationValuePostedDisplay: string;
}

/** Fallback when sims are unreachable — still server-shaped (no client derivation). */
export const EMPTY_ASSURANCE_COVERAGE_SNAPSHOT: AssuranceCoverageSnapshot = {
  assurancePosted: 0,
  circulationSpecieCount: 0,
  circulationValuePosted: 0,
  coveragePercent: 100,
  buyBackGuaranteeDollars: '0',
  buyBackGuaranteeCents: '00',
  assurancePostedDisplay: formatUsdcDisplay(0n),
  circulationValuePostedDisplay: formatUsdcDisplay(0n),
};

export async function getAssuranceBalance(): Promise<AssuranceCoverageSnapshot | null> {
  try {
    const [msbStateRes, specStateRes] = await Promise.all([
      fetchMarketSb('/sim/state'),
      fetchSpecies('/sim/state'),
    ]);
    if (!msbStateRes.ok || !specStateRes.ok) return null;
    const msbState = await msbStateRes.json();
    const specState = await specStateRes.json();
    const m = buildTradePanelReadModel(msbState, specState, 'user-001');
    return {
      assurancePosted: Number(m.assuranceGlobalPosted),
      circulationSpecieCount: m.circulationSpecieCount,
      circulationValuePosted: Number(m.circulationValuePosted),
      coveragePercent: m.coveragePercent,
      buyBackGuaranteeDollars: m.buyBackGuaranteeDollars,
      buyBackGuaranteeCents: m.buyBackGuaranteeCents,
      assurancePostedDisplay: m.assuranceGlobalPostedDisplay,
      circulationValuePostedDisplay: m.circulationValuePostedDisplay,
    };
  } catch {
    return null;
  }
}

export async function getOracleLedger(userRef = CURRENT_USER.ref, limit = 5): Promise<unknown[] | null> {
  try {
    const res = await fetchMarketSb(`/api/v1/oracle/virtual-accounts/va-funding-${userRef}/ledger`);
    if (!res.ok) return null;
    const data = await res.json();
    const events = Array.isArray(data) ? data : data.events || [];
    return events.slice(0, limit);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Species queries
// ---------------------------------------------------------------------------

export interface VaultBalance {
  vaultId: string;
  count: number;
}

export async function getVaultBalance(onliId = CURRENT_USER.onliId): Promise<VaultBalance | null> {
  try {
    const res = await fetchSpecies(`/marketplace/v1/vault/${onliId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getAssetOracleLedger(onliId = CURRENT_USER.onliId, limit = 5): Promise<unknown[] | null> {
  try {
    const res = await fetchSpecies(`/oracle/onli/${onliId}/ledger`);
    if (!res.ok) return null;
    const data = await res.json();
    return (Array.isArray(data) ? data : []).slice(0, limit);
  } catch {
    return null;
  }
}

export async function getMarketplaceStats(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchSpecies(`/marketplace/v1/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getListings(): Promise<unknown[] | null> {
  try {
    const res = await fetchSpecies(`/sim/state`);
    if (!res.ok) return null;
    const state = await res.json();
    const listings = state.listings || {};
    return Object.values(listings).filter((l: any) => l.status === 'active');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Convenience: get user state (funding + vault in one call)
// ---------------------------------------------------------------------------

export interface UserState {
  fundingBalance: number; // USDC display units (from posted base units)
  specieCount: number;    // vault count
  fundingVA: VABalance | null;
  vaultBalance: VaultBalance | null;
}

export async function getUserState(userRef = CURRENT_USER.ref, onliId = CURRENT_USER.onliId): Promise<UserState> {
  const [fundingVA, vault] = await Promise.all([
    getFundingBalance(userRef),
    getVaultBalance(onliId),
  ]);

  return {
    fundingBalance: fundingVA ? postedBaseUnitsToUsdNumber(fundingVA.posted) : 0,
    specieCount: vault?.count ?? 0,
    fundingVA,
    vaultBalance: vault,
  };
}

// ---------------------------------------------------------------------------
// Species sim buy operations (proper listing/treasury management)
// ---------------------------------------------------------------------------

/** Buy from marketplace listings (FIFO). Decrements listing quantities. */
export async function buyFromMarket(buyerOnliId: string, quantity: number): Promise<{ ok: boolean; matched: number; data?: unknown }> {
  try {
    const res = await fetchSpecies(`/sim/buy-from-market`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerOnliId, quantity }),
    });
    if (!res.ok) return { ok: false, matched: 0 };
    const data = await res.json();
    return { ok: true, matched: data.matched ?? 0, data };
  } catch {
    return { ok: false, matched: 0 };
  }
}

/** Issue new species from treasury to buyer vault. */
export async function buyFromTreasury(buyerOnliId: string, quantity: number): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchSpecies(`/sim/buy-from-treasury`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerOnliId, quantity }),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Mutations — actually change sim state
// ---------------------------------------------------------------------------

/** Simulate deposit through MarketSB lifecycle (incoming → FBO → compliance → credit). */
export async function simulateDeposit(vaId: string, amount: number, fbo?: string): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchMarketSb(`/sim/simulate-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaId, amount: String(amount), fbo }),
    });
    if (!res.ok) return { ok: false, data: await res.json().catch(() => null) };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

/** Simulate withdrawal through MarketSB lifecycle (debit → compliance → outgoing → sent). */
export async function simulateWithdrawal(vaId: string, amount: number, destination?: string): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchMarketSb(`/sim/simulate-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaId, amount: String(amount), destination }),
    });
    if (!res.ok) return { ok: false, data: await res.json().catch(() => null) };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

/** Credit a VA directly (legacy shortcut). Amount in USDC base units. */
export async function creditVA(vaId: string, amount: number): Promise<boolean> {
  try {
    const res = await fetchMarketSb(`/sim/credit-va`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaId, amount: String(amount) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Debit a VA directly (legacy shortcut). Amount in USDC base units. */
export async function debitVA(vaId: string, amount: number): Promise<boolean> {
  try {
    const res = await fetchMarketSb(`/sim/debit-va`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaId, amount: String(amount) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Call MarketSB cashier post-batch for buy/sell settlement.
 * quantity = raw specie count (e.g. 1000 for 1000 species)
 * unitPrice = price per specie in USDC base units (e.g. 1_000_000 for $1)
 */
export async function postCashierBatch(params: {
  eventId: string;
  matchId: string;
  intent: 'buy' | 'sell';
  quantity: number;
  buyerVaId: string;
  sellerVaId?: string;
  unitPrice: number;
  fees?: { issuance?: boolean; liquidity?: boolean };
}): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchMarketSb(`/api/v1/cashier/post-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        quantity: String(params.quantity),
        unitPrice: String(params.unitPrice),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[postCashierBatch] failed:', res.status, err);
      return { ok: false };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

/** Adjust Species vault count directly. */
export async function adjustVault(vaultId: string, delta: number, reason?: string): Promise<boolean> {
  try {
    const res = await fetchSpecies(`/sim/vault-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultId, delta, reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cashier Spec endpoints (trade / list / redeem)
// Uses the new cashier account model, not legacy post-batch
// ---------------------------------------------------------------------------

/** Well-known cashier account IDs (must match cashier-bootstrap.ts) */
const CASHIER_ACCOUNTS = {
  userFunding: (ref: string) => `acc-user-funding-${ref}`,
  assurance: 'acc-sub-assurance',
  liquidityFee: 'acc-sub-liquidity-fee',
  listingFee: 'acc-sub-listing-fee',
} as const;

export { CASHIER_ACCOUNTS };

/** P2P trade — buyer pays seller, no fees. */
export async function cashierTrade(params: {
  buyerRef: string;
  sellerRef: string;
  amount: string; // USD string e.g. "1000.00"
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchMarketSb(`/api/v1/transactions/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderAccountId: CASHIER_ACCOUNTS.userFunding(params.buyerRef),
        receiverAccountId: CASHIER_ACCOUNTS.userFunding(params.sellerRef),
        amount: params.amount,
        currency: 'USD',
        metadata: params.metadata,
        idempotencyKey: params.idempotencyKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[cashierTrade] failed:', res.status, err);
      return { ok: false, data: err };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

/** List species for sale — flat listing fee charged to seller. */
export async function cashierList(params: {
  sellerRef: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchMarketSb(`/api/v1/transactions/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderAccountId: CASHIER_ACCOUNTS.userFunding(params.sellerRef),
        receiverAccountId: CASHIER_ACCOUNTS.listingFee,
        currency: 'USD',
        metadata: params.metadata,
        idempotencyKey: params.idempotencyKey,
        // amount is omitted — cashier uses configured listing fee
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[cashierList] failed:', res.status, err);
      return { ok: false, data: err };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

/** Redeem species — MarketMaker buyback via assurance.
 * 1. Liquidity fee: seller → liquidityFee sub-account
 * 2. Payout: assurance → seller (1:1 at $1/Specie)
 */
export async function cashierRedeem(params: {
  sellerRef: string;
  redeemAmount: string; // USD string for full asset value e.g. "1000.00"
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchMarketSb(`/api/v1/transactions/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerAccountId: CASHIER_ACCOUNTS.userFunding(params.sellerRef),
        liquidityFeeSubAccountId: CASHIER_ACCOUNTS.liquidityFee,
        assuranceSubAccountId: CASHIER_ACCOUNTS.assurance,
        redeemAmount: params.redeemAmount,
        currency: 'USD',
        metadata: params.metadata,
        idempotencyKey: params.idempotencyKey,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[cashierRedeem] failed:', res.status, err);
      return { ok: false, data: err };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

/** Create a listing in the Species sim. */
export async function createSpeciesListing(params: {
  sellerOnliId: string;
  quantity: number;
  unitPrice?: number; // base units, default $1 = 1_000_000
}): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetchSpecies(`/sim/create-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerOnliId: params.sellerOnliId,
        quantity: params.quantity,
        unitPrice: params.unitPrice ?? 1_000_000,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[createSpeciesListing] failed:', res.status, err);
      return { ok: false, data: err };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Agent context (LLM grounding — MarketSB + Species)
// ---------------------------------------------------------------------------

export async function getMarketsbAgentContext(): Promise<unknown | null> {
  try {
    const res = await fetchMarketSb(`/api/v1/agentContext`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getSpeciesAgentContext(): Promise<unknown | null> {
  try {
    const res = await fetchSpecies(`/marketplace/v1/agentContext`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Parallel fetch of both sim service maps for Onli AI (cashier + marketplace pipeline). */
export async function getTwinSimAgentContexts(): Promise<{
  marketsb: unknown | null;
  species: unknown | null;
}> {
  const [marketsb, species] = await Promise.all([
    getMarketsbAgentContext(),
    getSpeciesAgentContext(),
  ]);
  return { marketsb, species };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

export function fmtUSDC(baseUnits: number): string {
  return formatUsdcDisplay(BigInt(Math.trunc(baseUnits)));
}

export function fmtDisplay(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
