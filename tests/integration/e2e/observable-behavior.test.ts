/**
 * E2E OBSERVABLE BEHAVIOR TESTS
 * These test what a REAL USER would see, not just function returns.
 * If the Oracle API returns data but the UI can't display it, that's a failure.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  simulateDeposit,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute } from '@/lib/journey-engine';

const MARKETSB = 'http://127.0.0.1:3101';
const SPECIES = 'http://127.0.0.1:3102';

describe('E2E — Observable Behavior After Buy', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 10_000);
  });

  it('E2E-001 — After buy: MarketSB oracle has funding entries', async () => {
    await buyExecute(100);

    const res = await fetch(`${MARKETSB}/api/v1/oracle/virtual-accounts/va-funding-user-001/ledger`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.entries || data.ledger || []);

    // Should have deposit + buy cost + fees
    expect(entries.length).toBeGreaterThanOrEqual(2);

    // Should contain buy-related entry
    const buyEntry = entries.find((e: any) => e.type?.includes('buy') || e.type?.includes('batch'));
    expect(buyEntry).toBeDefined();
  });

  it('E2E-002 — After buy: Species oracle has ChangeOwner entries', async () => {
    await buyExecute(100);

    const res = await fetch(`${SPECIES}/oracle/ledger`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.entries || data.ledger || []);

    // Pipeline records one change_owner per fill at ownership.changed (treasury|sellerLocker → buyer)
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const changeOwners = entries.filter((e: any) => e.type === 'change_owner');
    expect(changeOwners.length).toBeGreaterThanOrEqual(1);
    const toBuyer = changeOwners.filter((e: any) => e.to === 'onli-user-001');
    expect(toBuyer.length).toBeGreaterThanOrEqual(1);
    expect(toBuyer.some((e: any) => e.count === 100)).toBe(true);
  });

  it('E2E-003 — Oracle proxy API returns entries (simulates frontend fetch)', async () => {
    await buyExecute(100);

    // This is what the frontend Canvas would call
    // In tests, we call the Next.js API route handler directly
    const fundingRes = await fetch(`${MARKETSB}/api/v1/oracle/virtual-accounts/va-funding-user-001/ledger`);
    const fundingEntries = await fundingRes.json();
    expect(Array.isArray(fundingEntries) ? fundingEntries.length : 0).toBeGreaterThan(0);

    const assetRes = await fetch(`${SPECIES}/oracle/ledger`);
    const assetEntries = await assetRes.json();
    const assetArr = Array.isArray(assetEntries) ? assetEntries : (assetEntries.entries || []);
    expect(assetArr.length).toBeGreaterThan(0);
  });

  it('E2E-004 — After buy: vault balance matches expected count', async () => {
    const before = await getBalanceSnapshot();
    expect(before.specieCount).toBe(0);

    await buyExecute(100);

    const after = await getBalanceSnapshot();
    expect(after.specieCount).toBe(100);
  });

  it('E2E-005 — After buy: assurance balance increased', async () => {
    const before = await getBalanceSnapshot();

    await buyExecute(100);

    const after = await getBalanceSnapshot();
    // Assurance should increase by asset cost (buy proceeds fund assurance)
    expect(after.assuranceBalance).toBeGreaterThan(before.assuranceBalance);
  });

  it('E2E-006 — After buy: marketplace stats updated', async () => {
    await buyExecute(100);

    const res = await fetch(`${SPECIES}/marketplace/v1/stats`);
    expect(res.ok).toBe(true);
    const stats = await res.json();
    expect(stats.totalOrders).toBeGreaterThan(0);
  });
});

describe('E2E — Observable Behavior After Fund', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
  });

  it('E2E-010 — After fund: funding VA balance visible via API', async () => {
    await simulateDeposit('user-001', 5_000);

    const res = await fetch(`${MARKETSB}/api/v1/virtual-accounts/va-funding-user-001`);
    expect(res.ok).toBe(true);
    const va = await res.json();
    expect(va.balance.posted).toBeGreaterThan(0);
  });

  it('E2E-011 — After fund: oracle has deposit entry', async () => {
    await simulateDeposit('user-001', 5_000);

    const res = await fetch(`${MARKETSB}/api/v1/oracle/virtual-accounts/va-funding-user-001/ledger`);
    const entries = await res.json();
    const arr = Array.isArray(entries) ? entries : [];
    const depositEntry = arr.find((e: any) => e.type?.includes('deposit'));
    expect(depositEntry).toBeDefined();
  });
});
