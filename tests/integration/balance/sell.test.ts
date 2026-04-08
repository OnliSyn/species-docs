import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  assertBalanceDelta,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { sellExecute } from '@/lib/journey-engine';

describe('TRD-SELL — Sell/List Journey', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 10_000);
    await adjustVault('onli-user-001', 5000, 'test-setup');
  });

  it('TRD-SELL-001 — Listing created, no USDC change, Specie escrowed', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 200;

    const result = await sellExecute(quantity);
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

    // Sell = list for sale. No USDC change. Specie moves to escrow (decreases from user vault).
    assertBalanceDelta(before, after, {
      usdcPosted: 0,
      specieCount: -quantity,
    });
  });
});
