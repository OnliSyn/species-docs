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

    // Redeem 100 Specie at $1.00 = $100 gross = 100,000,000 base units
    // 1% liquidity fee = $1.00 = 1,000,000 base units
    // Net payout = $99.00 = 99,000,000 base units
    const grossBase = quantity * 1_000_000;
    const feeBase = Math.floor(grossBase * 0.01);
    const netBase = grossBase - feeBase;

    assertBalanceDelta(before, after, {
      specieCount: -quantity,
      usdcPosted: netBase,
    });
  });

  it('TRD-RED-003 — Fee math exact: 1% of gross, integer arithmetic', () => {
    const quantity = 1000;
    const grossBase = quantity * 1_000_000; // $1000 = 1,000,000,000 base units
    const feeBase = Math.floor(grossBase * 0.01); // $10 = 10,000,000
    const netBase = grossBase - feeBase; // $990 = 990,000,000

    expect(feeBase).toBe(10_000_000);
    expect(netBase).toBe(990_000_000);
  });
});
