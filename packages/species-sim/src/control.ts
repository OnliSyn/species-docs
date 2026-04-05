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
    res.json({
      orders: Object.fromEntries(state.orders),
      listings: Object.fromEntries(state.listings),
      idempotencyKeys: Array.from(state.idempotencyKeys),
      vaults: {
        treasury: state.vaults.treasury,
        settlement: state.vaults.settlement,
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
        settlement: state.vaults.settlement,
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
    const result = approveAskToMove(state, req.params.eventId);

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({
      message: `AskToMove approved for ${req.params.eventId}`,
      timestamp: new Date().toISOString(),
    });
  });

  // ── POST /sim/inject-error/:stage ────────────────────────────────────
  router.post('/sim/inject-error/:stage', (req: Request, res: Response) => {
    const state = getState();
    const stage = req.params.stage;

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
    const stage = req.params.stage;
    const ms = parseInt(req.params.ms, 10);

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
