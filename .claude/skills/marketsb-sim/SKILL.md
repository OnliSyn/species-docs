---
name: marketsb-sim
description: "@marketsb/sim 패키지 구현 — MarketSB-USDC 전체 REST API를 인메모리 상태로 시뮬레이션하는 Express 서버. TigerBeetle 계좌 토폴로지(코드 100-520), 입금/출금 라이프사이클 타이머, Cashier(정수 수수료 계산 + 5-transfer 배치), FundingOracle, 조정, idempotency. @marketsb/sim, MarketSB sim, sim 서버, 시뮬레이터, 인메모리 TigerBeetle 구현 시 반드시 사용."
---

# @marketsb/sim

MarketSB-USDC REST API의 인메모리 시뮬레이션 서버. `packages/marketsb-sim/`에 구현한다.

## Factory Pattern

```typescript
import { createMarketSBSim } from '@marketsb/sim';

const sim = createMarketSBSim({
  port: 3101,
  seedData: 'development',
  depositLifecycleDelayMs: 2000,
  withdrawalLifecycleDelayMs: 3000,
  sendoutApprovalThresholdUsd: 10_000_000_000n,  // $10,000
});

await sim.start();  // Express on http://localhost:3101/api/v1/...
await sim.stop();
```

## State Model

```typescript
interface SimState {
  virtualAccounts: Map<string, VirtualAccountState>;
  deposits: Map<string, DepositState>;
  withdrawals: Map<string, WithdrawalState>;
  transfers: TransferRecord[];
  oracleLog: Map<string, OracleEntry[]>;  // keyed by vaId
  systemWallets: {
    incoming: bigint;
    market: bigint;
    outgoing: bigint;
    operating: bigint;
  };
  idempotencyKeys: Set<string>;
  errorInjections: Map<string, boolean>;  // endpoint → fail next call
}
```

## API Contract (spec P1-4)

Base: `/api/v1`

### Accounts
- `GET /virtual-accounts/:vaId` → BalanceDTO
- `GET /virtual-accounts?ownerRef=` → BalanceDTO[]
- `POST /virtual-accounts` → BalanceDTO

### Deposits
- `GET /deposits/:id` → DepositDTO (with lifecycle array)
- `GET /deposits?vaId=&status=` → DepositDTO[]

Lifecycle timer: `detected → compliance_pending → compliance_passed → credited → registered`
Each step advances after `depositLifecycleDelayMs`. VA posted balance increases on `credited`.

### Withdrawals
- `POST /withdrawals` → WithdrawalDTO
- `GET /withdrawals/:id` → WithdrawalDTO
- `POST /withdrawals/:id/approve` → WithdrawalDTO
- `POST /withdrawals/:id/reject` → WithdrawalDTO

Threshold gate: if amount ≥ `sendoutApprovalThresholdUsd` → status `pending_approval`.
Below threshold → auto-advance: `processing → broadcast → confirmed`.
VA posted balance decreases on reserve (processing step).

### Transfers
- `POST /transfers` → TransferDTO (instant)

Instant debit/credit. Idempotency enforced. Source VA decreases, destination VA increases.

### Cashier
- `POST /cashier/post-batch` → BatchResultDTO

This is the critical endpoint. Receives order params from Species pipeline, computes fees using integer arithmetic, and applies all transfers atomically:

**Buy batch (5 transfers):**
1. Buyer Funding VA → Treasury (asset cost)
2. Buyer Funding VA → Operating (issuance fee)
3. Buyer Funding VA → Operating (liquidity fee)
4. Treasury → Assurance VA (assurance posting)
5. Treasury → Buyer Species VA (species credit)

**Sell batch (3 transfers):**
1. Buyer Funding VA → Seller Funding VA (asset cost)
2. Buyer Funding VA → Operating (liquidity fee)
3. Seller Species VA → Buyer Species VA (species migration)

Fee calculation (bigint, no floating point):
```
issuanceFee = quantity × 10_000n
liquidityFee = (orderAmount × 200n) / 10_000n
```

### Oracle
- `GET /oracle/virtual-accounts/:vaId/ledger` → OracleEntry[]
- `POST /oracle/virtual-accounts/:vaId/verify` → VerificationDTO

### Reconciliation
- `GET /reconciliation/status` → ReconciliationDTO
- `POST /reconciliation/run` → ReconciliationDTO

Sum all VA posted balances by code, compare against system wallet totals. Report variance.

### Wallets
- `GET /wallets` → WalletBalanceDTO[]
- `GET /wallets/:id/balance` → WalletBalanceDTO

## Control Panel

- `POST /sim/reset` — Reset to seed defaults
- `GET /sim/state` — Dump full state (debug)
- `POST /sim/inject-error/:endpoint` — Next call to endpoint fails
- `POST /sim/advance-deposit/:id` — Manually advance deposit lifecycle
- `POST /sim/set-config` — Override delays/thresholds

## Seed Data

Development seed creates:
- System accounts: Treasury (100), Settlement (200), Operating (300), Pending Deposit (400), Pending Withdrawal (450)
- User "Alex Morgan": Funding VA (500, $12,450), Species VA (510, $8,500), Assurance VA (520, $950,000)
- 4 historical deposits, 3 withdrawals, oracle entries
- System wallets with matching totals

Refer to `references/three-project-spec.md` P1-7 for full seed data spec.
