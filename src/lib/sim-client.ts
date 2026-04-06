// Shared sim client — fetches live data from MarketSB (4001) and Species (4002)
// Used by both /api/chat and /api/system-chat routes

const MARKETSB = process.env.MARKETSB_URL || 'http://localhost:4001';
const SPECIES = process.env.SPECIES_URL || 'http://localhost:4012';

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
};

export { CURRENT_USER, USERS_BY_NAME };

// ---------------------------------------------------------------------------
// Low-level fetchers with timeout
// ---------------------------------------------------------------------------
async function simFetch(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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
    const res = await simFetch(`${MARKETSB}/api/v1/virtual-accounts/va-funding-${userRef}`);
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

export async function getSpeciesVABalance(userRef = CURRENT_USER.ref): Promise<VABalance | null> {
  try {
    const res = await simFetch(`${MARKETSB}/api/v1/virtual-accounts/va-species-${userRef}`);
    if (!res.ok) return null;
    const data = await res.json();
    const bal = data.balance || {};
    return {
      vaId: data.vaId,
      posted: Number(bal.posted ?? data.posted ?? 0),
      pending: Number(bal.pending ?? data.pending ?? 0),
      available: Number(bal.available ?? bal.posted ?? 0),
      currency: data.currency || 'USDC',
      status: data.status || 'active',
      subtype: data.subtype || 'species',
    };
  } catch {
    return null;
  }
}

export async function getAssuranceBalance(): Promise<{ balance: number; outstanding: number; coverage: number } | null> {
  try {
    // Fetch full state to sum ALL assurance sources + species VAs
    const stateRes = await simFetch(`${MARKETSB}/sim/state`);
    if (!stateRes.ok) return null;
    const state = await stateRes.json();

    let totalAssurance = 0;
    let outstanding = 0;

    for (const [vaId, va] of Object.entries(state.virtualAccounts || {})) {
      const posted = Number((va as Record<string, unknown>).posted ?? 0);
      // Sum all assurance VAs: assurance-global + per-user (va-assurance-*)
      if (vaId === 'assurance-global' || vaId.startsWith('va-assurance-')) {
        totalAssurance += posted;
      }
      // Outstanding = total species VA value
      if (vaId.startsWith('va-species-')) {
        outstanding += posted;
      }
    }

    const coverage = outstanding > 0 ? Math.round((totalAssurance / outstanding) * 100) : 100;
    return { balance: totalAssurance, outstanding, coverage };
  } catch {
    return null;
  }
}

export async function getOracleLedger(userRef = CURRENT_USER.ref, limit = 5): Promise<unknown[] | null> {
  try {
    const res = await simFetch(`${MARKETSB}/api/v1/oracle/virtual-accounts/va-funding-${userRef}/ledger`);
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
    const res = await simFetch(`${SPECIES}/marketplace/v1/vault/${onliId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getAssetOracleLedger(onliId = CURRENT_USER.onliId, limit = 5): Promise<unknown[] | null> {
  try {
    const res = await simFetch(`${SPECIES}/oracle/onli/${onliId}/ledger`);
    if (!res.ok) return null;
    const data = await res.json();
    return (Array.isArray(data) ? data : []).slice(0, limit);
  } catch {
    return null;
  }
}

export async function getMarketplaceStats(): Promise<Record<string, unknown> | null> {
  try {
    const res = await simFetch(`${SPECIES}/marketplace/v1/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getListings(): Promise<unknown[] | null> {
  try {
    const res = await simFetch(`${SPECIES}/sim/state`);
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
  fundingBalance: number; // USDC in display units (posted / 1_000_000)
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
    fundingBalance: fundingVA ? fundingVA.posted / 1_000_000 : 0,
    specieCount: vault?.count ?? 0,
    fundingVA,
    vaultBalance: vault,
  };
}

// ---------------------------------------------------------------------------
// Mutations — actually change sim state
// ---------------------------------------------------------------------------

/** Simulate deposit through MarketSB lifecycle (incoming → FBO → compliance → credit). */
export async function simulateDeposit(vaId: string, amount: number, fbo?: string): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await simFetch(`${MARKETSB}/sim/simulate-deposit`, {
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
    const res = await simFetch(`${MARKETSB}/sim/simulate-withdrawal`, {
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
    const res = await simFetch(`${MARKETSB}/sim/credit-va`, {
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
    const res = await simFetch(`${MARKETSB}/sim/debit-va`, {
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
    const res = await simFetch(`${MARKETSB}/api/v1/cashier/post-batch`, {
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
    const res = await simFetch(`${SPECIES}/sim/vault-adjust`, {
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
    const res = await simFetch(`${MARKETSB}/api/v1/transactions/trade`, {
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
    const res = await simFetch(`${MARKETSB}/api/v1/transactions/list`, {
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
    const res = await simFetch(`${MARKETSB}/api/v1/transactions/redeem`, {
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
    const res = await simFetch(`${SPECIES}/sim/create-listing`, {
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
    const res = await simFetch(`${MARKETSB}/api/v1/agentContext`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getSpeciesAgentContext(): Promise<unknown | null> {
  try {
    const res = await simFetch(`${SPECIES}/marketplace/v1/agentContext`);
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
  return (baseUnits / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDisplay(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
