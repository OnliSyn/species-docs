import type { SpeciesSimState, OrderState, SpeciesSimConfig } from '../state.js';
import { changeOwner } from '../sim-onli/change-owner.js';
import { createAskToMove } from '../sim-onli/ask-to-move.js';
import { getVaultCount, ensureUserVault } from '../sim-onli/vaults.js';
import { matchOrder } from './matching.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WsEvent {
  source: 'species';
  eventId: string;
  stage: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type WsEmitter = (eventId: string, event: WsEvent) => void;

// ── Helpers ────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now(): string {
  return new Date().toISOString();
}

function emitStage(
  emit: WsEmitter,
  order: OrderState,
  stage: string,
  data: Record<string, unknown> = {},
): void {
  const timestamp = now();
  order.currentStage = stage;
  order.completedStages.push({ stage, timestamp, data });

  emit(order.eventId, {
    source: 'species',
    eventId: order.eventId,
    stage,
    timestamp,
    data,
  });
}

function failOrder(
  emit: WsEmitter,
  order: OrderState,
  stage: string,
  error: string,
): void {
  order.status = 'failed';
  order.error = error;
  emitStage(emit, order, 'order.failed', { failedAtStage: stage, error });
}

// ── Unit price constant ────────────────────────────────────────────────────

const UNIT_PRICE = 1_000_000; // 1 USDC in base units per Specie

// ── Pipeline Runner ────────────────────────────────────────────────────────

export async function runBuyPipeline(
  state: SpeciesSimState,
  config: SpeciesSimConfig,
  order: OrderState,
  emit: WsEmitter,
): Promise<void> {
  order.status = 'processing';

  // Stage 1: request.submitted (already emitted on creation)

  // Stage 2: request.authenticated
  await delay(state.stageDelays.authenticated);
  if (state.errorInjections.get('request.authenticated')) {
    state.errorInjections.delete('request.authenticated');
    failOrder(emit, order, 'request.authenticated', 'authentication_failed');
    return;
  }
  emitStage(emit, order, 'request.authenticated', { authResult: 'passed' });

  // Stage 3: order.validated
  await delay(state.stageDelays.validated);
  if (state.errorInjections.get('order.validated')) {
    state.errorInjections.delete('order.validated');
    failOrder(emit, order, 'order.validated', 'validation_failed');
    return;
  }
  // Validate: treasury has stock
  if (state.vaults.treasury.count < order.quantity) {
    failOrder(emit, order, 'order.validated', 'insufficient_treasury_stock');
    return;
  }
  emitStage(emit, order, 'order.validated', { validationResult: 'passed' });

  // Stage 4: order.classified
  await delay(state.stageDelays.classified);
  if (state.errorInjections.get('order.classified')) {
    state.errorInjections.delete('order.classified');
    failOrder(emit, order, 'order.classified', 'classification_failed');
    return;
  }
  emitStage(emit, order, 'order.classified', { intent: 'buy' });

  // Stage 5: order.matched
  await delay(state.stageDelays.matched);
  if (state.errorInjections.get('order.matched')) {
    state.errorInjections.delete('order.matched');
    failOrder(emit, order, 'order.matched', 'matching_failed');
    return;
  }
  const matchResult = matchOrder(state, 'buy', order.quantity);
  order.matches = matchResult.fills;
  emitStage(emit, order, 'order.matched', {
    fills: matchResult.fills,
    totalMatched: matchResult.totalMatched,
  });

  // Stage 6: asset.staged — ChangeOwner: source → Settlement
  await delay(state.stageDelays.assetStaged);
  if (state.errorInjections.get('asset.staged')) {
    state.errorInjections.delete('asset.staged');
    failOrder(emit, order, 'asset.staged', 'staging_failed');
    return;
  }

  // For each fill, move Specie from source to Settlement
  for (const fill of matchResult.fills) {
    const source = fill.counterparty === 'treasury' ? 'treasury' : fill.counterparty;
    const result = changeOwner(state, source, 'settlement', fill.quantity, order.eventId);
    if (!result.success) {
      failOrder(emit, order, 'asset.staged', result.error ?? 'staging_failed');
      return;
    }
  }
  emitStage(emit, order, 'asset.staged', { result: 'staged_in_settlement' });

  // Stage 7: payment.confirmed — Call MarketSB Cashier
  await delay(state.stageDelays.paymentConfirmed);
  if (state.errorInjections.get('payment.confirmed')) {
    state.errorInjections.delete('payment.confirmed');
    // Rollback: move from settlement back to sources
    for (const fill of matchResult.fills) {
      const source = fill.counterparty === 'treasury' ? 'treasury' : fill.counterparty;
      changeOwner(state, 'settlement', source, fill.quantity, order.eventId);
    }
    failOrder(emit, order, 'payment.confirmed', 'payment_failed');
    return;
  }

  try {
    const buyerVaId = order.paymentSource?.vaId ?? 'va-funding-user-001';
    const cashierPayload = {
      eventId: order.eventId,
      matchId: order.matches?.[0]?.matchId ?? 'match-unknown',
      intent: 'buy',
      quantity: order.quantity,
      buyerVaId,
      sellerVaId: 'va-treasury-100', // treasury VA in MarketSB
      unitPrice: UNIT_PRICE,
      fees: { issuance: true, liquidity: true, listing: false },
    };

    const response = await fetch(`${config.marketsbUrl}/cashier/post-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cashierPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[species-sim] Cashier call returned ${response.status}: ${errText}`);
      // Non-fatal: log but continue (sim may not have MarketSB running)
    }

    const batchResult = response.ok ? await response.json() : null;
    order.tbBatchId = batchResult?.batchId ?? `tb-batch-${order.eventId}`;

    // Compute fees for the receipt
    const orderAmount = BigInt(order.quantity) * BigInt(UNIT_PRICE);
    const issuanceFee = BigInt(order.quantity) * 10_000n;
    const liquidityFee = (orderAmount * 200n) / 10_000n;
    order.totalCost = Number(orderAmount + issuanceFee + liquidityFee);
    order.fees = {
      issuance: Number(issuanceFee),
      liquidity: Number(liquidityFee),
      listing: 0,
    };
    order.oracleRefs = {
      fundingOracle: batchResult?.oracleRef ?? `fo-${order.eventId}`,
      assetOracle: state.assetOracleLog[state.assetOracleLog.length - 1]?.id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn(`[species-sim] Cashier call failed: ${msg} (continuing pipeline)`);
    order.tbBatchId = `tb-batch-${order.eventId}`;

    const orderAmount = BigInt(order.quantity) * BigInt(UNIT_PRICE);
    const issuanceFee = BigInt(order.quantity) * 10_000n;
    const liquidityFee = (orderAmount * 200n) / 10_000n;
    order.totalCost = Number(orderAmount + issuanceFee + liquidityFee);
    order.fees = {
      issuance: Number(issuanceFee),
      liquidity: Number(liquidityFee),
      listing: 0,
    };
    order.oracleRefs = {
      fundingOracle: `fo-${order.eventId}`,
      assetOracle: state.assetOracleLog[state.assetOracleLog.length - 1]?.id,
    };
  }

  emitStage(emit, order, 'payment.confirmed', {
    tbBatchId: order.tbBatchId,
    totalCost: order.totalCost,
    fees: order.fees,
  });

  // Stage 8: ownership.changed — ChangeOwner: Settlement → Buyer Vault
  await delay(state.stageDelays.ownershipChanged);
  if (state.errorInjections.get('ownership.changed')) {
    state.errorInjections.delete('ownership.changed');
    failOrder(emit, order, 'ownership.changed', 'ownership_change_failed');
    return;
  }

  // Determine buyer onliId from paymentSource vaId
  const buyerOnliId = vaIdToOnliId(order.paymentSource?.vaId);
  ensureUserVault(state, buyerOnliId);

  const ownerResult = changeOwner(
    state,
    'settlement',
    buyerOnliId,
    order.quantity,
    order.eventId,
  );
  if (!ownerResult.success) {
    failOrder(emit, order, 'ownership.changed', ownerResult.error ?? 'ownership_failed');
    return;
  }
  emitStage(emit, order, 'ownership.changed', {
    newOwner: buyerOnliId,
    count: order.quantity,
  });

  // Stage 9: order.completed
  await delay(state.stageDelays.completed);
  order.status = 'completed';
  emitStage(emit, order, 'order.completed', {
    receipt: buildReceipt(order),
  });
}

// ── Transfer Pipeline ──────────────────────────────────────────────────────

export async function runTransferPipeline(
  state: SpeciesSimState,
  config: SpeciesSimConfig,
  order: OrderState,
  emit: WsEmitter,
): Promise<void> {
  order.status = 'processing';

  // Stage 2: request.authenticated
  await delay(state.stageDelays.authenticated);
  if (state.errorInjections.get('request.authenticated')) {
    state.errorInjections.delete('request.authenticated');
    failOrder(emit, order, 'request.authenticated', 'authentication_failed');
    return;
  }
  emitStage(emit, order, 'request.authenticated', { authResult: 'passed' });

  // Stage 3: order.validated
  await delay(state.stageDelays.validated);
  if (state.errorInjections.get('order.validated')) {
    state.errorInjections.delete('order.validated');
    failOrder(emit, order, 'order.validated', 'validation_failed');
    return;
  }

  const senderOnliId = vaIdToOnliId(order.paymentSource?.vaId);
  ensureUserVault(state, senderOnliId);
  const senderCount = getVaultCount(state, senderOnliId);
  if (senderCount < order.quantity) {
    failOrder(emit, order, 'order.validated', `insufficient_specie: has ${senderCount}, needs ${order.quantity}`);
    return;
  }
  emitStage(emit, order, 'order.validated', { validationResult: 'passed' });

  // Stage 4: order.classified
  await delay(state.stageDelays.classified);
  if (state.errorInjections.get('order.classified')) {
    state.errorInjections.delete('order.classified');
    failOrder(emit, order, 'order.classified', 'classification_failed');
    return;
  }
  emitStage(emit, order, 'order.classified', { intent: 'transfer' });

  // Stage 5: asset.staged — pre-stage: check and prepare
  await delay(state.stageDelays.assetStaged);
  if (state.errorInjections.get('asset.staged')) {
    state.errorInjections.delete('asset.staged');
    failOrder(emit, order, 'asset.staged', 'staging_failed');
    return;
  }
  emitStage(emit, order, 'asset.staged', { result: 'pending_ask_to_move' });

  // Stage 6: AskToMove pause — always required for transfers
  emitStage(emit, order, 'ask_to_move.pending', {
    onliId: senderOnliId,
    quantity: order.quantity,
    message: 'Awaiting approval to move assets',
  });

  const approved = await createAskToMove(
    state,
    order.eventId,
    senderOnliId,
    order.quantity,
    config.askToMoveTimeoutSeconds,
  );

  if (!approved) {
    order.status = 'cancelled';
    emitStage(emit, order, 'order.failed', {
      failedAtStage: 'ask_to_move',
      error: 'ask_to_move_timeout_or_rejected',
    });
    return;
  }

  emitStage(emit, order, 'ask_to_move.approved', { approved: true });

  // Stage 7: ownership.changed — ChangeOwner: Sender → Receiver
  await delay(state.stageDelays.ownershipChanged);
  if (state.errorInjections.get('ownership.changed')) {
    state.errorInjections.delete('ownership.changed');
    failOrder(emit, order, 'ownership.changed', 'ownership_change_failed');
    return;
  }

  const recipientOnliId = order.recipient?.onliId ?? 'unknown';
  ensureUserVault(state, recipientOnliId);

  const result = changeOwner(
    state,
    senderOnliId,
    recipientOnliId,
    order.quantity,
    order.eventId,
  );
  if (!result.success) {
    failOrder(emit, order, 'ownership.changed', result.error ?? 'transfer_failed');
    return;
  }

  order.oracleRefs = { assetOracle: result.oracleEntryId };
  emitStage(emit, order, 'ownership.changed', {
    from: senderOnliId,
    to: recipientOnliId,
    count: order.quantity,
  });

  // Stage 8: order.completed
  await delay(state.stageDelays.completed);
  order.status = 'completed';
  emitStage(emit, order, 'order.completed', {
    receipt: buildReceipt(order),
  });
}

// ── Sell Pipeline ──────────────────────────────────────────────────────────

export async function runSellPipeline(
  state: SpeciesSimState,
  config: SpeciesSimConfig,
  order: OrderState,
  emit: WsEmitter,
): Promise<void> {
  order.status = 'processing';

  // Stage 2: request.authenticated
  await delay(state.stageDelays.authenticated);
  if (state.errorInjections.get('request.authenticated')) {
    state.errorInjections.delete('request.authenticated');
    failOrder(emit, order, 'request.authenticated', 'authentication_failed');
    return;
  }
  emitStage(emit, order, 'request.authenticated', { authResult: 'passed' });

  // Stage 3: order.validated
  await delay(state.stageDelays.validated);
  if (state.errorInjections.get('order.validated')) {
    state.errorInjections.delete('order.validated');
    failOrder(emit, order, 'order.validated', 'validation_failed');
    return;
  }

  const sellerOnliId = vaIdToOnliId(order.paymentSource?.vaId);
  ensureUserVault(state, sellerOnliId);
  const sellerCount = getVaultCount(state, sellerOnliId);
  if (sellerCount < order.quantity) {
    failOrder(emit, order, 'order.validated', `insufficient_specie: has ${sellerCount}, needs ${order.quantity}`);
    return;
  }
  emitStage(emit, order, 'order.validated', { validationResult: 'passed' });

  // Stage 4: order.classified
  await delay(state.stageDelays.classified);
  if (state.errorInjections.get('order.classified')) {
    state.errorInjections.delete('order.classified');
    failOrder(emit, order, 'order.classified', 'classification_failed');
    return;
  }
  emitStage(emit, order, 'order.classified', { intent: 'sell' });

  // Stage 5: order.matched — create listing
  await delay(state.stageDelays.matched);
  if (state.errorInjections.get('order.matched')) {
    state.errorInjections.delete('order.matched');
    failOrder(emit, order, 'order.matched', 'matching_failed');
    return;
  }

  // Create a listing for the sell order
  const listingId = `listing-${order.eventId}`;
  state.listings.set(listingId, {
    listingId,
    sellerOnliId,
    quantity: order.quantity,
    remainingQuantity: order.quantity,
    unitPrice: UNIT_PRICE,
    status: 'active',
    createdAt: now(),
  });

  order.matches = [
    {
      matchId: `match-sell-${order.eventId}`,
      counterparty: 'market',
      listingId,
      quantity: order.quantity,
    },
  ];
  emitStage(emit, order, 'order.matched', {
    listingId,
    quantity: order.quantity,
  });

  // Stage 6: asset.staged — ChangeOwner: Seller → Settlement (with optional AskToMove)
  await delay(state.stageDelays.assetStaged);
  if (state.errorInjections.get('asset.staged')) {
    state.errorInjections.delete('asset.staged');
    failOrder(emit, order, 'asset.staged', 'staging_failed');
    return;
  }

  const autoAuthorize = order.listingConfig?.autoAuthorize ?? true;

  if (!autoAuthorize) {
    // AskToMove pause
    emitStage(emit, order, 'asset.staged', { result: 'pending_ask_to_move' });

    const approved = await createAskToMove(
      state,
      order.eventId,
      sellerOnliId,
      order.quantity,
      config.askToMoveTimeoutSeconds,
    );

    if (!approved) {
      order.status = 'cancelled';
      // Remove the listing
      state.listings.delete(listingId);
      emitStage(emit, order, 'order.failed', {
        failedAtStage: 'ask_to_move',
        error: 'ask_to_move_timeout_or_rejected',
      });
      return;
    }
    emitStage(emit, order, 'ask_to_move.approved', { approved: true });
  }

  // Move seller's Specie to settlement
  const stageResult = changeOwner(state, sellerOnliId, 'settlement', order.quantity, order.eventId);
  if (!stageResult.success) {
    state.listings.delete(listingId);
    failOrder(emit, order, 'asset.staged', stageResult.error ?? 'staging_failed');
    return;
  }
  if (autoAuthorize) {
    emitStage(emit, order, 'asset.staged', { result: 'staged_in_settlement' });
  }

  // Stage 7: payment.confirmed — Cashier call for sell
  await delay(state.stageDelays.paymentConfirmed);
  if (state.errorInjections.get('payment.confirmed')) {
    state.errorInjections.delete('payment.confirmed');
    // Rollback: settlement → seller
    changeOwner(state, 'settlement', sellerOnliId, order.quantity, order.eventId);
    state.listings.delete(listingId);
    failOrder(emit, order, 'payment.confirmed', 'payment_failed');
    return;
  }

  try {
    const cashierPayload = {
      eventId: order.eventId,
      matchId: order.matches[0].matchId,
      intent: 'sell',
      quantity: order.quantity,
      buyerVaId: 'va-treasury-100', // treasury buys in sell orders
      sellerVaId: order.paymentSource?.vaId ?? 'va-funding-user-001',
      unitPrice: UNIT_PRICE,
      fees: { issuance: false, liquidity: true, listing: false },
    };

    const response = await fetch(`${config.marketsbUrl}/cashier/post-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cashierPayload),
    });

    const batchResult = response.ok ? await response.json() : null;
    order.tbBatchId = batchResult?.batchId ?? `tb-batch-${order.eventId}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn(`[species-sim] Cashier call failed for sell: ${msg}`);
    order.tbBatchId = `tb-batch-${order.eventId}`;
  }

  const orderAmount = BigInt(order.quantity) * BigInt(UNIT_PRICE);
  const liquidityFee = (orderAmount * 200n) / 10_000n;
  order.totalCost = Number(orderAmount);
  order.fees = { issuance: 0, liquidity: Number(liquidityFee), listing: 0 };
  order.oracleRefs = {
    fundingOracle: `fo-${order.eventId}`,
    assetOracle: state.assetOracleLog[state.assetOracleLog.length - 1]?.id,
  };

  emitStage(emit, order, 'payment.confirmed', {
    tbBatchId: order.tbBatchId,
    totalCost: order.totalCost,
    fees: order.fees,
  });

  // Stage 8: ownership.changed — Settlement → Buyer (treasury for sell)
  await delay(state.stageDelays.ownershipChanged);
  if (state.errorInjections.get('ownership.changed')) {
    state.errorInjections.delete('ownership.changed');
    failOrder(emit, order, 'ownership.changed', 'ownership_change_failed');
    return;
  }

  const deliverResult = changeOwner(
    state,
    'settlement',
    'treasury', // sell: Specie goes back to treasury
    order.quantity,
    order.eventId,
  );
  if (!deliverResult.success) {
    failOrder(emit, order, 'ownership.changed', deliverResult.error ?? 'delivery_failed');
    return;
  }
  emitStage(emit, order, 'ownership.changed', {
    newOwner: 'treasury',
    count: order.quantity,
  });

  // Stage 9: order.completed
  await delay(state.stageDelays.completed);
  order.status = 'completed';
  emitStage(emit, order, 'order.completed', {
    receipt: buildReceipt(order),
  });
}

// ── Pipeline Dispatcher ────────────────────────────────────────────────────

export function startPipeline(
  state: SpeciesSimState,
  config: SpeciesSimConfig,
  order: OrderState,
  emit: WsEmitter,
): void {
  // Fire-and-forget async pipeline
  const runner =
    order.intent === 'buy'
      ? runBuyPipeline
      : order.intent === 'transfer'
        ? runTransferPipeline
        : runSellPipeline;

  runner(state, config, order, emit).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'unknown pipeline error';
    console.error(`[species-sim] Pipeline error for ${order.eventId}: ${msg}`);
    order.status = 'failed';
    order.error = msg;
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map a MarketSB VA ID to an Onli user ID.
 * Convention: va-funding-user-001 → onli-user-001
 */
function vaIdToOnliId(vaId?: string): string {
  if (!vaId) return 'onli-user-001';
  const match = vaId.match(/va-funding-user-(\d+)/);
  if (match) return `onli-user-${match[1]}`;
  // Fallback: use the vaId itself as identifier
  return vaId;
}

function buildReceipt(order: OrderState): Record<string, unknown> {
  return {
    eventId: order.eventId,
    status: order.status,
    intent: order.intent,
    quantity: order.quantity,
    totalCost: order.totalCost ?? 0,
    fees: order.fees ?? { issuance: 0, liquidity: 0, listing: 0 },
    matches: order.matches ?? [],
    tbBatchId: order.tbBatchId,
    oracleRefs: order.oracleRefs ?? {},
    timestamps: Object.fromEntries(
      order.completedStages.map((s) => {
        // Convert stage name to camelCase key
        const key = s.stage
          .replace(/^(request|order|asset|ownership|ask_to_move)\./, (_, prefix: string) =>
            prefix === 'request' || prefix === 'order' ? '' : prefix,
          )
          .replace(/\./g, '_')
          .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
          || s.stage;
        return [key, s.timestamp];
      }),
    ),
  };
}
