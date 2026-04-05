# Onli AI — Journey Specifications

## Complete Step-by-Step for All Five Journeys

**Version:** 1.0 · **Date:** April 2026

Each journey is traced through all three projects: what the user sees (Synth), what the pipeline does (Species), and what the financial/asset engines do (MarketSB / Onli Cloud). Every API call, every event, every state change, every UI transition.

---

## Notation

```
$   = USDC (money, managed by MarketSB)
º   = Specie (asset, managed by Onli Cloud)
→   = data flow / state transition
⛔  = failure path
✅  = success path
⏸   = pipeline pause (waiting for external input)
🔒  = chat locked (input bar disabled)
🔓  = chat unlocked (input bar re-enabled)
```

**Amount example used throughout:** 1,000 º at $1.00 each.

```
Asset cost:     1,000 × $1.00 = $1,000.00     (1_000_000_000 base units)
Issuance fee:   1,000 × $0.01 =    $10.00        (10_000_000 base units)
Liquidity fee:  $1,000 × 2%   =    $20.00        (20_000_000 base units)
Total debit:                     $1,030.00     (1_030_000_000 base units)
```

---

## Journey 1: FUND

### Purpose

Move $ from an external USDC wallet into the user's MarketSB Funding Account. No assets involved. No Species pipeline. Pure MarketSB operation.

### Systems Involved

| System | Involved | Role |
|---|---|---|
| MarketSB-USDC | Yes | Deposit detection, compliance, credit |
| Species Marketplace | No | — |
| Onli Cloud | No | — |
| Onli Synth | Yes | Display deposit address, poll lifecycle, update balance |

### Preconditions

- User is authenticated (platform + Onli identity)
- User has a Funding Account (VA, code 500) in MarketSB
- Neich tab is active in left panel
- User has an external USDC wallet with sufficient balance

### Step-by-Step

#### Step 1 — User enters amount

**Synth UI:**
- User is on Neich tab
- Fund card shows: amount input (0.00 USDC), Pay With dropdown (connected wallet addresses), Approve button
- User types `5000.00` into amount input
- Pay With shows `USDC (0x...4a2b)` — their connected external wallet

**State:** No API calls yet. Pure client-side input.

#### Step 2 — User taps Approve

**Synth UI:**
- Confirmation card appears in chat:

```
┌─────────────────────────────────────┐
│  FUND YOUR ACCOUNT                  │
│                                     │
│  Amount:     $5,000.00 USDC         │
│  From:       0x...4a2b (external)   │
│  To:         Funding Account        │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ Confirm  │  │  Cancel  │        │
│  └──────────┘  └──────────┘        │
└─────────────────────────────────────┘
```

- 🔒 Chat input bar disabled

#### Step 3 — User taps Confirm

**Synth → MarketSB API:**
```
GET /api/v1/virtual-accounts/{funding_va_id}
```

**MarketSB responds** with the VA's `depositAddress`:
```json
{
  "vaId": "va-funding-user-123",
  "depositAddress": "0x7890...deposit",
  ...
}
```

**Synth UI:**
- Displays deposit address prominently: `0x7890...deposit`
- Shows QR code for the address
- Shows instruction: "Send $5,000.00 USDC to this address on Base"
- Begins polling for deposit detection

#### Step 4 — User sends USDC on-chain

**External (outside Onli system):**
- User opens their wallet app (MetaMask, Coinbase, etc.)
- Sends 5,000 USDC to the displayed deposit address on Base network
- Transaction broadcasts to the Base blockchain

**State:** MarketSB is not yet aware. Waiting for chain indexer to detect.

#### Step 5 — Chain indexer detects deposit

**MarketSB internal (DepositService):**
- Chain indexer monitors the Base blockchain for USDC transfers to known deposit addresses
- Detects the incoming transaction
- Creates deposit record:

```
DepositService.detectDeposit({
  vaId: "va-funding-user-123",
  amount: 5_000_000_000n,        // 5,000 USDC in base units
  txHash: "0xabc123...",
  chain: "base",
  blockNumber: 12345678
})
```

- Deposit status → `detected`
- Emits event via Redis Streams: `deposit.detected`
- FundingOracle write: `{ type: "deposit_detected", vaId, amount, txHash }`

**Synth (polling):**
```
GET /api/v1/deposits/{depositId}
→ { status: "detected", lifecycle: [{ state: "detected", timestamp: "..." }] }
```

**Synth UI:**
- Lifecycle stepper appears:
  - ● Detected (green check)
  - ○ Compliance check (pending)
  - ○ Credited (pending)

#### Step 6 — Compliance check

**MarketSB internal (DepositService → compliance module):**
- Deposit status → `compliance_pending`
- Compliance check runs on the Incoming Wallet:
  - Source address verification
  - Amount threshold checks
  - Sanctions/watchlist screening
- If passed → status → `compliance_passed`
- If failed → status → `compliance_failed` → flow stops, user notified

**⛔ Compliance failure path:**
```
Deposit status → compliance_failed
Funds held in Incoming Wallet (not posted to MarketWallet)
FundingOracle write: { type: "compliance_failed", reason: "..." }
Synth UI: stepper shows ✕ on compliance step, error message displayed
🔓 Chat unlocked
```

**✅ Compliance passed:**
```
FundingOracle write: { type: "compliance_passed", vaId, amount }
```

**Synth (polling):**
```
GET /api/v1/deposits/{depositId}
→ { status: "compliance_passed", lifecycle: [..., { state: "compliance_passed" }] }
```

**Synth UI:**
- Stepper updates:
  - ● Detected (green check)
  - ● Compliance passed (green check)
  - ○ Credited (pending, spinner)

#### Step 7 — Credit to Funding Account

**MarketSB internal (DepositService → LedgerService):**
- Moves funds: Incoming Wallet → MarketWallet → Funding Account
- TigerBeetle transfer:

```
Transfer:
  Debit:  Incoming Wallet (system)     5,000,000,000
  Credit: User Funding VA (500)        5,000,000,000
```

- Deposit status → `credited`
- FundingOracle write: `{ type: "deposit_credited", vaId, amount, tbTransferId }`

**MarketSB internal (continued):**
- Deposit status → `registered` (final)
- FundingOracle write: `{ type: "deposit_registered", vaId, depositId }`

**Synth (polling):**
```
GET /api/v1/deposits/{depositId}
→ { status: "registered", lifecycle: [..., { state: "credited" }, { state: "registered" }] }
```

**Synth UI:**
- Stepper completes:
  - ● Detected (green check)
  - ● Compliance passed (green check)
  - ● Credited (green check)
- Balance View refreshes:
  - **Before:** $12,450.00
  - **After:** $17,450.00
- Success message in chat: "Deposit complete — $5,000.00 credited to your Funding Account"
- 🔓 Chat unlocked

### Fund — State Changes Summary

| System | Before | After |
|---|---|---|
| External wallet | 5,000 USDC | 0 USDC (sent) |
| MarketSB Incoming Wallet | +5,000 USDC (transit) | 0 (forwarded) |
| MarketSB MarketWallet | +5,000 USDC | +5,000 USDC (pool) |
| User Funding VA (500) | $12,450.00 | $17,450.00 |
| FundingOracle | — | 3 entries (detected, compliance_passed, credited) |

### Fund — Sim Behavior (`@marketsb/sim`)

```
1. GET /virtual-accounts/{id} → returns depositAddress from sim state
2. Sim auto-creates deposit record on POST /sim/trigger-deposit (or auto-detect timer)
3. Deposit auto-advances through lifecycle on configurable timer:
   t+0ms: detected
   t+DEPOSIT_LIFECYCLE_DELAY_MS: compliance_pending
   t+DEPOSIT_LIFECYCLE_DELAY_MS×2: compliance_passed
   t+DEPOSIT_LIFECYCLE_DELAY_MS×3: credited → sim VA balance increases
   t+DEPOSIT_LIFECYCLE_DELAY_MS×4: registered
4. Polling GET /deposits/{id} returns current lifecycle state
5. Error injection: POST /sim/inject-error/compliance → forces compliance_failed
```

---

## Journey 2: BUY

### Purpose

User pays $ to acquire º. $ moves from Buyer's Funding Account through the Cashier (MarketSB). º moves from Treasury Vault (or Seller Vault) through Onli Cloud to the Buyer's Vault. This is the most complex journey — it touches all three systems and flows through the full 9-stage Species pipeline.

### Systems Involved

| System | Involved | Role |
|---|---|---|
| MarketSB-USDC | Yes | Cashier — posts 5-transfer TigerBeetle batch, fees, FundingOracle |
| Species Marketplace | Yes | Full 9-stage pipeline orchestration |
| Onli Cloud | Yes | Pre-stage (ChangeOwner to Settlement Vault), deliver (ChangeOwner to User Vault) |
| Onli Synth | Yes | Pipeline card, confirmation, receipt, balance updates |

### Preconditions

- User authenticated (platform + Onli identity)
- User has Funding VA (500) with sufficient balance (≥ $1,030.00 for 1,000 º)
- User has Species VA (510) in MarketSB
- User has a Vault in Onli Cloud (via OnliYou)
- Species tab is active in left panel

### Step-by-Step

#### Stage 0 — User enters quantity and confirms

**Synth UI:**
- User is on Species tab
- Fund card shows: quantity input, "Pay With: USDC (0x...4a2b)" (their Funding VA), Approve button
- User types `1000` into quantity input
- UI displays fee preview (fetched from Species API or computed from known rates — display only, no client arithmetic):

```
Quantity:       1,000 SPECIES
Unit price:     $1.00
Asset cost:     $1,000.00
Issuance fee:   $10.00
Liquidity fee:  $20.00
─────────────────────────
Total:          $1,030.00
```

- User taps Approve
- 🔒 Chat locked — input bar disabled
- Confirmation card appears:

```
┌──────────────────────────────────────────┐
│  BUY 1,000 SPECIES                       │
│                                          │
│  Asset cost:     $1,000.00               │
│  Issuance fee:      $10.00               │
│  Liquidity fee:     $20.00               │
│  Total:          $1,030.00               │
│                                          │
│  From: Funding Account ($17,450.00)      │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │ Confirm  │  │  Cancel  │             │
│  └──────────┘  └──────────┘             │
└──────────────────────────────────────────┘
```

- User taps Confirm

#### Stage 1 — request.submitted

**Synth → Species API:**
```
POST /marketplace/v1/eventRequest
Headers: X-API-Key, X-Signature (HMAC), X-Nonce, X-Timestamp, X-Onli-Identity

{
  "eventId": "evt-550e8400",
  "intent": "buy",
  "quantity": 1000,
  "paymentSource": { "vaId": "va-funding-user-123" },
  "idempotencyKey": "buy-user123-1714000000"
}
```

**Species API responds:**
```json
{
  "eventId": "evt-550e8400",
  "status": "accepted",
  "pipelineStage": "request.submitted",
  "wsChannel": "/events/evt-550e8400/stream"
}
```

**Synth UI:**
- Connects to WebSocket: `ws://api.species.market/events/evt-550e8400/stream`
- 9-stage pipeline card appears:

```
┌──────────────────────────────────────────┐
│  BUY 1,000 SPECIES                       │
│                                          │
│  ◉ Submitted            SM    done       │
│  ○ Authenticating        SM    pending    │
│  ○ Validating            SM    pending    │
│  ○ Matching              SM    pending    │
│  ○ Staging asset         OC    pending    │
│  ○ Processing payment    MB    pending    │
│  ○ Delivering to Vault   OC    pending    │
│  ○ Verifying             SM    pending    │
│  ○ Complete              SM    pending    │
└──────────────────────────────────────────┘
```

#### Stage 2 — request.authenticated

**Species Pipeline (Authenticator node):**
1. Validate HMAC signature: `HMAC-SHA256(body + nonce + timestamp, apiSecret)` matches `X-Signature`
2. Validate nonce uniqueness: `Redis SET NX nonce:{nonce} EX 300` — if key exists, replay attack → reject
3. Validate timestamp: within 5-minute window of server time
4. Call Onli Cloud `AuthorizeBehavior`:

```
Onli Cloud API:
POST /authorize-behavior
{ "onliId": "onli-user-123", "action": "marketplace_order", "eventId": "evt-550e8400" }
→ { "authorized": true }
```

5. Emit: `request.authenticated`

**⛔ Auth failure:**
```
HMAC invalid OR nonce replay OR timestamp stale OR AuthorizeBehavior denied
→ Pipeline stops immediately
→ Species responds 401 to original POST
→ Synth UI: error message, pipeline card never appears
→ 🔓 Chat unlocked
```

**WebSocket → Synth:**
```json
{ "source": "species", "eventId": "evt-550e8400", "stage": "request.authenticated" }
```

**Synth UI pipeline card:**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done       ← green check
○ Validating            SM    pending    ← next
...
```

#### Stage 3 — order.received

**Species Pipeline (Marketplace API node):**
1. Check idempotency: lookup `idempotencyKey` in PostgreSQL `event_ingress` table
   - If exists → return 409 with existing eventId
   - If new → persist ingress record
2. Enqueue to pipeline via transactional outbox:
   - Insert `event_ingress` row + `outbox_events` row in same PostgreSQL transaction
   - Background worker reads outbox → publishes to Redis Streams
   - Guarantees at-least-once delivery even if process crashes between insert and publish
3. Emit: `order.received`

#### Stage 4 — order.validated

**Species Pipeline (Validator node):**

Three provider checks, all must pass:

**Check 1 — UserProvider (Onli Cloud):**
```
Onli Cloud API:
GET /user/{onliId}/status
→ { "exists": true, "status": "active", "vaultId": "vault-user-123" }
```
Confirms user is a verified Onli owner with an active Vault.

**Check 2 — PaymentProvider (MarketSB — direct call):**
```
MarketSB API:
GET /api/v1/virtual-accounts/va-funding-user-123
→ { "balance": { "available": 17450000000 } }
```
Available balance (17,450,000,000) ≥ required total (1,030,000,000) → ✅

**Check 3 — AssetProvider (Onli Cloud):**
```
Onli Cloud API:
GET /vault/treasury/balance
→ { "count": 999987600 }
```
Treasury has ≥ 1,000 º available → ✅

**⛔ Validation failures:**
```
UserProvider failed → "Both parties must be verified Onli owners"
PaymentProvider failed → "Insufficient funds — need $1,030.00, have $X"
AssetProvider failed → "Insufficient Specie available in Treasury"

→ Pipeline stops at order.validated with error
→ WebSocket: { stage: "order.validated", data: { error: "insufficient_funds", ... } }
→ Synth pipeline card: ✕ on Validating stage, error message
→ No $ moves, no º moves
→ 🔓 Chat unlocked
```

**✅ All checks pass:**
- Emit: `order.validated`

**Synth UI pipeline card:**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done       ← green check
○ Matching              SM    pending    ← next (amber spinner)
...
```

#### Stage 5 — order.classified

**Species Pipeline (Classifier node):**
- Pure function — no external calls
- Input: `intent: "buy"` → output: route to buy pipeline branch
- Emit: `order.classified`

(Classifier is instantaneous — Synth may not even render this as a separate visual stage. The pipeline card combines it with Matching.)

#### Stage 6 — order.matched

**Species Pipeline (Matching Service):**

**Market-first matching logic:**
1. Query active sell listings from PostgreSQL: `SELECT * FROM listings WHERE status = 'active' AND quantity >= 1000 ORDER BY created_at ASC`
2. If matching listings exist → match against user sellers first
3. If no listings (or insufficient quantity) → Treasury is counterparty of last resort
4. For large orders → split fills across multiple counterparties

**Example (no market sellers, Treasury match):**
```json
{
  "matchId": "match-001",
  "counterparty": "treasury",
  "fills": [
    { "quantity": 1000, "price": 1000000, "source": "treasury" }
  ]
}
```

**Example (partial market match + Treasury):**
```json
{
  "matchId": "match-002",
  "fills": [
    { "quantity": 600, "price": 1000000, "source": "user-seller-789", "listingId": "listing-042" },
    { "quantity": 400, "price": 1000000, "source": "treasury" }
  ]
}
```

- Emit: `order.matched`

**Synth UI pipeline card:**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done       ← green check
○ Staging asset         OC    pending    ← next (amber spinner)
...
```

#### Stage 7 — asset.staged (PRE-STAGING)

**THIS IS THE CRITICAL SAFETY GATE.**

**Species Pipeline (AssetDelivery node — pre-stage):**

Calls Onli Cloud `ChangeOwner` to move º from source Vault to Settlement Vault:

```
Onli Cloud API:
POST /change-owner
{
  "fromVault": "treasury",          // or seller's vault for market match
  "toVault": "settlement",
  "quantity": 1000,
  "eventId": "evt-550e8400",
  "matchId": "match-001"
}
→ { "transferId": "co-001", "status": "completed" }
```

**Onli Cloud internal:**
- Treasury Vault: 999,987,600 → 999,986,600 (−1,000)
- Settlement Vault: 0 → 1,000 (+1,000)
- AssetOracle write: `{ type: "pre_stage", from: "treasury", to: "settlement", quantity: 1000, eventId }`

**⛔ Staging failure (ChangeOwner fails):**
```
Onli Cloud returns error (insufficient treasury, network failure, etc.)

→ Pipeline STOPS HERE
→ Cashier (MarketSB) is NEVER reached
→ No $ moves — user's Funding Account is unchanged
→ Settlement Vault is unchanged (nothing was partially staged)
→ WebSocket: { stage: "asset.staged", data: { error: "staging_failed" } }
→ Synth pipeline card: ✕ on "Staging asset" stage
→ Chat message: "Order could not be processed — asset unavailable. No funds were charged."
→ 🔓 Chat unlocked
```

**✅ Staging succeeds:**
- º is now safely held in Settlement Vault, earmarked for this order
- Emit: `asset.staged`
- Pipeline continues to Cashier

**Synth UI pipeline card:**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done
◉ Staging asset         OC    done       ← green check
○ Processing payment    MB    pending    ← next (amber spinner)
...
```

#### Stage 8 — payment.confirmed (CASHIER)

**Species Pipeline → MarketSB API (Cashier endpoint):**

```
MarketSB API:
POST /api/v1/cashier/post-batch
{
  "eventId": "evt-550e8400",
  "matchId": "match-001",
  "intent": "buy",
  "quantity": 1000,
  "buyerVaId": "va-funding-user-123",
  "sellerVaId": "va-funding-treasury",    // or seller's VA for market match
  "unitPrice": 1000000,
  "fees": { "issuance": true, "liquidity": true, "listing": false }
}
```

**MarketSB internal (LedgerService):**

1. **Compute fees** (integer arithmetic, server-side):
```
assetCost    = 1000 × 1_000_000              = 1_000_000_000
issuanceFee  = 1000 × 10_000                 =    10_000_000
liquidityFee = (1_000_000_000 × 200) / 10000 =    20_000_000
```

2. **Build TigerBeetle linked transfer batch:**

```
Idempotency key: evt-550e8400:match-001

Transfer 1 — Asset cost:
  Debit:  User Funding VA (500)      1,000,000,000
  Credit: Treasury Reserve (100)     1,000,000,000
  Tag: asset_cost

Transfer 2 — Issuance fee:
  Debit:  User Funding VA (500)         10,000,000
  Credit: Operating Revenue (300)       10,000,000
  Tag: issuance_fee

Transfer 3 — Liquidity fee:
  Debit:  User Funding VA (500)         20,000,000
  Credit: Operating Revenue (300)       20,000,000
  Tag: liquidity_fee

Transfer 4 — Assurance posting:
  Debit:  Treasury Reserve (100)     1,000,000,000
  Credit: Assurance VA (520)         1,000,000,000
  Tag: assurance_posting

Transfer 5 — Species balance credit:
  Debit:  Treasury Reserve (100)     1,000,000,000
  Credit: User Species VA (510)      1,000,000,000
  Tag: species_credit

All 5 transfers linked — atomic — all-or-nothing
Total Dr = Total Cr ✓
```

3. **Post batch to TigerBeetle** — atomic commit
4. **FundingOracle writes** (one entry per VA affected):
```
{ type: "buy_debit", vaId: "va-funding-user-123", amount: -1_030_000_000, tbBatchId }
{ type: "fee_collected", vaId: "operating-300", amount: 30_000_000, tbBatchId }
{ type: "assurance_posted", vaId: "assurance-520", amount: 1_000_000_000, tbBatchId }
{ type: "species_credited", vaId: "va-species-user-123", amount: 1_000_000_000, tbBatchId }
```
5. **Persist posting reference:** `orders(eventId) ↔ tigerbeetle(tbBatchId)`
6. **Emit via Redis Streams:** `ledger.posted`

**MarketSB responds to Species:**
```json
{
  "tbBatchId": "tb-batch-abc123",
  "transfers": [ ...5 transfers... ],
  "totalDebited": 1030000000,
  "oracleRefs": ["fo-buy-001-a", "fo-buy-001-b", "fo-buy-001-c", "fo-buy-001-d"],
  "idempotencyKey": "evt-550e8400:match-001",
  "postedAt": "2026-04-03T12:00:02.100Z"
}
```

**Species Pipeline:**
- Records Cashier result
- Emit: `payment.confirmed`

**Synth UI pipeline card:**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done
◉ Staging asset         OC    done
◉ Processing payment    MB    done       ← green check
○ Delivering to Vault   OC    pending    ← next (amber spinner)
...
```

#### Stage 9 — ownership.changed (DELIVERY)

**Species Pipeline (AssetDelivery node — deliver):**

Now that payment is confirmed, deliver the pre-staged º to the buyer:

```
Onli Cloud API:
POST /change-owner
{
  "fromVault": "settlement",
  "toVault": "vault-user-123",      // buyer's personal Vault
  "quantity": 1000,
  "eventId": "evt-550e8400",
  "matchId": "match-001"
}
→ { "transferId": "co-002", "status": "completed" }
```

**Onli Cloud internal:**
- Settlement Vault: 1,000 → 0 (−1,000)
- User Vault: 12,450 → 13,450 (+1,000)
- **Genome evolution:** each of the 1,000 Specie tokens evolves uniquely during the transfer. One original — no copies, no duplicates.
- AssetOracle write: `{ type: "delivery", from: "settlement", to: "vault-user-123", quantity: 1000, eventId }`

**⛔ Delivery failure (extremely unlikely — asset is pre-staged):**
```
Onli Cloud returns error on ChangeOwner

→ Asset remains safely in Settlement Vault (it was pre-staged in Stage 7)
→ Money has already posted in Stage 8 (TigerBeetle batch is atomic and final)
→ No compensation needed on the financial side
→ Species pipeline retries delivery automatically
→ Synth UI: pipeline card shows persistent spinner on "Delivering to Vault"
→ Message: "Delivering to your Vault..." — user does not need to take action
→ Chat remains locked until delivery completes or manual intervention
```

**✅ Delivery succeeds:**
- Emit: `ownership.changed`
- Transfer is final and irreversible

**Synth UI pipeline card:**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done
◉ Staging asset         OC    done
◉ Processing payment    MB    done
◉ Delivering to Vault   OC    done       ← green check
○ Verifying             SM    pending    ← next
○ Complete              SM    pending
```

#### Stage 10 — order.completed

**Species Pipeline (FloorManager):**
1. Verify FundingOracle entries (from Cashier): confirm tbBatchId exists with correct amounts
2. Verify AssetOracle entries (from Onli Cloud): confirm delivery transferId exists
3. Compose canonical **eventReceipt**:

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
  "oracleRefs": { "fundingOracle": "fo-buy-001-a", "assetOracle": "ao-delivery-001" },
  "timestamps": {
    "submitted": "...", "authenticated": "...", "validated": "...",
    "classified": "...", "matched": "...", "assetStaged": "...",
    "paymentConfirmed": "...", "ownershipChanged": "...", "completed": "..."
  }
}
```

4. Emit: `order.completed`

**Species Pipeline (Reporter — side-car):**
- Subscribes to `order.completed` + `ledger.posted`
- Updates materialized views: receipts, user transaction history, marketplace stats

#### Stage 11 — Synth final update

**WebSocket → Synth:**
```json
{ "source": "species", "eventId": "evt-550e8400", "stage": "order.completed", "data": { "receipt": { ... } } }
```

**Synth UI pipeline card → Receipt card transition:**

```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done
◉ Staging asset         OC    done
◉ Processing payment    MB    done
◉ Delivering to Vault   OC    done
◉ Verifying             SM    done
◉ Complete              SM    done       ← final green check
```

Pipeline card transforms into **Receipt card:**

```
┌──────────────────────────────────────────┐
│  ✅ ORDER COMPLETE                        │
│                                          │
│  Event ID:    evt-550e8400               │
│  Batch ID:    tb-batch-abc123            │
│                                          │
│  Bought:      1,000 SPECIES              │
│  Cost:        $1,000.00                  │
│  Fees:        $30.00                     │
│  Total:       $1,030.00                  │
│                                          │
│  Oracle:      ✓ Verified                 │
│  Assurance:   $1,000.00 posted           │
│                                          │
│  12:00:03 PM                             │
└──────────────────────────────────────────┘
```

**Balance updates (Synth re-fetches both):**

MarketSB `GET /virtual-accounts/va-funding-user-123`:
- Funding balance: $17,450.00 → **$16,420.00** (−$1,030.00)

MarketSB `GET /virtual-accounts/va-species-user-123`:
- Species VA: $12,450.00 → **$13,450.00** (+$1,000.00)

Species `GET /vault/onli-user-123`:
- Vault count: 12,450 → **13,450** (+1,000 º)

Cross-reference check: Species VA ($13,450.00) matches Vault count (13,450 × $1.00) → ✅ no warning

Assurance card updates:
- Assurance balance: $45,000.00 → **$46,000.00** (+$1,000.00 from assurance posting)
- Coverage recalculated

- 🔓 Chat unlocked
- Transaction appears in history

### Buy — State Changes Summary

| System | Account/Vault | Before | After | Change |
|---|---|---|---|---|
| MarketSB | User Funding VA (500) | $17,450.00 | $16,420.00 | −$1,030.00 |
| MarketSB | User Species VA (510) | $12,450.00 | $13,450.00 | +$1,000.00 |
| MarketSB | Treasury Reserve (100) | — | −$1,000.00 net | complex (see batch) |
| MarketSB | Operating Revenue (300) | — | +$30.00 | +fees |
| MarketSB | Assurance VA (520) | $45,000.00 | $46,000.00 | +$1,000.00 |
| Onli Cloud | Treasury Vault | 999,987,600 | 999,986,600 | −1,000 º |
| Onli Cloud | Settlement Vault | 0 → 1,000 → 0 | 0 | transit |
| Onli Cloud | User Vault | 12,450 | 13,450 | +1,000 º |
| FundingOracle | — | — | 4 entries | $ audit |
| AssetOracle | — | — | 2 entries | º audit (stage + deliver) |

---

## Journey 3: SELL

### Purpose

Seller lists º for sale. When matched, $ moves Buyer → Seller. º moves Seller → Buyer. The reverse of Buy, with one key addition: the seller may need to authorize the asset transfer via AskToMove (unless auto-authorize was set on the listing).

### Systems Involved

| System | Involved | Role |
|---|---|---|
| MarketSB-USDC | Yes | Cashier — credits Seller, debits Buyer |
| Species Marketplace | Yes | Full 9-stage pipeline + optional auth wait |
| Onli Cloud | Yes | AskToMove (if not auto-authorized) + ChangeOwner |
| OnliYou (iOS) | Conditionally | Receives AskToMove push if auto-authorize is off |
| Onli Synth | Yes | Pipeline card with auth wait state |

### Two Phases

Sell is a two-phase journey: **Listing** (the seller posts their offer) and **Execution** (a buyer matches and the pipeline runs).

### Phase A — Listing Creation

#### Step A1 — Seller creates listing

**Synth UI:**
- User is on Species tab
- Sell action (via chat in Trade mode or dedicated sell button)
- Listing form:

```
Quantity:        500 SPECIES
Auto-authorize:  ✓ ON
                 (When matched, transfer proceeds without
                  requiring approval on your OnliYou app)
```

**Synth → Species API:**
```
POST /marketplace/v1/eventRequest
{
  "eventId": "evt-660e8400",
  "intent": "sell",
  "quantity": 500,
  "paymentSource": { "vaId": "va-funding-user-123" },
  "listingConfig": { "autoAuthorize": true },
  "idempotencyKey": "sell-user123-1714000001"
}
```

#### Step A2 — Listing registered

**Species Pipeline:**
1. Authenticator validates (same as Buy)
2. Validator confirms:
   - User is Onli owner ✅
   - User's Vault has ≥ 500 º ✅
3. Listing created in PostgreSQL: `{ listingId, onliId, quantity: 500, autoAuthorize: true, status: "active" }`
4. **º locked in Seller's Vault** — Onli Cloud marks 500 º as locked (cannot be transferred while listed)

```
Onli Cloud API:
POST /vault/{uid}/lock
{ "quantity": 500, "reason": "listing", "listingId": "listing-042" }
```

**Synth UI:**
- Chat message: "Listing created — 500 SPECIES listed for sale at $1.00 each"
- Listing visible in order history with status badge: `listed`
- 🔓 Chat unlocked (listing is passive — user waits for a match)

### Phase B — Match and Execution

A buyer submits a buy order that matches this listing (or part of it). The buy order's pipeline runs Stages 1–6 identically to Journey 2 (Buy). The difference is in how the º moves — it comes from the Seller's Vault, not Treasury.

#### Step B1 — Match resolves against seller listing

**Species Pipeline (Matching Service):**
- Incoming buy order for 500 º
- Matching Service finds `listing-042` (active, 500 º, auto-authorize: true)
- Match result:

```json
{
  "matchId": "match-003",
  "fills": [
    { "quantity": 500, "price": 1000000, "source": "user-seller-123", "listingId": "listing-042" }
  ]
}
```

#### Step B2 — AskToMove checkpoint

**Species Pipeline (AssetDelivery node — pre-stage):**

Before moving º from Seller Vault → Settlement Vault, the pipeline checks the listing's `autoAuthorize` flag.

**Path A — autoAuthorize: true (no pause):**
```
Listing has autoAuthorize = true
→ Skip AskToMove entirely
→ Proceed directly to ChangeOwner
→ No OnliYou notification
→ No pipeline pause
→ Synth pipeline card: stage progresses smoothly
```

**Path B — autoAuthorize: false (pipeline pauses):**
```
Species → Onli Cloud:
POST /ask-to-move
{
  "onliId": "onli-user-123",
  "quantity": 500,
  "eventId": "evt-770e8400",
  "reason": "sell_listing_matched"
}
→ { "requestId": "atm-001", "status": "pending" }
```

**Onli Cloud → OnliYou (iOS push notification):**
```
"Species Marketplace requests authorization to move 500 SPECIES
from your Vault. Tap to approve or deny."
```

**⏸ Pipeline pauses.**

**Synth UI pipeline card (auth wait state):**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done
◉ Staging asset         OC    waiting    ← AMBER PULSE
  "Check your OnliYou app"
  [Refresh Status]
○ Processing payment    MB    pending
...
```

**Waiting for OnliYou approval:**
- User opens OnliYou app on their iPhone
- Sees authorization request: "Move 500 SPECIES for sell order?"
- Taps Approve

**OnliYou → Onli Cloud:**
```
POST /ask-to-move/{requestId}/approve
→ { "status": "approved" }
```

**Onli Cloud → Species Pipeline (callback):**
```
AskToMove approved → pipeline resumes
```

**⛔ AskToMove timeout:**
```
ASKTOMOVE_TIMEOUT_SECONDS (300) expires without approval

→ Pipeline cancelled
→ º unlocked in Seller Vault
→ Listing status → "cancelled" (or back to "active" for retry)
→ WebSocket: { stage: "asset.staged", data: { error: "authorization_timeout" } }
→ Synth pipeline card: ✕ on Staging stage
→ Chat message: "Authorization timed out — order cancelled. Your SPECIES remain in your Vault."
→ 🔓 Chat unlocked
```

#### Step B3 — Pre-stage (Seller Vault → Settlement Vault)

**Species → Onli Cloud:**
```
POST /change-owner
{
  "fromVault": "vault-user-123",     // seller
  "toVault": "settlement",
  "quantity": 500,
  "eventId": "evt-770e8400"
}
```

- Seller Vault: 13,450 → 12,950 (−500)
- Settlement Vault: 0 → 500
- º unlocked from listing lock (now in Settlement)
- AssetOracle write: `{ type: "pre_stage", from: "vault-user-123", to: "settlement" }`
- Emit: `asset.staged`

#### Step B4 — Cashier (Buyer pays, Seller receives)

**Species → MarketSB:**
```
POST /api/v1/cashier/post-batch
{
  "eventId": "evt-770e8400",
  "matchId": "match-003",
  "intent": "sell",
  "quantity": 500,
  "buyerVaId": "va-funding-buyer-456",
  "sellerVaId": "va-funding-user-123",    // seller receives proceeds
  "unitPrice": 1000000,
  "fees": { "issuance": false, "liquidity": true, "listing": false }
}
```

**MarketSB TigerBeetle batch (sell):**
```
Transfer 1 — Asset cost:
  Debit:  Buyer Funding VA (500)       500,000,000
  Credit: Seller Funding VA (500)      500,000,000

Transfer 2 — Liquidity fee (from buyer):
  Debit:  Buyer Funding VA (500)        10,000,000
  Credit: Operating Revenue (300)       10,000,000

Transfer 3 — Species VA migration:
  Debit:  Seller Species VA (510)      500,000,000
  Credit: Buyer Species VA (510)       500,000,000
```

(Note: no issuance fee on sell — issuance fee only on initial buy from treasury. No assurance posting — assurance was posted on the original issuance.)

- FundingOracle writes for all VAs affected
- Emit: `ledger.posted`

#### Step B5 — Delivery (Settlement Vault → Buyer Vault)

```
Onli Cloud:
POST /change-owner
{ "fromVault": "settlement", "toVault": "vault-buyer-456", "quantity": 500 }
```

- Settlement Vault: 500 → 0
- Buyer Vault: receives 500 º
- Genome evolution on transfer
- AssetOracle write
- Emit: `ownership.changed`

#### Step B6 — Complete

- FloorManager verifies both Oracles
- Composes eventReceipt
- Emit: `order.completed`
- Listing status → `completed`

**Synth UI (Seller's view):**
- Funding balance: +$500.00 (proceeds)
- Asset balance: −500 SPECIES
- Chat: "Sale complete — 500 SPECIES sold. $500.00 credited to your Funding Account."

**Synth UI (Buyer's view):**
- Normal Buy receipt card (same as Journey 2)

---

## Journey 4: TRANSFER (Xfer)

### Purpose

Move º from Sender's Vault to Receiver's Vault. No $ involved. No MarketSB involvement whatsoever. No Cashier node. No TigerBeetle postings. No FundingOracle entries. Asset-only operation.

### Systems Involved

| System | Involved | Role |
|---|---|---|
| MarketSB-USDC | **No** | Not involved at all |
| Species Marketplace | Yes | 8-stage pipeline (no Cashier) |
| Onli Cloud | Yes | AskToMove + ChangeOwner |
| OnliYou (iOS) | Yes | AskToMove authorization |
| Onli Synth | Yes | 8-stage pipeline card |

### Preconditions

- Sender is authenticated with Onli identity
- Receiver is a verified Onli owner
- Sender's Vault has sufficient º
- Both parties are in Sender's contact list (with Onli addresses)

### Step-by-Step

#### Stage 0 — Sender initiates transfer

**Synth UI:**
- User is on Species tab
- Taps contact "Pepper Potts" → Transfer drawer opens
- Enters quantity: `100`
- Confirmation card:

```
┌──────────────────────────────────────────┐
│  TRANSFER 100 SPECIES                    │
│                                          │
│  To: Pepper Potts (onli-user-456)        │
│  Quantity: 100 SPECIES                   │
│  Fees: None                              │
│                                          │
│  ⚠ This transfer is final and           │
│    non-reversible.                       │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │ Confirm  │  │  Cancel  │             │
│  └──────────┘  └──────────┘             │
└──────────────────────────────────────────┘
```

- User taps Confirm
- 🔒 Chat locked

**Synth → Species API:**
```
POST /marketplace/v1/eventRequest
{
  "eventId": "evt-880e8400",
  "intent": "transfer",
  "quantity": 100,
  "recipient": { "onliId": "onli-user-456" },
  "idempotencyKey": "xfer-user123-1714000005"
}
```

#### Stages 1–3 — Authenticate, Receive, Validate

Same as Buy, except:
- **Validator does NOT check PaymentProvider** (no $ involved)
- Validator checks:
  - UserProvider: Sender is Onli owner ✅
  - UserProvider: Receiver (`onli-user-456`) is Onli owner ✅
  - AssetProvider: Sender Vault has ≥ 100 º ✅

#### Stage 4 — Classify

- Intent = `transfer` → route to transfer pipeline branch (no Cashier node)

#### Stage 5 — Match

- Direct peer-to-peer: Sender → Receiver
- No market matching, no Treasury involvement

#### Stage 6 — AskToMove (PIPELINE PAUSES)

**Species → Onli Cloud:**
```
POST /ask-to-move
{
  "onliId": "onli-user-123",     // sender
  "quantity": 100,
  "eventId": "evt-880e8400",
  "reason": "transfer_to_onli-user-456"
}
```

**Onli Cloud → OnliYou push:**
```
"Species Marketplace requests authorization to transfer 100 SPECIES
to Pepper Potts. Tap to approve."
```

**⏸ Pipeline pauses at Stage 6.**

**Synth UI — 8-stage pipeline card (auth wait):**
```
◉ Submitted            SM    done
◉ Authenticating        SM    done
◉ Validating            SM    done
◉ Matching              SM    done
○ Authorizing           OC    waiting    ← AMBER PULSE
  "Check your OnliYou app to
   authorize this transfer"
  [Refresh Status]
○ Transferring          OC    pending
○ Verifying             SM    pending
○ Complete              SM    pending
```

**User approves on OnliYou app.**

**⛔ Timeout path:** Same as Sell — order cancelled, º unchanged, chat unlocked.

#### Stage 7 — ChangeOwner (Sender Vault → Receiver Vault)

**Species → Onli Cloud:**
```
POST /change-owner
{
  "fromVault": "vault-user-123",
  "toVault": "vault-user-456",
  "quantity": 100,
  "eventId": "evt-880e8400"
}
```

- Sender Vault: 13,450 → 13,350 (−100)
- Receiver Vault: 5,000 → 5,100 (+100)
- Genome evolution on all 100 Specie
- AssetOracle write: `{ type: "transfer", from: "vault-user-123", to: "vault-user-456", quantity: 100 }`

**NO FundingOracle write. NO TigerBeetle posting. NO MarketSB involvement.**

- Emit: `ownership.changed`

#### Stage 8 — Complete

**Species (FloorManager):**
- Verify AssetOracle entry only (no FundingOracle for transfers)
- Compose eventReceipt (no tbBatchId, no fee breakdown)
- Emit: `order.completed`

**Synth UI — Receipt card:**

```
┌──────────────────────────────────────────┐
│  ✅ TRANSFER COMPLETE                     │
│                                          │
│  Event ID:    evt-880e8400               │
│                                          │
│  Sent:        100 SPECIES                │
│  To:          Pepper Potts               │
│  Fees:        None                       │
│                                          │
│  Oracle:      ✓ Asset verified           │
│               (no financial oracle)      │
│                                          │
│  12:05:18 PM                             │
└──────────────────────────────────────────┘
```

**Balance updates:**
- Funding balance: **unchanged** (no $ moved)
- Asset balance: 13,450 → **13,350** (−100 º)
- Species VA in MarketSB: **unchanged** (no TigerBeetle posting for transfers — this is an Onli-only operation)

**Important reconciliation note:** After a Transfer, the Onli Vault count changes but the MarketSB Species VA does NOT change (because MarketSB was not involved). This creates a temporary divergence that is expected for transfers. The reconciliation service accounts for pending transfer settlements.

- 🔓 Chat unlocked

---

## Journey 5: SENDOUT

### Purpose

Move $ from the user's Funding Account to an external USDC wallet. Exits the Onli system. Reverse of Fund. No assets involved. No Species pipeline.

### Systems Involved

| System | Involved | Role |
|---|---|---|
| MarketSB-USDC | Yes | Withdrawal creation, policy, reserve, broadcast, confirm |
| Species Marketplace | No | — |
| Onli Cloud | No | — |
| Onli Synth | Yes | Confirmation with irreversibility warning, lifecycle polling |

### Preconditions

- User authenticated
- User has Funding VA (500) with sufficient balance
- User has an external USDC wallet address to send to

### Step-by-Step

#### Step 1 — User initiates withdrawal

**Synth UI:**
- User is on Neich tab
- Withdrawal action (via chat Trade mode or dedicated withdraw button)
- Withdrawal form:

```
Amount:       $2,000.00
Destination:  0x9876...fedc
Network:      Base
```

- User taps Approve
- 🔒 Chat locked
- Confirmation card with **irreversibility warning:**

```
┌──────────────────────────────────────────┐
│  WITHDRAW $2,000.00 USDC                 │
│                                          │
│  To: 0x9876...fedc                       │
│  Network: Base                           │
│                                          │
│  ⚠️ THIS WITHDRAWAL IS IRREVERSIBLE     │
│  Once confirmed, funds cannot be         │
│  returned. Please verify the             │
│  destination address carefully.          │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │ Confirm  │  │  Cancel  │             │
│  └──────────┘  └──────────┘             │
└──────────────────────────────────────────┘
```

- User taps Confirm

#### Step 2 — Create withdrawal

**Synth → MarketSB API:**
```
POST /api/v1/withdrawals
{
  "vaId": "va-funding-user-123",
  "amount": 2000000000,
  "destination": "0x9876...fedc",
  "chain": "base",
  "idempotencyKey": "wd-user123-1714000006"
}
```

#### Step 3 — Policy check (threshold gate)

**MarketSB internal (PolicyService):**

**Path A — Below threshold (e.g., $2,000 < $10,000 threshold):**
```
Amount < SENDOUT_APPROVAL_THRESHOLD_USD
→ Skip approval queue
→ Status: processing
→ Proceed to reserve + broadcast
```

**Path B — At or above threshold:**
```
Amount ≥ SENDOUT_APPROVAL_THRESHOLD_USD
→ Status: pending_approval
→ Withdrawal enters operator approval queue
→ FundingOracle: { type: "withdrawal_pending_approval", amount, destination }
```

**Synth UI (pending approval):**
```
┌──────────────────────────────────────────┐
│  WITHDRAWAL PENDING APPROVAL             │
│                                          │
│  Amount:    $50,000.00                   │
│  Status:    ⏳ Awaiting operator approval │
│                                          │
│  Your withdrawal requires manual review  │
│  before processing. You will be notified │
│  when approved.                          │
└──────────────────────────────────────────┘
```

**Operator approves (via CLI or Operator dashboard):**
```
marketsb withdrawals approve wd-002 --reason "Identity verified"
→ Status: approved → processing
```

#### Step 4 — Reserve funds

**MarketSB internal (WithdrawalService):**
- TigerBeetle transfer:

```
Transfer — Reserve:
  Debit:  User Funding VA (500)          2,000,000,000
  Credit: Pending Withdrawal Staging (450) 2,000,000,000
```

- User's Funding balance decreases immediately
- Funds held in staging until on-chain confirmation
- FundingOracle: `{ type: "withdrawal_reserved", vaId, amount }`

#### Step 5 — Compliance check

**MarketSB internal (compliance module at Outgoing Wallet):**
- Destination address screening
- Amount threshold checks
- Sanctions/watchlist verification

**⛔ Compliance failure:**
```
→ Status: compliance_failed
→ Reverse reservation: Credit Funding VA, Debit Staging
→ User's balance restored
→ FundingOracle: { type: "withdrawal_compliance_failed" }
→ Synth UI: error message, balance restored
→ 🔓 Chat unlocked
```

**✅ Compliance passed:**
- Proceed to broadcast

#### Step 6 — Broadcast on-chain

**MarketSB internal (WithdrawalService):**
- Constructs USDC transfer transaction on Base
- Signs and broadcasts to the network
- Status → `broadcast`
- FundingOracle: `{ type: "withdrawal_broadcast", txHash: "0xdef456..." }`

**Synth (polling):**
```
GET /api/v1/withdrawals/wd-001
→ { status: "broadcast", txHash: "0xdef456..." }
```

**Synth UI:**
```
Lifecycle stepper:
  ● Processing (done)
  ● Broadcast (done)       ← tx hash displayed
  ○ Confirmed (pending, spinner)
```

#### Step 7 — On-chain confirmation

**MarketSB internal (WithdrawalService):**
- Monitors Base blockchain for transaction confirmation
- After sufficient block confirmations:
  - Status → `confirmed`
  - Move from staging to final:

```
Transfer — Confirm:
  Debit:  Pending Withdrawal Staging (450)  2,000,000,000
  Credit: Outgoing Wallet (system)          2,000,000,000
```

  - FundingOracle: `{ type: "withdrawal_confirmed", txHash, blockNumber }`

**⛔ Broadcast failure (ambiguous state):**
```
Transaction fails on-chain or times out
→ Status: manual_review
→ Operator alerted
→ Synth UI: banner "Your withdrawal requires manual review"
→ Funds remain in staging until resolved
```

#### Step 8 — Synth final update

**Synth (polling):**
```
GET /api/v1/withdrawals/wd-001
→ { status: "confirmed", txHash: "0xdef456...", lifecycle: [...] }
```

**Synth UI — Receipt:**

```
┌──────────────────────────────────────────┐
│  ✅ WITHDRAWAL COMPLETE                   │
│                                          │
│  Amount:      $2,000.00 USDC             │
│  To:          0x9876...fedc              │
│  Network:     Base                       │
│  Tx Hash:     0xdef456...                │
│                                          │
│  This transaction is final and           │
│  irreversible.                           │
│                                          │
│  12:10:45 PM                             │
└──────────────────────────────────────────┘
```

**Balance update:**
- Funding balance: $16,420.00 → **$14,420.00** (−$2,000.00)

- 🔓 Chat unlocked

### SendOut — State Changes Summary

| System | Account | Before | After | Change |
|---|---|---|---|---|
| MarketSB | User Funding VA (500) | $16,420.00 | $14,420.00 | −$2,000.00 |
| MarketSB | Pending Withdrawal (450) | +$2,000 (transit) | 0 (cleared) | transit |
| MarketSB | Outgoing Wallet | +$2,000 (transit) | 0 (released) | transit |
| External wallet | 0x9876...fedc | — | +2,000 USDC | received |
| FundingOracle | — | — | 3+ entries | $ audit |

---

## Journey Summary Matrix

| | Fund | Buy | Sell | Transfer | SendOut |
|---|---|---|---|---|---|
| **$ moves** | Yes (in) | Yes | Yes | No | Yes (out) |
| **º moves** | No | Yes | Yes | Yes | No |
| **MarketSB** | Yes | Yes (Cashier) | Yes (Cashier) | No | Yes |
| **Species Pipeline** | No | Yes (9 stages) | Yes (9 + auth) | Yes (8, no Cashier) | No |
| **Onli Cloud** | No | Yes | Yes (AskToMove) | Yes (AskToMove) | No |
| **OnliYou app** | No | No | If !autoAuthorize | Yes | No |
| **FundingOracle** | Yes | Yes | Yes | No | Yes |
| **AssetOracle** | No | Yes | Yes | Yes | No |
| **TB batch** | 1 transfer | 5 linked | 3 linked | None | 2 transfers |
| **Pipeline card** | Lifecycle stepper | 9-stage card | 9-stage + auth | 8-stage + auth | Lifecycle stepper |
| **Confirmation** | Amount + source | Qty + fees + total | Qty + listing config | Qty + recipient | Amount + warning |
| **Chat locked** | During lifecycle | During pipeline | During pipeline | During pipeline | During lifecycle |
| **Reversible** | No (on-chain) | No (final) | No (final) | No (final) | No (on-chain) |
