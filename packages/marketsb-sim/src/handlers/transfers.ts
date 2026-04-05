// ── Transfers handler ──
// POST /transfers → TransferDTO (instant)

import { Router, type Request, type Response } from 'express';
import type { SimState, TransferRecord } from '../state.js';
import { serializeBigints } from '../state.js';

let transferCounter = 0;

function toTransferDTO(t: TransferRecord) {
  return {
    transferId: t.transferId,
    sourceVaId: t.sourceVaId,
    destinationVaId: t.destinationVaId,
    amount: t.amount,
    memo: t.memo,
    idempotencyKey: t.idempotencyKey,
    createdAt: t.createdAt,
  };
}

export function createTransfersRouter(state: SimState): Router {
  const router = Router();

  // POST /transfers
  router.post('/', (req: Request, res: Response) => {
    if (state.errorInjections.get('transfers')) {
      state.errorInjections.delete('transfers');
      res.status(500).json({ code: 'simulated_error', message: 'Injected error on transfers' });
      return;
    }

    const { sourceVaId, destinationVaId, amount, idempotencyKey, memo } = req.body;

    if (!sourceVaId || !destinationVaId || amount === undefined) {
      res.status(400).json({ code: 'bad_request', message: 'sourceVaId, destinationVaId, and amount are required' });
      return;
    }

    // Idempotency check
    if (idempotencyKey && state.idempotencyKeys.has(idempotencyKey)) {
      const existing = state.idempotencyKeys.get(idempotencyKey);
      res.status(200).json(serializeBigints(existing));
      return;
    }

    const sourceVa = state.virtualAccounts.get(sourceVaId);
    if (!sourceVa) {
      res.status(404).json({ code: 'not_found', message: `Source VA ${sourceVaId} not found` });
      return;
    }

    const destVa = state.virtualAccounts.get(destinationVaId);
    if (!destVa) {
      res.status(404).json({ code: 'not_found', message: `Destination VA ${destinationVaId} not found` });
      return;
    }

    const amountBig = BigInt(amount);
    if (sourceVa.posted < amountBig) {
      res.status(409).json({
        code: 'insufficient_funds',
        message: `Insufficient balance: have ${sourceVa.posted}, need ${amountBig}`,
      });
      return;
    }

    const now = new Date().toISOString();
    transferCounter++;
    const transferId = `xfer-${String(transferCounter).padStart(5, '0')}`;

    // Atomic debit/credit
    sourceVa.posted -= amountBig;
    sourceVa.updatedAt = now;
    destVa.posted += amountBig;
    destVa.updatedAt = now;

    const record: TransferRecord = {
      transferId,
      sourceVaId,
      destinationVaId,
      amount: amountBig,
      memo: memo || '',
      idempotencyKey: idempotencyKey || '',
      createdAt: now,
    };

    state.transfers.set(transferId, record);

    // Oracle entries for both VAs
    const sourceEntries = state.oracleLog.get(sourceVaId) ?? [];
    sourceEntries.push({
      entryId: `fo-${transferId}-debit`,
      vaId: sourceVaId,
      type: 'transfer_debit',
      amount: amountBig,
      balanceBefore: sourceVa.posted + amountBig,
      balanceAfter: sourceVa.posted,
      ref: transferId,
      timestamp: now,
    });
    state.oracleLog.set(sourceVaId, sourceEntries);

    const destEntries = state.oracleLog.get(destinationVaId) ?? [];
    destEntries.push({
      entryId: `fo-${transferId}-credit`,
      vaId: destinationVaId,
      type: 'transfer_credit',
      amount: amountBig,
      balanceBefore: destVa.posted - amountBig,
      balanceAfter: destVa.posted,
      ref: transferId,
      timestamp: now,
    });
    state.oracleLog.set(destinationVaId, destEntries);

    const dto = toTransferDTO(record);

    if (idempotencyKey) {
      state.idempotencyKeys.set(idempotencyKey, dto);
    }

    res.status(200).json(serializeBigints(dto));
  });

  return router;
}
