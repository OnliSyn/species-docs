/**
 * IDEMPOTENCY TESTS — No double execution on retry
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute, redeemExecute, transferExecute } from '@/lib/journey-engine';

describe('IDEMP — Idempotency Tests', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 50_000);
    await adjustVault('onli-user-001', 10000, 'test-setup');
  });

  it('IDEMP-001 — Two sequential buys produce TWO distinct balance changes', async () => {
    // This tests that each buy is a separate transaction, not idempotent replay
    const before = await getBalanceSnapshot();

    await buyExecute(100);
    const afterFirst = await getBalanceSnapshot();

    await buyExecute(100);
    const afterSecond = await getBalanceSnapshot();

    // First buy: -100 USDC, +100 Specie
    const firstDelta = afterFirst.usdcPosted - before.usdcPosted;
    const secondDelta = afterSecond.usdcPosted - afterFirst.usdcPosted;

    // Each should deduct the same amount
    expect(firstDelta).toBe(-(100 * 1_000_000));
    expect(secondDelta).toBe(-(100 * 1_000_000));

    // Total should be double
    expect(afterSecond.usdcPosted - before.usdcPosted).toBe(-(200 * 1_000_000));
    expect(afterSecond.specieCount - before.specieCount).toBe(200);
  });

  it('IDEMP-002 — Transfer same amount twice: both execute', async () => {
    const before = await getBalanceSnapshot();

    await transferExecute(50, 'Pepper Potts');
    await transferExecute(50, 'Pepper Potts');

    const after = await getBalanceSnapshot();

    // Should have transferred 100 total
    expect(before.specieCount - after.specieCount).toBe(100);
  });

  it('IDEMP-003 — Redeem twice: both execute with correct fee each time', async () => {
    const before = await getBalanceSnapshot();

    await redeemExecute(100);
    const afterFirst = await getBalanceSnapshot();

    await redeemExecute(100);
    const afterSecond = await getBalanceSnapshot();

    // Each redeem: -100 Specie, +$99 USDC (after 1% fee)
    const net = 99 * 1_000_000; // $99 in base units
    expect(afterFirst.usdcPosted - before.usdcPosted).toBe(net);
    expect(afterSecond.usdcPosted - afterFirst.usdcPosted).toBe(net);
    expect(before.specieCount - afterSecond.specieCount).toBe(200);
  });
});
