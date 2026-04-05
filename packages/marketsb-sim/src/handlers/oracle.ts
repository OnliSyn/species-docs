// ── Oracle handler ──
// GET /oracle/ledger
// GET /oracle/entries, POST /oracle/entries, GET /oracle/entries/:id, POST /oracle/entries/:id/verify
// POST /oracle/encrypt, POST /oracle/decrypt
// GET /oracle/virtual-accounts/:vaId/ledger
// POST /oracle/virtual-accounts/:vaId/verify

import { Router, type Request, type Response } from 'express';
import type { OracleEntry, SimState } from '../state.js';
import { serializeBigints } from '../state.js';
import { verifyVaOracleLedger } from '../oracle-verify.js';
import type { CashierOracleEntry } from '../cashier-types.js';

export function createOracleRouter(state: SimState): Router {
  const router = Router();

  // GET /oracle/ledger
  router.get('/ledger', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const all: OracleEntry[] = [];
    for (const list of state.oracleLog.values()) {
      all.push(...list);
    }
    all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const paged = all.slice(offset, offset + limit);

    res.json(serializeBigints(paged));
  });

  // GET /oracle/entries
  router.get('/entries', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }
    let list = [...state.cashierOracleEntries.values()];
    const q = req.query;
    if (q.transactionId) list = list.filter((e) => e.transactionId === q.transactionId);
    if (q.state) list = list.filter((e) => e.state === q.state);
    res.json(list);
  });

  // POST /oracle/entries
  router.post('/entries', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }
    const { transactionId, payload } = req.body;
    if (!transactionId) {
      res.status(400).json({ code: 'bad_request', message: 'transactionId required' });
      return;
    }
    const tx = state.cashierTransactions.get(transactionId);
    if (!tx) {
      res.status(404).json({ code: 'not_found', message: 'Transaction not found' });
      return;
    }
    const ts = new Date().toISOString();
    const id = `co-manual-${Date.now()}`;
    const summary = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const entry: CashierOracleEntry = {
      oracleEntryId: id,
      transactionId,
      state: 'WRITTEN',
      encryptedPayload: Buffer.from(summary).toString('base64'),
      plaintextSummary: summary,
      createdAt: ts,
    };
    state.cashierOracleEntries.set(id, entry);
    res.status(201).json(entry);
  });

  // GET /oracle/entries/:oracleEntryId
  router.get('/entries/:oracleEntryId', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }
    const e = state.cashierOracleEntries.get(req.params.oracleEntryId);
    if (!e) {
      res.status(404).json({ code: 'not_found', message: 'Oracle entry not found' });
      return;
    }
    res.json(e);
  });

  // POST /oracle/entries/:oracleEntryId/verify
  router.post('/entries/:oracleEntryId/verify', (req: Request, res: Response) => {
    if (state.errorInjections.get('oracle')) {
      state.errorInjections.delete('oracle');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on oracle' });
      return;
    }
    const e = state.cashierOracleEntries.get(req.params.oracleEntryId);
    if (!e) {
      res.status(404).json({ code: 'not_found', message: 'Oracle entry not found' });
      return;
    }
    if (!e.vaId) {
      e.state = 'VERIFIED';
      res.json({ oracleEntryId: e.oracleEntryId, state: e.state, linkedVa: false });
      return;
    }
    const va = state.virtualAccounts.get(e.vaId);
    if (!va) {
      res.status(404).json({ code: 'not_found', message: 'Linked VA not found' });
      return;
    }
    const chain = verifyVaOracleLedger(va.posted, state.oracleLog.get(e.vaId) ?? []);
    const ok = chain.isValid;
    e.state = ok ? 'VERIFIED' : 'FAILED';
    res.json({
      oracleEntryId: e.oracleEntryId,
      state: e.state,
      linkedVaId: e.vaId,
      chainValid: chain.isValid,
      detail: chain.detail,
      verifiedAt: new Date().toISOString(),
    });
  });

  // POST /oracle/encrypt
  router.post('/encrypt', (req: Request, res: Response) => {
    const { payload } = req.body;
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    res.json({
      ciphertext: Buffer.from(text).toString('base64'),
      keyRef: state.cashier?.oracleKeyRef ?? 'unbound',
    });
  });

  // POST /oracle/decrypt
  router.post('/decrypt', (req: Request, res: Response) => {
    const { ciphertext } = req.body;
    if (!ciphertext || typeof ciphertext !== 'string') {
      res.status(400).json({ code: 'bad_request', message: 'ciphertext required' });
      return;
    }
    try {
      const plain = Buffer.from(ciphertext, 'base64').toString('utf8');
      res.json({ payload: plain });
    } catch {
      res.status(400).json({ code: 'bad_request', message: 'Invalid base64' });
    }
  });

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
    const chain = verifyVaOracleLedger(va.posted, entries);

    res.json(
      serializeBigints({
        vaId,
        actualBalance: va.posted,
        computedBalance: chain.finalComputedBalance,
        entryCount: chain.entryCount,
        isValid: chain.isValid,
        variance: chain.variance,
        detail: chain.detail,
        verifiedAt: new Date().toISOString(),
      }),
    );
  });

  return router;
}
