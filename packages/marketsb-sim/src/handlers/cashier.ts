// ── Cashier handler ── THE CRITICAL ENDPOINT
// POST /cashier/post-batch → BatchResultDTO

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';

interface BatchTransfer {
  type: string;
  debit: string;
  credit: string;
  amount: bigint;
}

function applyTransferLegacy(state: SimState, debit: string, credit: string, amount: bigint, now: string): void {
  const debitVa = state.virtualAccounts.get(debit);
  const creditVa = state.virtualAccounts.get(credit);
  if (debitVa) {
    debitVa.posted -= amount;
    debitVa.updatedAt = now;
  }
  if (creditVa) {
    creditVa.posted += amount;
    creditVa.updatedAt = now;
  }
}

function applyTransferStrict(
  state: SimState,
  debit: string,
  credit: string,
  amount: bigint,
  now: string,
): { ok: true } | { ok: false; message: string } {
  const debitVa = state.virtualAccounts.get(debit);
  const creditVa = state.virtualAccounts.get(credit);
  if (!debitVa || !creditVa) {
    return { ok: false, message: `Missing VA debit=${debit} credit=${credit}` };
  }
  if (debitVa.posted < amount) {
    return { ok: false, message: `Insufficient funds on ${debit}` };
  }
  debitVa.posted -= amount;
  debitVa.updatedAt = now;
  creditVa.posted += amount;
  creditVa.updatedAt = now;
  return { ok: true };
}

function writeOracleEntry(
  state: SimState,
  vaId: string,
  type: string,
  amount: bigint,
  balanceBefore: bigint,
  balanceAfter: bigint,
  ref: string,
  now: string,
): void {
  if (!state.virtualAccounts.has(vaId)) return;
  const entries = state.oracleLog.get(vaId) ?? [];
  entries.push({
    entryId: `fo-${ref}-${type}-${entries.length}`,
    vaId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    ref,
    timestamp: now,
  });
  state.oracleLog.set(vaId, entries);
}

let batchCounter = 0;

export function createCashierRouter(state: SimState): Router {
  const router = Router();

  router.post('/post-batch', (req: Request, res: Response) => {
    if (state.errorInjections.get('cashier')) {
      state.errorInjections.delete('cashier');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on cashier' });
      return;
    }

    const { eventId, matchId, intent, quantity, buyerVaId, sellerVaId, unitPrice, fees } = req.body;

    if (!eventId || !matchId || !intent || quantity === undefined || !buyerVaId || !unitPrice) {
      res.status(400).json({ code: 'bad_request', message: 'Missing required batch fields' });
      return;
    }

    const idempKey = `${eventId}:${matchId}`;
    if (state.idempotencyKeys.has(idempKey)) {
      const existing = state.idempotencyKeys.get(idempKey);
      res.status(200).json(serializeBigints(existing));
      return;
    }

    const quantityBig = BigInt(quantity);
    const unitPriceBig = BigInt(unitPrice);
    const assetCost = quantityBig * unitPriceBig;
    const issuanceFee = fees?.issuance ? quantityBig * 50_000n : 0n; // $0.05/Specie
    // Use configured liquidity fee rate (default 100 bps = 1%) — not hardcoded
    const liquidityBps = state.cashier?.liquidityFeeBps ?? 100n;
    const liquidityFee = fees?.liquidity ? (assetCost * liquidityBps) / 10_000n : 0n;

    const now = new Date().toISOString();
    batchCounter++;
    const tbBatchId = `tb-batch-${String(batchCounter).padStart(6, '0')}`;
    const transfers: BatchTransfer[] = [];
    const oracleRefs: string[] = [];
    const strict = state.useStrictCashierPostBatch;

    const apply = (debit: string, credit: string, amount: bigint): string | null => {
      if (strict) {
        const r = applyTransferStrict(state, debit, credit, amount, now);
        if (!r.ok) return r.message;
      } else {
        applyTransferLegacy(state, debit, credit, amount, now);
      }
      return null;
    };

    if (intent === 'buy') {
      const buyerVa = state.virtualAccounts.get(buyerVaId);
      if (!buyerVa) {
        res.status(404).json({ code: 'not_found', message: `Buyer VA ${buyerVaId} not found` });
        return;
      }
      const totalDebit = assetCost + issuanceFee + liquidityFee;
      if (buyerVa.posted < totalDebit) {
        res.status(409).json({
          code: 'insufficient_funds',
          message: `Buyer insufficient balance: have ${buyerVa.posted}, need ${totalDebit}`,
        });
        return;
      }

      // Route assurance proceeds to GLOBAL assurance VA (not per-user)
      // This ensures cashierRedeem (which reads acc-sub-assurance → assurance-global) can pay
      const assuranceVaId = 'assurance-global';
      const creditTreasury = sellerVaId || 'treasury-100';

      const run = (): string | null => {
        let err: string | null;

        const bb0 = buyerVa.posted;
        err = apply(buyerVaId, creditTreasury, assetCost);
        if (err) return err;
        writeOracleEntry(state, buyerVaId, 'batch_buy_cost', assetCost, bb0, buyerVa.posted, tbBatchId, now);

        if (issuanceFee > 0n) {
          const bb = buyerVa.posted;
          err = apply(buyerVaId, 'operating-300', issuanceFee);
          if (err) return err;
          writeOracleEntry(state, buyerVaId, 'batch_issuance_fee', issuanceFee, bb, buyerVa.posted, tbBatchId, now);
        }
        if (liquidityFee > 0n) {
          const bb = buyerVa.posted;
          err = apply(buyerVaId, 'operating-300', liquidityFee);
          if (err) return err;
          writeOracleEntry(state, buyerVaId, 'batch_liquidity_fee', liquidityFee, bb, buyerVa.posted, tbBatchId, now);
        }

        const treasury = state.virtualAccounts.get('treasury-100');
        const assurance = state.virtualAccounts.get(assuranceVaId);
        if (treasury && assurance) {
          const tb = treasury.posted;
          err = apply('treasury-100', assuranceVaId, assetCost);
          if (err) return err;
          writeOracleEntry(state, 'treasury-100', 'batch_treasury_to_assurance', assetCost, tb, treasury.posted, tbBatchId, now);
          writeOracleEntry(
            state,
            assuranceVaId,
            'batch_assurance_credit',
            assetCost,
            assurance.posted - assetCost,
            assurance.posted,
            tbBatchId,
            now,
          );
        } else {
          err = apply('treasury-100', assuranceVaId, assetCost);
          if (err) return err;
        }

        transfers.push({ type: 'asset_cost', debit: buyerVaId, credit: creditTreasury, amount: assetCost });
        if (issuanceFee > 0n) {
          transfers.push({ type: 'issuance_fee', debit: buyerVaId, credit: 'operating-300', amount: issuanceFee });
        }
        if (liquidityFee > 0n) {
          transfers.push({ type: 'liquidity_fee', debit: buyerVaId, credit: 'operating-300', amount: liquidityFee });
        }
        transfers.push({ type: 'assurance_posting', debit: 'treasury-100', credit: assuranceVaId, amount: assetCost });

        const refBase = `${tbBatchId}-buy`;
        oracleRefs.push(`${refBase}-a`, `${refBase}-b`, `${refBase}-c`);
        return null;
      };

      const fail = run();
      if (fail) {
        res.status(500).json({ code: 'posting_failed', message: fail });
        return;
      }
    } else if (intent === 'sell') {
      const buyerVa = state.virtualAccounts.get(buyerVaId);
      if (!buyerVa) {
        res.status(404).json({ code: 'not_found', message: `Buyer VA ${buyerVaId} not found` });
        return;
      }
      const totalBuyerDebit = assetCost + liquidityFee;
      if (buyerVa.posted < totalBuyerDebit) {
        res.status(409).json({
          code: 'insufficient_funds',
          message: `Buyer insufficient balance: have ${buyerVa.posted}, need ${totalBuyerDebit}`,
        });
        return;
      }

      const effectiveSellerVaId = sellerVaId || 'treasury-100';

      const run = (): string | null => {
        let err: string | null;

        const bbStart = buyerVa.posted;
        err = apply(buyerVaId, effectiveSellerVaId, assetCost);
        if (err) return err;

        if (liquidityFee > 0n) {
          err = apply(buyerVaId, 'operating-300', liquidityFee);
          if (err) return err;
        }

        writeOracleEntry(
          state,
          buyerVaId,
          'cashier_sell_debit',
          totalBuyerDebit,
          bbStart,
          buyerVa.posted,
          tbBatchId,
          now,
        );

        const sellerFunding = state.virtualAccounts.get(effectiveSellerVaId);
        if (sellerFunding) {
          const sb = sellerFunding.posted - assetCost;
          writeOracleEntry(
            state,
            effectiveSellerVaId,
            'cashier_sell_credit',
            assetCost,
            sb,
            sellerFunding.posted,
            tbBatchId,
            now,
          );
        }

        transfers.push({ type: 'asset_cost', debit: buyerVaId, credit: effectiveSellerVaId, amount: assetCost });
        if (liquidityFee > 0n) {
          transfers.push({ type: 'liquidity_fee', debit: buyerVaId, credit: 'operating-300', amount: liquidityFee });
        }

        const refBase = `${tbBatchId}-sell`;
        oracleRefs.push(`${refBase}-a`, `${refBase}-b`);
        return null;
      };

      const fail = run();
      if (fail) {
        res.status(500).json({ code: 'posting_failed', message: fail });
        return;
      }
    } else {
      res.status(400).json({ code: 'bad_request', message: `Unknown intent: ${intent}` });
      return;
    }

    const totalDebited = transfers.filter((t) => t.debit === buyerVaId).reduce((sum, t) => sum + t.amount, 0n);

    const result = {
      tbBatchId,
      transfers: transfers.map((t) => ({
        type: t.type,
        debit: t.debit,
        credit: t.credit,
        amount: t.amount,
      })),
      totalDebited,
      oracleRefs,
      idempotencyKey: idempKey,
      postedAt: now,
    };

    state.idempotencyKeys.set(idempKey, result);
    res.status(200).json(serializeBigints(result));
  });

  return router;
}
