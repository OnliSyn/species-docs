/**
 * ASK MODE TESTS — Read-only queries with no mutations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  expectNoMutation,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import {
  getFundingBalance,
  getVaultBalance,
  getMarketplaceStats,
  getListings,
  getOracleLedger,
  getAssuranceBalance,
} from '@/lib/sim-client';

describe('ASK MODE — Read-only queries', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    // Seed some data to query
    await simulateDeposit('user-001', 5_000);
    await adjustVault('onli-user-001', 100, 'test-setup');
  });

  it('ASK-001 — Balance query returns correct posted/pending', async () => {
    const va = await getFundingBalance('user-001');
    expect(va).not.toBeNull();
    expect(va!.posted).toBeGreaterThan(0);
    expect(typeof va!.posted).toBe('number');
    expect(typeof va!.pending).toBe('number');
  });

  it('ASK-001b — Vault query returns correct Specie count', async () => {
    const vault = await getVaultBalance('onli-user-001');
    expect(vault).not.toBeNull();
    expect(vault!.count).toBe(100);
  });

  it('ASK-002 — Listings query returns array with correct structure', async () => {
    const listings = await getListings();
    expect(listings).not.toBeNull();
    expect(Array.isArray(listings)).toBe(true);
    // Seed data has listings from Pepper and Tony
    expect(listings!.length).toBeGreaterThan(0);
  });

  it('ASK-003 — Marketplace stats returns valid structure', async () => {
    const stats = await getMarketplaceStats();
    expect(stats).not.toBeNull();
    expect(stats).toHaveProperty('totalOrders');
    expect(stats).toHaveProperty('activeListings');
  });

  it('ASK-004 — Oracle ledger returns entries', async () => {
    const ledger = await getOracleLedger('user-001', 5);
    expect(ledger).not.toBeNull();
    expect(Array.isArray(ledger)).toBe(true);
  });

  it('ASK-005 — Assurance balance returns coverage data', async () => {
    const assurance = await getAssuranceBalance();
    expect(assurance).not.toBeNull();
    expect(typeof assurance!.balance).toBe('number');
    expect(typeof assurance!.outstanding).toBe('number');
    expect(typeof assurance!.coverage).toBe('number');
  });

  it('ASK-006 — All queries are read-only: zero mutations', async () => {
    const before = await getBalanceSnapshot();

    // Run every read query
    await getFundingBalance('user-001');
    await getVaultBalance('onli-user-001');
    await getMarketplaceStats();
    await getListings();
    await getOracleLedger('user-001', 5);
    await getAssuranceBalance();

    const after = await getBalanceSnapshot();
    expectNoMutation(before, after);
  });
});
