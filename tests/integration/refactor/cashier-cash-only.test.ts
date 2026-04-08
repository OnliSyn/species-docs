/**
 * CASHIER CASH-ONLY TESTS
 * Verify MarketSB cashier does NOT create species VAs.
 * After refactor: cashier handles USDC only.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  simulateDeposit,
  waitForHealth,
} from '../../helpers/sim-control';

const MARKETSB = 'http://localhost:4001';

describe('CASHIER — Cash Only (no species VAs)', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
  });

  it('CASH-001 — No species VAs exist after reset', async () => {
    const res = await fetch(`${MARKETSB}/sim/state`);
    const state = await res.json();
    const vas = Object.keys(state.virtualAccounts || {});
    const speciesVAs = vas.filter((v: string) => v.includes('species'));
    expect(speciesVAs).toHaveLength(0);
  });

  it('CASH-002 — Only funding VAs exist for users', async () => {
    const res = await fetch(`${MARKETSB}/sim/state`);
    const state = await res.json();
    const vas = Object.keys(state.virtualAccounts || {});
    const userVAs = vas.filter((v: string) => v.startsWith('va-funding-'));
    // 6 users: alex, pepper, tony, happy, steve, natasha
    expect(userVAs.length).toBe(6);
    userVAs.forEach((va: string) => {
      expect(va).toMatch(/^va-funding-user-/);
    });
  });

  it('CASH-003 — System accounts are cash-only: pool, fees, incoming, outgoing, assurance', async () => {
    const res = await fetch(`${MARKETSB}/sim/state`);
    const state = await res.json();
    const vas = Object.keys(state.virtualAccounts || {});
    const systemAccounts = vas.filter((v: string) => !v.startsWith('va-funding-') && !v.startsWith('va-cashier-'));

    expect(systemAccounts).toContain('treasury-100');
    expect(systemAccounts).toContain('operating-300');
    expect(systemAccounts).toContain('pending-deposit-400');
    expect(systemAccounts).toContain('pending-withdrawal-450');
    expect(systemAccounts).toContain('assurance-global');

    // settlement-200 removed (dead code)
    expect(systemAccounts).not.toContain('settlement-200');
  });

  it('CASH-004 — Deposit only affects funding VA, no species VA created', async () => {
    await simulateDeposit('user-001', 5000);

    const res = await fetch(`${MARKETSB}/sim/state`);
    const state = await res.json();
    const vas = Object.keys(state.virtualAccounts || {});
    const speciesVAs = vas.filter((v: string) => v.includes('species'));
    expect(speciesVAs).toHaveLength(0);

    // Funding VA should have the deposit
    const funding = state.virtualAccounts['va-funding-user-001'];
    expect(funding).toBeDefined();
    expect(funding.posted).toBeGreaterThan(0);
  });
});
