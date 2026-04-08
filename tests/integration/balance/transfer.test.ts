import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  assertBalanceDelta,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { transferExecute } from '@/lib/journey-engine';

describe('TRD-XFER — Transfer Journey', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await adjustVault('onli-user-001', 500, 'test-setup');
  });

  it('TRD-XFER-001 — Sender decreases, no USDC movement', async () => {
    const before = await getBalanceSnapshot();
    const quantity = 50;

    const result = await transferExecute(quantity, 'Pepper Potts');
    expect(result.type).toBe('tool');

    const after = await getBalanceSnapshot();

    assertBalanceDelta(before, after, {
      specieCount: -quantity,
      usdcPosted: 0, // no USDC movement on transfer
    });
  });
});
