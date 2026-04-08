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
    // Precondition: fund account with $10,000
    await simulateDeposit('user-001', 10_000);
  });

  it('TRD-BUY-001 — USDC decreases and Specie increases by exact amount', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 100;

    const result = await buyExecute(quantity);
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

    // Clean seed: all buys from treasury (no marketplace listings)
    // Treasury buy: $1.00/Specie + $0.05 issuance fee = $1.05/Specie
    // 100 Specie × $1.05 = $105 = 105,000,000 base units
    const costPerSpecie = 1_000_000 + 50_000; // $1.00 + $0.05 issuance
    assertBalanceDelta(before, after, {
      usdcPosted: -(quantity * costPerSpecie),
      specieCount: quantity,
    });
  });

  it('TRD-BUY-004 — Treasury buy includes issuance fee of $0.05/Specie', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 1000;

    await buyExecute(quantity);

    const after = await getBalanceSnapshot();
    const usdcDelta = before.usdcPosted - after.usdcPosted;

    // 1000 × ($1.00 + $0.05) = $1,050 = 1,050,000,000 base units
    expect(usdcDelta).toBe(quantity * 1_050_000);
  });
});
