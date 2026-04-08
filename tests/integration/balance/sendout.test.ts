import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  assertBalanceDelta,
  simulateDeposit,
  waitForHealth,
} from '../../helpers/sim-control';
import { sendoutExecute } from '@/lib/journey-engine';

describe('TRD-SEND — SendOut/Withdraw Journey', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 10_000);
  });

  it('TRD-SEND-001 — USDC decreases by withdrawal amount, Specie unchanged', async () => {
    const before = await getBalanceSnapshot();
    const amountUSDC = 1000;

    const result = await sendoutExecute(amountUSDC);
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

    assertBalanceDelta(before, after, {
      usdcPosted: -(amountUSDC * 1_000_000),
      specieCount: 0,
    });
  });
});
