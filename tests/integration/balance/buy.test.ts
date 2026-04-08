import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  assertBalanceDelta,
  simulateDeposit,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute } from '@/lib/journey-engine';

describe('TRD-BUY — Buy Journey', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    // Precondition: fund account with $10,000 (converted to base units by helper)
    await simulateDeposit('user-001', 10_000);
  });

  it('TRD-BUY-001 — USDC decreases and Specie increases by exact amount', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 100;

    const result = await buyExecute(quantity);
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

    // Buy 100 Specie at $1.00 = $100 = 100,000,000 base units
    assertBalanceDelta(before, after, {
      usdcPosted: -(quantity * 1_000_000),
      specieCount: quantity,
    });
  });

  it('TRD-BUY-004 — No buy fee charged (buy is free)', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 1000;

    await buyExecute(quantity);

    const after = await getBalanceSnapshot();
    const usdcDelta = before.usdcPosted - after.usdcPosted;

    // USDC delta = exactly quantity * $1.00 in base units, no extra fees
    expect(usdcDelta).toBe(quantity * 1_000_000);
  });
});
