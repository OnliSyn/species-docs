// ── Accounts handler ──
// GET /virtual-accounts/:vaId → BalanceDTO
// GET /virtual-accounts?ownerRef= → BalanceDTO[]
// POST /virtual-accounts → BalanceDTO

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';

function toBalanceDTO(va: {
  vaId: string;
  ownerRef: string;
  subtype: string;
  tbCode: number;
  posted: bigint;
  pending: bigint;
  depositAddress: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    vaId: va.vaId,
    ownerRef: va.ownerRef,
    subtype: va.subtype,
    tbCode: va.tbCode,
    balance: {
      posted: va.posted,
      pending: va.pending,
      available: va.posted - va.pending,
    },
    depositAddress: va.depositAddress,
    currency: va.currency,
    status: va.status,
    createdAt: va.createdAt,
    updatedAt: va.updatedAt,
  };
}

export function createAccountsRouter(state: SimState): Router {
  const router = Router();

  // GET /virtual-accounts/:vaId
  router.get('/:vaId', (req: Request, res: Response) => {
    if (state.errorInjections.get('accounts')) {
      state.errorInjections.delete('accounts');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on accounts' });
      return;
    }

    const va = state.virtualAccounts.get(String(req.params.vaId));
    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${String(req.params.vaId)} not found` });
      return;
    }

    res.json(serializeBigints(toBalanceDTO(va)));
  });

  // GET /virtual-accounts?ownerRef=
  router.get('/', (req: Request, res: Response) => {
    if (state.errorInjections.get('accounts')) {
      state.errorInjections.delete('accounts');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on accounts' });
      return;
    }

    const ownerRef = req.query.ownerRef as string | undefined;
    let accounts = [...state.virtualAccounts.values()];

    if (ownerRef) {
      accounts = accounts.filter((va) => va.ownerRef === ownerRef);
    }

    res.json(serializeBigints(accounts.map(toBalanceDTO)));
  });

  // POST /virtual-accounts
  router.post('/', (req: Request, res: Response) => {
    const { ownerRef, subtype, tbCode } = req.body;

    if (!ownerRef || !subtype) {
      res.status(400).json({ code: 'bad_request', message: 'ownerRef and subtype are required' });
      return;
    }

    const vaId = `va-${subtype}-${ownerRef}`;

    if (state.virtualAccounts.has(vaId)) {
      res.status(409).json({ code: 'already_exists', message: `VA ${vaId} already exists` });
      return;
    }

    const codeMap: Record<string, number> = { funding: 500, species: 510, assurance: 520 };
    const now = new Date().toISOString();

    const va = {
      vaId,
      ownerRef,
      subtype,
      tbCode: tbCode ?? codeMap[subtype] ?? 500,
      posted: 0n,
      pending: 0n,
      depositAddress: `0x${Buffer.from(vaId).toString('hex').slice(0, 40).padEnd(40, '0')}`,
      currency: 'USDC',
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    state.virtualAccounts.set(vaId, va);
    res.status(201).json(serializeBigints(toBalanceDTO(va)));
  });

  return router;
}
