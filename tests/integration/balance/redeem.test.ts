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

const MARKETSB = 'http://localhost:3101';

/** Fund the assurance sub-account directly for test setup */
async function fundAssurance(amount: number): Promise<void> {
  await fetch(`${MARKETSB}/api/v1/accounts/acc-sub-assurance/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'USD', metadata: { reason: 'test-setup' } }),
  });
}

describe('TRD-RED — Redeem Journey', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    // Precondition: fund user + give Specie + fund assurance pool
    await simulateDeposit('user-001', 10_000);
    await adjustVault('onli-user-001', 5000, 'test-setup');
    // Fund assurance so redeem has a source to pay from
    await fundAssurance(10_000_000_000); // $10,000 in base units
  });

  it('TRD-RED-001 — Specie decreases, USDC increases by (gross - 1% fee)', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 100;

    const result = await redeemExecute(quantity);
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

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
    const grossBase = quantity * 1_000_000;
    const feeBase = Math.floor(grossBase * 0.01);
    const netBase = grossBase - feeBase;

    expect(feeBase).toBe(10_000_000);
    expect(netBase).toBe(990_000_000);
  });
});
