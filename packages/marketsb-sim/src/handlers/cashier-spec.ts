// ── Cashier service spec routes (additive to legacy sim API) ──

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';
import type { CashierAccount, CashierSystemUser } from '../cashier-types.js';
import { formatBaseUnitsToUsd, parsePercentToBps, parseUsdToBaseUnits } from '../cashier-money.js';
import {
  CashierEngineError,
  creditAccount,
  debitAccount,
  executeList,
  executeRedeem,
  executeTrade,
  getAccountBalance,
  transferAccounts,
} from '../cashier-engine.js';
let accountSeq = 0;

function nowIso() {
  return new Date().toISOString();
}

function toTxResponse(tx: { transactionId: string; type: string; state: string }) {
  return { transactionId: tx.transactionId, type: tx.type, state: tx.state };
}

function toAccountDTO(a: CashierAccount) {
  return {
    accountId: a.accountId,
    ownerId: a.ownerId,
    accountType: a.accountType,
    name: a.name,
    parentAccountId: a.parentAccountId,
    state: a.state,
    currency: a.currency,
    metadata: a.metadata,
  };
}

function toUserDTO(u: CashierSystemUser) {
  return {
    userId: u.userId,
    displayName: u.displayName,
    metadata: u.metadata,
    state: u.state,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export function createCashierSpecRouter(state: SimState): Router {
  const router = Router();

  // ── GET /agentContext ───────────────────────────────────────────────
  router.get('/agentContext', (_req: Request, res: Response) => {
    const c = state.cashier;
    res.json({
      service: 'Cashier',
      purpose:
        'Financial transaction service for the marketplace. Handles account lifecycle, fee routing, transaction execution, oracle recording, and receipt generation.',
      accountModel: {
        masterAccounts: ['incoming', 'market', 'outgoing', 'operating'],
        systemSubAccounts: ['assurance', 'listingFee', 'liquidityFee'],
      },
      ownershipModel: {
        marketMakerUser: ['assurance', 'liquidityFee'],
        marketplaceOperatorUser: ['listingFee', 'oracleKey'],
      },
      fees: c
        ? {
            listingFee: formatBaseUnitsToUsd(c.listingFeeBaseUnits),
            liquidityFeePercent: (Number(c.liquidityFeeBps) / 100).toFixed(2),
          }
        : { listingFee: '50.00', liquidityFeePercent: '1.00' },
      transactionTypes: {
        trade: {
          sender: 'buyer',
          receiver: 'seller',
          fee: 'none',
          effects: ['oracleEntry', 'receipt'],
        },
        list: {
          sender: 'seller',
          receiver: 'listingFeeSubAccount',
          fee: 'fixed listing fee',
          effects: ['oracleEntry', 'receipt'],
        },
        redeem: {
          partA: {
            sender: 'seller',
            receiver: 'liquidityFeeSubAccount',
            fee: 'liquidity fee',
          },
          partB: {
            sender: 'assuranceSubAccount',
            receiver: 'seller',
            fee: 'none',
          },
          effects: ['oracleEntry', 'receipt'],
        },
      },
      accountStates: ['PENDING', 'ACTIVE', 'DISABLED', 'SUSPENDED'],
      transactionStates: ['CREATED', 'VALIDATED', 'POSTED', 'RECORDED', 'RECEIPTED', 'FAILED', 'REVERSED'],
      policies: {
        accountDeletion: 'not allowed',
        disableInsteadOfDelete: true,
        redeemAtomicity: true,
      },
      simNotes: {
        currency: 'USD strings map to USDC 6-decimal base units internally',
        legacyBatch: 'POST /api/v1/cashier/post-batch remains for Species pipeline',
        speciesSim:
          '@species/sim orchestrates buy/sell/transfer and calls post-batch at payment.confirmed. Run alongside this service; point Species at this API base (MARKETSB_URL / marketsbUrl). Companion context: GET {SPECIES_URL}/marketplace/v1/agentContext for pipeline stages, WebSocket channels, vaults, and VA mapping.',
      },
    });
  });

  // ── POST /cashier/initialize ────────────────────────────────────────
  router.post('/cashier/initialize', (req: Request, res: Response) => {
    try {
      if (state.cashier?.initialized) {
        res.json({ status: 'already_initialized' });
        return;
      }
      const b = req.body;
      const listingFeeBaseUnits = parseUsdToBaseUnits(b.listingFee ?? '50.00');
      const liquidityFeeBps = parsePercentToBps(b.liquidityFeePercent ?? '1.00');
      const ts = nowIso();
      state.cashier = {
        initialized: true,
        adminUsername: String(b.adminUsername ?? 'admin'),
        adminPassword: String(b.adminPassword ?? ''),
        marketMakerUserId: String(b.marketMakerUserId ?? 'user-market-maker'),
        marketplaceOperatorUserId: String(b.marketplaceOperatorUserId ?? 'user-marketplace-operator'),
        listingFeeBaseUnits,
        liquidityFeeBps,
        oracleKeyRef: String(b.oracleKeyRef ?? 'oracle-key'),
        effectiveAt: ts,
      };
      res.json({ status: 'initialized' });
    } catch (e) {
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  // ── GET /cashier/config ────────────────────────────────────────────
  router.get('/cashier/config', (_req: Request, res: Response) => {
    if (!state.cashier?.initialized) {
      res.status(400).json({ code: 'not_initialized', message: 'Call POST /cashier/initialize first' });
      return;
    }
    const c = state.cashier;
    res.json(
      serializeBigints({
        listingFee: formatBaseUnitsToUsd(c.listingFeeBaseUnits),
        liquidityFeePercent: (Number(c.liquidityFeeBps) / 100).toFixed(2),
        currency: 'USD',
        effectiveAt: c.effectiveAt,
        marketMakerUserId: c.marketMakerUserId,
        marketplaceOperatorUserId: c.marketplaceOperatorUserId,
        oracleKeyRef: c.oracleKeyRef,
      }),
    );
  });

  // ── PATCH /cashier/config/fees ──────────────────────────────────────
  router.patch('/cashier/config/fees', (req: Request, res: Response) => {
    if (!state.cashier?.initialized) {
      res.status(400).json({ code: 'not_initialized', message: 'Cashier not initialized' });
      return;
    }
    try {
      const b = req.body;
      if (b.listingFee !== undefined) {
        state.cashier.listingFeeBaseUnits = parseUsdToBaseUnits(String(b.listingFee));
      }
      if (b.liquidityFeePercent !== undefined) {
        state.cashier.liquidityFeeBps = parsePercentToBps(String(b.liquidityFeePercent));
      }
      state.cashier.effectiveAt = nowIso();
      res.json(
        serializeBigints({
          listingFee: formatBaseUnitsToUsd(state.cashier.listingFeeBaseUnits),
          liquidityFeePercent: (Number(state.cashier.liquidityFeeBps) / 100).toFixed(2),
          currency: 'USD',
          effectiveAt: state.cashier.effectiveAt,
        }),
      );
    } catch (e) {
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  // ── POST /accounts/transfer (before :accountId routes) ──────────────
  router.post('/accounts/transfer', (req: Request, res: Response) => {
    try {
      const { senderAccountId, receiverAccountId, amount, currency, reason } = req.body;
      if (!senderAccountId || !receiverAccountId || amount === undefined) {
        res.status(400).json({ code: 'bad_request', message: 'senderAccountId, receiverAccountId, amount required' });
        return;
      }
      transferAccounts(state, senderAccountId, receiverAccountId, String(amount), String(reason ?? 'transfer'));
      res.json({ status: 'ok' });
    } catch (e) {
      if (e instanceof CashierEngineError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      res.status(500).json({ code: 'error', message: String(e) });
    }
  });

  // ── POST /accounts ──────────────────────────────────────────────────
  router.post('/accounts', (req: Request, res: Response) => {
    try {
      if (!state.cashier?.initialized) {
        res.status(400).json({ code: 'not_initialized', message: 'Cashier not initialized' });
        return;
      }
      const b = req.body;
      if (!b.ownerId || !b.accountType || !b.name) {
        res.status(400).json({ code: 'bad_request', message: 'ownerId, accountType, name required' });
        return;
      }
      accountSeq++;
      const accountId = `acc-${String(accountSeq).padStart(6, '0')}`;
      if (state.cashierAccounts.has(accountId)) {
        res.status(409).json({ code: 'conflict', message: 'Account id collision' });
        return;
      }
      const ts = nowIso();
      const vaId = b.metadata?.vaId as string | undefined;
      if (!vaId || typeof vaId !== 'string' || !state.virtualAccounts.has(vaId)) {
        res.status(400).json({ code: 'bad_request', message: 'metadata.vaId must reference an existing virtual account' });
        return;
      }
      const acc: CashierAccount = {
        accountId,
        ownerId: String(b.ownerId),
        accountType: b.accountType === 'MASTER' ? 'MASTER' : 'SUBACCOUNT',
        name: String(b.name),
        parentAccountId: b.parentAccountId ?? null,
        state: 'ACTIVE',
        currency: String(b.currency ?? 'USD'),
        metadata: (b.metadata as Record<string, unknown>) ?? {},
        balanceRef: { kind: 'virtualAccount', vaId },
        createdAt: ts,
        updatedAt: ts,
      };
      state.cashierAccounts.set(accountId, acc);
      res.status(201).json({ accountId, state: 'ACTIVE' });
    } catch (e) {
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  // ── GET /accounts ───────────────────────────────────────────────────
  router.get('/accounts', (req: Request, res: Response) => {
    let list = [...state.cashierAccounts.values()];
    const q = req.query;
    if (q.ownerId) list = list.filter((a) => a.ownerId === q.ownerId);
    if (q.accountType) list = list.filter((a) => a.accountType === q.accountType);
    if (q.state) list = list.filter((a) => a.state === q.state);
    if (q.parentAccountId) list = list.filter((a) => a.parentAccountId === q.parentAccountId);
    if (q.name) list = list.filter((a) => a.name === q.name);
    res.json(serializeBigints(list.map(toAccountDTO)));
  });

  // ── GET /accounts/:accountId/balance ────────────────────────────────
  router.get('/accounts/:accountId/balance', (req: Request, res: Response) => {
    const acc = state.cashierAccounts.get(String(req.params.accountId));
    if (!acc) {
      res.status(404).json({ code: 'not_found', message: 'Account not found' });
      return;
    }
    const bal = getAccountBalance(state, acc);
    res.json(
      serializeBigints({
        accountId: acc.accountId,
        balance: formatBaseUnitsToUsd(bal),
        balanceBaseUnits: bal,
        currency: acc.currency,
      }),
    );
  });

  // ── GET /accounts/:accountId/transactions ───────────────────────────
  router.get('/accounts/:accountId/transactions', (req: Request, res: Response) => {
    const id = String(req.params.accountId);
    const txs = [...state.cashierTransactions.values()].filter(
      (t) => t.senderAccountId === id || t.receiverAccountId === id,
    );
    res.json(serializeBigints(txs));
  });

  router.post('/accounts/:accountId/credit', (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      if (amount === undefined) {
        res.status(400).json({ code: 'bad_request', message: 'amount required' });
        return;
      }
      const r = creditAccount(state, String(req.params.accountId), String(amount));
      res.json(serializeBigints({ ...r, formatted: formatBaseUnitsToUsd(r.newBalance) }));
    } catch (e) {
      if (e instanceof CashierEngineError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  router.post('/accounts/:accountId/debit', (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      if (amount === undefined) {
        res.status(400).json({ code: 'bad_request', message: 'amount required' });
        return;
      }
      const r = debitAccount(state, String(req.params.accountId), String(amount));
      res.json(serializeBigints({ ...r, formatted: formatBaseUnitsToUsd(r.newBalance) }));
    } catch (e) {
      if (e instanceof CashierEngineError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  router.post('/accounts/:accountId/disable', (req: Request, res: Response) => {
    const acc = state.cashierAccounts.get(String(req.params.accountId));
    if (!acc) {
      res.status(404).json({ code: 'not_found', message: 'Account not found' });
      return;
    }
    acc.state = 'DISABLED';
    acc.updatedAt = nowIso();
    res.json({ accountId: acc.accountId, state: 'DISABLED' });
  });

  router.post('/accounts/:accountId/enable', (req: Request, res: Response) => {
    const acc = state.cashierAccounts.get(String(req.params.accountId));
    if (!acc) {
      res.status(404).json({ code: 'not_found', message: 'Account not found' });
      return;
    }
    acc.state = 'ACTIVE';
    acc.updatedAt = nowIso();
    res.json({ accountId: acc.accountId, state: 'ACTIVE' });
  });

  router.patch('/accounts/:accountId', (req: Request, res: Response) => {
    const acc = state.cashierAccounts.get(String(req.params.accountId));
    if (!acc) {
      res.status(404).json({ code: 'not_found', message: 'Account not found' });
      return;
    }
    const b = req.body;
    if (b.metadata) acc.metadata = { ...acc.metadata, ...b.metadata };
    if (b.name) acc.name = String(b.name);
    acc.updatedAt = nowIso();
    res.json(toAccountDTO(acc));
  });

  router.get('/accounts/:accountId', (req: Request, res: Response) => {
    const acc = state.cashierAccounts.get(String(req.params.accountId));
    if (!acc) {
      res.status(404).json({ code: 'not_found', message: 'Account not found' });
      return;
    }
    res.json(toAccountDTO(acc));
  });

  // ── Transactions ───────────────────────────────────────────────────
  router.post('/transactions/trade', (req: Request, res: Response) => {
    try {
      const tx = executeTrade(state, {
        senderAccountId: req.body.senderAccountId,
        receiverAccountId: req.body.receiverAccountId,
        amountStr: String(req.body.amount),
        currency: String(req.body.currency ?? 'USD'),
        metadata: req.body.metadata,
        idempotencyKey: req.body.idempotencyKey,
      });
      res.json(serializeBigints(toTxResponse(tx)));
    } catch (e) {
      if (e instanceof CashierEngineError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  router.post('/transactions/list', (req: Request, res: Response) => {
    try {
      const tx = executeList(state, {
        senderAccountId: req.body.senderAccountId,
        receiverAccountId: req.body.receiverAccountId,
        amountStr: req.body.amount !== undefined ? String(req.body.amount) : undefined,
        currency: String(req.body.currency ?? 'USD'),
        metadata: req.body.metadata,
        idempotencyKey: req.body.idempotencyKey,
      });
      res.json(serializeBigints(toTxResponse(tx)));
    } catch (e) {
      if (e instanceof CashierEngineError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  router.post('/transactions/redeem', (req: Request, res: Response) => {
    try {
      const { feeTx, payoutTx, redeemGroupId } = executeRedeem(state, {
        sellerAccountId: req.body.sellerAccountId,
        liquidityFeeSubAccountId: req.body.liquidityFeeSubAccountId,
        assuranceSubAccountId: req.body.assuranceSubAccountId,
        redeemAmountStr: String(req.body.redeemAmount),
        currency: String(req.body.currency ?? 'USD'),
        liquidityFeeAmountStr:
          req.body.liquidityFeeAmount !== undefined ? String(req.body.liquidityFeeAmount) : undefined,
        metadata: req.body.metadata,
        idempotencyKey: req.body.idempotencyKey,
      });
      res.json(
        serializeBigints({
          redeemId: redeemGroupId,
          feeTransactionId: feeTx.transactionId,
          payoutTransactionId: payoutTx.transactionId,
          state: 'RECEIPTED',
        }),
      );
    } catch (e) {
      if (e instanceof CashierEngineError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      res.status(400).json({ code: 'bad_request', message: String(e) });
    }
  });

  router.get('/transactions/:transactionId', (req: Request, res: Response) => {
    const tx = state.cashierTransactions.get(String(req.params.transactionId));
    if (!tx) {
      res.status(404).json({ code: 'not_found', message: 'Transaction not found' });
      return;
    }
    res.json(
      serializeBigints({
        ...tx,
        amount: formatBaseUnitsToUsd(tx.amount),
        feeAmount: formatBaseUnitsToUsd(tx.feeAmount),
      }),
    );
  });

  router.get('/transactions', (req: Request, res: Response) => {
    let list = [...state.cashierTransactions.values()];
    const q = req.query;
    if (q.type) list = list.filter((t) => t.type === q.type);
    if (q.state) list = list.filter((t) => t.state === q.state);
    if (q.senderAccountId) list = list.filter((t) => t.senderAccountId === q.senderAccountId);
    if (q.receiverAccountId) list = list.filter((t) => t.receiverAccountId === q.receiverAccountId);
    res.json(
      serializeBigints(
        list.map((t) => ({
          ...t,
          amount: formatBaseUnitsToUsd(t.amount),
          feeAmount: formatBaseUnitsToUsd(t.feeAmount),
        })),
      ),
    );
  });

  // ── Receipts ────────────────────────────────────────────────────────
  router.post('/receipts', (req: Request, res: Response) => {
    const { transactionId } = req.body;
    if (!transactionId) {
      res.status(400).json({ code: 'bad_request', message: 'transactionId required' });
      return;
    }
    const existing = [...state.cashierReceipts.values()].find((r) => r.transactionId === transactionId);
    if (existing) {
      res.json(existing);
      return;
    }
    if (!state.cashierTransactions.has(transactionId)) {
      res.status(404).json({ code: 'not_found', message: 'Transaction not found' });
      return;
    }
    res.status(404).json({ code: 'not_found', message: 'Receipt not found; receipts are created with transactions' });
  });

  router.get('/receipts/:receiptId', (req: Request, res: Response) => {
    const r = state.cashierReceipts.get(String(req.params.receiptId));
    if (!r) {
      res.status(404).json({ code: 'not_found', message: 'Receipt not found' });
      return;
    }
    res.json(r);
  });

  router.get('/receipts', (req: Request, res: Response) => {
    let list = [...state.cashierReceipts.values()];
    if (req.query.transactionId) {
      list = list.filter((r) => r.transactionId === req.query.transactionId);
    }
    if (req.query.state) {
      list = list.filter((r) => r.state === req.query.state);
    }
    res.json(list);
  });

  // ── System users (minimal) ──────────────────────────────────────────
  router.post('/system-users', (req: Request, res: Response) => {
    const b = req.body;
    const userId = String(b.userId ?? `su-${Date.now()}`);
    const ts = nowIso();
    const u: CashierSystemUser = {
      userId,
      displayName: String(b.displayName ?? userId),
      metadata: (b.metadata as Record<string, unknown>) ?? {},
      state: 'ACTIVE',
      createdAt: ts,
      updatedAt: ts,
    };
    state.cashierSystemUsers.set(userId, u);
    res.status(201).json(toUserDTO(u));
  });

  router.get('/system-users/:userId', (req: Request, res: Response) => {
    const u = state.cashierSystemUsers.get(String(req.params.userId));
    if (!u) {
      res.status(404).json({ code: 'not_found', message: 'User not found' });
      return;
    }
    res.json(toUserDTO(u));
  });

  router.patch('/system-users/:userId', (req: Request, res: Response) => {
    const u = state.cashierSystemUsers.get(String(req.params.userId));
    if (!u) {
      res.status(404).json({ code: 'not_found', message: 'User not found' });
      return;
    }
    if (req.body.displayName) u.displayName = String(req.body.displayName);
    if (req.body.metadata) u.metadata = { ...u.metadata, ...req.body.metadata };
    u.updatedAt = nowIso();
    res.json(toUserDTO(u));
  });

  // ── Audit ───────────────────────────────────────────────────────────
  router.get('/audit/events', (req: Request, res: Response) => {
    let ev = [...state.auditEvents];
    if (req.query.type) ev = ev.filter((e) => e.type === req.query.type);
    res.json(ev);
  });

  router.get('/audit/events/:eventId', (req: Request, res: Response) => {
    const e = state.auditEvents.find((x) => x.eventId === String(req.params.eventId));
    if (!e) {
      res.status(404).json({ code: 'not_found', message: 'Event not found' });
      return;
    }
    res.json(e);
  });

  return router;
}
