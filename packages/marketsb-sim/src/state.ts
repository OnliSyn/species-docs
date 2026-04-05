// ── @marketsb/sim — In-memory state model ──
// All balances are bigint. Never use number for money.

export interface VirtualAccountState {
  vaId: string;
  ownerRef: string;
  subtype: 'funding' | 'species' | 'assurance' | 'system';
  tbCode: number;
  posted: bigint;
  pending: bigint;
  depositAddress: string;
  currency: string;
  status: 'active' | 'frozen' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleStep {
  state: string;
  timestamp: string;
}

export interface DepositState {
  depositId: string;
  vaId: string;
  amount: bigint;
  status: string;
  lifecycle: LifecycleStep[];
  txHash: string;
  chain: string;
  oracleRef: string;
}

export interface WithdrawalState {
  withdrawalId: string;
  vaId: string;
  amount: bigint;
  status: string;
  destination: string;
  chain: string;
  lifecycle: LifecycleStep[];
  txHash: string | null;
  oracleRef: string;
  idempotencyKey: string;
}

export interface TransferRecord {
  transferId: string;
  sourceVaId: string;
  destinationVaId: string;
  amount: bigint;
  memo: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface OracleEntry {
  entryId: string;
  vaId: string;
  type: string;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  ref: string;
  timestamp: string;
}

export interface SimState {
  virtualAccounts: Map<string, VirtualAccountState>;
  deposits: Map<string, DepositState>;
  withdrawals: Map<string, WithdrawalState>;
  transfers: Map<string, TransferRecord>;
  oracleLog: Map<string, OracleEntry[]>;
  systemWallets: {
    incoming: bigint;
    market: bigint;
    outgoing: bigint;
    operating: bigint;
  };
  idempotencyKeys: Map<string, unknown>;
  errorInjections: Map<string, boolean>;
}

export interface SimConfig {
  port: number;
  seedData: 'development' | 'test' | 'empty';
  depositLifecycleDelayMs: number;
  withdrawalLifecycleDelayMs: number;
  sendoutApprovalThresholdUsd: bigint;
}

export const DEFAULT_CONFIG: SimConfig = {
  port: 4001,
  seedData: 'development',
  depositLifecycleDelayMs: 2000,
  withdrawalLifecycleDelayMs: 3000,
  sendoutApprovalThresholdUsd: 10_000_000_000n, // $10,000
};

export function createEmptyState(): SimState {
  return {
    virtualAccounts: new Map(),
    deposits: new Map(),
    withdrawals: new Map(),
    transfers: new Map(),
    oracleLog: new Map(),
    systemWallets: {
      incoming: 0n,
      market: 0n,
      outgoing: 0n,
      operating: 0n,
    },
    idempotencyKeys: new Map(),
    errorInjections: new Map(),
  };
}

// Serialize bigints to numbers for JSON responses.
// Safe for this sim since all amounts fit in Number.MAX_SAFE_INTEGER.
export function serializeBigints(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
  );
}
