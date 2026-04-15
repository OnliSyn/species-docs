import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute, redeemExecute, transferExecute } from '@/lib/journey-engine';

const MARKETSB = 'http://localhost:3101';
async function fundAssurance(amount: number): Promise<void> {
  await fetch(`${MARKETSB}/api/v1/accounts/acc-sub-assurance/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'USD', metadata: { reason: 'test-setup' } }),
  });
}

describe('IDEMP — Idempotency Tests', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 50_000);
  });

  it('IDEMP-001 — Two sequential buys produce TWO distinct balance changes', async () => {
    const before = await getBalanceSnapshot();

    await buyExecute(100);
    const afterFirst = await getBalanceSnapshot();

    await buyExecute(100);
    const afterSecond = await getBalanceSnapshot();

    // Clean seed: treasury buy — $1.06/Specie (includes $0.05 issuance + $0.01 liquidity fee)
    const costPerBuy = 100 * 1_050_000; // $105 per 100 Specie (no liquidity on buy)

    const firstDelta = afterFirst.usdcPosted - before.usdcPosted;
    const secondDelta = afterSecond.usdcPosted - afterFirst.usdcPosted;

    expect(firstDelta).toBe(-costPerBuy);
    expect(secondDelta).toBe(-costPerBuy);
    expect(afterSecond.usdcPosted - before.usdcPosted).toBe(-(2 * costPerBuy));
    expect(afterSecond.specieCount - before.specieCount).toBe(200);
  });

  it('IDEMP-002 — Transfer same amount twice: both execute', async () => {
    // Buy specie first so we have something to transfer
    await buyExecute(200);
    const before = await getBalanceSnapshot();

    await transferExecute(50, 'Pepper Potts');
    await transferExecute(50, 'Pepper Potts');

    const after = await getBalanceSnapshot();
    expect(before.specieCount - after.specieCount).toBe(100);
  });

  it('IDEMP-003 — Redeem twice: both execute with correct fee each time', async () => {
    // Give user Specie and fund assurance pool directly
    await adjustVault('onli-user-001', 500, 'test-setup');
    await fundAssurance(10_000_000_000); // $10,000
    const before = await getBalanceSnapshot();

    await redeemExecute(100);
    const afterFirst = await getBalanceSnapshot();

    await redeemExecute(100);
    const afterSecond = await getBalanceSnapshot();

    // Each redeem: -100 Specie, +$99 USDC (after 1% fee)
    const net = 99 * 1_000_000;
    expect(afterFirst.usdcPosted - before.usdcPosted).toBe(net);
    expect(afterSecond.usdcPosted - afterFirst.usdcPosted).toBe(net);
    expect(before.specieCount - afterSecond.specieCount).toBe(200);
  });
});
