# Onli AI — Three-Project Implementation Spec

## System of Record

**Version:** 2.0 · **Date:** April 2026 · **Status:** Implementation-ready

---

## Part 0 — System Overview

Three independent projects. Each ships four deliverables: REST API, MCP Server, CLI, and Sim package. One frontend project consumes the other two.

### 0.1 The Three Projects

| Project | Repo | Domain | Deliverables |
|---|---|---|---|
| **Project 1: MarketSB-USDC** | `marketsb-usdc` | All money ($) | REST API · MCP Server · CLI · `@marketsb/sim` |
| **Project 2: Species Marketplace** | `species-marketplace` | Pipeline orchestration + Onli Cloud integration | REST API · MCP Server · CLI · `@species/sim` (bundles sim-Onli) |
| **Project 3: Onli Synth** | `onli-synth` | Unified UI + AI Chat | React frontend · imports `@marketsb/sim` + `@species/sim` for local dev |

### 0.2 Dependency Graph

```
MarketSB-USDC (zero external dependencies)
  │
  ├── publishes @marketsb/sim (week 2)
  │     │
  │     └──► Species Marketplace (depends on MarketSB as Cashier)
  │           │
  │           ├── integrates Onli Cloud (already operational)
  │           ├── publishes @species/sim (week 6)
  │           │     │
  │           │     └──► Onli Synth (imports both sims for local dev)
  │           │
  │           └── publishes REST API + MCP Server
  │
  └── publishes REST API + MCP Server
```

### 0.3 Build Sequence (14 weeks with overlap)

```
Week:  1  2  3  4  5  6  7  8  9  10  11  12  13  14
MB:    [sim][========= real =========][polish]
SP:       [····][sim][========= real =========][polish]
SY:                  [····][============ frontend ============]
```

MarketSB starts first (zero dependencies). Species starts once `@marketsb/sim` is published. Synth starts once `@species/sim` is published. Each project can develop and deploy independently.

### 0.4 The Absolute Boundaries

These are load-bearing. Violations break the architecture.

- **$ never enters Onli Cloud.** Onli Cloud moves Specie between Vaults. No concept of money.
- **º never enters MarketSB.** MarketSB debits and credits USDC ledger entries. No concept of possession.
- **Species Marketplace holds neither.** Orchestrates both via an event pipeline.
- **Onli Synth computes nothing.** Displays server-side values. Gates mutations behind confirmations.
- **OnliYou (iOS) authorizes.** AskToMove approvals happen on-device, never in the Synth chat UI.

### 0.5 The Five User Journeys

| Journey | $ Moves | º Moves | MarketSB | Onli Cloud | Species Pipeline |
|---|---|---|---|---|---|
| **Fund** | Yes (in) | No | Yes | No | No |
| **Buy** | Yes | Yes | Yes (Cashier) | Yes | Yes (9 stages) |
| **Sell** | Yes | Yes | Yes (Cashier) | Yes (AskToMove or auto-authorize) | Yes (9 stages) |
| **Transfer** | No | Yes | No | Yes (AskToMove) | Yes (8 stages, no Cashier) |
| **SendOut** | Yes (out) | No | Yes | No | No |

### 0.6 Container and Asset Terminology

| Term | System | Holds |
|---|---|---|
| **Wallet** | MarketSB | System-level USDC pool (Incoming, MarketWallet, Outgoing, Operating) |
| **Account** (Funding Account) | MarketSB | Per-user USDC balance — sub-account of MarketWallet |
| **Vault** | Onli Cloud | Specie possession (Treasury, Settlement, User) |

Wallets ≠ Accounts ≠ Vaults. Buyer/Seller are transaction roles, not account types.

### 0.7 Resolved Design Decisions

| # | Decision | Detail |
|---|---|---|
| 1 | Validator calls MarketSB directly | REST client with circuit breaker, no intermediary |
| 2 | VA codes: subtype field + separate TB codes | Funding=500, Species=510, Assurance=520 |
| 3 | One-time Onli identity linking at onboarding | Persists across sessions |
| 4 | Unified WebSocket | Single connection, `source` discriminator, fallback polling 5s |
| 5 | Contacts store both VA IDs + wallet addresses | Established at onboarding. No Vault — only Onli users have Vaults |
| 6 | Sell auto-authorize set at listing creation | If enabled, pipeline skips AskToMove on match |
| 7 | Redis Streams + transactional outbox | Upstash Redis for cache + messaging |
| 8 | No Settlement Vault capacity limit | Concurrent ChangeOwner handled natively |

### 0.8 Fee Schedule (Cashier Calculations)

| Fee | Rate | TigerBeetle Transfer |
|---|---|---|
| Listing fee | $100.00 flat per listing | User Funding VA → Operating Wallet (300) |
| Issuance fee | $0.01 per Specie | User Funding VA → Operating Wallet (300) |
| Liquidity fee | 2% of transaction value | User Funding VA → Operating Wallet (300) |

### 0.9 Amount Handling (ADR-105)

| Context | Format | Example |
|---|---|---|
| UI display | USD-formatted string | `$12,450.00` |
| API / TigerBeetle | Integer, smallest USDC unit (1 USDC = 1,000,000) | `12450000000` |
| Specie count | Integer | `12,450` |
| Specie value | Count × $1.00 | `12,450 SPECIES = $12,450.00` |

---

# PROJECT 1: MarketSB-USDC

## The Financial Settlement Engine

**Repo:** `marketsb-usdc`
**Language:** TypeScript (Node.js)
**Domain:** All money ($). All USDC. All double-entry ledger postings. All fee calculations. FundingOracle.

### P1-1. What This Project Delivers

| Deliverable | Description |
|---|---|
| **REST API** | Full USDC operations: accounts, deposits, withdrawals, transfers, oracle, reconciliation, wallet reads |
| **MCP Server** | AI tool surface for all $ operations — read tools (no confirmation) + write tools (confirmation required) |
| **CLI** | Operator tooling: reconcile, approve withdrawals, inspect wallets, seed accounts, query oracle |
| **`@marketsb/sim`** | Lightweight sim package — in-memory TigerBeetle substitute, deterministic responses, same API contract |

### P1-2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MarketSB-USDC                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  REST API   │  │ MCP Server  │  │   CLI               │ │
│  │  (Express)  │  │ (Vercel)    │  │   (Commander.js)    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────────────┘ │
│         │                │                 │                 │
│         └────────────────┼─────────────────┘                │
│                          │                                   │
│                ┌─────────▼──────────┐                       │
│                │   Service Layer     │                       │
│                ├────────────────────┤                       │
│                │ AccountService      │ VA CRUD, balance      │
│                │ DepositService      │ Chain indexer, credit  │
│                │ WithdrawalService   │ Reserve, broadcast     │
│                │ TransferService     │ Internal debit/credit  │
│                │ LedgerService       │ TB batch builder       │
│                │ OracleService       │ Audit trail R/W        │
│                │ ReconciliationSvc   │ Reserve vs liability   │
│                │ PolicyService       │ Threshold enforcement  │
│                │ WalletService       │ System wallet reads    │
│                │ IdempotencyService  │ Redis-backed dedup     │
│                └─────────┬──────────┘                       │
│                          │                                   │
│         ┌────────────────┼─────────────────┐                │
│         │                │                 │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐        │
│  │ TigerBeetle │  │ PostgreSQL  │  │   Redis     │        │
│  │ (ledger)    │  │ (control)   │  │ (cache+msg) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### P1-3. TigerBeetle Account Topology

| Code | Type | Purpose |
|---|---|---|
| 100 | Treasury Reserve | Primary USDC reserve backing all internal balances |
| 200 | Settlement Reserve | Hot wallet for outbound USDC operations |
| 300 | Operating Revenue | Fee collection (listing, issuance, liquidity) |
| 400 | Pending Deposit Staging | Detected but unposted inbound USDC |
| 450 | Pending Withdrawal Staging | Reserved but unconfirmed outbound USDC |
| 500 | User Funding VA | Per-user USDC balance (subtype: funding) |
| 510 | User Species VA | Per-user Specie value in USDC base units (subtype: species) |
| 520 | Assurance VA | Issuance proceeds — backs the 100% guarantee (subtype: assurance) |

### P1-4. REST API Specification

**Base URL:** `/api/v1`

#### Accounts

```
GET  /virtual-accounts/{vaId}              → BalanceDTO
GET  /virtual-accounts?ownerRef={userId}   → BalanceDTO[]
POST /virtual-accounts                     → CreateVA (operator)
```

**BalanceDTO:**
```json
{
  "vaId": "va-funding-user-123",
  "ownerRef": "user-123",
  "subtype": "funding",
  "tbCode": 500,
  "balance": {
    "posted": 12450000000,
    "pending": 0,
    "available": 12450000000
  },
  "depositAddress": "0x1234...abcd",
  "currency": "USDC",
  "status": "active",
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-04-03T11:55:00.000Z"
}
```

#### Deposits

```
GET  /deposits/{depositId}                 → DepositDTO
GET  /deposits?vaId={vaId}&status={status} → DepositDTO[]
```

**DepositDTO:**
```json
{
  "depositId": "dep-001",
  "vaId": "va-funding-user-123",
  "amount": 5000000000,
  "status": "credited",
  "lifecycle": [
    { "state": "detected", "timestamp": "2026-04-03T11:00:00Z" },
    { "state": "compliance_pending", "timestamp": "2026-04-03T11:00:01Z" },
    { "state": "compliance_passed", "timestamp": "2026-04-03T11:00:05Z" },
    { "state": "credited", "timestamp": "2026-04-03T11:00:06Z" },
    { "state": "registered", "timestamp": "2026-04-03T11:00:06.5Z" }
  ],
  "txHash": "0xabc123...",
  "chain": "base",
  "oracleRef": "fo-dep-001"
}
```

#### Withdrawals

```
POST /withdrawals                          → WithdrawalDTO (201)
GET  /withdrawals/{withdrawalId}           → WithdrawalDTO
POST /withdrawals/{withdrawalId}/approve   → WithdrawalDTO (operator)
POST /withdrawals/{withdrawalId}/reject    → WithdrawalDTO (operator)
GET  /withdrawals?status=pending_approval  → WithdrawalDTO[] (operator queue)
```

**Withdrawal request:**
```json
{
  "vaId": "va-funding-user-123",
  "amount": 2000000000,
  "destination": "0x9876...fedc",
  "chain": "base",
  "idempotencyKey": "wd-user123-1714000003"
}
```

**WithdrawalDTO:**
```json
{
  "withdrawalId": "wd-001",
  "vaId": "va-funding-user-123",
  "amount": 2000000000,
  "status": "processing",
  "destination": "0x9876...fedc",
  "lifecycle": [
    { "state": "processing", "timestamp": "2026-04-03T12:00:00Z" }
  ],
  "txHash": null,
  "oracleRef": "fo-wd-001"
}
```

Lifecycle: `pending_approval` (if ≥ threshold) → `approved` → `processing` → `broadcast` → `confirmed`

#### Transfers

```
POST /transfers                            → TransferDTO (200, instant)
```

**Transfer request:**
```json
{
  "sourceVaId": "va-funding-user-123",
  "destinationVaId": "va-funding-user-456",
  "amount": 100000000,
  "idempotencyKey": "xfer-usdc-user123-001",
  "memo": "Payment to Pepper Potts"
}
```

#### Cashier (consumed by Species pipeline)

```
POST /cashier/post-batch                   → BatchResultDTO
```

**Batch request (from Species pipeline on `payment.confirmed`):**
```json
{
  "eventId": "evt-550e8400",
  "matchId": "match-001",
  "intent": "buy",
  "quantity": 1000,
  "buyerVaId": "va-funding-user-123",
  "sellerVaId": "va-funding-treasury",
  "unitPrice": 1000000,
  "fees": {
    "issuance": true,
    "liquidity": true,
    "listing": false
  }
}
```

The Cashier endpoint computes fees server-side using integer arithmetic, builds the 5-transfer linked batch, posts to TigerBeetle, writes FundingOracle entries, and returns the batch result. The caller does not compute fees.

**BatchResultDTO:**
```json
{
  "tbBatchId": "tb-batch-abc123",
  "transfers": [
    { "type": "asset_cost", "debit": "va-funding-user-123", "credit": "va-funding-treasury", "amount": 1000000000 },
    { "type": "issuance_fee", "debit": "va-funding-user-123", "credit": "operating-300", "amount": 10000000 },
    { "type": "liquidity_fee", "debit": "va-funding-user-123", "credit": "operating-300", "amount": 20000000 },
    { "type": "assurance_posting", "debit": "treasury-100", "credit": "assurance-520", "amount": 1000000000 },
    { "type": "species_credit", "debit": "treasury-100", "credit": "va-species-user-123", "amount": 1000000000 }
  ],
  "totalDebited": 1030000000,
  "oracleRefs": ["fo-buy-001-a", "fo-buy-001-b", "fo-buy-001-c"],
  "idempotencyKey": "evt-550e8400:match-001",
  "postedAt": "2026-04-03T12:00:02.100Z"
}
```

#### Oracle

```
GET  /oracle/virtual-accounts/{vaId}/ledger?limit=50&offset=0  → OracleEntryDTO[]
POST /oracle/virtual-accounts/{vaId}/verify                     → VerificationDTO
```

#### Reconciliation

```
GET  /reconciliation/status                → ReconciliationDTO
POST /reconciliation/run                   → ReconciliationDTO (operator)
```

#### Wallets (operator)

```
GET  /wallets/{walletId}/balance           → WalletBalanceDTO
GET  /wallets                              → WalletBalanceDTO[] (all 4 system wallets)
```

### P1-5. MCP Server Tools

**Read tools (no user confirmation required):**

| Tool | Maps To |
|---|---|
| `get_funding_balance` | `GET /virtual-accounts/{funding_va_id}` |
| `get_species_balance` | `GET /virtual-accounts/{species_va_id}` |
| `get_assurance_balance` | `GET /virtual-accounts/{assurance_va_id}` |
| `list_accounts` | `GET /virtual-accounts?ownerRef={userId}` |
| `get_deposit_status` | `GET /deposits/{depositId}` |
| `get_withdrawal_status` | `GET /withdrawals/{withdrawalId}` |
| `query_oracle_ledger` | `GET /oracle/virtual-accounts/{vaId}/ledger` |
| `get_wallet_balance` | `GET /wallets/{walletId}/balance` (operator) |
| `get_reconciliation_status` | `GET /reconciliation/status` (operator) |

**Write tools (require confirmation card in Synth UI):**

| Tool | Maps To |
|---|---|
| `transfer_usdc` | `POST /transfers` |
| `request_withdrawal` | `POST /withdrawals` |
| `approve_withdrawal` | `POST /withdrawals/{id}/approve` (operator) |

### P1-6. CLI

```bash
marketsb accounts list --owner user-123
marketsb accounts get va-funding-user-123
marketsb accounts create --owner user-123 --subtype funding

marketsb deposits list --va va-funding-user-123 --status credited
marketsb deposits get dep-001

marketsb withdrawals list --status pending_approval
marketsb withdrawals approve wd-002 --reason "Verified identity"
marketsb withdrawals reject wd-003 --reason "Suspicious destination"

marketsb wallets list
marketsb wallets get incoming

marketsb oracle ledger va-funding-user-123 --limit 20
marketsb oracle verify va-funding-user-123

marketsb reconciliation status
marketsb reconciliation run

marketsb seed --env development    # Create system accounts + test users
marketsb seed --env test           # Minimal fixture data for CI

marketsb cashier post-batch --event-id evt-123 --match-id match-001 --dry-run
```

### P1-7. `@marketsb/sim`

The sim is a lightweight npm package that other projects import for local development. It implements the exact same API contract as the real service using in-memory state instead of TigerBeetle + PostgreSQL.

**Package:** `@marketsb/sim`
**Runtime:** Single Express server, no database dependencies
**State:** In-memory, deterministic, resettable

```typescript
// Usage in another project
import { createMarketSBSim } from '@marketsb/sim';

const sim = createMarketSBSim({
  port: 3101,
  seedData: 'development',  // pre-populate accounts
  depositLifecycleDelayMs: 2000,
  withdrawalLifecycleDelayMs: 3000,
  sendoutApprovalThresholdUsd: 10000000000
});

await sim.start();
// sim now responds on http://localhost:3101/api/v1/...
// exact same endpoints, exact same response shapes

await sim.stop();
```

**Sim state model:**

```typescript
interface SimState {
  virtualAccounts: Map<string, {
    vaId: string;
    ownerRef: string;
    subtype: 'funding' | 'species' | 'assurance';
    tbCode: number;
    posted: bigint;
    pending: bigint;
    depositAddress: string;
  }>;
  deposits: Map<string, DepositDTO>;
  withdrawals: Map<string, WithdrawalDTO>;
  transfers: Map<string, TransferDTO>;
  oracleLog: Map<string, OracleEntryDTO[]>;
  systemWallets: Record<'incoming' | 'market' | 'outgoing' | 'operating', bigint>;
  idempotencyKeys: Set<string>;
}
```

**Sim control endpoints (dev only):**

```
POST /sim/reset                    — Reset all state to seed defaults
POST /sim/set-config               — Override config (thresholds, delays)
GET  /sim/state                    — Dump full state for debugging
POST /sim/inject-error/{endpoint}  — Force next call to {endpoint} to fail
POST /sim/advance-deposit/{id}     — Manually advance deposit to next lifecycle state
```

**Sim contract tests:** The sim package includes a test suite that validates every response shape matches the real API contract. When the real API evolves, the sim tests break — forcing the sim to be updated in lockstep.

### P1-8. Repo Structure

```
marketsb-usdc/
├── apps/
│   ├── api/                            # REST API server
│   │   ├── src/
│   │   │   ├── routes/                # Express route handlers
│   │   │   ├── services/             # AccountService, DepositService, etc.
│   │   │   ├── tigerbeetle/          # TB client, batch builder, account topology
│   │   │   ├── middleware/           # Auth, idempotency, rate limiting
│   │   │   ├── events/              # Redis Streams publisher
│   │   │   └── index.ts
│   │   ├── drizzle/                  # Schema + migrations
│   │   └── tsconfig.json
│   │
│   ├── mcp/                            # MCP Server (Vercel Edge)
│   │   ├── src/
│   │   │   ├── tools/               # Read + write tool handlers
│   │   │   └── auth/
│   │   └── vercel.json
│   │
│   └── cli/                            # Operator CLI
│       ├── src/
│       │   ├── commands/             # One file per command group
│       │   └── index.ts
│       └── tsconfig.json
│
├── packages/
│   ├── sim/                            # @marketsb/sim — published package
│   │   ├── src/
│   │   │   ├── server.ts            # Express sim server
│   │   │   ├── state.ts             # In-memory state
│   │   │   ├── handlers/            # Route handlers mirroring real API
│   │   │   ├── control.ts           # /sim/* control endpoints
│   │   │   └── seed.ts              # Seed data fixtures
│   │   ├── __tests__/
│   │   │   └── contract.test.ts     # Validates sim responses match real API shapes
│   │   └── package.json             # name: "@marketsb/sim"
│   │
│   └── shared/                         # Shared types, amount utilities
│       ├── src/
│       │   ├── types.ts              # BalanceDTO, DepositDTO, WithdrawalDTO, etc.
│       │   ├── amount.ts             # Integer ↔ display conversion
│       │   └── constants.ts          # TB codes, fee rates, status enums
│       └── package.json              # name: "@marketsb/shared"
│
├── infra/
│   ├── docker-compose.yml              # TigerBeetle + Postgres + Redis (local dev)
│   ├── fly.toml                        # Fly.io deployment
│   └── tigerbeetle/                   # TB cluster config + account init scripts
│
├── tests/
│   ├── integration/                    # Cross-service tests (requires running infra)
│   └── load/                           # k6 scripts
│
├── docs/
│   ├── api.md                          # OpenAPI-style reference
│   ├── adr/                           # Architecture Decision Records
│   │   └── ADR-105-amount-handling.md
│   └── runbook.md                     # Operational runbook
│
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
└── README.md
```

### P1-9. Commands

```bash
# ── Setup ──
pnpm install
docker compose up -d                      # TigerBeetle + Postgres + Redis
pnpm db:migrate                           # Run Drizzle migrations
pnpm db:seed                              # Seed system accounts + test users

# ── Development ──
pnpm dev                                  # Start API server (hot reload)
pnpm dev:sim                              # Start sim server only (for other projects)
pnpm dev:mcp                              # Start MCP server locally

# ── Testing ──
pnpm test                                 # All unit tests (Vitest)
pnpm test:integration                     # Integration tests (requires Docker infra)
pnpm test:contract                        # Sim contract validation
pnpm test:coverage                        # Coverage report (target: 90%)
k6 run tests/load/transfers.js            # Load test

# ── Build + Deploy ──
pnpm build                                # Compile all packages
pnpm --filter @marketsb/sim pack          # Build sim package for publishing
npm publish --workspace packages/sim      # Publish @marketsb/sim
fly deploy                                # Deploy API to Fly.io
vercel --prod --cwd apps/mcp             # Deploy MCP to Vercel

# ── CLI ──
pnpm cli -- accounts list --owner user-123
pnpm cli -- reconciliation run
pnpm cli -- withdrawals list --status pending_approval

# ── Linting ──
pnpm lint                                 # ESLint --max-warnings 0
pnpm typecheck                            # tsc --noEmit
```

### P1-10. Testing Strategy

| Layer | Framework | Coverage | What |
|---|---|---|---|
| Unit | Vitest | 90% | Fee calculation (integer arithmetic), batch composition, amount conversion, service logic |
| Integration | Vitest + Docker | Critical paths | TigerBeetle atomic batches, deposit lifecycle, withdrawal saga, Oracle writes |
| Contract | Vitest | 100% of endpoints | Sim response shapes match real API — breaks if API evolves without sim update |
| Load | k6 | p95 < 2s | Transfer throughput, concurrent batch posting, balance read under load |

**Critical test scenarios:**

1. Buy batch: 5 linked transfers post atomically — verify Dr = Cr, all amounts integer-precise
2. Idempotency: same `eventId:matchId` submitted twice → second rejected, balances unchanged
3. Fee calculation: 1,000 º buy → issuance = 10,000,000, liquidity = 20,000,000, total debit = 1,030,000,000
4. Deposit lifecycle: detected → compliance_pending → compliance_passed → credited — VA balance increases exactly by deposit amount
5. Withdrawal threshold: amount ≥ SENDOUT_APPROVAL_THRESHOLD → status = pending_approval, no $ moves
6. Reconciliation: sum of all Funding VAs + system wallets = total USDC reserve — zero variance
7. Amount round-trip: 12450000000 → "$12,450.00" → 12450000000 (zero drift)

### P1-11. Code Style

```typescript
// Naming: camelCase vars/fns, PascalCase types, SCREAMING_SNAKE constants
// Files: kebab-case (account-service.ts, deposit-dto.ts)
// Amounts: ALWAYS bigint internally, NEVER floating point

import { type BalanceDTO } from '@marketsb/shared';
import { TB_CODE_FUNDING, USDC_DECIMALS } from '@marketsb/shared/constants';

const ISSUANCE_FEE_PER_SPECIE = 10_000n; // $0.01 in base units
const LIQUIDITY_FEE_BPS = 200n;           // 2% = 200 basis points

export function computeIssuanceFee(quantity: bigint): bigint {
  return quantity * ISSUANCE_FEE_PER_SPECIE;
}

export function computeLiquidityFee(orderAmount: bigint): bigint {
  // Integer division — no floating point ever touches fee calculation
  return (orderAmount * LIQUIDITY_FEE_BPS) / 10_000n;
}

export function buildBuyBatch(params: {
  eventId: string;
  matchId: string;
  buyerVaId: string;
  sellerVaId: string;
  quantity: bigint;
  unitPrice: bigint;
}): TigerBeetleTransfer[] {
  const assetCost = params.quantity * params.unitPrice;
  const issuanceFee = computeIssuanceFee(params.quantity);
  const liquidityFee = computeLiquidityFee(assetCost);

  // All 5 transfers linked — atomic, all-or-nothing
  return [
    { debit: params.buyerVaId, credit: params.sellerVaId, amount: assetCost, tag: 'asset_cost' },
    { debit: params.buyerVaId, credit: 'operating-300', amount: issuanceFee, tag: 'issuance_fee' },
    { debit: params.buyerVaId, credit: 'operating-300', amount: liquidityFee, tag: 'liquidity_fee' },
    { debit: 'treasury-100', credit: 'assurance-520', amount: assetCost, tag: 'assurance_posting' },
    { debit: 'treasury-100', credit: params.buyerVaId.replace('funding', 'species'), amount: assetCost, tag: 'species_credit' },
  ];
}
```

### P1-12. Git Workflow

```
main                                      # Production — deploy on merge
develop                                   # Integration — PR target
feature/MB-{ticket}-{description}         # Feature branches
fix/MB-{ticket}-{description}             # Bug fixes
hotfix/MB-{ticket}-{description}          # Urgent production fix from main
```

Commit format: `<type>(mb): <description>` — e.g., `feat(mb): add 5-transfer buy batch builder`

### P1-13. Constraints

- **Never use floating point for money.** All amounts are `bigint`. All fee calculations use integer arithmetic.
- **Never commit secrets.** `.env` files gitignored. Use `fly secrets` and `vercel env`.
- **Never bypass idempotency.** Every write endpoint enforces idempotency keys via Redis SET NX.
- **Never break Dr = Cr.** TigerBeetle linked transfers enforce this, but unit tests must also verify.
- **Never expose TigerBeetle directly.** All reads go through the service layer. No direct TB client access from routes.
- **Sim must match real.** Contract tests in `@marketsb/sim` break if API shapes diverge.

### P1-14. Timeline

| Week | Milestone |
|---|---|
| 1 | Sim published: `@marketsb/sim` with full API contract, seed data, control panel |
| 2 | Sim contract tests green. Species team can start. |
| 3 | Real API: AccountService, TigerBeetle topology, PostgreSQL schema, balance reads |
| 4 | Real API: DepositService (chain indexer), TransferService (instant TB debit/credit) |
| 5 | Real API: LedgerService (Cashier — 5-transfer batch), OracleService, fee calculation |
| 6 | Real API: WithdrawalService (saga, policy, broadcast), ReconciliationService |
| 7 | MCP Server deployed. CLI operational. Integration tests green. |
| 8 | Load tested. Production deploy. Polish. |

### P1-15. Exit Criteria

1. All REST endpoints operational with real TigerBeetle + PostgreSQL
2. Cashier `POST /cashier/post-batch`: 5-transfer buy batch posts atomically, Dr = Cr
3. FundingOracle has entries for every $ movement
4. Deposit lifecycle: on-chain USDC → detected → credited (real chain indexer on Base)
5. Withdrawal lifecycle: request → policy → broadcast → confirmed (real on-chain)
6. Reconciliation: zero variance between USDC reserves and internal liabilities
7. MCP Server: all tools resolve against real API
8. CLI: all commands operational
9. `@marketsb/sim` published, contract tests green
10. Integration tests + load tests pass

---

# PROJECT 2: Species Marketplace

## The Orchestration Pipeline + Onli Cloud Integration

**Repo:** `species-marketplace`
**Language:** Go
**Domain:** Pipeline orchestration — sequencing, matching, event lifecycle. Integrates MarketSB as Cashier and Onli Cloud as Asset Engine.

### P2-1. What This Project Delivers

| Deliverable | Description |
|---|---|
| **REST API** | EventRequest submission, receipt query, pipeline status, marketplace stats |
| **MCP Server** | AI tool surface for marketplace + asset operations (TypeScript, Vercel Edge) |
| **CLI** | Operator tooling: pipeline health, order inspect, treasury status, vault queries, listing management |
| **`@species/sim`** | Sim package bundling sim-Species pipeline + sim-Onli Cloud — full pipeline simulation with timed stage events |

### P2-2. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Species Marketplace                             │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌──────────────┐                   │
│  │ REST API  │  │MCP Server │  │     CLI      │                   │
│  │  (Gin)    │  │ (Vercel)  │  │ (cobra)      │                   │
│  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘                   │
│        │               │               │                            │
│        └───────────────┼───────────────┘                            │
│                        │                                             │
│  ┌─────────────────────▼───────────────────────────────────┐       │
│  │              PIPELINE SERVICE NODES                      │       │
│  │                                                          │       │
│  │  Authenticator → Marketplace API → Validator             │       │
│  │  → Classifier → Matching Service → AssetDelivery         │       │
│  │  → [Cashier call] → AssetDelivery → FloorManager         │       │
│  │  → Reporter                                              │       │
│  └────────┬──────────────────┬──────────────────────────────┘       │
│           │                  │                                       │
│    ┌──────▼──────┐    ┌──────▼──────┐                               │
│    │ PostgreSQL  │    │   Redis     │                               │
│    │ (orders,    │    │ (streams,   │                               │
│    │  listings,  │    │  cache,     │                               │
│    │  receipts)  │    │  nonce)     │                               │
│    └─────────────┘    └─────────────┘                               │
└──────────┬──────────────────────┬───────────────────────────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────┐
    │ MarketSB    │        │ Onli Cloud  │
    │ (Cashier)   │        │ (Assets)    │
    │ POST /batch │        │ gRPC/REST   │
    └─────────────┘        └─────────────┘
    Project 1 API          External (operational)
```

### P2-3. Pipeline Service Nodes

| Node | Responsibility | Emits |
|---|---|---|
| **Authenticator** | HMAC + nonce + timestamp validation, Onli Cloud `AuthorizeBehavior` | `request.authenticated` |
| **Marketplace API** | Idempotency enforcement, transactional outbox, ingress persistence | `order.received` |
| **Validator** | UserProvider (Onli), PaymentProvider (MarketSB direct call), AssetProvider (Onli Vault) | `order.validated` |
| **Classifier** | Intent routing: buy \| sell \| transfer | `order.classified` |
| **Matching Service** | Market-first counterparty resolution, Treasury last resort, split fills | `order.matched` |
| **AssetDelivery (pre-stage)** | ChangeOwner: source Vault → Settlement Vault | `asset.staged` |
| **Cashier (call)** | Calls MarketSB `POST /cashier/post-batch` — NOT called on Transfer | `payment.confirmed` |
| **AssetDelivery (deliver)** | ChangeOwner: Settlement Vault → destination Vault | `ownership.changed` |
| **FloorManager** | Verify both Oracles, compose canonical eventReceipt | `order.completed` |
| **Reporter** | Side-car: materialized views for receipts, statements, analytics | `ledger.posted` |

### P2-4. REST API Specification

**Base URL:** `/marketplace/v1`

#### EventRequest

```
POST /eventRequest
Headers: X-API-Key, X-Signature, X-Nonce, X-Timestamp, X-Onli-Identity
```

**Request (Buy):**
```json
{
  "eventId": "evt-550e8400-e29b-41d4-a716-446655440000",
  "intent": "buy",
  "quantity": 1000,
  "paymentSource": { "vaId": "va-funding-user-123" },
  "idempotencyKey": "buy-user123-1714000000"
}
```

**Request (Sell):**
```json
{
  "eventId": "evt-660e8400",
  "intent": "sell",
  "quantity": 500,
  "paymentSource": { "vaId": "va-funding-user-123" },
  "listingConfig": { "autoAuthorize": true },
  "idempotencyKey": "sell-user123-1714000001"
}
```

**Request (Transfer):**
```json
{
  "eventId": "evt-770e8400",
  "intent": "transfer",
  "quantity": 100,
  "recipient": { "onliId": "onli-user-456" },
  "idempotencyKey": "xfer-user123-1714000002"
}
```

**Response — 202 Accepted:**
```json
{
  "eventId": "evt-550e8400",
  "status": "accepted",
  "pipelineStage": "request.submitted",
  "wsChannel": "/events/evt-550e8400/stream",
  "createdAt": "2026-04-03T12:00:00Z"
}
```

#### Receipts + Status

```
GET /events/{eventId}/receipt              → EventReceiptDTO
GET /events/{eventId}/status               → PipelineStatusDTO
```

**EventReceiptDTO:**
```json
{
  "eventId": "evt-550e8400",
  "status": "completed",
  "intent": "buy",
  "quantity": 1000,
  "totalCost": 1030000000,
  "fees": { "issuance": 10000000, "liquidity": 20000000, "listing": 0 },
  "matches": [{ "matchId": "match-001", "counterparty": "treasury", "quantity": 1000 }],
  "tbBatchId": "tb-batch-abc123",
  "oracleRefs": { "fundingOracle": "fo-001", "assetOracle": "ao-001" },
  "timestamps": {
    "submitted": "2026-04-03T12:00:00Z",
    "authenticated": "2026-04-03T12:00:00.12Z",
    "validated": "2026-04-03T12:00:00.35Z",
    "classified": "2026-04-03T12:00:00.36Z",
    "matched": "2026-04-03T12:00:00.50Z",
    "assetStaged": "2026-04-03T12:00:01.20Z",
    "paymentConfirmed": "2026-04-03T12:00:02.10Z",
    "ownershipChanged": "2026-04-03T12:00:03.00Z",
    "completed": "2026-04-03T12:00:03.20Z"
  }
}
```

#### Stats + Listings

```
GET /stats                                 → MarketplaceStatsDTO
GET /listings                              → ListingDTO[]
GET /listings/{listingId}                  → ListingDTO
```

#### Vault (proxied from Onli Cloud)

```
GET /vault/{uid}                           → VaultBalanceDTO
GET /vault/{uid}/history                   → VaultHistoryDTO
```

#### WebSocket

```
WS /events/{eventId}/stream
```

Emits JSON frames:
```json
{
  "source": "species",
  "eventId": "evt-550e8400",
  "stage": "order.validated",
  "timestamp": "2026-04-03T12:00:00.35Z",
  "data": { "validationResult": "passed" }
}
```

### P2-5. MCP Server Tools

**Read tools (no confirmation):**

| Tool | Maps To |
|---|---|
| `get_vault_balance` | `GET /vault/{uid}` |
| `get_vault_history` | `GET /vault/{uid}/history` |
| `get_order_status` | `GET /events/{eventId}/status` |
| `get_event_receipt` | `GET /events/{eventId}/receipt` |
| `get_marketplace_stats` | `GET /stats` |
| `get_listings` | `GET /listings` |

**Write tools (require confirmation card):**

| Tool | Maps To |
|---|---|
| `submit_buy_order` | `POST /eventRequest` (intent: buy) |
| `submit_sell_order` | `POST /eventRequest` (intent: sell) |
| `submit_transfer_order` | `POST /eventRequest` (intent: transfer) |

### P2-6. CLI

```bash
species pipeline health                    # Status of all pipeline nodes
species pipeline inspect evt-550e8400      # Full event trace through pipeline

species orders list --user user-123 --status completed
species orders get evt-550e8400
species orders receipt evt-550e8400

species listings list --status active
species listings get listing-001

species vault balance onli-user-123
species vault history onli-user-123

species treasury status                    # Treasury Vault count, Settlement Vault in-flight
species stats                              # Volume, orders today, active listings

species matching queue                     # Pending unmatched orders
species matching simulate --intent buy --quantity 1000  # Dry-run match

species seed --env development
species seed --env test
```

### P2-7. `@species/sim`

Sim package that bundles the full Species pipeline simulation AND sim-Onli Cloud. Consumers get both in one import.

**Package:** `@species/sim`
**Runtime:** Single process, TypeScript
**Dependencies:** `@marketsb/sim` (uses MarketSB sim for Cashier calls during pipeline simulation)

```typescript
import { createSpeciesSim } from '@species/sim';
import { createMarketSBSim } from '@marketsb/sim';

// Start MarketSB sim first (Species sim calls it as Cashier)
const mbSim = createMarketSBSim({ port: 3101 });
await mbSim.start();

const spSim = createSpeciesSim({
  port: 3102,
  marketsbUrl: 'http://localhost:3101/api/v1',
  pipelineDelays: {
    authenticated: 100,
    validated: 300,
    classified: 100,
    matched: 200,
    assetStaged: 700,
    paymentConfirmed: 800,
    ownershipChanged: 800,
    completed: 200
  },
  askToMoveTimeoutSeconds: 300
});

await spSim.start();
// sim responds on http://localhost:3102/marketplace/v1/...
// WebSocket on ws://localhost:3102/events/{eventId}/stream
```

**Sim pipeline behavior (Buy, 9 stages):**

The sim walks through each pipeline stage on a timer, emitting WebSocket events at each step. At the Cashier stage, it calls the MarketSB sim's `POST /cashier/post-batch` endpoint — so the MarketSB sim's in-memory balances actually update during a sim buy order. This means the Synth frontend sees realistic balance changes even in full-sim mode.

**Sim-Onli (bundled inside `@species/sim`):**

```typescript
// Internal to @species/sim — not separately importable
simOnli = {
  vaults: {
    treasury: { count: 1_000_000_000 },
    settlement: { count: 0 },
    users: Map<onliId, { count: number, history: [] }>
  },
  pendingAskToMove: Map<requestId, { onliId, quantity, eventId, expiresAt }>,
  assetOracleLog: []
}
```

**Sim control endpoints:**

```
POST /sim/reset                            — Reset pipeline + Onli state
POST /sim/inject-error/{stage}             — Force failure at pipeline stage
POST /sim/set-delay/{stage}/{ms}           — Override stage timing
POST /sim/approve/{eventId}                — Simulate OnliYou AskToMove approval
POST /sim/set-config                       — Override config
GET  /sim/state                            — Dump full state
GET  /sim/onli/state                       — Dump sim-Onli state separately
```

### P2-8. Repo Structure

```
species-marketplace/
├── cmd/                                    # Go service binaries
│   ├── authenticator/main.go
│   ├── marketplace-api/main.go
│   ├── validator/main.go
│   ├── classifier/main.go
│   ├── matching/main.go
│   ├── asset-delivery/main.go
│   ├── floor-manager/main.go
│   ├── reporter/main.go
│   └── cli/main.go                        # CLI entry point
│
├── internal/                               # Private Go packages
│   ├── auth/                              # HMAC, nonce, identity
│   ├── api/                               # Idempotency, outbox, ingress
│   ├── validator/                         # User/Payment/Asset provider checks
│   ├── classifier/                        # Intent routing (pure function)
│   ├── matching/                          # Engine, market-first, split fills
│   ├── asset/                             # ChangeOwner orchestration, pre-stage/deliver
│   ├── floor/                             # Oracle verify, receipt compose
│   ├── reporter/                          # Materialized views, projections
│   └── pipeline/                          # Stage sequencing, event chain, Redis Streams
│
├── pkg/                                    # Shared Go packages
│   ├── onlicloud/                         # Onli Cloud gRPC/REST client
│   ├── marketsb/                          # MarketSB REST client (Cashier calls)
│   ├── events/                            # Redis Streams publish/subscribe
│   ├── cache/                             # Tiered cache (L1 memory + L2 Redis)
│   └── circuit/                           # Circuit breaker
│
├── migrations/                             # PostgreSQL migrations
│
├── sim/                                    # @species/sim (TypeScript, published as npm package)
│   ├── src/
│   │   ├── sim-species/                  # Pipeline simulator with timed stages
│   │   ├── sim-onli/                     # Vault + ChangeOwner + AskToMove sim
│   │   ├── sim-websocket/               # WS server for stage events
│   │   ├── sim-control/                 # Control panel endpoints
│   │   ├── state.ts
│   │   └── server.ts
│   ├── __tests__/
│   │   └── contract.test.ts              # Response shape validation
│   └── package.json                       # name: "@species/sim"
│
├── mcp/                                    # MCP Server (TypeScript, Vercel Edge)
│   ├── src/
│   │   ├── tools/
│   │   └── auth/
│   └── vercel.json
│
├── tests/
│   ├── integration/                       # Go integration tests
│   └── load/                              # k6 scripts
│
├── infra/
│   ├── docker-compose.yml                 # Postgres + Redis (local dev)
│   ├── fly/                               # Fly.io configs per service
│   └── ecosystem.config.js               # PM2 for local multi-service dev
│
├── docs/
│   ├── pipeline.md                        # Full pipeline spec
│   ├── api.md
│   └── runbook.md
│
├── go.mod
├── go.sum
└── README.md
```

### P2-9. Commands

```bash
# ── Setup ──
go mod download
cd sim && pnpm install                     # Sim + MCP are TypeScript
docker compose up -d                       # Postgres + Redis

# ── Development ──
go run ./cmd/marketplace-api               # Start single service
pm2 start ecosystem.config.js             # Start all Go services via PM2
cd sim && pnpm dev                         # Start sim server (port 3102)
cd mcp && pnpm dev                         # Start MCP server locally

# ── Testing (Go) ──
go test ./... -v                           # All unit tests
go test ./... -race                        # Race detection
go test ./internal/matching/... -v         # Test specific package
go vet ./...                               # Static analysis
golangci-lint run                          # Extended linting

# ── Testing (Sim) ──
cd sim && pnpm test                        # Sim unit tests
cd sim && pnpm test:contract               # Contract validation vs API spec

# ── Build + Deploy ──
go build ./cmd/...                         # Build all service binaries
cd sim && npm publish                      # Publish @species/sim
cd mcp && vercel --prod                    # Deploy MCP to Vercel
fly deploy --config infra/fly/api.toml     # Deploy pipeline services

# ── CLI ──
go run ./cmd/cli -- pipeline health
go run ./cmd/cli -- orders receipt evt-550e8400
go run ./cmd/cli -- treasury status
go run ./cmd/cli -- vault balance onli-user-123
```

### P2-10. Testing Strategy

| Layer | Framework | Coverage | What |
|---|---|---|---|
| Unit (Go) | Go testing + testify | 85% | Classifier (pure), matching engine, validator logic, HMAC, pipeline sequencing |
| Integration (Go) | Go testing | Critical paths | Full pipeline: EventRequest → receipt. Cashier call to MarketSB (sim or real). ChangeOwner via Onli Cloud. |
| Race | Go -race | All packages | Concurrent order processing, matching contention |
| Contract (Sim) | Vitest | 100% endpoints | Sim responses match real API shapes |
| Load | k6 | p95 < 3s | Concurrent buy orders, matching throughput |

**Critical test scenarios:**

1. Buy pipeline: EventRequest → 9 stages → Cashier call → receipt — all events emitted in order
2. Transfer pipeline: EventRequest → 8 stages (no Cashier) → AssetOracle only, no FundingOracle
3. Pre-staging failure: ChangeOwner to Settlement fails → pipeline stops → Cashier never called
4. AskToMove timeout: sell without auto-authorize → timeout → order cancelled → º unlocked
5. Auto-authorize: sell with flag → no AskToMove pause → pipeline continues immediately
6. Idempotency: duplicate EventRequest → 409, no double-processing
7. Market-first matching: user sell listing exists → buy matches user first, not Treasury
8. Split fill: large order partially matched across multiple sellers

### P2-11. Code Style

```go
// Standard Go conventions — exported PascalCase, unexported camelCase
// Files: snake_case (matching_engine.go)
// Errors: wrap with context, never swallow

package matching

import (
    "context"
    "fmt"

    "github.com/onli/species-marketplace/pkg/events"
)

// MatchResult holds the resolved counterparty and fill details.
type MatchResult struct {
    MatchID      string   `json:"matchId"`
    Counterparty string   `json:"counterparty"`
    Fills        []Fill   `json:"fills"`
    IsTreasury   bool     `json:"isTreasury"`
}

// Match resolves counterparties for an order.
// Market orders matched first. Treasury is last resort.
func (e *Engine) Match(ctx context.Context, order Order) (*MatchResult, error) {
    result, err := e.matchMarketOrders(ctx, order)
    if err != nil {
        return nil, fmt.Errorf("matching market orders: %w", err)
    }
    if result != nil {
        return result, nil
    }
    return e.matchTreasury(ctx, order)
}
```

### P2-12. Git Workflow

```
main / develop / feature/SP-{ticket}-{desc} / fix/SP-{ticket}-{desc}
```

Commit format: `<type>(sp): <description>` — e.g., `feat(sp): implement market-first matching with split fills`

### P2-13. Constraints

- **Never hold money or assets.** Species orchestrates both but possesses neither.
- **Never call Onli Cloud from the Cashier call path.** Cashier (MarketSB) only handles $. Asset delivery is a separate pipeline stage.
- **Never skip pre-staging.** If ChangeOwner to Settlement Vault fails, the pipeline must stop. Cashier must never be reached.
- **Never compute fees.** Fee calculation is MarketSB's domain. Species sends order parameters; MarketSB computes and posts.
- **Sim must match real.** Contract tests break if API shapes diverge. Sim calls `@marketsb/sim` as Cashier.
- **Transactional outbox.** Events must never be lost. At-least-once delivery via outbox + Redis Streams.

### P2-14. Timeline

| Week | Milestone |
|---|---|
| 1 | `@marketsb/sim` available (from Project 1). Begin pipeline design. |
| 2 | Sim published: `@species/sim` with full pipeline stages, WebSocket events, sim-Onli bundled |
| 3 | Sim contract tests green. Synth team can start. |
| 4 | Real: Authenticator, Marketplace API (idempotency + outbox), Validator (calls real or sim MarketSB) |
| 5 | Real: Classifier, Matching Service (market-first + Treasury fallback) |
| 6 | Real: AssetDelivery (pre-stage + deliver via Onli Cloud), Cashier integration (calls MarketSB API) |
| 7 | Real: FloorManager (dual Oracle verify, receipt), Reporter (projections) |
| 8 | MCP Server deployed. CLI operational. WebSocket gateway. Integration tests green. |
| 9 | Load test. Production deploy. Polish. |

### P2-15. Exit Criteria

1. Full pipeline: EventRequest → 9 stages → order.completed with real MarketSB + real Onli Cloud
2. Transfer pipeline: 8 stages, no Cashier call, AssetOracle only
3. Pre-staging safety: staging failure → pipeline stops → no $ moves
4. AskToMove: real push to OnliYou → approval → pipeline resumes
5. Auto-authorize: sell listing with flag → pipeline skips AskToMove
6. Matching: market-first, Treasury last resort, split fills
7. WebSocket: real-time pipeline stage events delivered to clients
8. MCP Server: all tools resolve against real API
9. CLI: all commands operational
10. `@species/sim` published, contract tests green, Synth team unblocked

---

# PROJECT 3: Onli Synth

## The Unified UI + AI Chat

**Repo:** `onli-synth`
**Language:** TypeScript (React)
**Domain:** Presentation, chat modes, confirmation gates, pipeline visualization. Computes nothing. Displays server-side values.

### P3-1. What This Project Delivers

| Deliverable | Description |
|---|---|
| **React Frontend** | Three-panel layout, Neich/Species tabs, AI chat (Ask/Trade/Learn), all pages, all cards |
| **No backend** | Imports `@marketsb/sim` + `@species/sim` for local dev. Connects to real APIs in production. |

### P3-2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ONLI SYNTH                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    React Application                     │    │
│  │                                                          │    │
│  │  Layout: Sidebar (240px) + Left Panel (340px) +         │    │
│  │          Chat Center (666px)                             │    │
│  │                                                          │    │
│  │  Pages: Home, Transactions, Assets, Assurance,           │    │
│  │         Contacts, Analytics, Settings                    │    │
│  │                                                          │    │
│  │  Modes: Ask (FAQ) · Trade (MCP tools) · Learn (KB)      │    │
│  └──────────┬───────────────────────────┬───────────────────┘    │
│             │                           │                        │
│  ┌──────────▼──────────┐    ┌───────────▼──────────┐            │
│  │ MarketSB Client     │    │ Species Client       │            │
│  │ (typed interface)   │    │ (typed interface)    │            │
│  │                     │    │                      │            │
│  │ dev: @marketsb/sim  │    │ dev: @species/sim    │            │
│  │ prod: real API      │    │ prod: real API       │            │
│  └─────────────────────┘    └──────────────────────┘            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ AI Chat (Anthropic API + dual MCP)                    │       │
│  │                                                       │       │
│  │ MCP 1: MarketSB tools (read + write)                 │       │
│  │ MCP 2: Species/Onli tools (read + write)             │       │
│  │                                                       │       │
│  │ Write tools → Confirmation Card → user Confirm/Cancel │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### P3-3. Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 18+ with TypeScript |
| Build | Vite |
| Styling | Tailwind CSS with design tokens |
| Components | shadcn/ui |
| State | Zustand (client) + TanStack Query (server) |
| AI Chat | Anthropic API (claude-sonnet-4-20250514) via dual MCP |
| Charts | Recharts |
| Font | Manrope |
| Real-time | WebSocket (unified, `source` discriminator) + polling fallback |
| Testing | Vitest + React Testing Library + Playwright |

### P3-4. Design System Tokens

**Colors:**

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#FFFFFF` | Main background |
| `--bg-card` | `#FAFAFA` | Card surfaces |
| `--bg-sidebar` | `#F5F5F5` | Sidebar |
| `--cta-primary` | `#2D2D2D` | Primary buttons |
| `--accent-green` | `#C5DE8A` | Toggle active, success, online |
| `--accent-amber` | `#FFCE73` | Warnings, assurance alerts |
| `--accent-red` | `#E74C3C` | Log Out, critical alerts |
| `--text-primary` | `#1A1A1A` | Headings |
| `--text-secondary` | `#6B6B6B` | Labels |
| `--border` | `#E5E5E5` | Card borders |

**Typography:** Manrope. Body 14/400. Label 11/600 uppercase tracking 0.08em. Card title 16/600. Balance large 28/700. Nav 14/500.

**Shape:** Card radius 20px. Button radius 12px. Input radius 10px. Card padding 24px. Shadow `0 2px 8px rgba(0,0,0,0.04)`.

### P3-5. UI Components

#### Left Panel

| Component | Data Source | Description |
|---|---|---|
| **Tab Switcher** | Local state | Neich (USDC) ↔ Species (Asset). Changes Fund card + balance + contact actions. |
| **Fund Card** | Neich: MarketSB deposit flow. Species: Species buy EventRequest. | Amount input, Pay With dropdown, Approve button. Adapts per tab. |
| **Balance View** | Neich: MarketSB `GET /virtual-accounts/{funding_va}`. Species: MarketSB `GET /virtual-accounts/{species_va}` + Species `GET /vault/{uid}`. | Toggle between Funding ($) and Asset (º). Cross-reference warning if divergence. |
| **Assurance Card** | MarketSB: Assurance VA balance + Species: total outstanding. | Balance, Total Outstanding, Coverage %, threshold badges (≥50% green, <50% amber, <25% red). |
| **Contact List** | Local storage + MarketSB VA refs + Onli addresses. | Add contact, tap → transfer drawer. Neich: USDC transfer. Species: Specie transfer. |

#### Chat Center

| Component | Description |
|---|---|
| **Welcome State** | TRANSACTION PROTECTED badge, "Welcome, {name}!", 4 quick action chips |
| **Message Types** | User bubble (dark, right), AI bubble (light, left), typing indicator, confirmation card, pipeline card, receipt card |
| **Mode Tabs** | Ask (FAQ, no API), Trade (MCP tools, confirmation gates), Learn (KB search) |
| **Input Bar** | Sparkle icon, text input, mic placeholder, send button. Disabled during active journey. |
| **Pipeline Card** | 9-stage (Buy), 8-stage (Transfer). Stages: pending → running (amber pulse) → done (green check). Auth wait: amber + "Check your OnliYou app". |
| **Confirmation Card** | All write operations. Shows full order summary. Confirm / Cancel required. |
| **Receipt Card** | Terminal card on order.completed. eventId, tbBatchId, quantities, fees, oracle refs. |

#### Pages

| Page | Data Sources |
|---|---|
| **Transactions** | Merged: MarketSB deposits/withdrawals/transfers + Species orders. Filters: type, system, status, date, amount. Detail drawer: lifecycle + Oracle trail + eventReceipt. |
| **Assets** | MarketSB VA list + Onli Vault contents. Per-VA card. Reconciliation warning if divergence. |
| **Assurance** | Coverage chart, reserve health, issuance tracking, backing ratio, risk alerts, run reconciliation (operator). |
| **Analytics** | Funding over time, asset over time, volume, coverage trend, fee summary, marketplace metrics. |
| **Settings** | Profile, security, Onli identity, notifications, deposit addresses. |

### P3-6. Safeguards (non-negotiable)

| ID | Safeguard | How Verified |
|---|---|---|
| F238 | No financial logic in UI | Audit: no arithmetic on amounts in any component. Display-only formatting. |
| F239 | Confirmation gate on all writes | E2E: every write tool → confirmation card rendered → must tap Confirm |
| F240 | AI hallucination guard | E2E: prompt AI for balance → response only contains MCP tool result data |
| F237 | Dual session destroy on logout | E2E: logout → both platform + Onli sessions terminated |
| F159 | Chat locked during journey | E2E: active pipeline → input bar disabled → only journey controls |
| F220 | Role-based access | E2E: business user cannot access operator routes |

### P3-7. Client Interface Pattern

The key architectural pattern: typed client interfaces with swappable backends.

```typescript
// src/lib/api/marketsb-client.ts
import type { BalanceDTO, DepositDTO } from '@marketsb/shared';

interface MarketSBClient {
  getVirtualAccount(vaId: string): Promise<BalanceDTO>;
  listVirtualAccounts(ownerRef: string): Promise<BalanceDTO[]>;
  getDeposit(depositId: string): Promise<DepositDTO>;
  createWithdrawal(params: WithdrawalRequest): Promise<WithdrawalDTO>;
  createTransfer(params: TransferRequest): Promise<TransferDTO>;
  // ... all endpoints
}

// Development: backed by @marketsb/sim
export function createSimClient(simUrl: string): MarketSBClient { ... }

// Production: backed by real API
export function createRealClient(apiUrl: string, token: string): MarketSBClient { ... }

// Selected by environment variable
export const marketsb: MarketSBClient =
  import.meta.env.VITE_USE_SIM === 'true'
    ? createSimClient(import.meta.env.VITE_MARKETSB_SIM_URL)
    : createRealClient(import.meta.env.VITE_MARKETSB_API_URL, getToken());
```

Same pattern for Species client. The swap from sim to real is a config change, not a code change.

### P3-8. Repo Structure

```
onli-synth/
├── src/
│   ├── components/
│   │   ├── chat/                          # AI chat UI
│   │   │   ├── chat-center.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── typing-indicator.tsx
│   │   │   ├── confirmation-card.tsx
│   │   │   ├── pipeline-card.tsx
│   │   │   ├── receipt-card.tsx
│   │   │   ├── welcome-state.tsx
│   │   │   ├── mode-tabs.tsx
│   │   │   └── input-bar.tsx
│   │   ├── financial/                     # Left panel
│   │   │   ├── tab-switcher.tsx
│   │   │   ├── fund-card.tsx
│   │   │   ├── balance-view.tsx
│   │   │   ├── assurance-card.tsx
│   │   │   └── contact-list.tsx
│   │   ├── layout/                        # Shell
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── three-panel.tsx
│   │   └── shared/                        # Reusable
│   │       ├── status-badge.tsx
│   │       ├── lifecycle-stepper.tsx
│   │       ├── amount-display.tsx
│   │       └── loading-skeleton.tsx
│   ├── hooks/
│   │   ├── use-balance.ts
│   │   ├── use-vault.ts
│   │   ├── use-pipeline.ts
│   │   ├── use-chat.ts
│   │   ├── use-websocket.ts
│   │   └── use-amount.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── marketsb-client.ts        # Typed interface + sim/real swap
│   │   │   ├── species-client.ts         # Typed interface + sim/real swap
│   │   │   └── websocket.ts             # Unified WS with source discriminator
│   │   ├── mcp/
│   │   │   ├── marketsb-tools.ts         # MCP tool definitions
│   │   │   └── species-tools.ts          # MCP tool definitions
│   │   └── amount.ts                     # Display formatting only (no arithmetic)
│   ├── stores/
│   │   ├── auth-store.ts                 # Platform + Onli identity
│   │   ├── mode-store.ts                 # Ask / Trade / Learn
│   │   └── journey-store.ts             # Active pipeline state, chat lock
│   ├── pages/
│   │   ├── home.tsx
│   │   ├── transactions.tsx
│   │   ├── assets.tsx
│   │   ├── assurance.tsx
│   │   ├── contacts.tsx
│   │   ├── analytics.tsx
│   │   └── settings.tsx
│   ├── __tests__/                         # Unit tests (colocated pattern also OK)
│   ├── App.tsx
│   └── main.tsx
│
├── e2e/                                    # Playwright E2E tests
│   ├── fund-journey.spec.ts
│   ├── buy-journey.spec.ts
│   ├── sell-journey.spec.ts
│   ├── transfer-journey.spec.ts
│   ├── sendout-journey.spec.ts
│   ├── safeguards.spec.ts                # All F231–F240 verification
│   ├── chat-modes.spec.ts
│   └── operator-tools.spec.ts
│
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json                           # deps: @marketsb/sim, @species/sim (devDeps)
├── .env.example                           # VITE_USE_SIM, VITE_MARKETSB_API_URL, etc.
└── README.md
```

### P3-9. Commands

```bash
# ── Setup ──
pnpm install                               # Installs @marketsb/sim + @species/sim as devDeps

# ── Development (sim mode) ──
pnpm dev:sims                              # Start both sim servers (ports 3101 + 3102)
pnpm dev                                   # Vite dev server (reads from sims)
# These two commands are all you need for full local development.

# ── Development (real mode) ──
VITE_USE_SIM=false pnpm dev                # Connect to real APIs (requires running services)

# ── Testing ──
pnpm test                                  # Vitest unit + component tests
pnpm test:e2e                              # Playwright against sims (auto-starts sims)
pnpm test:e2e:real                         # Playwright against real APIs
pnpm test:coverage                         # Coverage report (target: 80%)
pnpm test:safeguards                       # Dedicated safeguard verification suite

# ── Build + Deploy ──
pnpm build                                 # Production build
pnpm preview                               # Preview production build locally
# Deploy to Vercel / Netlify / static host

# ── Linting ──
pnpm lint                                  # ESLint --max-warnings 0
pnpm typecheck                             # tsc --noEmit
```

### P3-10. Testing Strategy

| Layer | Framework | Coverage | What |
|---|---|---|---|
| Unit | Vitest + RTL | 80% | Components, hooks, amount formatting, store logic |
| E2E | Playwright | 100% critical paths | All 5 journeys, all safeguards, mode switching, tab switching |
| Safeguard | Playwright (dedicated suite) | 100% of F231–F240 | Confirmation gates, hallucination guard, chat lock, role guards |
| Visual | Playwright screenshots | Key states | Pipeline card stages, assurance thresholds, error states |

**Critical test scenarios:**

1. Buy journey: enter quantity → confirmation card → confirm → 9-stage pipeline card → receipt card → balance updated
2. Pre-staging failure: sim injects error at asset.staged → pipeline card shows error → no balance change → "No funds were charged"
3. AskToMove timeout: sell without auto-authorize → amber wait state → sim timeout → "Order cancelled"
4. Hallucination guard: in Trade mode, ask "what's my balance?" → verify AI response only contains MCP tool result, no fabricated numbers
5. Chat lock: start buy → verify input bar disabled → order completes → verify input bar re-enabled
6. Tab switch: set Neich balance → switch to Species → switch back → Neich balance preserved
7. Dual-balance cross-reference: set sim-Onli Vault count ≠ MarketSB Species VA → verify amber warning appears

### P3-11. Code Style

```typescript
// Same conventions as @marketsb/shared
// CRITICAL: never compute amounts — only format for display

import { useQuery } from '@tanstack/react-query';
import { marketsb } from '../lib/api/marketsb-client';

const POLL_INTERVAL_MS = 5_000;

interface FundingBalanceProps {
  vaId: string;
}

export function FundingBalance({ vaId }: FundingBalanceProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['virtual-account', vaId],
    queryFn: () => marketsb.getVirtualAccount(vaId),
    refetchInterval: POLL_INTERVAL_MS,
  });

  if (isLoading) return <BalanceSkeleton />;

  // FORMAT only — the integer comes from the server, we just display it
  // Never: data.balance.posted * 1.02 (NO ARITHMETIC)
  const display = formatUsdDisplay(data.balance.posted);

  return (
    <div className="text-[28px] font-bold text-[--text-primary]">
      {display}
    </div>
  );
}

// src/lib/amount.ts — display formatting ONLY
export function formatUsdDisplay(baseUnits: bigint): string {
  const dollars = Number(baseUnits / 1_000_000n);
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatSpecieCount(count: number): string {
  return count.toLocaleString('en-US');
}
```

### P3-12. Git Workflow

```
main / develop / feature/SY-{ticket}-{desc} / fix/SY-{ticket}-{desc}
```

Commit format: `<type>(sy): <description>` — e.g., `feat(sy): add 9-stage pipeline card with WebSocket updates`

### P3-13. Constraints

- **Never compute financial amounts.** `src/lib/amount.ts` contains ONLY formatting functions. No arithmetic.
- **Never generate financial data from AI training.** MCP tool results only. Verified by safeguard tests.
- **Never allow mutations without confirmation.** Every write → confirmation card → Confirm tap required.
- **Never call Onli Cloud directly.** All asset operations go through the Species API. Synth knows two APIs: MarketSB and Species.
- **Never process AskToMove in UI.** Authorization happens on OnliYou only. Chat shows amber wait state.
- **Sim imports are devDependencies only.** Production bundle must not contain sim code.

### P3-14. Timeline

| Week | Milestone |
|---|---|
| 1 | `@species/sim` available (from Project 2, which depends on `@marketsb/sim` from Project 1) |
| 2 | Scaffold: Vite + React + Tailwind + shadcn/ui + design tokens + layout shell + sim startup script |
| 3 | Neich tab: Fund card, deposit lifecycle stepper, Funding balance, assurance card |
| 4 | Species tab: buy flow, 9-stage pipeline card, asset balance, cross-reference |
| 5 | Sell + Transfer flows, auto-authorize, AskToMove amber state, 8-stage card |
| 6 | Transactions page, merged history, filters, detail drawer, oracle trail |
| 7 | AI Chat: bubbles, modes, dual MCP, read tools, write tools with confirmation |
| 8 | Operator: assurance dashboard, reconciliation, wallet views, analytics, role guards |
| 9 | Polish: WebSocket real-time, error handling, skeletons, responsive, a11y |
| 10 | E2E suite green against sims. Safeguard suite green. Performance pass. |

### P3-15. Exit Criteria

1. All five journeys work end-to-end against sim backends
2. All safeguards (F231–F240) pass dedicated Playwright verification suite
3. Pipeline cards animate correctly: Buy (9), Sell (9 + auth), Transfer (8)
4. AI chat: dual MCP reads resolve, writes gate behind confirmation, hallucination guard holds
5. Tab switch Neich ↔ Species: seamless, no reload, state preserved
6. Swap to real APIs: change `VITE_USE_SIM=false` → same E2E tests pass against real services
7. Amount formatting: zero drift across all display paths
8. All pages populated and functional: Transactions, Assets, Assurance, Analytics, Settings
9. Responsive + accessible (WCAG 2.1 AA)
10. Bundle < 200KB gzip, initial load < 3s

---

## Cross-Project Specifications

### Success Metrics (Full System)

| Metric | Target |
|---|---|
| Buy order completion rate (V3 real) | > 95% |
| End-to-end buy latency | < 5 seconds |
| USDC transfer perceived latency | < 500ms |
| Assurance coverage accuracy | 0 variance |
| AI dual-system resolution | > 70% queries without escalation |
| Financial display errors | 0 |
| Reconciliation pass rate | > 99.9% zero-variance runs |
| P95 API latency | < 3 seconds |
| Uptime (V3 production) | > 99.95% |
| E2E pass rate (Synth against real) | 100% |

### Shared Constraints (All Projects)

- **Never commit secrets.** `.env` files gitignored. Platform secret stores only.
- **Sim must match real.** Contract tests in every sim package validate response shapes.
- **Terminology is precise.** Wallets ≠ Accounts ≠ Vaults. $ = USDC. º = Specie.
- **The pre-staging rule is inviolable.** No $ moves until º is staged in Settlement Vault.
- **Both Oracles are complete.** Every $ movement → FundingOracle. Every º movement → AssetOracle.

### Integration Test (Cross-Project, V3)

After all three projects are deployed, the full lifecycle integration test runs:

```
1. Fund:     Deposit USDC → MarketSB chain indexer → Funding VA credited
2. Buy:      EventRequest → Species pipeline → MarketSB Cashier batch → Onli Cloud ChangeOwner → Receipt
3. Transfer: EventRequest → Species pipeline (no Cashier) → Onli Cloud ChangeOwner → AssetOracle only
4. Sell:     EventRequest → AskToMove (or auto-authorize) → Cashier → ChangeOwner → Funding credited
5. SendOut:  Withdrawal → policy → broadcast → confirmed → USDC on-chain

Verify: Funding VA balance, Species VA balance, Onli Vault count, FundingOracle entries, AssetOracle entries, Assurance coverage %, reconciliation zero variance.
```

---

*Three projects. Three repos. Three teams. Each ships API + MCP + CLI + Sim. Synth consumes both. The sim IS the contract.*
