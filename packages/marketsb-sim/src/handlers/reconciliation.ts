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
    125: 'Global Assurance Pool',
    200: 'Settlement Reserve',
    300: 'Operating Revenue',
    400: 'Pending Deposit Staging',
    450: 'Pending Withdrawal Staging',
    // Alex Morgan (user-001)
    500: 'Alex Funding VA',
    510: 'Alex Species VA',
    520: 'Alex Assurance VA',
    // Pepper Potts (user-456)
    530: 'Pepper Funding VA',
    540: 'Pepper Species VA',
    550: 'Pepper Assurance VA',
    // Tony Stark (user-789)
    560: 'Tony Funding VA',
    570: 'Tony Species VA',
    580: 'Tony Assurance VA',
    // Happy Hogan (user-012)
    590: 'Happy Funding VA',
    600: 'Happy Species VA',
    610: 'Happy Assurance VA',
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

  const cashierTxByState: Record<string, number> = {};
  for (const t of state.cashierTransactions.values()) {
    cashierTxByState[t.state] = (cashierTxByState[t.state] ?? 0) + 1;
  }

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
    cashier: {
      initialized: state.cashier?.initialized ?? false,
      accountCount: state.cashierAccounts.size,
      transactionCount: state.cashierTransactions.size,
      transactionsByState: cashierTxByState,
      receiptCount: state.cashierReceipts.size,
      cashierOracleEntryCount: state.cashierOracleEntries.size,
      auditEventCount: state.auditEvents.length,
    },
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
