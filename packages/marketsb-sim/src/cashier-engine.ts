// ── Cashier spec transaction engine (atomic posting, oracle, receipts) ──

import type { SimState, OracleEntry } from './state.js';
import type {
  CashierAccount,
  CashierOracleEntry,
  CashierReceipt,
  CashierTransaction,
  CashierTxState,
  CashierTxType,
} from './cashier-types.js';
import { formatBaseUnitsToUsd, parseUsdToBaseUnits } from './cashier-money.js';
import { CASHIER_SUB_IDS } from './cashier-bootstrap.js';
import { CASHIER_VA } from './cashier-types.js';

function isListingFeeAccount(a: CashierAccount): boolean {
  return (
    a.accountId === CASHIER_SUB_IDS.listingFee ||
    (a.balanceRef.kind === 'virtualAccount' && a.balanceRef.vaId === CASHIER_VA.listingFee)
  );
}

function isLiquidityFeeAccount(a: CashierAccount): boolean {
  return (
    a.accountId === CASHIER_SUB_IDS.liquidityFee ||
    (a.balanceRef.kind === 'virtualAccount' && a.balanceRef.vaId === CASHIER_VA.liquidityFee)
  );
}

function isAssuranceAccount(a: CashierAccount): boolean {
  return (
    a.accountId === CASHIER_SUB_IDS.assurance ||
    (a.balanceRef.kind === 'virtualAccount' && a.balanceRef.vaId === CASHIER_VA.assurancePool)
  );
}

export class CashierEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'CashierEngineError';
  }
}

let txSeq = 0;
let redeemGroupSeq = 0;
let rcSeq = 0;
let oracleSeq = 0;
let auditSeq = 0;

export function resetCashierEngineCounters(): void {
  txSeq = redeemGroupSeq = rcSeq = oracleSeq = auditSeq = 0;
}

function nowIso() {
  return new Date().toISOString();
}

function appendAudit(state: SimState, type: string, detail: Record<string, unknown>): void {
  auditSeq++;
  state.auditEvents.push({
    eventId: `audit-${String(auditSeq).padStart(8, '0')}`,
    type,
    detail,
    createdAt: nowIso(),
  });
}

export function getAccountBalance(state: SimState, acc: CashierAccount): bigint {
  if (acc.balanceRef.kind === 'systemWallet') {
    return state.systemWallets[acc.balanceRef.wallet];
  }
  const va = state.virtualAccounts.get(acc.balanceRef.vaId);
  if (!va) throw new CashierEngineError(`Missing VA ${acc.balanceRef.vaId}`, 'va_not_found', 500);
  return va.posted;
}

/** Strict transfer: both legs must exist; reverts debit if credit fails. */
export function applyAccountTransfer(
  state: SimState,
  debitAcc: CashierAccount,
  creditAcc: CashierAccount,
  amount: bigint,
  timestamp: string,
): void {
  if (amount <= 0n) {
    throw new CashierEngineError('Amount must be positive', 'invalid_amount');
  }
  if (debitAcc.state !== 'ACTIVE' || creditAcc.state !== 'ACTIVE') {
    throw new CashierEngineError('Account not ACTIVE', 'account_inactive', 409);
  }

  if (getAccountBalance(state, debitAcc) < amount) {
    throw new CashierEngineError('Insufficient funds', 'insufficient_funds', 409);
  }

  if (creditAcc.balanceRef.kind === 'virtualAccount') {
    if (!state.virtualAccounts.has(creditAcc.balanceRef.vaId)) {
      throw new CashierEngineError(`Credit VA missing`, 'va_not_found', 500);
    }
  }

  let debitWalletBefore: bigint | undefined;
  let debitVaBefore: bigint | undefined;
  let debitVaId: string | undefined;

  if (debitAcc.balanceRef.kind === 'systemWallet') {
    const w = debitAcc.balanceRef.wallet;
    debitWalletBefore = state.systemWallets[w];
    state.systemWallets[w] -= amount;
  } else {
    const va = state.virtualAccounts.get(debitAcc.balanceRef.vaId);
    if (!va) throw new CashierEngineError(`Debit VA missing`, 'va_not_found', 500);
    debitVaBefore = va.posted;
    debitVaId = va.vaId;
    va.posted -= amount;
    va.updatedAt = timestamp;
  }

  if (creditAcc.balanceRef.kind === 'systemWallet') {
    const w = creditAcc.balanceRef.wallet;
    state.systemWallets[w] += amount;
  } else {
    const va = state.virtualAccounts.get(creditAcc.balanceRef.vaId);
    if (!va) {
      if (debitAcc.balanceRef.kind === 'systemWallet') {
        state.systemWallets[debitAcc.balanceRef.wallet] = debitWalletBefore!;
      } else if (debitVaId !== undefined && debitVaBefore !== undefined) {
        const dva = state.virtualAccounts.get(debitVaId);
        if (dva) dva.posted = debitVaBefore;
      }
      throw new CashierEngineError(`Credit VA missing`, 'va_not_found', 500);
    }
    va.posted += amount;
    va.updatedAt = timestamp;
  }
}

function appendVaOracle(
  state: SimState,
  vaId: string,
  type: string,
  amount: bigint,
  balanceBefore: bigint,
  balanceAfter: bigint,
  ref: string,
  timestamp: string,
): string {
  const entryId = `fo-${ref}-${type}`;
  const row: OracleEntry = {
    entryId,
    vaId,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    ref,
    timestamp,
  };
  const list = state.oracleLog.get(vaId) ?? [];
  list.push(row);
  state.oracleLog.set(vaId, list);
  return entryId;
}

function createOracleForTransaction(
  state: SimState,
  tx: CashierTransaction,
  debitAcc: CashierAccount,
  creditAcc: CashierAccount,
  amount: bigint,
  timestamp: string,
): CashierOracleEntry {
  oracleSeq++;
  const oracleEntryId = `co-${String(oracleSeq).padStart(8, '0')}`;

  let vaId: string | undefined;
  let linkedId: string | undefined;

  if (debitAcc.balanceRef.kind === 'virtualAccount') {
    const va = state.virtualAccounts.get(debitAcc.balanceRef.vaId)!;
    const before = va.posted + amount;
    const after = va.posted;
    linkedId = appendVaOracle(
      state,
      debitAcc.balanceRef.vaId,
      `cashier_${tx.type.toLowerCase()}_debit`,
      amount,
      before,
      after,
      tx.transactionId,
      timestamp,
    );
    vaId = debitAcc.balanceRef.vaId;
  } else if (creditAcc.balanceRef.kind === 'virtualAccount') {
    const va = state.virtualAccounts.get(creditAcc.balanceRef.vaId)!;
    const before = va.posted - amount;
    const after = va.posted;
    linkedId = appendVaOracle(
      state,
      creditAcc.balanceRef.vaId,
      `cashier_${tx.type.toLowerCase()}_credit`,
      amount,
      before,
      after,
      tx.transactionId,
      timestamp,
    );
    vaId = creditAcc.balanceRef.vaId;
  }

  const summary = JSON.stringify({
    transactionId: tx.transactionId,
    type: tx.type,
    amount: formatBaseUnitsToUsd(amount),
    sender: tx.senderAccountId,
    receiver: tx.receiverAccountId,
  });

  const entry: CashierOracleEntry = {
    oracleEntryId,
    transactionId: tx.transactionId,
    state: 'WRITTEN',
    encryptedPayload: Buffer.from(summary).toString('base64'),
    plaintextSummary: summary,
    vaId,
    linkedOracleEntryId: linkedId,
    createdAt: timestamp,
  };
  state.cashierOracleEntries.set(oracleEntryId, entry);
  return entry;
}

function createReceipt(state: SimState, tx: CashierTransaction, timestamp: string): CashierReceipt {
  rcSeq++;
  const receiptId = `rc-${String(rcSeq).padStart(8, '0')}`;
  const r: CashierReceipt = {
    receiptId,
    transactionId: tx.transactionId,
    state: 'DELIVERED',
    receiptNumber: `R-${tx.transactionId}`,
    createdAt: timestamp,
    payload: {
      type: tx.type,
      amount: formatBaseUnitsToUsd(tx.amount),
      feeAmount: formatBaseUnitsToUsd(tx.feeAmount),
      sender: tx.senderAccountId,
      receiver: tx.receiverAccountId,
    },
  };
  state.cashierReceipts.set(receiptId, r);
  return r;
}

function transition(tx: CashierTransaction, state: CashierTxState, ts: string, reason?: string) {
  tx.state = state;
  tx.updatedAt = ts;
  if (reason) tx.failureReason = reason;
}

function requireInitialized(state: SimState): void {
  if (!state.cashier?.initialized) {
    throw new CashierEngineError('Cashier not initialized', 'not_initialized', 400);
  }
}

function nextTxId(): string {
  txSeq++;
  return `ctx-${String(txSeq).padStart(8, '0')}`;
}

export interface TradeInput {
  senderAccountId: string;
  receiverAccountId: string;
  amountStr: string;
  currency: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export function executeTrade(state: SimState, input: TradeInput): CashierTransaction {
  requireInitialized(state);
  const ts = nowIso();
  const idemp = input.idempotencyKey
    ? `cashier:trade:${input.idempotencyKey}`
    : undefined;
  if (idemp && state.cashierIdempotency.has(idemp)) {
    const tid = (state.cashierIdempotency.get(idemp) as { transactionId: string }).transactionId;
    const existing = state.cashierTransactions.get(tid);
    if (existing) return existing;
  }

  const amount = parseUsdToBaseUnits(input.amountStr);
  if (input.currency !== 'USD') {
    throw new CashierEngineError('Only USD supported in sim', 'unsupported_currency');
  }

  const sender = state.cashierAccounts.get(input.senderAccountId);
  const receiver = state.cashierAccounts.get(input.receiverAccountId);
  if (!sender || !receiver) {
    throw new CashierEngineError('Unknown account', 'not_found', 404);
  }

  const tx: CashierTransaction = {
    transactionId: nextTxId(),
    type: 'TRADE',
    state: 'CREATED',
    senderAccountId: sender.accountId,
    receiverAccountId: receiver.accountId,
    amount,
    feeAmount: 0n,
    currency: 'USD',
    createdAt: ts,
    updatedAt: ts,
    metadata: input.metadata ?? {},
  };
  state.cashierTransactions.set(tx.transactionId, tx);
  transition(tx, 'VALIDATED', ts);

  try {
    applyAccountTransfer(state, sender, receiver, amount, ts);
  } catch (e) {
    transition(tx, 'FAILED', nowIso(), e instanceof Error ? e.message : 'failed');
    appendAudit(state, 'transaction.failed', { transactionId: tx.transactionId, type: 'TRADE' });
    throw e;
  }

  transition(tx, 'POSTED', ts);
  createOracleForTransaction(state, tx, sender, receiver, amount, ts);
  transition(tx, 'RECORDED', ts);
  createReceipt(state, tx, ts);
  transition(tx, 'RECEIPTED', ts);

  appendAudit(state, 'transaction.receipted', { transactionId: tx.transactionId, type: 'TRADE' });
  if (idemp) state.cashierIdempotency.set(idemp, { transactionId: tx.transactionId });
  return tx;
}

export interface ListInput {
  senderAccountId: string;
  receiverAccountId: string;
  amountStr?: string;
  currency: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export function executeList(state: SimState, input: ListInput): CashierTransaction {
  requireInitialized(state);
  const ts = nowIso();
  const idemp = input.idempotencyKey
    ? `cashier:list:${input.idempotencyKey}`
    : undefined;
  if (idemp && state.cashierIdempotency.has(idemp)) {
    const tid = (state.cashierIdempotency.get(idemp) as { transactionId: string }).transactionId;
    const existing = state.cashierTransactions.get(tid);
    if (existing) return existing;
  }

  const listingFee = state.cashier!.listingFeeBaseUnits;
  const amount = input.amountStr ? parseUsdToBaseUnits(input.amountStr) : listingFee;
  if (input.currency !== 'USD') {
    throw new CashierEngineError('Only USD supported in sim', 'unsupported_currency');
  }

  const sender = state.cashierAccounts.get(input.senderAccountId);
  const receiver = state.cashierAccounts.get(input.receiverAccountId);
  if (!sender || !receiver) {
    throw new CashierEngineError('Unknown account', 'not_found', 404);
  }
  if (!isListingFeeAccount(receiver)) {
    throw new CashierEngineError('Receiver must be listing fee sub-account', 'invalid_receiver', 400);
  }

  const tx: CashierTransaction = {
    transactionId: nextTxId(),
    type: 'LIST',
    state: 'CREATED',
    senderAccountId: sender.accountId,
    receiverAccountId: receiver.accountId,
    amount,
    feeAmount: 0n,
    currency: 'USD',
    createdAt: ts,
    updatedAt: ts,
    metadata: input.metadata ?? {},
  };
  state.cashierTransactions.set(tx.transactionId, tx);
  transition(tx, 'VALIDATED', ts);

  try {
    applyAccountTransfer(state, sender, receiver, amount, ts);
  } catch (e) {
    transition(tx, 'FAILED', nowIso(), e instanceof Error ? e.message : 'failed');
    appendAudit(state, 'transaction.failed', { transactionId: tx.transactionId, type: 'LIST' });
    throw e;
  }

  transition(tx, 'POSTED', ts);
  createOracleForTransaction(state, tx, sender, receiver, amount, ts);
  transition(tx, 'RECORDED', ts);
  createReceipt(state, tx, ts);
  transition(tx, 'RECEIPTED', ts);

  appendAudit(state, 'transaction.receipted', { transactionId: tx.transactionId, type: 'LIST' });
  if (idemp) state.cashierIdempotency.set(idemp, { transactionId: tx.transactionId });
  return tx;
}

export interface RedeemInput {
  sellerAccountId: string;
  liquidityFeeSubAccountId: string;
  assuranceSubAccountId: string;
  redeemAmountStr: string;
  currency: string;
  liquidityFeeAmountStr?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export function executeRedeem(state: SimState, input: RedeemInput): {
  redeemGroupId: string;
  feeTx: CashierTransaction;
  payoutTx: CashierTransaction;
} {
  requireInitialized(state);
  const ts = nowIso();
  const idemp = input.idempotencyKey
    ? `cashier:redeem:${input.idempotencyKey}`
    : undefined;
  if (idemp && state.cashierIdempotency.has(idemp)) {
    const stored = state.cashierIdempotency.get(idemp) as {
      redeemGroupId: string;
      feeTransactionId: string;
      payoutTransactionId: string;
    };
    return {
      redeemGroupId: stored.redeemGroupId,
      feeTx: state.cashierTransactions.get(stored.feeTransactionId)!,
      payoutTx: state.cashierTransactions.get(stored.payoutTransactionId)!,
    };
  }

  const redeemAmount = parseUsdToBaseUnits(input.redeemAmountStr);
  if (input.currency !== 'USD') {
    throw new CashierEngineError('Only USD supported in sim', 'unsupported_currency');
  }

  const bps = state.cashier!.liquidityFeeBps;
  const computedFee = (redeemAmount * bps) / 10_000n;
  const feeAmt = input.liquidityFeeAmountStr
    ? parseUsdToBaseUnits(input.liquidityFeeAmountStr)
    : computedFee;

  const seller = state.cashierAccounts.get(input.sellerAccountId);
  const liq = state.cashierAccounts.get(input.liquidityFeeSubAccountId);
  const asr = state.cashierAccounts.get(input.assuranceSubAccountId);
  if (!seller || !liq || !asr) {
    throw new CashierEngineError('Unknown account', 'not_found', 404);
  }
  if (!isLiquidityFeeAccount(liq)) {
    throw new CashierEngineError('Invalid liquidity fee account', 'invalid_account', 400);
  }
  if (!isAssuranceAccount(asr)) {
    throw new CashierEngineError('Invalid assurance account', 'invalid_account', 400);
  }

  // Assurance pays full 1:1 (redeemAmount), fee is separately charged from seller
  const payout = redeemAmount;
  if (redeemAmount <= 0n) {
    throw new CashierEngineError('Redeem amount must be positive', 'invalid_amount', 400);
  }

  redeemGroupSeq++;
  const groupId = `rdm-${String(redeemGroupSeq).padStart(8, '0')}`;

  const feeTx: CashierTransaction = {
    transactionId: nextTxId(),
    type: 'REDEEM',
    state: 'CREATED',
    senderAccountId: seller.accountId,
    receiverAccountId: liq.accountId,
    amount: feeAmt,
    feeAmount: feeAmt,
    currency: 'USD',
    createdAt: ts,
    updatedAt: ts,
    metadata: { ...input.metadata, part: 'A' },
    redeemGroupId: groupId,
    redeemRole: 'FEE',
  };

  const payoutTx: CashierTransaction = {
    transactionId: nextTxId(),
    type: 'REDEEM',
    state: 'CREATED',
    senderAccountId: asr.accountId,
    receiverAccountId: seller.accountId,
    amount: payout,
    feeAmount: 0n,
    currency: 'USD',
    createdAt: ts,
    updatedAt: ts,
    metadata: { ...input.metadata, part: 'B' },
    redeemGroupId: groupId,
    redeemRole: 'PAYOUT',
  };

  state.cashierTransactions.set(feeTx.transactionId, feeTx);
  state.cashierTransactions.set(payoutTx.transactionId, payoutTx);

  transition(feeTx, 'VALIDATED', ts);
  transition(payoutTx, 'VALIDATED', ts);

  try {
    applyAccountTransfer(state, seller, liq, feeAmt, ts);
    applyAccountTransfer(state, asr, seller, payout, ts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    transition(feeTx, 'FAILED', nowIso(), msg);
    transition(payoutTx, 'FAILED', nowIso(), msg);
    appendAudit(state, 'transaction.failed', { redeemGroupId: groupId, type: 'REDEEM' });
    throw e;
  }

  transition(feeTx, 'POSTED', ts);
  transition(payoutTx, 'POSTED', ts);

  createOracleForTransaction(state, feeTx, seller, liq, feeAmt, ts);
  transition(feeTx, 'RECORDED', ts);
  createReceipt(state, feeTx, ts);
  transition(feeTx, 'RECEIPTED', ts);

  createOracleForTransaction(state, payoutTx, asr, seller, payout, ts);
  transition(payoutTx, 'RECORDED', ts);
  createReceipt(state, payoutTx, ts);
  transition(payoutTx, 'RECEIPTED', ts);

  appendAudit(state, 'transaction.receipted', { redeemGroupId: groupId, type: 'REDEEM' });

  if (idemp) {
    state.cashierIdempotency.set(idemp, {
      redeemGroupId: groupId,
      feeTransactionId: feeTx.transactionId,
      payoutTransactionId: payoutTx.transactionId,
    });
  }

  return { redeemGroupId: groupId, feeTx, payoutTx };
}

export function creditAccount(
  state: SimState,
  accountId: string,
  amountStr: string,
): { newBalance: bigint } {
  requireInitialized(state);
  const acc = state.cashierAccounts.get(accountId);
  if (!acc) throw new CashierEngineError('Unknown account', 'not_found', 404);
  if (acc.state !== 'ACTIVE') throw new CashierEngineError('Account not ACTIVE', 'account_inactive', 409);
  const amount = parseUsdToBaseUnits(amountStr);
  const ts = nowIso();
  if (acc.balanceRef.kind === 'systemWallet') {
    state.systemWallets[acc.balanceRef.wallet] += amount;
  } else {
    const va = state.virtualAccounts.get(acc.balanceRef.vaId);
    if (!va) throw new CashierEngineError('VA missing', 'va_not_found', 500);
    const before = va.posted;
    va.posted += amount;
    va.updatedAt = ts;
    appendVaOracle(state, va.vaId, 'cashier_admin_credit', amount, before, va.posted, `admin-${accountId}`, ts);
  }
  acc.updatedAt = ts;
  appendAudit(state, 'account.credit', { accountId, amount: amountStr });
  return { newBalance: getAccountBalance(state, acc) };
}

export function debitAccount(
  state: SimState,
  accountId: string,
  amountStr: string,
): { newBalance: bigint } {
  requireInitialized(state);
  const acc = state.cashierAccounts.get(accountId);
  if (!acc) throw new CashierEngineError('Unknown account', 'not_found', 404);
  if (acc.state !== 'ACTIVE') throw new CashierEngineError('Account not ACTIVE', 'account_inactive', 409);
  const amount = parseUsdToBaseUnits(amountStr);
  const ts = nowIso();
  if (acc.balanceRef.kind === 'systemWallet') {
    if (state.systemWallets[acc.balanceRef.wallet] < amount) {
      throw new CashierEngineError('Insufficient funds', 'insufficient_funds', 409);
    }
    state.systemWallets[acc.balanceRef.wallet] -= amount;
  } else {
    const va = state.virtualAccounts.get(acc.balanceRef.vaId);
    if (!va) throw new CashierEngineError('VA missing', 'va_not_found', 500);
    if (va.posted < amount) throw new CashierEngineError('Insufficient funds', 'insufficient_funds', 409);
    const before = va.posted;
    va.posted -= amount;
    va.updatedAt = ts;
    appendVaOracle(state, va.vaId, 'cashier_admin_debit', amount, before, va.posted, `admin-${accountId}`, ts);
  }
  acc.updatedAt = ts;
  appendAudit(state, 'account.debit', { accountId, amount: amountStr });
  return { newBalance: getAccountBalance(state, acc) };
}

export function transferAccounts(
  state: SimState,
  senderAccountId: string,
  receiverAccountId: string,
  amountStr: string,
  reason: string,
): void {
  requireInitialized(state);
  const sender = state.cashierAccounts.get(senderAccountId);
  const receiver = state.cashierAccounts.get(receiverAccountId);
  if (!sender || !receiver) throw new CashierEngineError('Unknown account', 'not_found', 404);
  const amount = parseUsdToBaseUnits(amountStr);
  const ts = nowIso();
  applyAccountTransfer(state, sender, receiver, amount, ts);
  appendAudit(state, 'account.transfer', { senderAccountId, receiverAccountId, amount: amountStr, reason });
}
