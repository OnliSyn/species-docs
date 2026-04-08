import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  assertBalanceDelta,
  simulateDeposit,
  waitForHealth,
} from '../../helpers/sim-control';

describe('TRD-FUND — Fund Journey (Deposit USDC)', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
  });

  it('TRD-FUND-001 — Deposit increases USDC posted by exact amount', async () => {
    const before = await getBalanceSnapshot();
    const depositAmount = 10_000; // $10,000 USDC

    const result = await simulateDeposit('user-001', depositAmount);
    expect(result.ok).toBe(true);

    const after = await getBalanceSnapshot();

    // USDC should increase by deposit amount in base units
    // 1 USDC = 1,000,000 base units
    assertBalanceDelta(before, after, {
      usdcPosted: depositAmount * 1_000_000,
      specieCount: 0, // No specie change on deposit
    });
  });

  it('TRD-FUND-002 — Specie balance unchanged after deposit', async () => {
    const before = await getBalanceSnapshot();
    await simulateDeposit('user-001', 5_000);
    const after = await getBalanceSnapshot();

    expect(after.specieCount).toBe(before.specieCount);
  });
});
