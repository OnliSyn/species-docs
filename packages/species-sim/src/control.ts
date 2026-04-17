import { Router, type Request, type Response } from 'express';
import type { SpeciesSimState, SpeciesSimConfig, StageDelays } from './state.js';
import { seedState } from './seed.js';
import { approveAskToMove, clearAllAskToMove } from './sim-onli/ask-to-move.js';
import { resetOracleCounter } from './sim-onli/change-owner.js';
import { resetMatchCounter } from './sim-species/matching.js';

export function createControlRouter(
  getState: () => SpeciesSimState,
  setState: (s: SpeciesSimState) => void,
  config: SpeciesSimConfig,
): Router {
  const router = Router();

  // ── POST /sim/reset ──────────────────────────────────────────────────
  router.post('/sim/reset', (_req: Request, res: Response) => {
    const currentState = getState();

    // Clean up pending AskToMove timers
    clearAllAskToMove(currentState);

    // Reset counters
    resetOracleCounter();
    resetMatchCounter();

    // Re-seed state
    const fresh = seedState(config.pipelineDelays);
    setState(fresh);

    res.json({ message: 'State reset to seed defaults', timestamp: new Date().toISOString() });
  });

  // ── GET /sim/state ───────────────────────────────────────────────────
  router.get('/sim/state', (_req: Request, res: Response) => {
    const state = getState();
    const circulation = state.vaults.sellerLocker.count + 
      Array.from(state.vaults.users.values()).reduce((sum, v) => sum + v.count, 0);

    res.json({
      circulation,
      orders: Object.fromEntries(state.orders),
      listings: Object.fromEntries(state.listings),
      idempotencyKeys: Array.from(state.idempotencyKeys),
      vaults: {
        treasury: state.vaults.treasury,
        sellerLocker: state.vaults.sellerLocker,
        marketMaker: state.vaults.marketMaker,
        users: Object.fromEntries(state.vaults.users),
      },
      pendingAskToMove: Array.from(state.pendingAskToMove.keys()),
      assetOracleLog: state.assetOracleLog,
      errorInjections: Object.fromEntries(state.errorInjections),
      stageDelays: state.stageDelays,
    });
  });

  // ── GET /sim/onli/state ──────────────────────────────────────────────
  router.get('/sim/onli/state', (_req: Request, res: Response) => {
    const state = getState();
    res.json({
      vaults: {
        treasury: state.vaults.treasury,
        sellerLocker: state.vaults.sellerLocker,
        marketMaker: state.vaults.marketMaker,
        users: Object.fromEntries(state.vaults.users),
      },
      pendingAskToMove: Array.from(state.pendingAskToMove.entries()).map(([id, atm]) => ({
        requestId: atm.requestId,
        onliId: atm.onliId,
        quantity: atm.quantity,
        eventId: atm.eventId,
        expiresAt: new Date(atm.expiresAt).toISOString(),
      })),
      assetOracleLog: state.assetOracleLog,
    });
  });

  // ── POST /sim/approve/:eventId ───────────────────────────────────────
  router.post('/sim/approve/:eventId', (req: Request, res: Response) => {
    const state = getState();
    const result = approveAskToMove(state, String(req.params.eventId));

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({
      message: `AskToMove approved for ${String(req.params.eventId)}`,
      timestamp: new Date().toISOString(),
    });
  });

  // ── POST /sim/buy-from-market ─────────────────────────────────────────
  // Buy species from active listings (FIFO). Decrements listing quantities,
  // moves species from settlement to buyer vault. Returns what was matched.
  router.post('/sim/buy-from-market', (req: Request, res: Response) => {
    const state = getState();
    const { buyerOnliId, quantity } = req.body;

    if (!buyerOnliId || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'buyerOnliId and quantity required' });
      return;
    }

    // Match against listings FIFO
    const activeListings = Array.from(state.listings.values())
      .filter(l => l.status === 'active' && l.remainingQuantity > 0)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let remaining = quantity;
    const fills: { listingId: string; sellerOnliId: string; qty: number }[] = [];

    for (const listing of activeListings) {
      if (remaining <= 0) break;
      const fillQty = Math.min(remaining, listing.remainingQuantity);
      listing.remainingQuantity -= fillQty;
      if (listing.remainingQuantity === 0) listing.status = 'filled';
      fills.push({ listingId: listing.listingId, sellerOnliId: listing.sellerOnliId, qty: fillQty });
      remaining -= fillQty;
    }

    const matched = quantity - remaining;
    const now = new Date().toISOString();

    // Move species from sellerLocker to buyer vault
    if (matched > 0) {
      state.vaults.sellerLocker.count -= matched;
      const buyer = state.vaults.users.get(buyerOnliId);
      if (buyer) {
        buyer.count += matched;
        buyer.history.push({
          type: 'credit',
          count: matched,
          from: 'sellerLocker',
          to: buyerOnliId,
          eventId: `buy-market-${Date.now()}`,
          timestamp: now,
        });
      }

      state.assetOracleLog.push({
        id: `ao-buy-market-${Date.now()}`,
        eventId: `buy-market-${Date.now()}`,
        type: 'change_owner',
        from: 'sellerLocker',
        to: buyerOnliId,
        count: matched,
        timestamp: now,
      });
    }

    res.json({
      matched,
      fromTreasury: remaining,
      fills,
      buyerVaultCount: state.vaults.users.get(buyerOnliId)?.count ?? 0,
      sellerLockerCount: state.vaults.sellerLocker.count,
    });
  });

  // ── POST /sim/buy-from-treasury ─────────────────────────────────────
  // Issue new species from treasury to buyer vault.
  router.post('/sim/buy-from-treasury', (req: Request, res: Response) => {
    const state = getState();
    const { buyerOnliId, quantity } = req.body;

    if (!buyerOnliId || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'buyerOnliId and quantity required' });
      return;
    }

    if (state.vaults.treasury.count < quantity) {
      res.status(400).json({ error: 'Insufficient treasury stock', available: state.vaults.treasury.count });
      return;
    }

    const now = new Date().toISOString();

    state.vaults.treasury.count -= quantity;
    const buyer = state.vaults.users.get(buyerOnliId);
    if (buyer) {
      buyer.count += quantity;
      buyer.history.push({
        type: 'credit',
        count: quantity,
        from: 'treasury',
        to: buyerOnliId,
        eventId: `buy-treasury-${Date.now()}`,
        timestamp: now,
      });
    }

    state.assetOracleLog.push({
      id: `ao-buy-treasury-${Date.now()}`,
      eventId: `buy-treasury-${Date.now()}`,
      type: 'change_owner',
      from: 'treasury',
      to: buyerOnliId,
      count: quantity,
      timestamp: now,
    });

    res.json({
      issued: quantity,
      treasuryCount: state.vaults.treasury.count,
      buyerVaultCount: buyer?.count ?? 0,
    });
  });

  // ── POST /sim/create-listing ──────────────────────────────────────────
  // Create a marketplace listing (species moved to sellerLocker/escrow)
  router.post('/sim/create-listing', (req: Request, res: Response) => {
    const state = getState();
    const { sellerOnliId, quantity, unitPrice } = req.body;

    if (!sellerOnliId || !quantity) {
      res.status(400).json({ error: 'sellerOnliId and quantity required' });
      return;
    }

    const vault = state.vaults.users.get(sellerOnliId);
    if (!vault || vault.count < quantity) {
      res.status(400).json({
        error: 'Insufficient species in vault',
        available: vault?.count ?? 0,
        requested: quantity,
      });
      return;
    }

    const listingId = `listing-${sellerOnliId}-${Date.now()}`;
    const now = new Date().toISOString();

    // Move species from user vault to sellerLocker (escrow)
    vault.count -= quantity;
    vault.history.push({
      type: 'debit',
      count: quantity,
      from: sellerOnliId,
      to: 'sellerLocker',
      eventId: listingId,
      timestamp: now,
    });

    state.vaults.sellerLocker.count += quantity;

    // Create the listing
    state.listings.set(listingId, {
      listingId,
      sellerOnliId,
      quantity,
      remainingQuantity: quantity,
      unitPrice: unitPrice ?? 1_000_000,
      status: 'active',
      createdAt: now,
    });

    // Asset oracle
    state.assetOracleLog.push({
      id: `ao-${listingId}`,
      eventId: listingId,
      type: 'listing_escrow',
      from: sellerOnliId,
      to: 'sellerLocker',
      count: quantity,
      timestamp: now,
    });

    res.json({
      listingId,
      sellerOnliId,
      quantity,
      unitPrice: unitPrice ?? 1_000_000,
      status: 'active',
      escrowedFrom: sellerOnliId,
      sellerVaultRemaining: vault.count,
    });
  });

  // ── POST /sim/vault-adjust ────────────────────────────────────────────
  // Directly adjust a vault count (for mock chat buy/sell/transfer journeys)
  router.post('/sim/vault-adjust', (req: Request, res: Response) => {
    const state = getState();
    const { vaultId, delta, reason } = req.body;

    if (!vaultId || delta === undefined) {
      res.status(400).json({ error: 'vaultId and delta required' });
      return;
    }

    if (vaultId === 'treasury') {
      state.vaults.treasury.count += delta;
      res.json({ vaultId, newCount: state.vaults.treasury.count });
      return;
    }

    const user = state.vaults.users.get(vaultId);
    if (!user) {
      // Auto-create vault if it doesn't exist
      state.vaults.users.set(vaultId, { count: Math.max(0, delta), history: [] });
      const created = state.vaults.users.get(vaultId)!;
      created.history.push({
        type: delta > 0 ? 'credit' : 'debit',
        count: Math.abs(delta),
        from: delta > 0 ? 'treasury' : vaultId,
        to: delta > 0 ? vaultId : 'treasury',
        eventId: `sim-adjust-${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
      res.json({ vaultId, newCount: created.count, created: true });
      return;
    }

    // Prevent negative balance
    if (delta < 0 && user.count + delta < 0) {
      res.status(400).json({ error: 'Insufficient species', available: user.count, requested: Math.abs(delta) });
      return;
    }

    user.count += delta;
    user.history.push({
      type: delta > 0 ? 'credit' : 'debit',
      count: Math.abs(delta),
      from: delta > 0 ? 'treasury' : vaultId,
      to: delta > 0 ? vaultId : 'treasury',
      eventId: `sim-adjust-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ vaultId, newCount: user.count, reason: reason || 'sim-adjust' });
  });

  // ── POST /sim/inject-error/:stage ────────────────────────────────────
  router.post('/sim/inject-error/:stage', (req: Request, res: Response) => {
    const state = getState();
    const stage = String(req.params.stage);

    // Normalize: allow both dot and dash notation
    const normalizedStage = stage.replace(/-/g, '.');
    state.errorInjections.set(normalizedStage, true);

    res.json({
      message: `Error injection set for stage: ${normalizedStage}`,
      active: Object.fromEntries(state.errorInjections),
    });
  });

  // ── POST /sim/set-delay/:stage/:ms ───────────────────────────────────
  router.post('/sim/set-delay/:stage/:ms', (req: Request, res: Response) => {
    const state = getState();
    const stage = String(req.params.stage);
    const ms = parseInt(String(req.params.ms), 10);

    if (isNaN(ms) || ms < 0) {
      res.status(400).json({ error: 'Invalid delay value' });
      return;
    }

    if (!(stage in state.stageDelays)) {
      res.status(400).json({
        error: `Unknown stage: ${stage}`,
        validStages: Object.keys(state.stageDelays),
      });
      return;
    }

    state.stageDelays[stage as keyof StageDelays] = ms;

    res.json({
      message: `Delay for ${stage} set to ${ms}ms`,
      stageDelays: state.stageDelays,
    });
  });

  // ── POST /sim/set-config ─────────────────────────────────────────────
  router.post('/sim/set-config', (req: Request, res: Response) => {
    const body = req.body;

    if (body.askToMoveTimeoutSeconds !== undefined) {
      config.askToMoveTimeoutSeconds = body.askToMoveTimeoutSeconds;
    }

    if (body.marketsbUrl !== undefined) {
      config.marketsbUrl = body.marketsbUrl;
    }

    if (body.pipelineDelays) {
      const state = getState();
      for (const [key, value] of Object.entries(body.pipelineDelays)) {
        if (key in state.stageDelays && typeof value === 'number') {
          state.stageDelays[key as keyof StageDelays] = value;
        }
      }
    }

    res.json({
      message: 'Config updated',
      config: {
        port: config.port,
        marketsbUrl: config.marketsbUrl,
        askToMoveTimeoutSeconds: config.askToMoveTimeoutSeconds,
        pipelineDelays: getState().stageDelays,
      },
    });
  });

  return router;
}
