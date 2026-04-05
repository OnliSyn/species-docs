/** TigerBeetle account codes */
export const AccountCode = {
  TreasuryReserve: 100,
  SettlementReserve: 200,
  OperatingRevenue: 300,
  PendingDeposit: 400,
  PendingWithdrawal: 450,
  VirtualAccount: 500,
} as const;

export type AccountCode = (typeof AccountCode)[keyof typeof AccountCode];

export type VirtualAccountSubtype = 'funding' | 'species' | 'assurance';

export interface TigerBeetleBalanceDTO {
  account_id: string;
  account_code: AccountCode;
  subtype?: VirtualAccountSubtype;
  /** String because JSON can't represent bigint -- convert with BigInt() */
  posted_balance: string;
  pending_balance: string;
  posted_debits: string;
  posted_credits: string;
}

export interface VirtualAccount {
  id: string;
  owner_ref: string;
  display_name: string;
  subtype: VirtualAccountSubtype;
  deposit_address?: string;
  status: 'active' | 'suspended' | 'closed';
  balance: TigerBeetleBalanceDTO;
  created_at: string;
  updated_at: string;
}

export type DepositStatus = 'detected' | 'awaiting_confirmations' | 'confirmed' | 'credited' | 'failed';

export interface Deposit {
  id: string;
  va_id: string;
  amount: string;
  status: DepositStatus;
  tx_hash?: string;
  confirmations: number;
  required_confirmations: number;
  created_at: string;
  updated_at: string;
}

export type WithdrawalStatus = 'requested' | 'policy_check' | 'reserved' | 'broadcast' | 'confirmed' | 'failed' | 'manual_review';

export interface Withdrawal {
  id: string;
  va_id: string;
  amount: string;
  destination: string;
  status: WithdrawalStatus;
  tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface Transfer {
  id: string;
  source_va_id: string;
  destination_va_id: string;
  amount: string;
  idempotency_key: string;
  status: 'completed' | 'failed';
  created_at: string;
}

export interface OracleEvent {
  id: string;
  va_id: string;
  event_type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ReconciliationStatus {
  last_run: string;
  status: 'pass' | 'fail' | 'running';
  variance: string;
  details?: Record<string, unknown>;
}

export interface MarketSBError {
  code: string;
  message: string;
  details?: unknown;
}
