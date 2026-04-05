import { Router, type Request, type Response } from 'express';
import type { SpeciesSimState, SpeciesSimConfig, OrderState } from '../state.js';
import { startPipeline, type WsEmitter } from './pipeline.js';
import { getVaultBalance, getVaultHistory } from '../sim-onli/vaults.js';

export function createMarketplaceRouter(
  getState: () => SpeciesSimState,
  config: SpeciesSimConfig,
  emit: WsEmitter,
): Router {
  const router = Router();

  // ── POST /eventRequest ───────────────────────────────────────────────
  router.post('/eventRequest', (req: Request, res: Response) => {
    const state = getState();
    const {
      eventId,
      intent,
      quantity,
      paymentSource,
      recipient,
      listingConfig,
      idempotencyKey,
    } = req.body;

    // Validate required fields
    if (!eventId || !intent || !quantity || !idempotencyKey) {
      res.status(400).json({
        error: 'Missing required fields: eventId, intent, quantity, idempotencyKey',
      });
      return;
    }

    if (!['buy', 'sell', 'transfer'].includes(intent)) {
      res.status(400).json({ error: 'Invalid intent. Must be buy, sell, or transfer' });
      return;
    }

    if (intent === 'transfer' && !recipient?.onliId) {
      res.status(400).json({ error: 'Transfer requires recipient.onliId' });
      return;
    }

    // Idempotency check
    if (state.idempotencyKeys.has(idempotencyKey)) {
      const existing = Array.from(state.orders.values()).find(
        (o) => o.idempotencyKey === idempotencyKey,
      );
      if (existing) {
        res.status(200).json({
          eventId: existing.eventId,
          status: existing.status,
          pipelineStage: existing.currentStage,
          wsChannel: `/events/${existing.eventId}/stream`,
          createdAt: existing.createdAt,
          idempotent: true,
        });
        return;
      }
    }

    state.idempotencyKeys.add(idempotencyKey);

    const now = new Date().toISOString();
    const order: OrderState = {
      eventId,
      intent,
      quantity,
      status: 'accepted',
      currentStage: 'request.submitted',
      completedStages: [{ stage: 'request.submitted', timestamp: now }],
      paymentSource,
      recipient,
      listingConfig,
      idempotencyKey,
      createdAt: now,
    };

    state.orders.set(eventId, order);

    // Emit the initial submitted event
    emit(eventId, {
      source: 'species',
      eventId,
      stage: 'request.submitted',
      timestamp: now,
      data: { intent, quantity },
    });

    // Start pipeline in background (fire-and-forget)
    startPipeline(state, config, order, emit);

    // Return 202 immediately
    res.status(202).json({
      eventId,
      status: 'accepted',
      pipelineStage: 'request.submitted',
      wsChannel: `/events/${eventId}/stream`,
      createdAt: now,
    });
  });

  // ── GET /events/:eventId/receipt ─────────────────────────────────────
  router.get('/events/:eventId/receipt', (req: Request, res: Response) => {
    const state = getState();
    const order = state.orders.get(req.params.eventId);
    if (!order) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (order.status !== 'completed') {
      res.status(409).json({
        error: 'Receipt not available yet',
        currentStage: order.currentStage,
        status: order.status,
      });
      return;
    }

    const timestamps = Object.fromEntries(
      order.completedStages.map((s) => [toCamelCase(s.stage), s.timestamp]),
    );

    res.json({
      eventId: order.eventId,
      status: order.status,
      intent: order.intent,
      quantity: order.quantity,
      totalCost: order.totalCost ?? 0,
      fees: order.fees ?? { issuance: 0, liquidity: 0, listing: 0 },
      matches: order.matches ?? [],
      tbBatchId: order.tbBatchId,
      oracleRefs: order.oracleRefs ?? {},
      timestamps,
    });
  });

  // ── GET /events/:eventId/status ──────────────────────────────────────
  router.get('/events/:eventId/status', (req: Request, res: Response) => {
    const state = getState();
    const order = state.orders.get(req.params.eventId);
    if (!order) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({
      eventId: order.eventId,
      status: order.status,
      currentStage: order.currentStage,
      intent: order.intent,
      quantity: order.quantity,
      completedStages: order.completedStages,
      error: order.error,
      createdAt: order.createdAt,
    });
  });

  // ── GET /stats ───────────────────────────────────────────────────────
  router.get('/stats', (_req: Request, res: Response) => {
    const state = getState();
    const orders = Array.from(state.orders.values());
    const listings = Array.from(state.listings.values());

    const completedOrders = orders.filter((o) => o.status === 'completed');
    const totalVolume = completedOrders.reduce((sum, o) => sum + o.quantity, 0);
    const activeListings = listings.filter((l) => l.status === 'active');

    res.json({
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      failedOrders: orders.filter((o) => o.status === 'failed').length,
      processingOrders: orders.filter((o) => o.status === 'processing').length,
      totalVolumeSpecie: totalVolume,
      activeListings: activeListings.length,
      treasuryCount: state.vaults.treasury.count,
      settlementCount: state.vaults.settlement.count,
      userVaults: state.vaults.users.size,
    });
  });

  // ── GET /listings ────────────────────────────────────────────────────
  router.get('/listings', (_req: Request, res: Response) => {
    const state = getState();
    const listings = Array.from(state.listings.values());
    res.json(listings);
  });

  // ── GET /listings/:listingId ─────────────────────────────────────────
  router.get('/listings/:listingId', (req: Request, res: Response) => {
    const state = getState();
    const listing = state.listings.get(req.params.listingId);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    res.json(listing);
  });

  // ── GET /vault/:uid ──────────────────────────────────────────────────
  router.get('/vault/:uid', (req: Request, res: Response) => {
    const state = getState();
    const balance = getVaultBalance(state, req.params.uid);
    if (!balance) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }
    res.json(balance);
  });

  // ── GET /vault/:uid/history ──────────────────────────────────────────
  router.get('/vault/:uid/history', (req: Request, res: Response) => {
    const state = getState();
    const history = getVaultHistory(state, req.params.uid);
    if (!history) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }
    res.json(history);
  });

  return router;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toCamelCase(stage: string): string {
  return stage.replace(/[._]([a-z])/g, (_, c: string) => c.toUpperCase());
}
