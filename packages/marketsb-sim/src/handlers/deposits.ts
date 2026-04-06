// ── Deposits handler ──
// GET /deposits/:id → DepositDTO
// GET /deposits?vaId=&status= → DepositDTO[]

import { Router, type Request, type Response } from 'express';
import type { SimState, DepositState, SimConfig } from '../state.js';
import { serializeBigints } from '../state.js';

const DEPOSIT_LIFECYCLE_STATES = [
  'detected',
  'compliance_pending',
  'compliance_passed',
  'credited',
  'registered',
];

function toDepositDTO(dep: DepositState) {
  return {
    depositId: dep.depositId,
    vaId: dep.vaId,
    amount: dep.amount,
    status: dep.status,
    lifecycle: dep.lifecycle,
    txHash: dep.txHash,
    chain: dep.chain,
    oracleRef: dep.oracleRef,
  };
}

export function advanceDepositLifecycle(
  state: SimState,
  depositId: string,
): DepositState | null {
  const dep = state.deposits.get(depositId);
  if (!dep) return null;

  const currentIdx = DEPOSIT_LIFECYCLE_STATES.indexOf(dep.status);
  if (currentIdx < 0 || currentIdx >= DEPOSIT_LIFECYCLE_STATES.length - 1) {
    return dep; // already at final state
  }

  const nextState = DEPOSIT_LIFECYCLE_STATES[currentIdx + 1];
  const now = new Date().toISOString();

  dep.status = nextState;
  dep.lifecycle.push({ state: nextState, timestamp: now });

  // On 'credited', increase the VA's posted balance
  if (nextState === 'credited') {
    const va = state.virtualAccounts.get(dep.vaId);
    if (va) {
      const balanceBefore = va.posted;
      va.posted += dep.amount;
      va.updatedAt = now;

      // Write oracle entry
      const entries = state.oracleLog.get(dep.vaId) ?? [];
      entries.push({
        entryId: `fo-${dep.depositId}`,
        vaId: dep.vaId,
        type: 'deposit_credited',
        amount: dep.amount,
        balanceBefore,
        balanceAfter: va.posted,
        ref: dep.depositId,
        timestamp: now,
      });
      state.oracleLog.set(dep.vaId, entries);
    }
  }

  return dep;
}

export function startDepositLifecycleTimer(
  state: SimState,
  depositId: string,
  config: SimConfig,
): NodeJS.Timeout[] {
  const timers: NodeJS.Timeout[] = [];
  const dep = state.deposits.get(depositId);
  if (!dep) return timers;

  const currentIdx = DEPOSIT_LIFECYCLE_STATES.indexOf(dep.status);
  const remaining = DEPOSIT_LIFECYCLE_STATES.length - 1 - currentIdx;

  for (let i = 1; i <= remaining; i++) {
    const timer = setTimeout(() => {
      advanceDepositLifecycle(state, depositId);
    }, config.depositLifecycleDelayMs * i);
    timers.push(timer);
  }

  return timers;
}

export function createDepositsRouter(state: SimState): Router {
  const router = Router();

  // GET /deposits/:id
  router.get('/:id', (req: Request, res: Response) => {
    if (state.errorInjections.get('deposits')) {
      state.errorInjections.delete('deposits');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on deposits' });
      return;
    }

    const dep = state.deposits.get(String(req.params.id));
    if (!dep) {
      res.status(404).json({ code: 'not_found', message: `Deposit ${String(req.params.id)} not found` });
      return;
    }

    res.json(serializeBigints(toDepositDTO(dep)));
  });

  // GET /deposits?vaId=&status=
  router.get('/', (req: Request, res: Response) => {
    if (state.errorInjections.get('deposits')) {
      state.errorInjections.delete('deposits');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on deposits' });
      return;
    }

    const { vaId, status } = req.query as { vaId?: string; status?: string };
    let deposits = [...state.deposits.values()];

    if (vaId) deposits = deposits.filter((d) => d.vaId === vaId);
    if (status) deposits = deposits.filter((d) => d.status === status);

    res.json(serializeBigints(deposits.map(toDepositDTO)));
  });

  return router;
}
