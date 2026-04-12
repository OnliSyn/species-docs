# Onli Synth User Flows

Complete step-by-step documentation of every user journey in the Onli Synth simulation environment. Each flow ends with the post-transaction audit that verifies system integrity.

---

## 1. FUND (Deposit USDC)

### User Action -> System Response -> State Changes

**Step 1:** User types "fund my account" in Trade mode.

**Step 2:** AI responds with deposit instructions:
- Incoming Account address (funding VA)
- FBO (For Benefit Of) memo
- Prompts user for the deposit amount

**Step 3:** User provides amount (e.g., "100000").

**Step 4:** AI displays a confirmation card:
- SIMULATED DEPOSIT
- Amount: $100,000.00
- Send To: [Incoming Account address]
- For Benefit Of: [FBO memo]
- Credit To: [User's Funding Account]

**Step 5:** User types "confirm".

**Step 6:** System calls `simulateDeposit()` which credits the user's funding VA with the amount in base units.

**Result:** Funding Account balance increases by the deposited amount.

**Audit:** Conservation check passes (no specie moved). Assurance unchanged. No negative balances.

---

## 2. BUY (Purchase Specie)

### User Action -> System Response -> State Changes

**Step 1:** User types "buy 1000 species".

**Step 2:** AI checks marketplace listings first (FIFO order), then treasury for any remainder.

**Step 3:** AI displays a confirmation card:
- Quantity: 1,000
- Source: Market (if listings available) / Treasury (remainder)
- Issuance Fee: $0.05/sp (treasury-sourced only)
- Asset Cost: $1,000.00
- Total: $1,050.00 (if all from treasury; varies by source mix)

**Step 4:** User types "confirm".

**Step 5:** System calls `submitPipeline(intent: 'buy')` which triggers the species-sim 9-stage pipeline:

| Stage | Event | What Happens |
|-------|-------|-------------|
| 1 | `request.submitted` | Pipeline created, intent recorded |
| 2 | `request.authenticated` | User identity and permissions verified |
| 3 | `order.validated` | Confirms treasury + active listings can fill the requested quantity |
| 4 | `order.classified` | Intent classified as `buy` |
| 5 | `order.matched` | FIFO matching: marketplace listings consumed first, treasury fills remainder |
| 6 | `asset.staged` | Specie moved from source(s) into settlement vault |
| 7 | `payment.confirmed` | MarketSB cashier executes USDC transfers: buyer VA -> treasury (asset cost), treasury -> assurance (asset cost), buyer VA -> operating account (issuance fee) |
| 8 | `ownership.changed` | Specie moved from settlement vault -> buyer's vault |
| 9 | `order.completed` | Pipeline finalized, all parties notified |

**State Changes:**
- Buyer funding account: -$total (asset cost + issuance fee)
- Buyer vault: +1,000 specie
- Treasury vault: -1,000 specie (or split with marketplace sellers)
- Assurance account: +$1,000.00 (asset cost deposited)

**Audit:** Conservation check passes. Assurance = (circulation + settlement) x $1.00.

---

## 3. SELL (List on Marketplace)

### User Action -> System Response -> State Changes

**Step 1:** User types "sell 200".

**Step 2:** AI displays a confirmation card:
- Quantity: 200
- Listing Price: $1.00/sp
- Fees: None
- Note: "Specie will be moved to Settlement Vault until sold"

**Step 3:** User types "confirm".

**Step 4:** System calls `submitPipeline(intent: 'sell')` which triggers the 9-stage pipeline:

| Stage | Event | What Happens |
|-------|-------|-------------|
| 1 | `request.submitted` | Pipeline created, intent recorded |
| 2 | `request.authenticated` | User identity and permissions verified |
| 3 | `order.validated` | Confirms seller has sufficient specie in vault |
| 4 | `order.classified` | Intent classified as `sell` |
| 5 | `order.matched` | Creates marketplace listing: sellerOnliId, quantity: 200, price: $1.00/sp, status: active |
| 6 | `asset.staged` | `changeOwner(seller -> settlement)` escrows specie in settlement vault |
| 7 | `payment.confirmed` | No USDC movement (escrow only, payment happens when a buyer matches) |
| 8 | `ownership.changed` | Listing status set to `escrowed_for_listing` |
| 9 | `order.completed` | Pipeline finalized, listing visible on marketplace |

**State Changes:**
- Seller vault: -200 specie
- Settlement vault: +200 specie
- Marketplace: new active listing created

**When a buyer matches later:**
- Buyer's funding VA pays into seller's funding VA
- Specie moves from settlement vault -> buyer's vault
- Listing quantity decremented or removed

**Audit:** Conservation check passes. Assurance unchanged (escrowed specie is still backed by assurance).

---

## 4. TRANSFER (P2P)

### User Action -> System Response -> State Changes

**Step 1:** User types "transfer 50 to Tony Stark".

**Step 2:** AI resolves the contact name to an onliId and displays a confirmation card:
- To: Tony Stark (onliId)
- Quantity: 50
- Fees: None
- Warning: "This transfer is final and non-reversible"

**Step 3:** User types "confirm".

**Step 4:** System calls `submitPipeline(intent: 'transfer', recipient: { onliId })`:

| Stage | What Happens |
|-------|-------------|
| Validate | Confirms sender has 50 specie, recipient exists |
| Change Owner | `changeOwner(sender -> recipient)` moves specie between vaults |
| AskToMove | Auto-approved in simulation mode |
| Completed | Pipeline finalized, both parties notified |

**State Changes:**
- Sender vault: -50 specie
- Recipient vault: +50 specie

**Audit:** Conservation check passes. Assurance unchanged. Circulation unchanged (specie redistributed between users, not created or destroyed).

---

## 5. REDEEM (Sell Back via Assurance)

### User Action -> System Response -> State Changes

**Step 1:** User types "redeem 100".

**Step 2:** AI displays a confirmation card:
- Redemption Value: $100.00 (1:1 from Assurance)
- Liquidity Fee (1%): -$1.00
- Net Payout: $99.00
- Note: "Assurance Account funds the buyback. Species return to MarketMaker."

**Step 3:** User types "confirm".

**Step 4:** System calls `submitPipeline(intent: 'redeem')` which triggers the pipeline:

| Stage | Event | What Happens |
|-------|-------|-------------|
| 1 | `request.submitted` | Pipeline created, intent recorded |
| 2 | `request.authenticated` | User identity and permissions verified |
| 3 | `order.validated` | Confirms seller has 100 specie in vault |
| 4 | `order.classified` | Intent classified as `redeem` |
| 5 | `asset.staged` | `changeOwner(seller -> settlement)` escrows specie |
| 6 | `payment.confirmed` | MarketSB cashier redeem: assurance -> seller funding (gross $100), seller funding -> liquidity fee account ($1.00) |
| 7 | `ownership.changed` | MarketMaker relists redeemed specie (sellerOnliId: `market-maker`, price: $1.00/sp) |
| 8 | `order.completed` | Pipeline finalized |

**State Changes:**
- Seller vault: -100 specie
- Settlement vault: +100 specie (held under MarketMaker listing)
- Seller funding account: +$99.00 (net after fee)
- Assurance account: -$100.00 (gross redemption value)
- Liquidity fee account: +$1.00

**Audit:** Conservation check passes. Assurance = (circulation + userListed) x $1.00. MarketMaker listings are excluded from the backed count since they are no longer user-held.

---

## 6. SENDOUT (Withdraw USDC)

### User Action -> System Response -> State Changes

**Step 1:** User types "withdraw 5000".

**Step 2:** AI displays a confirmation card:
- Amount: $5,000.00
- From: Funding Account
- To: External wallet address

**Step 3:** User types "confirm".

**Step 4:** System calls `simulateWithdrawal()` which debits the user's funding VA.

**Result:** Funding Account balance decreases by $5,000.00.

**Audit:** Conservation check passes (no specie moved). Assurance unchanged. No negative balances.

---

## 7. MODE GUARDRAILS

### Ask Mode

Any trade-related request receives a guardrail response:
- First sentence: "To trade, switch to Trade mode."
- Last sentence: "To trade, switch to Trade mode."
- Middle content may explain what the trade would involve

### Develop Mode

- Can explain technical flows, pipeline stages, and system architecture
- Any actual trade attempt receives: "Actual trades require Trade mode."

### Onli Cloud Inquiries

- Any questions about Onli Cloud are directed to: https://onli.cloud/

---

## 8. AUDIT (Post-Transaction Integrity Check)

The audit runs automatically after every transaction. It performs four checks:

### Check 1: Specie Conservation

```
treasury + settlement + circulation = 1,000,000,000
```

Total specie in the system must always equal the fixed supply of one billion. Specie is never created or destroyed, only moved between vaults.

### Check 2: Assurance 1:1 Backing

```
assurance = (circulation + userListed) x $1.00
```

The assurance account must hold exactly $1.00 for every specie in user circulation plus every specie listed by users on the marketplace. MarketMaker listings are excluded from the backed count.

### Check 3: No Negative Balances

```
all vaults >= 0
assurance >= 0
all funding accounts >= 0
```

No vault, assurance account, or funding account may ever hold a negative balance.

### Check 4: Settlement-Listing Match

```
settlement specie count = sum(active listing remaining quantities)
```

The number of specie held in the settlement vault must exactly equal the total remaining quantity across all active marketplace listings.

### On Failure

If any check fails, the system logs an `[AUDIT VIOLATION]` to the server console with:
- Which check failed
- Expected value vs. actual value
- Transaction context that triggered the violation
