import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  simulateDeposit,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute } from '@/lib/journey-engine';

describe('REC — Reconciliation Tests', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
  });

  it('REC-001 — After buy: USDC delta = -(qty * price), Specie delta = +qty', async () => {
    await simulateDeposit('user-001', 5000);
    const before = await getBalanceSnapshot();

    await buyExecute(100);

    const after = await getBalanceSnapshot();
    const usdcDelta = after.usdcPosted - before.usdcPosted;
    const specieDelta = after.specieCount - before.specieCount;

    // Base units: 100 * $1.00 = 100,000,000
    expect(usdcDelta).toBe(-(100 * 1_000_000));
    expect(specieDelta).toBe(100);
  });

  it('REC-005 — After fund: USDC increases, Specie unchanged', async () => {
    const before = await getBalanceSnapshot();

    await simulateDeposit('user-001', 1000);

    const after = await getBalanceSnapshot();
    expect(after.usdcPosted - before.usdcPosted).toBe(1000 * 1_000_000);
    expect(after.specieCount).toBe(before.specieCount);
  });
});
