// ── Reconciliation handler ──
// GET /reconciliation/status → ReconciliationDTO
// POST /reconciliation/run → ReconciliationDTO

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';

interface CodeSummary {
  code: number;
  label: string;
  totalPosted: bigint;
  accountCount: number;
}

function runReconciliation(state: SimState) {
  const codeLabels: Record<number, string> = {
    100: 'Treasury Reserve',
    200: 'Settlement Reserve',
    300: 'Operating Revenue',
    400: 'Pending Deposit Staging',
    450: 'Pending Withdrawal Staging',
    500: 'User Funding VA',
    510: 'User Species VA',
    520: 'Assurance VA',
  };

  const codeSummaries = new Map<number, CodeSummary>();

  for (const va of state.virtualAccounts.values()) {
    const existing = codeSummaries.get(va.tbCode) ?? {
      code: va.tbCode,
      label: codeLabels[va.tbCode] || `Code ${va.tbCode}`,
      totalPosted: 0n,
      accountCount: 0,
    };
    existing.totalPosted += va.posted;
    existing.accountCount++;
    codeSummaries.set(va.tbCode, existing);
  }

  const totalVABalance = [...state.virtualAccounts.values()]
    .reduce((sum, va) => sum + va.posted, 0n);

  const totalWalletBalance =
    state.systemWallets.incoming +
    state.systemWallets.market +
    state.systemWallets.outgoing +
    state.systemWallets.operating;

  const now = new Date().toISOString();

  return {
    status: totalVABalance > 0n ? 'completed' : 'empty',
    codeSummaries: [...codeSummaries.values()],
    totalVABalance,
    systemWallets: {
      incoming: state.systemWallets.incoming,
      market: state.systemWallets.market,
      outgoing: state.systemWallets.outgoing,
      operating: state.systemWallets.operating,
    },
    totalWalletBalance,
    variance: totalWalletBalance - totalVABalance,
    reconciledAt: now,
  };
}

export function createReconciliationRouter(state: SimState): Router {
  const router = Router();

  // GET /reconciliation/status
  router.get('/status', (_req: Request, res: Response) => {
    if (state.errorInjections.get('reconciliation')) {
      state.errorInjections.delete('reconciliation');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on reconciliation' });
      return;
    }

    res.json(serializeBigints(runReconciliation(state)));
  });

  // POST /reconciliation/run
  router.post('/run', (_req: Request, res: Response) => {
    if (state.errorInjections.get('reconciliation')) {
      state.errorInjections.delete('reconciliation');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on reconciliation' });
      return;
    }

    res.json(serializeBigints(runReconciliation(state)));
  });

  return router;
}
