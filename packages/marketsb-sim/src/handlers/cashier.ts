// ── Cashier handler ── THE CRITICAL ENDPOINT
// POST /cashier/post-batch → BatchResultDTO
//
// Receives order params from Species pipeline, computes fees using
// bigint integer arithmetic, applies transfers atomically to state.

import { Router, type Request, type Response } from 'express';
import type { SimState } from '../state.js';
import { serializeBigints } from '../state.js';

interface BatchTransfer {
  type: string;
  debit: string;
  credit: string;
  amount: bigint;
}

function applyTransfer(state: SimState, debit: string, credit: string, amount: bigint, now: string): void {
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

function writeOracleEntry(
  state: SimState,
  vaId: string,
  type: string,
  amount: bigint,
  ref: string,
  now: string,
): void {
  const va = state.virtualAccounts.get(vaId);
  if (!va) return;

  const entries = state.oracleLog.get(vaId) ?? [];
  entries.push({
    entryId: `fo-${ref}-${type}`,
    vaId,
    type,
    amount,
    balanceBefore: va.posted, // already updated, but close enough for sim
    balanceAfter: va.posted,
    ref,
    timestamp: now,
  });
  state.oracleLog.set(vaId, entries);
}

let batchCounter = 0;

export function createCashierRouter(state: SimState): Router {
  const router = Router();

  // POST /cashier/post-batch
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

    // Idempotency: eventId:matchId
    const idempKey = `${eventId}:${matchId}`;
    if (state.idempotencyKeys.has(idempKey)) {
      const existing = state.idempotencyKeys.get(idempKey);
      res.status(200).json(serializeBigints(existing));
      return;
    }

    const quantityBig = BigInt(quantity);
    const unitPriceBig = BigInt(unitPrice);
    const assetCost = quantityBig * unitPriceBig;

    // Fee calculation — pure bigint, no floating point
    const issuanceFee = fees?.issuance ? quantityBig * 10_000n : 0n;
    const liquidityFee = fees?.liquidity ? (assetCost * 200n) / 10_000n : 0n;

    const now = new Date().toISOString();
    batchCounter++;
    const tbBatchId = `tb-batch-${String(batchCounter).padStart(6, '0')}`;

    const transfers: BatchTransfer[] = [];
    const oracleRefs: string[] = [];

    if (intent === 'buy') {
      // Validate buyer has enough funds
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

      // Derive species VA from buyer funding VA
      const buyerSpeciesVaId = buyerVaId.replace('funding', 'species');
      // Derive assurance VA — use a global one or buyer-specific
      const assuranceVaId = buyerVaId.replace('funding', 'assurance');

      // 1. Buyer Funding VA → Treasury (asset cost)
      transfers.push({ type: 'asset_cost', debit: buyerVaId, credit: sellerVaId || 'treasury-100', amount: assetCost });
      applyTransfer(state, buyerVaId, sellerVaId || 'treasury-100', assetCost, now);

      // 2. Buyer Funding VA → Operating (issuance fee)
      if (issuanceFee > 0n) {
        transfers.push({ type: 'issuance_fee', debit: buyerVaId, credit: 'operating-300', amount: issuanceFee });
        applyTransfer(state, buyerVaId, 'operating-300', issuanceFee, now);
      }

      // 3. Buyer Funding VA → Operating (liquidity fee)
      if (liquidityFee > 0n) {
        transfers.push({ type: 'liquidity_fee', debit: buyerVaId, credit: 'operating-300', amount: liquidityFee });
        applyTransfer(state, buyerVaId, 'operating-300', liquidityFee, now);
      }

      // 4. Treasury → Assurance VA (assurance posting)
      transfers.push({ type: 'assurance_posting', debit: 'treasury-100', credit: assuranceVaId, amount: assetCost });
      applyTransfer(state, 'treasury-100', assuranceVaId, assetCost, now);

      // 5. Treasury → Buyer Species VA (species credit)
      transfers.push({ type: 'species_credit', debit: 'treasury-100', credit: buyerSpeciesVaId, amount: assetCost });
      applyTransfer(state, 'treasury-100', buyerSpeciesVaId, assetCost, now);

      // Oracle entries
      const refBase = `${tbBatchId}-buy`;
      oracleRefs.push(`${refBase}-a`, `${refBase}-b`, `${refBase}-c`);
      writeOracleEntry(state, buyerVaId, 'cashier_buy_debit', totalDebit, refBase, now);
      writeOracleEntry(state, buyerSpeciesVaId, 'cashier_species_credit', assetCost, refBase, now);
      if (state.virtualAccounts.has(assuranceVaId)) {
        writeOracleEntry(state, assuranceVaId, 'cashier_assurance_posting', assetCost, refBase, now);
      }

    } else if (intent === 'sell') {
      // Sell batch: 3 transfers
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
      const sellerSpeciesVaId = effectiveSellerVaId.replace('funding', 'species');
      const buyerSpeciesVaId = buyerVaId.replace('funding', 'species');

      // 1. Buyer Funding VA → Seller Funding VA (asset cost)
      transfers.push({ type: 'asset_cost', debit: buyerVaId, credit: effectiveSellerVaId, amount: assetCost });
      applyTransfer(state, buyerVaId, effectiveSellerVaId, assetCost, now);

      // 2. Buyer Funding VA → Operating (liquidity fee)
      if (liquidityFee > 0n) {
        transfers.push({ type: 'liquidity_fee', debit: buyerVaId, credit: 'operating-300', amount: liquidityFee });
        applyTransfer(state, buyerVaId, 'operating-300', liquidityFee, now);
      }

      // 3. Seller Species VA → Buyer Species VA (species migration)
      transfers.push({ type: 'species_migration', debit: sellerSpeciesVaId, credit: buyerSpeciesVaId, amount: assetCost });
      applyTransfer(state, sellerSpeciesVaId, buyerSpeciesVaId, assetCost, now);

      const refBase = `${tbBatchId}-sell`;
      oracleRefs.push(`${refBase}-a`, `${refBase}-b`);
      writeOracleEntry(state, buyerVaId, 'cashier_sell_debit', totalBuyerDebit, refBase, now);
      writeOracleEntry(state, effectiveSellerVaId, 'cashier_sell_credit', assetCost, refBase, now);

    } else {
      res.status(400).json({ code: 'bad_request', message: `Unknown intent: ${intent}` });
      return;
    }

    // Compute total debited from buyer
    const totalDebited = transfers
      .filter((t) => t.debit === buyerVaId)
      .reduce((sum, t) => sum + t.amount, 0n);

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
