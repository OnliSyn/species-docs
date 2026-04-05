// ── Withdrawals handler ──
// POST /withdrawals → WithdrawalDTO (201)
// GET /withdrawals/:id → WithdrawalDTO
// GET /withdrawals?status= → WithdrawalDTO[]
// POST /withdrawals/:id/approve → WithdrawalDTO
// POST /withdrawals/:id/reject → WithdrawalDTO

import { Router, type Request, type Response } from 'express';
import type { SimState, SimConfig, WithdrawalState } from '../state.js';
import { serializeBigints } from '../state.js';

const WITHDRAWAL_LIFECYCLE_STATES = [
  'pending_approval',
  'approved',
  'processing',
  'broadcast',
  'confirmed',
];

let withdrawalCounter = 0;

function toWithdrawalDTO(wd: WithdrawalState) {
  return {
    withdrawalId: wd.withdrawalId,
    vaId: wd.vaId,
    amount: wd.amount,
    status: wd.status,
    destination: wd.destination,
    lifecycle: wd.lifecycle,
    txHash: wd.txHash,
    oracleRef: wd.oracleRef,
  };
}

function advanceWithdrawalAuto(
  state: SimState,
  withdrawalId: string,
  config: SimConfig,
): NodeJS.Timeout[] {
  const timers: NodeJS.Timeout[] = [];
  const wd = state.withdrawals.get(withdrawalId);
  if (!wd) return timers;

  // Auto-advance from processing → broadcast → confirmed
  const autoStates = ['broadcast', 'confirmed'];
  for (let i = 0; i < autoStates.length; i++) {
    const timer = setTimeout(() => {
      const w = state.withdrawals.get(withdrawalId);
      if (!w) return;
      const now = new Date().toISOString();
      const nextState = autoStates[i];
      w.status = nextState;
      w.lifecycle.push({ state: nextState, timestamp: now });

      if (nextState === 'broadcast') {
        w.txHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      }
    }, config.withdrawalLifecycleDelayMs * (i + 1));
    timers.push(timer);
  }

  return timers;
}

export function createWithdrawalsRouter(
  state: SimState,
  config: SimConfig,
): Router {
  const router = Router();

  // POST /withdrawals
  router.post('/', (req: Request, res: Response) => {
    if (state.errorInjections.get('withdrawals')) {
      state.errorInjections.delete('withdrawals');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on withdrawals' });
      return;
    }

    const { vaId, amount, destination, chain, idempotencyKey } = req.body;

    if (!vaId || amount === undefined || !destination) {
      res.status(400).json({ code: 'bad_request', message: 'vaId, amount, and destination are required' });
      return;
    }

    // Idempotency check
    if (idempotencyKey && state.idempotencyKeys.has(idempotencyKey)) {
      const existing = state.idempotencyKeys.get(idempotencyKey);
      res.status(200).json(serializeBigints(existing));
      return;
    }

    const va = state.virtualAccounts.get(vaId);
    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${vaId} not found` });
      return;
    }

    const amountBig = BigInt(amount);
    if (va.posted < amountBig) {
      res.status(409).json({ code: 'insufficient_funds', message: `Insufficient balance: have ${va.posted}, need ${amountBig}` });
      return;
    }

    const now = new Date().toISOString();
    withdrawalCounter++;
    const withdrawalId = `wd-${String(withdrawalCounter).padStart(3, '0')}`;

    // Threshold gate
    const needsApproval = amountBig >= config.sendoutApprovalThresholdUsd;
    const initialStatus = needsApproval ? 'pending_approval' : 'processing';

    // Reserve funds (decrease posted, increase pending)
    va.posted -= amountBig;
    va.pending += amountBig;
    va.updatedAt = now;

    const wd: WithdrawalState = {
      withdrawalId,
      vaId,
      amount: amountBig,
      status: initialStatus,
      destination,
      chain: chain || 'base',
      lifecycle: [{ state: initialStatus, timestamp: now }],
      txHash: null,
      oracleRef: `fo-${withdrawalId}`,
      idempotencyKey: idempotencyKey || '',
    };

    state.withdrawals.set(withdrawalId, wd);

    const dto = toWithdrawalDTO(wd);

    if (idempotencyKey) {
      state.idempotencyKeys.set(idempotencyKey, dto);
    }

    // Auto-advance if below threshold
    if (!needsApproval) {
      advanceWithdrawalAuto(state, withdrawalId, config);
    }

    res.status(201).json(serializeBigints(dto));
  });

  // GET /withdrawals/:id
  router.get('/:id', (req: Request, res: Response) => {
    if (state.errorInjections.get('withdrawals')) {
      state.errorInjections.delete('withdrawals');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on withdrawals' });
      return;
    }

    const wd = state.withdrawals.get(req.params.id);
    if (!wd) {
      res.status(404).json({ code: 'not_found', message: `Withdrawal ${req.params.id} not found` });
      return;
    }

    res.json(serializeBigints(toWithdrawalDTO(wd)));
  });

  // GET /withdrawals?status=
  router.get('/', (req: Request, res: Response) => {
    const { status } = req.query as { status?: string };
    let wds = [...state.withdrawals.values()];

    if (status) {
      wds = wds.filter((w) => w.status === status);
    }

    res.json(serializeBigints(wds.map(toWithdrawalDTO)));
  });

  // POST /withdrawals/:id/approve
  router.post('/:id/approve', (req: Request, res: Response) => {
    const wd = state.withdrawals.get(req.params.id);
    if (!wd) {
      res.status(404).json({ code: 'not_found', message: `Withdrawal ${req.params.id} not found` });
      return;
    }

    if (wd.status !== 'pending_approval') {
      res.status(409).json({ code: 'invalid_state', message: `Cannot approve withdrawal in state: ${wd.status}` });
      return;
    }

    const now = new Date().toISOString();
    wd.status = 'processing';
    wd.lifecycle.push({ state: 'approved', timestamp: now });
    wd.lifecycle.push({ state: 'processing', timestamp: now });

    // Start auto-advance from processing
    advanceWithdrawalAuto(state, wd.withdrawalId, config);

    res.json(serializeBigints(toWithdrawalDTO(wd)));
  });

  // POST /withdrawals/:id/reject
  router.post('/:id/reject', (req: Request, res: Response) => {
    const wd = state.withdrawals.get(req.params.id);
    if (!wd) {
      res.status(404).json({ code: 'not_found', message: `Withdrawal ${req.params.id} not found` });
      return;
    }

    if (wd.status !== 'pending_approval') {
      res.status(409).json({ code: 'invalid_state', message: `Cannot reject withdrawal in state: ${wd.status}` });
      return;
    }

    const now = new Date().toISOString();
    wd.status = 'rejected';
    wd.lifecycle.push({ state: 'rejected', timestamp: now });

    // Return reserved funds
    const va = state.virtualAccounts.get(wd.vaId);
    if (va) {
      va.posted += wd.amount;
      va.pending -= wd.amount;
      va.updatedAt = now;
    }

    res.json(serializeBigints(toWithdrawalDTO(wd)));
  });

  return router;
}
