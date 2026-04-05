import type { SpeciesSimState, StageDelays } from './state.js';
import { createEmptyState } from './state.js';

export function seedState(delays: StageDelays): SpeciesSimState {
  const state = createEmptyState(delays);

  // ── Treasury & Settlement ──────────────────────────────────────────────
  state.vaults.treasury.count = 1_000_000_000;
  state.vaults.settlement.count = 0;

  // ── User Vaults ────────────────────────────────────────────────────────
  state.vaults.users.set('onli-user-001', {
    count: 8_500,
    history: [
      {
        type: 'credit',
        count: 8_500,
        from: 'treasury',
        to: 'onli-user-001',
        eventId: 'seed-buy-001',
        timestamp: '2026-03-15T10:00:00Z',
      },
    ],
  });

  state.vaults.users.set('onli-user-002', {
    count: 5_000,
    history: [
      {
        type: 'credit',
        count: 5_000,
        from: 'treasury',
        to: 'onli-user-002',
        eventId: 'seed-buy-002',
        timestamp: '2026-03-20T14:30:00Z',
      },
    ],
  });

  // ── Historical Orders ──────────────────────────────────────────────────
  state.orders.set('seed-buy-001', {
    eventId: 'seed-buy-001',
    intent: 'buy',
    quantity: 8_500,
    status: 'completed',
    currentStage: 'order.completed',
    completedStages: [
      { stage: 'request.submitted', timestamp: '2026-03-15T09:59:50Z' },
      { stage: 'request.authenticated', timestamp: '2026-03-15T09:59:50.1Z' },
      { stage: 'order.validated', timestamp: '2026-03-15T09:59:50.4Z' },
      { stage: 'order.classified', timestamp: '2026-03-15T09:59:50.5Z' },
      { stage: 'order.matched', timestamp: '2026-03-15T09:59:50.7Z' },
      { stage: 'asset.staged', timestamp: '2026-03-15T09:59:51.4Z' },
      { stage: 'payment.confirmed', timestamp: '2026-03-15T09:59:52.2Z' },
      { stage: 'ownership.changed', timestamp: '2026-03-15T09:59:53.0Z' },
      { stage: 'order.completed', timestamp: '2026-03-15T10:00:00Z' },
    ],
    paymentSource: { vaId: 'va-funding-user-001' },
    idempotencyKey: 'seed-buy-001',
    matches: [{ matchId: 'seed-match-001', counterparty: 'treasury', quantity: 8_500 }],
    tbBatchId: 'seed-tb-batch-001',
    oracleRefs: { fundingOracle: 'seed-fo-001', assetOracle: 'seed-ao-001' },
    totalCost: 8_500_000_000,
    fees: { issuance: 85_000_000, liquidity: 170_000_000, listing: 0 },
    createdAt: '2026-03-15T09:59:50Z',
  });

  state.orders.set('seed-buy-002', {
    eventId: 'seed-buy-002',
    intent: 'buy',
    quantity: 5_000,
    status: 'completed',
    currentStage: 'order.completed',
    completedStages: [
      { stage: 'request.submitted', timestamp: '2026-03-20T14:29:50Z' },
      { stage: 'request.authenticated', timestamp: '2026-03-20T14:29:50.1Z' },
      { stage: 'order.validated', timestamp: '2026-03-20T14:29:50.4Z' },
      { stage: 'order.classified', timestamp: '2026-03-20T14:29:50.5Z' },
      { stage: 'order.matched', timestamp: '2026-03-20T14:29:50.7Z' },
      { stage: 'asset.staged', timestamp: '2026-03-20T14:29:51.4Z' },
      { stage: 'payment.confirmed', timestamp: '2026-03-20T14:29:52.2Z' },
      { stage: 'ownership.changed', timestamp: '2026-03-20T14:29:53.0Z' },
      { stage: 'order.completed', timestamp: '2026-03-20T14:30:00Z' },
    ],
    paymentSource: { vaId: 'va-funding-user-002' },
    idempotencyKey: 'seed-buy-002',
    matches: [{ matchId: 'seed-match-002', counterparty: 'treasury', quantity: 5_000 }],
    tbBatchId: 'seed-tb-batch-002',
    oracleRefs: { fundingOracle: 'seed-fo-002', assetOracle: 'seed-ao-002' },
    totalCost: 5_000_000_000,
    fees: { issuance: 50_000_000, liquidity: 100_000_000, listing: 0 },
    createdAt: '2026-03-20T14:29:50Z',
  });

  state.idempotencyKeys.add('seed-buy-001');
  state.idempotencyKeys.add('seed-buy-002');

  // ── Listings ───────────────────────────────────────────────────────────
  state.listings.set('listing-001', {
    listingId: 'listing-001',
    sellerOnliId: 'onli-user-001',
    quantity: 2_000,
    remainingQuantity: 2_000,
    unitPrice: 1_000_000, // 1 USDC per Specie in base units
    status: 'active',
    createdAt: '2026-03-25T09:00:00Z',
  });

  state.listings.set('listing-002', {
    listingId: 'listing-002',
    sellerOnliId: 'onli-user-002',
    quantity: 1_000,
    remainingQuantity: 500,
    unitPrice: 1_000_000,
    status: 'active',
    createdAt: '2026-03-28T11:00:00Z',
  });

  // ── Asset Oracle Log ───────────────────────────────────────────────────
  state.assetOracleLog.push(
    {
      id: 'seed-ao-001',
      eventId: 'seed-buy-001',
      type: 'change_owner',
      from: 'treasury',
      to: 'onli-user-001',
      count: 8_500,
      timestamp: '2026-03-15T10:00:00Z',
    },
    {
      id: 'seed-ao-002',
      eventId: 'seed-buy-002',
      type: 'change_owner',
      from: 'treasury',
      to: 'onli-user-002',
      count: 5_000,
      timestamp: '2026-03-20T14:30:00Z',
    },
  );

  return state;
}
