// ── Asset oracle handler (species ownership ledger) ──
// GET /oracle/ledger → AssetOracleEntry[] (global, paged)
// GET /oracle/onli/:onliId/ledger → entries involving that party
// GET /oracle/events/:eventId/entries → entries for one pipeline event
// POST /oracle/onli/:onliId/verify → reconcile vault count vs oracle-derived count

import { Router, type Request, type Response } from 'express';
import type { SpeciesSimState } from '../state.js';

export function createOracleRouter(getState: () => SpeciesSimState): Router {
  const router = Router();

  const checkInjectedError = (state: SpeciesSimState, res: Response): boolean => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return true;
    }
    return false;
  };

  // GET /oracle/ledger
  router.get('/ledger', (req: Request, res: Response) => {
    const state = getState();
    if (checkInjectedError(state, res)) return;

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const log = state.assetOracleLog;
    const sorted = [...log].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json(sorted.slice(offset, offset + limit));
  });

  // GET /oracle/onli/:onliId/ledger
  router.get('/onli/:onliId/ledger', (req: Request, res: Response) => {
    const state = getState();
    if (checkInjectedError(state, res)) return;

    const { onliId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const entries = state.assetOracleLog.filter((e) => e.from === onliId || e.to === onliId);
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json(entries.slice(offset, offset + limit));
  });

  // GET /oracle/events/:eventId/entries
  router.get('/events/:eventId/entries', (req: Request, res: Response) => {
    const state = getState();
    if (checkInjectedError(state, res)) return;

    const { eventId } = req.params;
    const entries = state.assetOracleLog.filter((e) => e.eventId === eventId);
    res.json(entries);
  });

  // POST /oracle/onli/:onliId/verify
  router.post('/onli/:onliId/verify', (req: Request, res: Response) => {
    const state = getState();
    if (checkInjectedError(state, res)) return;

    const { onliId } = req.params;
    const vault = state.vaults.users.get(onliId);
    if (!vault) {
      res.status(404).json({ code: 'not_found', message: `No user vault for onliId ${onliId}` });
      return;
    }

    let computedCount = 0;
    for (const e of state.assetOracleLog) {
      if (e.to === onliId) computedCount += e.count;
      if (e.from === onliId) computedCount -= e.count;
    }

    const actualCount = vault.count;
    const isValid = actualCount === computedCount;

    res.json({
      onliId,
      actualCount,
      computedCount,
      entryCount: state.assetOracleLog.filter((e) => e.from === onliId || e.to === onliId).length,
      isValid,
      variance: actualCount - computedCount,
      verifiedAt: new Date().toISOString(),
    });
  });

  return router;
}
