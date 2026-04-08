/**
 * Sim control helpers for integration tests.
 * Manages sim lifecycle, state reset, and balance snapshots.
 */

const MARKETSB = 'http://localhost:4001';
const SPECIES = 'http://localhost:4012';

export interface BalanceSnapshot {
  /** USDC funding balance in base units (1 USDC = 1,000,000) */
  usdcPosted: number;
  usdcPending: number;
  /** Specie count in vault */
  specieCount: number;
  /** Assurance pool balance in base units */
  assuranceBalance: number;
  /** Assurance outstanding (total Specie value backed) */
  assuranceOutstanding: number;
}

export interface BalanceDelta {
  usdcPosted?: number;
  specieCount?: number;
  assuranceBalance?: number;
}

/** Check if both sims are healthy */
export async function checkHealth(): Promise<{ marketsb: boolean; species: boolean }> {
  const [msb, sp] = await Promise.all([
    fetch(`${MARKETSB}/health`).then(r => r.ok).catch(() => false),
    fetch(`${SPECIES}/health`).then(r => r.ok).catch(() => false),
  ]);
  return { marketsb: msb, species: sp };
}

/** Wait for both sims to be healthy (poll with timeout) */
export async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const health = await checkHealth();
    if (health.marketsb && health.species) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Sims did not become healthy within timeout');
}

/** Reset both sims to seed state */
export async function resetSims(): Promise<void> {
  const [msb, sp] = await Promise.all([
    fetch(`${MARKETSB}/sim/reset`, { method: 'POST' }),
    fetch(`${SPECIES}/sim/reset`, { method: 'POST' }),
  ]);
  if (!msb.ok) throw new Error(`MarketSB reset failed: ${msb.status}`);
  if (!sp.ok) throw new Error(`Species reset failed: ${sp.status}`);
}

/** Get full sim state dump from both sims */
export async function getSimState(): Promise<{ marketsb: unknown; species: unknown }> {
  const [msb, sp] = await Promise.all([
    fetch(`${MARKETSB}/sim/state`).then(r => r.json()),
    fetch(`${SPECIES}/sim/state`).then(r => r.json()),
  ]);
  return { marketsb: msb, species: sp };
}

/** Get a balance snapshot for a user */
export async function getBalanceSnapshot(
  userRef = 'user-001',
  onliId = 'onli-user-001',
): Promise<BalanceSnapshot> {
  // Fetch funding VA
  const fundingVaId = `va-funding-${userRef}`;
  const vaRes = await fetch(`${MARKETSB}/api/v1/virtual-accounts/${fundingVaId}`).catch(() => null);
  let usdcPosted = 0;
  let usdcPending = 0;
  if (vaRes?.ok) {
    const va = await vaRes.json();
    usdcPosted = va.posted ?? va.posted_balance ?? 0;
    usdcPending = va.pending ?? va.pending_balance ?? 0;
  }

  // Fetch vault balance
  const vaultRes = await fetch(`${SPECIES}/marketplace/v1/vault/${onliId}`).catch(() => null);
  let specieCount = 0;
  if (vaultRes?.ok) {
    const vault = await vaultRes.json();
    specieCount = vault.count ?? 0;
  }

  // Fetch assurance
  const assRes = await fetch(`${MARKETSB}/api/v1/accounts/acc-sub-assurance/balance`, { method: 'POST' }).catch(() => null);
  let assuranceBalance = 0;
  let assuranceOutstanding = 0;
  if (assRes?.ok) {
    const ass = await assRes.json();
    assuranceBalance = ass.posted ?? ass.posted_balance ?? 0;
    assuranceOutstanding = ass.pending ?? 0;
  }

  return { usdcPosted, usdcPending, specieCount, assuranceBalance, assuranceOutstanding };
}

/** Assert exact balance deltas between two snapshots. Integer comparison — no tolerance. */
export function assertBalanceDelta(
  before: BalanceSnapshot,
  after: BalanceSnapshot,
  expected: BalanceDelta,
): void {
  if (expected.usdcPosted !== undefined) {
    const actual = after.usdcPosted - before.usdcPosted;
    if (actual !== expected.usdcPosted) {
      throw new Error(
        `USDC delta mismatch: expected ${expected.usdcPosted}, got ${actual} ` +
        `(before: ${before.usdcPosted}, after: ${after.usdcPosted})`
      );
    }
  }
  if (expected.specieCount !== undefined) {
    const actual = after.specieCount - before.specieCount;
    if (actual !== expected.specieCount) {
      throw new Error(
        `Specie delta mismatch: expected ${expected.specieCount}, got ${actual} ` +
        `(before: ${before.specieCount}, after: ${after.specieCount})`
      );
    }
  }
  if (expected.assuranceBalance !== undefined) {
    const actual = after.assuranceBalance - before.assuranceBalance;
    if (actual !== expected.assuranceBalance) {
      throw new Error(
        `Assurance delta mismatch: expected ${expected.assuranceBalance}, got ${actual} ` +
        `(before: ${before.assuranceBalance}, after: ${after.assuranceBalance})`
      );
    }
  }
}

/** Assert that NO balances changed (read-only operation) */
export function expectNoMutation(before: BalanceSnapshot, after: BalanceSnapshot): void {
  assertBalanceDelta(before, after, {
    usdcPosted: 0,
    specieCount: 0,
  });
}

/** Simulate a USDC deposit via MarketSB */
export async function simulateDeposit(
  userRef = 'user-001',
  amountUSDC: number,
): Promise<{ ok: boolean }> {
  const vaId = `va-funding-${userRef}`;
  const res = await fetch(`${MARKETSB}/sim/simulate-deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaId, amount: amountUSDC }),
  });
  return { ok: res.ok };
}

/** Adjust vault balance directly (for test setup) */
export async function adjustVault(
  onliId: string,
  delta: number,
  reason = 'test-setup',
): Promise<{ ok: boolean }> {
  const res = await fetch(`${SPECIES}/sim/vault-adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onliId, delta, reason }),
  });
  return { ok: res.ok };
}
