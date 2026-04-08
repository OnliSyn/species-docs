/**
 * PIPELINE FLOW TESTS
 * Verify journey-engine routes through species-sim eventRequest pipeline.
 * Buy/Sell/Transfer/Redeem should go through the 10-stage pipeline, NOT call cashier directly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  getBalanceSnapshot,
  simulateDeposit,
  adjustVault,
  waitForHealth,
} from '../../helpers/sim-control';
import { buyExecute, sellExecute, transferExecute } from '@/lib/journey-engine';

const SPECIES = 'http://localhost:4012';

describe('PIPELINE — Journey flows through eventRequest', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
    await simulateDeposit('user-001', 10_000);
  });

  it('PIPE-001 — Buy creates an order in species-sim', async () => {
    const result = await buyExecute(100);

    // Should return a tool response (pipeline card or error)
    expect(result.type).toBe('tool');

    // Check species-sim has an order record
    const stateRes = await fetch(`${SPECIES}/sim/state`);
    const state = await stateRes.json();
    const orders = state.orders || {};
    const orderCount = Object.keys(orders).length;
    expect(orderCount).toBeGreaterThan(0);
  });

  it('PIPE-002 — Buy through pipeline: funding decreases, vault increases', async () => {
    const before = await getBalanceSnapshot();

    await buyExecute(100);

    const after = await getBalanceSnapshot();
    // Funding should decrease (payment went through cashier via pipeline)
    expect(after.usdcPosted).toBeLessThan(before.usdcPosted);
    // Vault should increase (asset delivered via ChangeOwner)
    expect(after.specieCount).toBeGreaterThan(before.specieCount);
  });

  it('PIPE-003 — Sell through pipeline: vault decreases (escrowed)', async () => {
    // First buy some specie
    await buyExecute(500);
    const before = await getBalanceSnapshot();

    await sellExecute(100);

    const after = await getBalanceSnapshot();
    // Specie should decrease (moved to settlement/escrow)
    expect(after.specieCount).toBeLessThan(before.specieCount);
  });

  it('PIPE-004 — Transfer through pipeline: sender vault decreases', async () => {
    // Buy specie first
    await buyExecute(200);
    const before = await getBalanceSnapshot();

    await transferExecute(50, 'Pepper Potts');

    const after = await getBalanceSnapshot();
    // Sender vault should decrease by 50
    expect(before.specieCount - after.specieCount).toBe(50);
    // No USDC change
    expect(after.usdcPosted).toBe(before.usdcPosted);
  });

  it('PIPE-005 — No species VAs created in MarketSB after buy', async () => {
    await buyExecute(100);

    const res = await fetch('http://localhost:4001/sim/state');
    const state = await res.json();
    const vas = Object.keys(state.virtualAccounts || {});
    const speciesVAs = vas.filter((v: string) => v.includes('species'));
    expect(speciesVAs).toHaveLength(0);
  });
});
