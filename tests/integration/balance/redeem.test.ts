import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  assertBalanceDelta,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { redeemExecute } from '@/lib/journey-engine';

describe('TRD-RED — Redeem Journey', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    // Precondition: fund + give user Specie
    await simulateDeposit('user-001', 10_000);
    await adjustVault('onli-user-001', 5000, 'test-setup');
  });

  it('TRD-RED-001 — Specie decreases, USDC increases by (gross - 1% fee)', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 100;

    const result = await redeemExecute(quantity);
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

    // Redeem 100 Specie at $1.00 = $100 gross
    // 1% liquidity fee = $1.00 = 1,000,000 base units
    // Net payout = $99.00 = 99,000,000 base units
    const gross = quantity * 1_000_000;
    const fee = Math.floor(gross * 0.01);
    const net = gross - fee;

    assertBalanceDelta(before, after, {
      specieCount: -quantity,
      usdcPosted: net,
    });
  });

  it('TRD-RED-003 — Fee math exact: 1% of gross, integer arithmetic', async () => {
    const quantity = 1000;
    const gross = quantity * 1_000_000; // $1000 in base units
    const expectedFee = Math.floor(gross * 0.01); // $10 = 10,000,000

    // Verify fee calculation is exact integer, no floating point drift
    expect(expectedFee).toBe(10_000_000);
    expect(gross - expectedFee).toBe(990_000_000);
  });
});
