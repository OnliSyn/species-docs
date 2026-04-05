---
name: species-sim
description: "@species/sim 패키지 구현 — Species Marketplace 9단계 파이프라인 + sim-Onli Cloud(Vault, ChangeOwner, AskToMove)를 시뮬레이션하는 서버. WebSocket으로 실시간 단계 이벤트 전송. MarketSB sim을 Cashier로 호출하여 잔액이 실제 변경됨. @species/sim, Species sim, 파이프라인 시뮬레이터, sim-Onli, Vault 시뮬레이션 구현 시 반드시 사용."
---

# @species/sim

Species Marketplace 파이프라인 + sim-Onli Cloud 시뮬레이션 서버. `packages/species-sim/`에 구현한다.

## Factory Pattern

```typescript
import { createSpeciesSim } from '@species/sim';

const sim = createSpeciesSim({
  port: 4002,
  marketsbUrl: 'http://localhost:4001/api/v1',
  pipelineDelays: {
    authenticated: 100,
    validated: 300,
    classified: 100,
    matched: 200,
    assetStaged: 700,
    paymentConfirmed: 800,
    ownershipChanged: 800,
    completed: 200,
  },
  askToMoveTimeoutSeconds: 300,
});

await sim.start();  // Express on http://localhost:4002/marketplace/v1/...
await sim.stop();   // WS on ws://localhost:4002/events/:eventId/stream
```

## State Model

```typescript
interface SpeciesSimState {
  // Pipeline
  orders: Map<string, OrderState>;
  listings: Map<string, ListingState>;
  idempotencyKeys: Set<string>;

  // Sim-Onli
  vaults: {
    treasury: { count: number };
    settlement: { count: number };
    users: Map<string, { count: number; history: VaultEvent[] }>;
  };
  pendingAskToMove: Map<string, AskToMoveRequest>;
  assetOracleLog: AssetOracleEntry[];

  // Config
  errorInjections: Map<string, boolean>;  // stage → fail
  stageDelays: Record<string, number>;
}
```

## Pipeline Engine

On `POST /eventRequest` → returns 202 immediately. Background pipeline:

### Buy (9 stages):
1. `request.submitted` — ingress + idempotency
2. `request.authenticated` — HMAC stub (always passes in sim)
3. `order.validated` — check user exists, funding balance sufficient, treasury has stock
4. `order.classified` — intent routing (pure)
5. `order.matched` — market-first matching against active listings, Treasury fallback
6. `asset.staged` — ChangeOwner: Treasury/Seller Vault → Settlement Vault
7. `payment.confirmed` — **Call MarketSB sim POST /cashier/post-batch** (real HTTP call)
8. `ownership.changed` — ChangeOwner: Settlement Vault → Buyer Vault
9. `order.completed` — compose eventReceipt

### Sell (9 stages + optional AskToMove pause):
Same as Buy but:
- Stage 6: if `!autoAuthorize` → AskToMove pause (requires /sim/approve/:eventId)
- Cashier batch is 3 transfers (buyer pays seller)

### Transfer (8 stages, no Cashier):
- No Cashier call (no $ movement)
- Stage 5: AskToMove (always required for transfers)
- Stage 7: ChangeOwner: Sender Vault → Receiver Vault
- No FundingOracle entries

Each stage emits a WebSocket event and advances after `pipelineDelays[stage]` ms.

## Sim-Onli Cloud

### Vaults
- Treasury: starts at 1,000,000,000 Specie
- Settlement: starts at 0
- Users: Map of onliId → count

### ChangeOwner
Moves count between vaults. Validates source has sufficient count.

### AskToMove
For sell(!autoAuthorize) and transfer:
- Pipeline pauses at the staging stage
- `POST /sim/approve/:eventId` resumes pipeline
- After `askToMoveTimeoutSeconds`: pipeline cancelled, counts restored

## WebSocket

`WS /events/:eventId/stream`

Emits JSON frames per stage:
```json
{
  "source": "species",
  "eventId": "evt-550e8400",
  "stage": "order.validated",
  "timestamp": "2026-04-03T12:00:00.35Z",
  "data": { "validationResult": "passed" }
}
```

Client connects after receiving 202. Events stream in order. Connection closes on `order.completed` or `order.failed`.

## API Contract (spec P2-4)

Base: `/marketplace/v1`

- `POST /eventRequest` → 202 + `{ eventId, status, pipelineStage, wsChannel }`
- `GET /events/:eventId/receipt` → EventReceiptDTO
- `GET /events/:eventId/status` → PipelineStatusDTO (current stage + all completed stages)
- `GET /stats` → MarketplaceStatsDTO
- `GET /listings` → ListingDTO[]
- `GET /listings/:listingId` → ListingDTO
- `GET /vault/:uid` → VaultBalanceDTO
- `GET /vault/:uid/history` → VaultHistoryDTO[]

## Control Panel

- `POST /sim/reset` — Reset all state
- `GET /sim/state` — Dump pipeline + Onli state
- `GET /sim/onli/state` — Dump Onli state only
- `POST /sim/approve/:eventId` — Approve AskToMove (resume pipeline)
- `POST /sim/inject-error/:stage` — Fail at stage
- `POST /sim/set-delay/:stage/:ms` — Override stage timing
- `POST /sim/set-config` — Override config

## Cashier Integration

At `payment.confirmed` stage, the sim makes a real HTTP call to MarketSB sim:

```typescript
const response = await fetch(`${marketsbUrl}/cashier/post-batch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId, matchId, intent, quantity,
    buyerVaId, sellerVaId, unitPrice: 1000000,
    fees: { issuance: intent === 'buy', liquidity: true, listing: false },
  }),
});
```

This means MarketSB sim's VA balances actually change during a Species buy order — the Synth frontend sees real balance updates.

Refer to `references/three-project-spec.md` P2-7 for full sim spec.
