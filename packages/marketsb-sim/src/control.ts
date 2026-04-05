// ── Sim control endpoints (dev only) ──
// POST /sim/reset
// GET /sim/state
// POST /sim/inject-error/:endpoint
// POST /sim/advance-deposit/:id
// POST /sim/set-config

import { Router, type Request, type Response } from 'express';
import type { SimState, SimConfig } from './state.js';
import { createEmptyState, serializeBigints } from './state.js';
import { seedDevelopment, seedTest } from './seed.js';
import { advanceDepositLifecycle } from './handlers/deposits.js';

export function createControlRouter(
  getState: () => SimState,
  setState: (s: SimState) => void,
  config: SimConfig,
): Router {
  const router = Router();

  // POST /sim/reset
  router.post('/reset', (_req: Request, res: Response) => {
    let newState: SimState;
    if (config.seedData === 'development') {
      newState = seedDevelopment();
    } else if (config.seedData === 'test') {
      newState = seedTest();
    } else {
      newState = createEmptyState();
    }
    setState(newState);
    res.json({ status: 'reset', seedData: config.seedData, timestamp: new Date().toISOString() });
  });

  // GET /sim/state
  router.get('/state', (_req: Request, res: Response) => {
    const state = getState();
    const dump = {
      virtualAccounts: Object.fromEntries(state.virtualAccounts),
      deposits: Object.fromEntries(state.deposits),
      withdrawals: Object.fromEntries(state.withdrawals),
      transfers: Object.fromEntries(state.transfers),
      oracleLog: Object.fromEntries(state.oracleLog),
      systemWallets: state.systemWallets,
      idempotencyKeysCount: state.idempotencyKeys.size,
      errorInjections: Object.fromEntries(state.errorInjections),
    };
    res.json(serializeBigints(dump));
  });

  // POST /sim/inject-error/:endpoint
  router.post('/inject-error/:endpoint', (req: Request, res: Response) => {
    const state = getState();
    state.errorInjections.set(req.params.endpoint, true);
    res.json({ status: 'error_injected', endpoint: req.params.endpoint });
  });

  // POST /sim/advance-deposit/:id
  router.post('/advance-deposit/:id', (req: Request, res: Response) => {
    const state = getState();
    const result = advanceDepositLifecycle(state, req.params.id);
    if (!result) {
      res.status(404).json({ code: 'not_found', message: `Deposit ${req.params.id} not found` });
      return;
    }
    res.json(serializeBigints(result));
  });

  // POST /sim/set-config
  router.post('/set-config', (req: Request, res: Response) => {
    const updates = req.body;
    if (updates.depositLifecycleDelayMs !== undefined) {
      config.depositLifecycleDelayMs = updates.depositLifecycleDelayMs;
    }
    if (updates.withdrawalLifecycleDelayMs !== undefined) {
      config.withdrawalLifecycleDelayMs = updates.withdrawalLifecycleDelayMs;
    }
    if (updates.sendoutApprovalThresholdUsd !== undefined) {
      config.sendoutApprovalThresholdUsd = BigInt(updates.sendoutApprovalThresholdUsd);
    }
    res.json({
      status: 'config_updated',
      config: {
        depositLifecycleDelayMs: config.depositLifecycleDelayMs,
        withdrawalLifecycleDelayMs: config.withdrawalLifecycleDelayMs,
        sendoutApprovalThresholdUsd: Number(config.sendoutApprovalThresholdUsd),
      },
    });
  });

  return router;
}
