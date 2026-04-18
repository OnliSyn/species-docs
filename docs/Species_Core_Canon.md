# Species Core Canon — Unified Reference

**Status:** Canonical — supersedes the three prior documents
**Resolves:**
1. *Species Canon — Separation of Authority*
2. *Species Market — Dependable Transition Canon*
3. *Onli AI OS — Canonical Glossary* (Specie / Species Market sections)
**Date:** April 2026

---

## How to read this canon

The three source documents described the same system at three levels of abstraction. This unified canon preserves all three without contradiction.

| Source | Level | What it defines |
|--------|-------|-----------------|
| Separation of Authority | Governance | Who is allowed to declare which truth |
| Dependable Transition | Machine | How state moves deterministically |
| Canonical Glossary | Vocabulary | The nouns and their formats |

Part I establishes identity and vocabulary. Part II establishes the authority model. Part III establishes the transition machine. Part IV is the diagnostic contract that binds them together.

---

## Part I — Identity and Vocabulary

### 1.1 Specie vs. Species vs. Species Market

Three terms, three referents. They are not interchangeable.

| Term | Referent |
|------|----------|
| **Specie** | The asset. The native micro-currency of the Onli One network, pegged 1:1 with USDT. One unit = one Genome of genotype **DENOMINATION**. |
| **Species** | The collective — used only in composed names (*Species Market*, *Species AI*, *Species Trust*). Never stands alone. |
| **Species Market** | The marketplace Appliance at `species.market`. Coordinates orders. Does not settle money. Does not transfer assets. |

### 1.2 Stack placement

Specie sits in Layer 2 (Storage) of the Onli AI stack. Species Market is a Layer 7 Appliance. Species AI is a Layer 8 interface bound to the Species Market domain.

| Layer | Component | Role in the Specie system |
|-------|-----------|---------------------------|
| 2 — Storage | **Specie** (Genome, genotype DENOMINATION) | The asset itself |
| 4 — Protocol | **Onli One** | The network where Specie moves via EVD |
| 5 — Trust | **Onli You** | Where Owners authorize Specie movements |
| 6 — Services | **Species Trust**, **Onli Cloud** | Financial settlement and orchestration |
| 7 — User Interaction | **Species Market** | Order coordination Appliance |
| 8 — AI Interface | **Species AI** (powered by **Syn**) | Natural language intent interpretation |

### 1.3 Canonical nouns (this system only)

| Noun | Format | Definition |
|------|--------|------------|
| Specie | Genome, genotype DENOMINATION | The asset unit. $1 fixed. |
| Genome | `gnm-...` | The 10-helix tensor object. A Specie is a Genome. |
| Gene / Onli ID | `gne-...` | The Owner's cryptographic credential. |
| Vault | `vlt-...` | TEE where a Genome lives. |
| Locker | (vault sub-state) | Controlled transition zone inside a Vault. |
| Assurance Account | — | USDT-denominated funding account, owned by AssuranceUser, that backs circulating Specie 1:1. |
| Treasury | — | The issuer inventory of unissued Specie. Owned by TreasuryUser. |
| Oracle | — | Immutable receipt registry. Never stores content, only proof. |

### 1.4 Identity rule (from Separation; preserved)

Every actor is a **User** with a `userId`. Roles are expressed as specialized Users:

- **Funding roles:** BuyerUser, SellerUser, TreasuryUser, AssuranceUser, MarketMakerUser, OperatorUser
- **Asset roles:** SenderUser, ReceiverUser, TreasuryUser, MarketMakerUser

Funding roles act on **funding accounts**. Asset roles act on **vaults** and **lockers**. The two container classes are architecturally separate.

---

## Part II — Separation of Authority

### 2.1 First Principle

Specie is a **financial system**, not an application. A financial system cannot rely on discretionary correction.

- There are **no adjustments**.
- There is **no mutation of truth**.
- There are **no silent fixes**.

All state is append-only. All corrections are compensating entries.

### 2.2 No self-declared truth

No actor is allowed to mark its own work as true. Authority is separated by domain.

| Domain | Authority | Responsibility | Stack layer |
|--------|-----------|----------------|-------------|
| Intent | **Species AI** (Syn) | Interprets natural language intent | AI Interface |
| Orders | **Species Market** | Validates, classifies, matches orders | User Interaction |
| Money | **Species Trust** | Executes and records financial settlement | Services |
| Assets | **Onli** (Onli One + Transfer Agent) | Executes and records asset ownership transfer via EVD | Protocol |
| Receipt | **Floor Manager** | Composes canonical transaction receipt | Services |
| Truth | **Oracle Layer** | Immutable witness records | Protocol |

### 2.3 Authority definitions

**Species AI — Intent Authority.** Interprets natural language into executable intent. Modes: *Ask* (inquiry), *Trade* (execution), *Develop* (system configuration). Species AI does not settle money, transfer assets, or determine outcomes. It prepares structured calls; only an Owner authorizes mutation.

**Species Market — Order Authority.** A system of **coordination**, not settlement. It receives orders, validates structure, classifies intent, matches counterparties, opens transaction context, collects confirmations, and assembles receipts. It does NOT move money, transfer assets, determine transaction success, or adjust outcomes.

**Species Trust — Financial Authority.** The only authority over money. If Species Trust does not report settlement, money did not move.

**Onli — Asset Authority.** The only authority over assets. Operates through the Onli One protocol and Transfer Agents. If Onli does not report transfer, ownership did not change.

**Floor Manager — Receipt Authority.** Composes the canonical transaction record from three independent inputs: order context (Market), financial report (Trust), asset report (Onli). The receipt does not invent truth — it **binds** independent truths.

**Oracle Layer — Witness Authority.** Truth is witnessed independently across three oracles, each append-only and immutable:

| Oracle | Source | Records |
|--------|--------|---------|
| Financial Oracle | Species Trust | Money movement, balances, funding receipts |
| Asset Oracle | Onli | Ownership, transfers, asset receipts |
| Market Oracle | Species Market | Transaction closure, order receipts |

### 2.4 Auditor Function (Correlation Layer)

The Auditor trusts no single service. It correlates independent witnesses.

For every transaction, all three oracles must agree on: `transactionId`, counterparties, amount, asset.

**If correlation fails:** no mutation occurs, no adjustment is made, a **review case is opened**. Truth remains intact.

### 2.5 UI Principle — Read-Only Truth

The UI does not maintain state. The UI reads receipts and oracle-backed records. The UI never caches truth, computes balances independently, or displays derived state. **If a value cannot be traced to an oracle row, it must not be displayed.**

### 2.6 System Guarantee

Fraud is not prevented by policy. Fraud is prevented by **architecture** — because no single system controls outcome, all systems write append-only logs, independent witnesses exist, and correlation verifies consistency. It becomes physically impossible for a single actor to fabricate, hide, or alter a transaction.

---

## Part III — The Dependable Transition Machine

### 3.1 System objective

Species Market is a **deterministic transition system**. A dependable system is one where intent is classified the same way every time, each transition has one meaning, and every movement (funding, asset, authorization, oracle witness, state effect) is explicit. Imbalance is observable, never hidden.

### 3.2 Layer model

The authority separation of Part II resolves into a seven-layer execution pipeline.

| # | Layer | Owning authority | Emits |
|---|-------|------------------|-------|
| 1 | Request | Species AI → Species Market | `request.submitted`, `request.authenticated`, `request.validated` |
| 2 | Classification | Species Market (pure compute) | `order.classified` |
| 3 | Transition | Species Market (coordinator) | Selects canonical transition |
| 4 | Movement | Species Trust (funding) + Onli (asset) | Funding records, Asset move records |
| 5 | Authorization | Onli You (Owner) | `transition.authorized` |
| 6 | Oracle | All three oracles | `transition.committed`, `oracle.recorded`, `order.completed` |
| 7 | State | Species Trust + Onli (coupled) | `assuranceBalance`, `speciesInCirculation`, inventory states |

### 3.3 Canonical flow

```text
intent
→ Species AI interprets
→ Species Market validates order
→ Species Market classifies intent
→ Species Market matches counterparties
→ Species Trust settles money (independent)
→ Onli settles asset via EVD (independent)
→ Floor Manager composes receipt
→ Three oracles record immutable truth
→ Auditor correlates records
→ UI reads truth
```

### 3.4 Canonical names

**Event names:** `request.submitted`, `request.authenticated`, `request.validated`, `order.classified`, `transition.authorized`, `transition.committed`, `ownership.changed`, `oracle.recorded`, `order.completed`.

**Intent names:** `BUY_TREASURY`, `BUY_MARKET`, `SELL_MARKET`, `TRANSFER`, `REDEEM`.

**Transition names:** `ISSUANCE`, `BUY_MARKET_EXECUTION`, `SELL_MARKET_LISTING`, `TRANSFER_EXECUTION`, `REDEMPTION`.

**Primitive names:** `AuthorizeBehavior`, `AskToMove`, `ChangeOwner`.

**State names:** `IN_TREASURY_INVENTORY`, `IN_CIRCULATION`, `LISTED_LOCKED`, `REDEEMED_INVENTORY`, `EXTINGUISHED`.

### 3.5 Container model

Funding movements reference **funding accounts only**. Asset movements reference **vaults or lockers only**. Never mixed.

**Funding accounts:** `payWith` (Buyer), `putProceeds` (Seller), `treasuryAccount` (Treasury), `assuranceAccount` (Assurance), `marketMakerAccount` (MarketMaker), `feeAccount` (Operator), `userAccount` (User).

**Asset containers (per User):** `<role>Vault`, `<role>Locker` — e.g., `sellerVault`, `sellerLocker`, `buyerVault`, `treasuryLocker`.

The **locker** is a controlled transition state within a Vault. `AskToMove` prepares or moves an asset batch into a locker-controlled state. `ChangeOwner` moves the same asset batch from one controlled owner state to another — the asset is never recreated at the destination; the same Genome moves through controlled conditions via EVD.

### 3.6 Record grammars

**Funding record.** `TYPE: FUNDING`; fields: `fromUserId`, `toUserId`, `fromRole`, `toRole`, `amount`, `unit: USD`, `fromAccount`, `toAccount`. Fee records add `label: fee`.

**Asset move record.** `TYPE: ASSET_MOVE`; fields: `assetBatchId`, `fromUserId`, `toUserId`, `fromRole`, `toRole`, `amount`, `unit: Species`, `fromContainer`, `toContainer`, `fromCondition`, `toCondition`, `transferPrimitive: AskToMove | ChangeOwner`.

**State record.** `TYPE: STATE`; fields: `userId`, `object`, `fromState`, `toState`, `amount`, `unit`, `location`.

**Oracle record.** `TYPE: ORACLE`; fields: `transitionId`, `transitionType`, `fromCondition`, `toCondition`, `fundingRecordIds[]`, `assetRecordIds[]`, `stateEffect`, `timestamp`, `status: committed`.

### 3.7 Authorization canon

Every transition is authenticated and authorized. **Authorization is not optional behavior around the transition — authorization is part of transition formation.**

- `AuthorizeBehavior` gates transition execution.
- `AskToMove` is a user-in-the-loop primitive and therefore requires `AuthorizeBehavior`.
- `ChangeOwner` moves the asset batch from one controlled owner condition to another.

Per Onli canon: Owners authorize. Agents can only ask. Custody never implies authority.

### 3.8 Classification canon

The classifier is pure-compute, stateless, idempotent, deterministic, auditable. Same `eventId` always produces the same classification.

**Logic:**
1. Consume `order.validated`.
2. If explicit `listingId` is present → `BUY_MARKET`.
3. Resolve `to` against the Marketplace User Registry.
4. If `to` resolves to TreasuryUser → `BUY_TREASURY`.
5. If `putProceeds` is present → `SELL_MARKET`.
6. Otherwise → `TRANSFER`.
7. (`REDEEM` is resolved through Redemption flow.)
8. Emit `order.classified`. Log classification reason.

Classification selects the transition path. It does not move funding, move assets, or mutate system state.

### 3.9 The five canonical transitions

Every transition declares: `startCondition`, `endCondition`, `fundingMovement[]`, `assetMovement[]`, `oracleEntry`, `stateEffect`. `Q` denotes quantity of Specie.

---

#### ISSUANCE (BUY_TREASURY)

Treasury inventory enters circulation with matching redemption funding in the Assurance Account.

- **Start → End:** `IN_TREASURY_INVENTORY → IN_CIRCULATION`
- **Funding:**
  - `BuyerUser/payWith → TreasuryUser/treasuryAccount = issuancePrice × Q`
  - `TreasuryUser/treasuryAccount → AssuranceUser/assuranceAccount = $1 × Q`
  - `BuyerUser/payWith → OperatorUser/feeAccount = issuanceFee × Q`
- **Asset:**
  - `TreasuryUser/treasuryVault → TreasuryUser/treasuryLocker` (`AskToMove`)
  - `TreasuryUser/treasuryLocker → BuyerUser/buyerVault` (`ChangeOwner`)
- **State effect:** `ΔassuranceBalance: +Q`, `ΔspeciesInCirculation: +Q`

---

#### BUY_MARKET_EXECUTION

Listed circulating Specie moves from Seller to Buyer.

- **Start → End:** `LISTED_LOCKED → IN_CIRCULATION`
- **Funding:** `BuyerUser/payWith → SellerUser/putProceeds = buyPrice × Q`
- **Asset:** `SellerUser/sellerLocker → BuyerUser/buyerVault` (`ChangeOwner`)
- **State effect:** `ΔassuranceBalance: 0`, `ΔspeciesInCirculation: 0`

---

#### SELL_MARKET_LISTING

Circulating Specie is prepared for market execution.

- **Start → End:** `IN_CIRCULATION → LISTED_LOCKED`
- **Funding:** none (`$0`)
- **Asset:** `SellerUser/sellerVault → SellerUser/sellerLocker` (`AskToMove`)
- **State effect:** `ΔassuranceBalance: 0`, `ΔspeciesInCirculation: 0`

---

#### TRANSFER_EXECUTION

Circulating Specie moves directly between holders.

- **Start → End:** `IN_CIRCULATION → IN_CIRCULATION`
- **Funding:** `User/userAccount → OperatorUser/feeAccount = transferFee`
- **Asset:**
  - `SenderUser/senderVault → SenderUser/senderLocker` (`AskToMove`)
  - `SenderUser/senderLocker → ReceiverUser/receiverVault` (`ChangeOwner`)
- **State effect:** `ΔassuranceBalance: 0`, `ΔspeciesInCirculation: 0`

---

#### REDEMPTION

Circulating Specie exits circulation; matching redemption principal exits the Assurance Account.

- **Start → End:** `IN_CIRCULATION | LISTED_LOCKED → REDEEMED_INVENTORY`
- **Funding:**
  - `AssuranceUser/assuranceAccount → SellerUser/putProceeds = $1 × Q`
  - `SellerUser/putProceeds → MarketMakerUser/marketMakerAccount = redemptionFee × Q`
- **Asset:**
  - `SellerUser/sellerVault → SellerUser/sellerLocker` (`AskToMove`)
  - `SellerUser/sellerLocker → MarketMakerUser/marketMakerVault` (`ChangeOwner`)
- **State effect:** `ΔassuranceBalance: −Q`, `ΔspeciesInCirculation: −Q`

---

## Part IV — Coupled State and the Diagnostic Contract

### 4.1 Coupled state variables

`assuranceBalance` and `speciesInCirculation` are **coupled state variables**. They move together **by construction**, not by rule.

Transitions that change coupled state: `ISSUANCE`, `REDEMPTION`.
Transitions that do not: `BUY_MARKET_EXECUTION`, `SELL_MARKET_LISTING`, `TRANSFER_EXECUTION`.

### 4.2 Natural operating condition

```
assuranceBalance = speciesInCirculation
```

This equality is the **observable result** of correct transition execution. It is not enforced by a balancing rule. It emerges because every transition that adds to circulation also adds to assurance, and every transition that subtracts from circulation also subtracts from assurance — by construction.

### 4.3 Diagnostic equation

```
imbalance = assuranceBalance − speciesInCirculation
```

- `imbalance = 0` → machine state is coherent.
- `imbalance ≠ 0` → machine state is incoherent. Investigation required — **never silent correction.**

The Assurance Account remains intentionally observable as a **canary**. It is not adjusted to force alignment.

### 4.4 Reconciliation with Separation of Authority

This diagnostic contract is how the "no adjustment, only truth" principle of Part II is realized mechanically. The machine does not hide imbalance through balancing logic. Any deviation indicates drift, misclassification, incomplete transition execution, or implementation error — and opens a review case, exactly as the Auditor function specifies.

### 4.5 Dependability test

A dependable system can answer, for any transition:

1. What was the validated request?
2. What intent was classified?
3. What transition did that intent resolve to?
4. What funding moved?
5. What asset batch moved?
6. What oracle entry witnessed it?
7. What state effect did it produce?
8. Did the coupled variables remain coherent?

If every transition can answer these eight questions, the system is dependable.

---

## Part V — Canonical Statement

Specie is the world's first intelligent digital asset and the native micro-currency of the Onli One network. It exists as a Genome of genotype DENOMINATION, held in an Owner's Vault, moved via EVD through a separation-based financial system where:

- **Intent** is interpreted by Species AI (Syn)
- **Orders** are coordinated by Species Market
- **Money** is settled independently by Species Trust
- **Assets** are transferred independently by Onli
- **Receipts** are composed by the Floor Manager
- **Truth** is witnessed by three independent oracles
- **Correlation** is verified by the Auditor
- **Coherence** is observable through the coupled state contract

There is no adjustment. There is only truth.

One Specie. One Owner. One authentic possession. There can be Onli one.

---

*End of Canon.*
