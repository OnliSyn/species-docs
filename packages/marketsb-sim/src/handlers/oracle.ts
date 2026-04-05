// ── Oracle handler ──
// GET /oracle/virtual-accounts/:vaId/ledger → OracleEntryDTO[]
// POST /oracle/virtual-accounts/:vaId/verify → VerificationDTO

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';

export function createOracleRouter(state: SimState): Router {
  const router = Router();

  // GET /oracle/virtual-accounts/:vaId/ledger
  router.get('/virtual-accounts/:vaId/ledger', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }

    const { vaId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const entries = state.oracleLog.get(vaId) ?? [];
    const paged = entries.slice(offset, offset + limit);

    res.json(serializeBigints(paged));
  });

  // POST /oracle/virtual-accounts/:vaId/verify
  router.post('/virtual-accounts/:vaId/verify', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }

    const { vaId } = req.params;
    const va = state.virtualAccounts.get(vaId);

    if (!va) {
      res.status(404).json({ code: 'not_found', message: `VA ${vaId} not found` });
      return;
    }

    const entries = state.oracleLog.get(vaId) ?? [];

    // Compute expected balance from oracle entries
    let computedBalance = 0n;
    for (const entry of entries) {
      if (entry.type.includes('credit') || entry.type.includes('deposit')) {
        computedBalance += entry.amount;
      } else if (entry.type.includes('debit')) {
        computedBalance -= entry.amount;
      }
    }

    const actualBalance = va.posted;
    const isValid = computedBalance === actualBalance;

    res.json(serializeBigints({
      vaId,
      actualBalance,
      computedBalance,
      entryCount: entries.length,
      isValid,
      variance: actualBalance - computedBalance,
      verifiedAt: new Date().toISOString(),
    }));
  });

  return router;
}
