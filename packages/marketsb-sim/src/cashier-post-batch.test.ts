import http from 'node:http';
import express from 'express';
import { describe, it, expect } from 'vitest';
import { seedTest } from './seed.js';
import { createCashierRouter } from './handlers/cashier.js';
import type { SimState } from './state.js';

function mountCashier(state: SimState) {
  const app = express();
  app.use(express.json());
  app.use('/cashier', createCashierRouter(state));
  return app;
}

async function withServer(app: express.Express, fn: (port: number) => Promise<void>) {
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (typeof addr !== 'object' || !addr) throw new Error('expected server address');
  try {
    await fn(addr.port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

describe('legacy POST /cashier/post-batch', () => {
  it('rejects intent buy when sellerVaId is not treasury (prevents uncoupled assurance credit)', async () => {
    const state = seedTest();
    state.useStrictCashierPostBatch = true;
    const app = mountCashier(state);
    const assuranceBefore = state.virtualAccounts.get('assurance-global')!.posted;

    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/cashier/post-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-test-invalid-buy',
          matchId: 'match-1',
          intent: 'buy',
          quantity: '1',
          buyerVaId: 'va-funding-user-001',
          sellerVaId: 'va-funding-user-456',
          unitPrice: '1000000',
          fees: { issuance: false, liquidity: false },
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('invalid_buy_batch');
      expect(state.virtualAccounts.get('assurance-global')!.posted).toBe(assuranceBefore);
    });
  });

  it('accepts treasury issuance buy and credits assurance from treasury flow', async () => {
    const state = seedTest();
    state.useStrictCashierPostBatch = true;
    const buyer = state.virtualAccounts.get('va-funding-user-001')!;
    buyer.posted = 2_000_000n;
    const app = mountCashier(state);
    const assuranceBefore = state.virtualAccounts.get('assurance-global')!.posted;

    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/cashier/post-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-test-valid-buy',
          matchId: 'match-2',
          intent: 'buy',
          quantity: '1',
          buyerVaId: 'va-funding-user-001',
          sellerVaId: 'treasury-100',
          unitPrice: '1000000',
          fees: { issuance: true, liquidity: false },
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { tbBatchId?: string };
      expect(json.tbBatchId).toBeDefined();
      expect(state.virtualAccounts.get('assurance-global')!.posted).toBe(assuranceBefore + 1_000_000n);
    });
  });
});
