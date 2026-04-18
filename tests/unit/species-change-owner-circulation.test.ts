import { describe, it, expect } from 'vitest';
import type { SpeciesSimState, StageDelays } from '../../packages/species-sim/src/state.js';
import { createEmptyState } from '../../packages/species-sim/src/state.js';
import { changeOwner } from '../../packages/species-sim/src/sim-onli/change-owner.js';
import { moveUserVaultToSellerLocker } from '../../packages/species-sim/src/sim-onli/seller-locker-escrow.js';
import { stageSenderVaultToSenderLocker } from '../../packages/species-sim/src/sim-onli/transfer-staging.js';
import { userLockerVaultId } from '../../packages/species-sim/src/sim-onli/vault-ids.js';
import { ensureUserVault, speciesInCirculationCount } from '../../packages/species-sim/src/sim-onli/vaults.js';

const zeroDelays: StageDelays = {
  authenticated: 0,
  validated: 0,
  classified: 0,
  matched: 0,
  assetStaged: 0,
  paymentConfirmed: 0,
  ownershipChanged: 0,
  completed: 0,
};

function circulation(state: SpeciesSimState): number {
  return speciesInCirculationCount(state);
}

describe('@species/sim canon asset moves + circulation', () => {
  it('SELL_MARKET_LISTING: AskToMove vault → sellerLocker preserves aggregate circulation', () => {
    const state = createEmptyState(zeroDelays);
    state.vaults.treasury.count = 1_000_000;
    const seller = 'onli-user-001';
    ensureUserVault(state, seller);
    state.vaults.users.get(seller)!.count = 500;

    const before = circulation(state);
    const r = moveUserVaultToSellerLocker(state, seller, 200, 'evt-list-test');
    expect(r.success).toBe(true);
    expect(circulation(state)).toBe(before);
    expect(state.vaults.users.get(seller)!.count).toBe(300);
    expect(state.vaults.sellerLocker.count).toBe(200);
    expect(state.assetOracleLog.some((e) => e.type === 'ask_to_move')).toBe(true);
  });

  it('changeOwner credits marketMaker (redeem / MM escrow path)', () => {
    const state = createEmptyState(zeroDelays);
    const seller = 'onli-user-001';
    ensureUserVault(state, seller);
    state.vaults.users.get(seller)!.count = 100;

    const r = changeOwner(state, seller, 'marketMaker', 40, 'evt-mm-test');
    expect(r.success).toBe(true);
    expect(state.vaults.users.get(seller)!.count).toBe(60);
    expect(state.vaults.marketMaker.count).toBe(40);
  });

  it('TRANSFER_EXECUTION: AskToMove to sender locker then ChangeOwner to receiver preserves circulation', () => {
    const state = createEmptyState(zeroDelays);
    const sender = 'onli-user-001';
    const receiver = 'onli-user-456';
    ensureUserVault(state, sender);
    ensureUserVault(state, receiver);
    state.vaults.users.get(sender)!.count = 50;

    const before = circulation(state);
    const s = stageSenderVaultToSenderLocker(state, sender, 20, 'evt-txfr');
    expect(s.success).toBe(true);
    expect(circulation(state)).toBe(before);

    const co = changeOwner(state, userLockerVaultId(sender), receiver, 20, 'evt-txfr');
    expect(co.success).toBe(true);
    expect(circulation(state)).toBe(before);
    expect(state.vaults.users.get(sender)!.count).toBe(30);
    expect(state.vaults.users.get(sender)!.lockerCount).toBe(0);
    expect(state.vaults.users.get(receiver)!.count).toBe(20);
  });
});
