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
import { resetCashierEngineCounters } from './cashier-engine.js';

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
    resetCashierEngineCounters();
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
      cashier: state.cashier,
      cashierAccounts: Object.fromEntries(state.cashierAccounts),
      cashierTransactions: Object.fromEntries(state.cashierTransactions),
      cashierReceipts: Object.fromEntries(state.cashierReceipts),
      cashierOracleEntries: Object.fromEntries(state.cashierOracleEntries),
      cashierSystemUsers: Object.fromEntries(state.cashierSystemUsers),
      cashierIdempotencyCount: state.cashierIdempotency.size,
      auditEvents: state.auditEvents,
      useStrictCashierPostBatch: state.useStrictCashierPostBatch,
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

  // POST /sim/simulate-deposit — full deposit lifecycle through MarketSB accounting
  router.post('/simulate-deposit', (req: Request, res: Response) => {
    const state = getState();
    const { vaId, amount, fbo } = req.body;

    if (!vaId || amount === undefined) {
      res.status(400).json({ code: 'bad_request', message: 'vaId and amount required' });
      return;
    }

    const va = state.virtualAccounts.get(vaId);
    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${vaId} not found` });
      return;
    }

    const depositAmount = BigInt(amount);
    const now = new Date().toISOString();
    const depId = `dep-sim-${Date.now()}`;

    // 1. Credit incoming system wallet
    state.systemWallets.incoming += depositAmount;

    // 2. Create deposit record with full lifecycle
    state.deposits.set(depId, {
      depositId: depId,
      vaId,
      amount: depositAmount,
      status: 'credited',
      lifecycle: [
        { state: 'detected', timestamp: now },
        { state: 'compliance_pending', timestamp: now },
        { state: 'compliance_passed', timestamp: now },
        { state: 'credited', timestamp: now },
      ],
      txHash: `0xsim${Date.now().toString(16)}`,
      chain: 'base',
      oracleRef: `fo-${depId}`,
    });

    // 3. Credit user funding VA
    const before = va.posted;
    va.posted += depositAmount;
    va.updatedAt = now;

    // 4. Debit incoming wallet (funds moved to user VA)
    state.systemWallets.incoming -= depositAmount;

    // 5. Oracle entry
    const entries = state.oracleLog.get(vaId) ?? [];
    entries.push({
      entryId: `fo-${depId}`,
      vaId,
      type: 'deposit_credited',
      amount: depositAmount,
      balanceBefore: before,
      balanceAfter: va.posted,
      ref: depId,
      timestamp: now,
    });
    state.oracleLog.set(vaId, entries);

    res.json(serializeBigints({
      depositId: depId,
      vaId,
      amount: depositAmount,
      fbo: fbo || vaId,
      status: 'credited',
      lifecycle: ['detected', 'compliance_pending', 'compliance_passed', 'credited'],
      newBalance: va.posted,
      timestamp: now,
    }));
  });

  // POST /sim/simulate-withdrawal — full withdrawal lifecycle through MarketSB accounting
  router.post('/simulate-withdrawal', (req: Request, res: Response) => {
    const state = getState();
    const { vaId, amount, destination } = req.body;

    if (!vaId || amount === undefined) {
      res.status(400).json({ code: 'bad_request', message: 'vaId and amount required' });
      return;
    }

    const va = state.virtualAccounts.get(vaId);
    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${vaId} not found` });
      return;
    }

    const withdrawAmount = BigInt(amount);
    if (va.posted < withdrawAmount) {
      res.status(400).json({ code: 'insufficient_balance', message: 'Not enough balance' });
      return;
    }

    const now = new Date().toISOString();
    const wdId = `wd-sim-${Date.now()}`;

    // 1. Debit user funding VA
    const before = va.posted;
    va.posted -= withdrawAmount;
    va.updatedAt = now;

    // 2. Credit outgoing system wallet
    state.systemWallets.outgoing += withdrawAmount;

    // 3. Create withdrawal record
    state.withdrawals.set(wdId, {
      withdrawalId: wdId,
      vaId,
      amount: withdrawAmount,
      destination: destination || '0xexternal',
      status: 'sent',
      chain: 'base',
      lifecycle: [
        { state: 'requested', timestamp: now },
        { state: 'compliance_passed', timestamp: now },
        { state: 'debited', timestamp: now },
        { state: 'sent', timestamp: now },
      ],
      txHash: `0xwd${Date.now().toString(16)}`,
      oracleRef: `fo-${wdId}`,
      idempotencyKey: wdId,
    });

    // 4. Debit outgoing wallet (funds sent on-chain)
    state.systemWallets.outgoing -= withdrawAmount;

    // 5. Oracle entry
    const entries = state.oracleLog.get(vaId) ?? [];
    entries.push({
      entryId: `fo-${wdId}`,
      vaId,
      type: 'withdrawal_sent',
      amount: withdrawAmount,
      balanceBefore: before,
      balanceAfter: va.posted,
      ref: wdId,
      timestamp: now,
    });
    state.oracleLog.set(vaId, entries);

    res.json(serializeBigints({
      withdrawalId: wdId,
      vaId,
      amount: withdrawAmount,
      destination: destination || '0xexternal',
      status: 'sent',
      lifecycle: ['requested', 'compliance_passed', 'debited', 'sent'],
      newBalance: va.posted,
      timestamp: now,
    }));
  });

  // POST /sim/credit-va — directly credit a VA (for mock chat fund journeys)
  router.post('/credit-va', (req: Request, res: Response) => {
    const state = getState();
    const { vaId, amount } = req.body;

    if (!vaId || amount === undefined) {
      res.status(400).json({ code: 'bad_request', message: 'vaId and amount required' });
      return;
    }

    const va = state.virtualAccounts.get(vaId);
    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${vaId} not found` });
      return;
    }

    const creditAmount = BigInt(amount);
    const before = va.posted;
    va.posted += creditAmount;
    va.updatedAt = new Date().toISOString();

    // Oracle entry
    const entries = state.oracleLog.get(vaId) ?? [];
    entries.push({
      entryId: `sim-credit-${Date.now()}`,
      vaId,
      type: 'deposit_credited',
      amount: creditAmount,
      balanceBefore: before,
      balanceAfter: va.posted,
      ref: `sim-instant-deposit`,
      timestamp: va.updatedAt,
    });
    state.oracleLog.set(vaId, entries);

    res.json(serializeBigints({
      vaId,
      credited: creditAmount,
      newBalance: va.posted,
      timestamp: va.updatedAt,
    }));
  });

  // POST /sim/debit-va — directly debit a VA (for mock chat withdraw journeys)
  router.post('/debit-va', (req: Request, res: Response) => {
    const state = getState();
    const { vaId, amount } = req.body;

    if (!vaId || amount === undefined) {
      res.status(400).json({ code: 'bad_request', message: 'vaId and amount required' });
      return;
    }

    const va = state.virtualAccounts.get(vaId);
    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${vaId} not found` });
      return;
    }

    const debitAmount = BigInt(amount);
    if (va.posted < debitAmount) {
      res.status(400).json({ code: 'insufficient_balance', message: 'Not enough balance' });
      return;
    }

    const before = va.posted;
    va.posted -= debitAmount;
    va.updatedAt = new Date().toISOString();

    const entries = state.oracleLog.get(vaId) ?? [];
    entries.push({
      entryId: `sim-debit-${Date.now()}`,
      vaId,
      type: 'withdrawal_debited',
      amount: debitAmount,
      balanceBefore: before,
      balanceAfter: va.posted,
      ref: `sim-instant-withdrawal`,
      timestamp: va.updatedAt,
    });
    state.oracleLog.set(vaId, entries);

    res.json(serializeBigints({
      vaId,
      debited: debitAmount,
      newBalance: va.posted,
      timestamp: va.updatedAt,
    }));
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
    const st = getState();
    if (updates.useStrictCashierPostBatch !== undefined) {
      config.useStrictCashierPostBatch = Boolean(updates.useStrictCashierPostBatch);
      st.useStrictCashierPostBatch = config.useStrictCashierPostBatch;
    }
    res.json({
      status: 'config_updated',
      config: {
        depositLifecycleDelayMs: config.depositLifecycleDelayMs,
        withdrawalLifecycleDelayMs: config.withdrawalLifecycleDelayMs,
        sendoutApprovalThresholdUsd: Number(config.sendoutApprovalThresholdUsd),
        useStrictCashierPostBatch: config.useStrictCashierPostBatch,
      },
    });
  });

  return router;
}
