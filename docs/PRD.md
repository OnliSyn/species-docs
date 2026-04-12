# Product Requirements Document -- Onli Synth

**Version:** 3.0
**Date:** April 10, 2026
**Status:** Living document -- reflects current implementation

---

## 1. Overview

Onli Synth is a live simulation of the Onli AI and Species Marketplace infrastructure. It provides a three-panel dashboard where users interact with an AI assistant (Synth) to query account state, execute financial transactions, and learn the underlying API architecture. A full-screen cover page with a p5.js sphere animation greets users on every visit before revealing the dashboard underneath.

The application simulates two backend systems -- MarketSB (USDC funding) and Species Marketplace (digital asset trading) -- connected through a unified AI orchestrator. Every issued Specie is backed 1:1 by $1.00 USDC in assurance, enforced by an audit that runs after every transaction.

---

## 2. Product Vision

Onli Synth demonstrates the full Onli platform lifecycle without requiring real funds or live infrastructure. Owners explore funding, trading, and redemption flows through conversational AI. Developers inspect API architecture and pipeline mechanics. The simulation maintains the same invariants and fee structures as the production system, making it a faithful reference implementation.

### Target Users

| User Type | Description |
|-----------|-------------|
| **Owners** | Onli platform participants who hold USDC funding and Specie digital assets |
| **Developers** | Teams building on Onli who need to understand APIs, pipelines, and architecture |

### Onli Cloud

Onli Synth simulates the Onli platform locally. For inquiries about the production Onli Cloud platform, users are directed to [https://onli.cloud/](https://onli.cloud/).

---

## 3. Modes

The dashboard operates in three mutually exclusive modes. Each mode reconfigures all three panels and governs what actions the AI assistant can perform.

| Mode | Purpose | Chat Behavior | Guardrails |
|------|---------|---------------|------------|
| **Ask** | Read-only information queries | Balance lookups, listing queries, stats, explainers | Cannot execute any trade or mutation |
| **Trade** | Execute financial journeys | Multi-step journey flows with confirmation cards | Confirmation required for every mutation |
| **Develop** | Learn API architecture | Technical walkthroughs, pipeline explanations | Cannot execute any trade or mutation; explains only |

### Panel Layout by Mode

| Panel | Ask | Trade | Develop |
|-------|-----|-------|---------|
| **Left (Panel 1)** | System cards, user info, People gallery | System cards, user info | System cards, user info |
| **Center (Panel 2)** | AI chat -- read-only queries | AI chat -- journey execution with gen-ui cards | AI chat -- technical walkthroughs |
| **Right (Panel 3)** | Info cards + video, Canvas walkthrough, Blog articles | Marketplace info + assurance, Code reference, News | Developer concepts + architecture video, API reference (synced to chat), Whitepapers |

### Mode Safety

Ask and Develop modes cannot execute trades. Any trade-like request in these modes is blocked at the intent classification layer. Trade mode requires explicit user confirmation (typing "confirm") before any mutation executes. Post-transaction audit logging runs after every successful execution.

---

## 4. Journeys

Seven journeys are supported through the Trade mode journey engine. Each follows a state machine: Intent -> Start -> Amount/Quantity -> Confirm -> Execute/Cancel.

### 4.1 Fund

Simulate a USDC deposit to the user's funding virtual account (VA).

- **Trigger:** "fund", "deposit"
- **Fee:** None
- **Effect:** USDC balance increases by deposit amount

### 4.2 Buy

Purchase Specie from the marketplace. The engine checks the marketplace first for existing sell listings at the best available price. If no marketplace inventory exists, the buy executes against the treasury.

- **Trigger:** "buy"
- **Fee:** $0.05/Specie issuance fee (treasury buy only; marketplace buys are free)
- **USDC effect:** Decreases by total asset cost (price + fee if treasury)
- **Specie effect:** Increases by purchased quantity
- **Assurance:** Asset cost flows into assurance, maintaining the $1/Specie backing

### 4.3 Sell

List Specie for sale on the marketplace. The seller's Specie is escrowed to settlement until a buyer matches the listing.

- **Trigger:** "sell", "list"
- **Fee:** None
- **USDC effect:** None (until a buyer matches)
- **Specie effect:** Escrowed from seller's vault to settlement

### 4.4 Transfer

Peer-to-peer vault-to-vault Specie transfer between users.

- **Trigger:** "transfer"
- **Fee:** None
- **Specie effect:** Sender vault decreases, receiver vault increases by transfer quantity

### 4.5 Redeem

Sell Specie back to the system at the guaranteed $1.00/Specie backing rate via assurance. A 1% liquidity fee is deducted. The MarketMaker relists redeemed Specie on the marketplace.

- **Trigger:** "redeem", "buyback"
- **Fee:** 1% liquidity fee (deducted from gross proceeds)
- **USDC effect:** Increases by (quantity x $1.00) minus 1% fee
- **Specie effect:** Decreases by redeemed quantity (returned to treasury/MarketMaker)

### 4.6 SendOut (Withdraw)

Withdraw USDC from the user's funding VA to an external wallet.

- **Trigger:** "withdraw"
- **Fee:** None
- **USDC effect:** Decreases by withdrawal amount

### 4.7 Issue

Admin-only treasury issuance of new Specie. Issues Specie from the treasury with an issuance fee.

- **Trigger:** "issue" + "treasury"
- **Fee:** $0.05/Specie issuance fee
- **USDC effect:** Decreases by total cost (quantity x price + issuance fee)
- **Specie effect:** Increases by issued quantity from treasury

### Journey Confirmation Flow

1. Journey engine detects intent from conversation history
2. AI presents a ConfirmCard with line-item breakdown (amounts, fees, totals)
3. User types "confirm" or "cancel"
4. On confirm: executes via sim APIs, returns PipelineCard with 9-stage progression
5. Onli You authorization badge displayed on confirm and pipeline cards

---

## 5. Fee Structure

| Operation | Fee | Calculation | Destination |
|-----------|-----|-------------|-------------|
| Fund (Deposit) | Free | -- | -- |
| Buy (marketplace) | Free | -- | -- |
| Buy (treasury) | $0.05/Specie issuance | `quantity x $0.05` | operating-300 |
| Sell / List | Free | -- | -- |
| Transfer | Free | -- | -- |
| Redeem | 1% liquidity fee | `quantity x $1.00 x 0.01` | liquidity fee account |
| SendOut (Withdraw) | Free | -- | -- |
| Issue (treasury) | $0.05/Specie issuance | `quantity x $0.05` | operating-300 |

**Amount precision:** All USDC amounts are handled in integer base units (1 USDC = 1,000,000 units). No floating-point arithmetic is used on monetary values.

---

## 6. Invariants and Audit

### Core Invariant

Every issued Specie is backed 1:1 by $1.00 USDC held in assurance. This invariant is verified after every transaction by the audit function.

### Audit Behavior

- The audit runs automatically after every successful journey execution
- It verifies that total Specie in circulation equals assurance pool balance (in dollar terms)
- Audit results are logged as part of the post-transaction pipeline
- Any invariant violation is flagged immediately

### Additional Guarantees

- Confirmation is required before every mutation -- no silent execution
- Mode boundaries are enforced at the intent classification layer
- Vault balances are validated to prevent negative states
- All fee calculations use integer arithmetic to avoid rounding errors

---

## 7. Technical Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.2 + Turbopack | App Router, React 19 |
| AI Chat | Vercel AI SDK (Claude) | `useChat` hook + `streamText` server route, SSE streaming |
| State | Zustand 5 | Mode, panel tabs, chat lock, dev journey tracking |
| Animations | GSAP 3.14 | Cover page transition, card entrance, counter animations |
| Cover Page | p5.js | Full-screen sphere animation with GSAP parallax exit |
| Styling | TailwindCSS | Glassmorphic design system, Manrope font |
| Sim: Funding | MarketSB Express server (:4001) | USDC balances, deposits, withdrawals, cashier settlement |
| Sim: Assets | Species Express server (:4012) | Buy/sell matching, vaults, 9-stage pipeline, Oracle |
| Deployment | Fly.io | Single Docker container (frontend + both sim servers) |

### System Topology

```
                     Synth (AI Orchestrator :3000)
                    /              |              \
              MarketSB          Species         Onli Cloud
              (:4001)         Marketplace        (simulated)
                |               (:4012)             |
          USDC balances      Buy/sell/match      Vaults, Gene auth,
          Cashier batches    9-stage pipeline     ChangeOwner
          Deposits/withdrawals  Listings          Asset delivery
```

### Generative UI Components

| Component | Purpose |
|-----------|---------|
| `ConfirmCard` | Pre-execution breakdown with line items, fees, totals |
| `PipelineCard` | 9-stage pipeline progression after execution |
| `LifecycleCard` | Asset lifecycle state display |
| `BalanceCard` | USDC and/or Specie balance display |

---

## 8. Test Coverage

**Framework:** Vitest
**Total:** 93 tests across 20 files
**Status:** All passing

### By Category

| Category | Tests | Scope |
|----------|-------|-------|
| Mode Safety | ~40 | Mode switching resets state, cross-mode action blocking, confirm-before-execute, intent routing, Develop mode explain-only |
| Journey Execution | ~20 | Buy, Sell, Fund, Redeem, Transfer, SendOut, Issue -- fee verification, cancel flows, insufficient balance rejection |
| Ask Mode | ~8 | Balance queries, listing lookups, stats, history, safety redirects |
| Cross-System | ~8 | Post-mutation balance reconciliation, idempotency |
| Audit Invariants | Included | Assurance backing verification after transactions |

### What Tests Verify

- Mode boundaries are enforced (Ask/Develop cannot trade)
- Every mutation requires explicit confirmation
- Fee calculations are correct (issuance $0.05/sp, liquidity 1%)
- Balance changes are accurate after every journey
- Cross-system reconciliation (MarketSB USDC totals match Species asset values)
- Audit invariant holds after every transaction
- Duplicate requests are handled idempotently

---

## 9. Known Limitations

| Area | Description |
|------|-------------|
| Authentication | Onli You is indicated on cards but not enforced; user is always "Alex Morgan" |
| Mobile | `MobileGate` blocks small screens entirely; no responsive layout |
| Real-time | System cards poll via fetch every 5s; no WebSocket streaming |
| Chat persistence | Per-mode chat history is in-memory only; lost on page reload |
| Contacts | Three hardcoded contacts (Pepper Potts, Tony Stark, Happy Hogan); not API-driven |
| Develop Canvas | Only activates when user clicks a preset or chat sets `devJourney`; not reactive to free-form queries |
| Error UX | No error boundary UI for failed API calls; failures silently caught |

---

## 10. Roadmap

### Near-Term

- Real Onli You authentication (OAuth/passkey flow)
- Error boundary UI for failed API calls and sim downtime
- Loading skeleton states for slow responses
- WebSocket integration for real-time balance and pipeline updates

### Medium-Term

- Mobile responsive layout (single-column with panel swipe)
- Chat history persistence across page reloads
- Live marketplace stats (replace static data in Trade Info tab)
- Reactive Develop Canvas (auto-detect journey from free-form chat)
- Blog CMS integration (replace static posts)

### Long-Term

- Multi-user support with API-driven contacts
- Notification system (trade complete, balance change, listing matched)
- Assurance dashboard with coverage ratio charts and health trends
- Transaction history export (CSV/PDF)
- Dark mode and internationalization
