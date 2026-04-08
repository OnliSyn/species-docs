import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  expectNoMutation,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute, redeemExecute, transferExecute } from '@/lib/journey-engine';

describe('INSUFFICIENT FUNDS — Rejection tests', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    // Alex starts with $0 USDC and 0 Specie after reset
  });

  it('TRD-BUY-002 — Buy with $0 balance: cashier rejects payment', async () => {
    const before = await getBalanceSnapshot();

    await buyExecute(100);

    const after = await getBalanceSnapshot();
    // Cashier rejected — USDC should not decrease
    expect(after.usdcPosted).toBe(before.usdcPosted);
  });

  it('TRD-RED-002 — Redeem with 0 Specie: no USDC credit', async () => {
    const before = await getBalanceSnapshot();
    expect(before.specieCount).toBe(0);

    await redeemExecute(100);

    const after = await getBalanceSnapshot();
    expect(after.usdcPosted).toBeLessThanOrEqual(before.usdcPosted);
  });

  it('TRD-XFER-003 — Transfer with 0 Specie: rejected by vault validation', async () => {
    const before = await getBalanceSnapshot();
    expect(before.specieCount).toBe(0);

    await transferExecute(50, 'Pepper Potts');

    const after = await getBalanceSnapshot();
    // Vault now validates — 0 Specie cannot transfer 50
    expectNoMutation(before, after);
  });
});
