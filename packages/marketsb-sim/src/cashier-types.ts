// ── Cashier spec-aligned types (sim) ──

export type CashierAccountState = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'SUSPENDED';

export type CashierTxType = 'TRADE' | 'LIST' | 'REDEEM';
export type CashierTxState =
  | 'CREATED'
  | 'VALIDATED'
  | 'POSTED'
  | 'RECORDED'
  | 'RECEIPTED'
  | 'FAILED'
  | 'REVERSED';

export type CashierReceiptState = 'PENDING' | 'GENERATED' | 'DELIVERED' | 'FAILED';

export type CashierOracleEntryState = 'PENDING' | 'ENCRYPTED' | 'WRITTEN' | 'VERIFIED' | 'FAILED';

export type SystemWalletId = 'incoming' | 'market' | 'outgoing' | 'operating';

/** Canonical VA ids for cashier sub-accounts (created in seed / bootstrap). */
export const CASHIER_VA = {
  listingFee: 'va-cashier-listing-fee',
  liquidityFee: 'va-cashier-liquidity-fee',
  assurancePool: 'assurance-global',
} as const;

export interface CashierBalanceRef {
  kind: 'systemWallet';
  wallet: SystemWalletId;
}

export interface CashierVaBalanceRef {
  kind: 'virtualAccount';
  vaId: string;
}

export type CashierAccountBalanceRef = CashierBalanceRef | CashierVaBalanceRef;

export interface CashierAccount {
  accountId: string;
  ownerId: string;
  accountType: 'MASTER' | 'SUBACCOUNT';
  name: string;
  parentAccountId: string | null;
  state: CashierAccountState;
  currency: string;
  metadata: Record<string, unknown>;
  balanceRef: CashierAccountBalanceRef;
  createdAt: string;
  updatedAt: string;
}

export interface CashierRuntimeConfig {
  initialized: boolean;
  adminUsername: string;
  adminPassword: string;
  marketMakerUserId: string;
  marketplaceOperatorUserId: string;
  listingFeeBaseUnits: bigint;
  /** Basis points: 100 = 1.00% */
  liquidityFeeBps: bigint;
  oracleKeyRef: string;
  effectiveAt: string;
}

export interface CashierTransaction {
  transactionId: string;
  type: CashierTxType;
  state: CashierTxState;
  senderAccountId: string;
  receiverAccountId: string;
  amount: bigint;
  feeAmount: bigint;
  currency: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  redeemGroupId?: string;
  redeemRole?: 'FEE' | 'PAYOUT';
  failureReason?: string;
}

export interface CashierReceipt {
  receiptId: string;
  transactionId: string;
  state: CashierReceiptState;
  receiptNumber: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface CashierOracleEntry {
  oracleEntryId: string;
  transactionId: string;
  state: CashierOracleEntryState;
  encryptedPayload: string;
  /** Sim-only summary when encrypt is a no-op stub */
  plaintextSummary?: string;
  vaId?: string;
  linkedOracleEntryId?: string;
  createdAt: string;
}

export interface CashierSystemUser {
  userId: string;
  displayName: string;
  metadata: Record<string, unknown>;
  state: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  eventId: string;
  type: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
