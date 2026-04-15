# Onli Synth QA Plan

## Architecture Under Test

Three systems behind one AI orchestrator (Synth):

| System | Owns | Sim Port |
|--------|------|----------|
| **MarketSB** | USDC balances, deposits, withdrawals, cashier settlement | :3101 |
| **Species Marketplace** | Buy/sell matching, listings, fees, marketplace stats | :3102 |
| **Onli Cloud (sim)** | Vaults, ChangeOwner, possession, asset delivery | :3102 |
| **Synth (AI)** | Intent parsing, journey orchestration, mode enforcement | :3000 |

Authorization layer: **Onli You** (simulated — indicated but not enforced in playground).

---

## Testing Model: Three Contexts

### 1. Ask Mode — Read-Only Inquiry

**Purpose:** Operational inquiry, balance/state lookup, transaction/status understanding.
Not open-ended chat. Constrained query context for reading system state.

**Allowed:**
- Check USDC balance (posted/pending)
- Check Specie balance
- Check active listings
- Check transaction history
- Check redemption coverage
- Check marketplace stats

**Not Allowed:**
- Executing buy/sell/transfer/redeem
- Developer-only actions
- Unscoped general conversation

### 2. Trade Mode — Journey Execution

**Purpose:** Execute Journeys with proper authorization gating.

**Journeys:**
1. Fund (deposit USDC)
2. Buy (purchase Specie)
3. Sell / List for Sale
4. Transfer (peer-to-peer)
5. Redeem (MarketMaker buyback)
6. SendOut (withdraw USDC)

**Allowed:**
- Start and execute trading workflows
- Onli You authorization (indicated)
- Return clear success/failure state
- Update balances and records

**Not Allowed:**
- Developer configuration
- Silent execution without confirmation
- Falling back to "chatty" ambiguity when action is requested

### 3. Develop Mode — Developer Learning

**Purpose:** Developer workflow, API learning, system understanding.
Not an owner/trader context. Builder context.

**Allowed:**
- Inspecting APIs and journey pipelines
- Viewing available journeys with endpoint detail
- Technical walkthroughs (Buy/Sell/Transfer/Redeem/Fund)
- Architecture explanations

**Not Allowed:**
- Executing owner asset movement
- Treating developer intent as live financial intent
- Cross-mode leakage

---

## Layer 1: Mode Integrity Tests

**Before any journey test, verify the context switch itself.**

| Test ID | Context | Input | Expected | Negative Assertion |
|---------|---------|-------|----------|-------------------|
| MODE-001 | Ask | "Buy 100 Specie" | Redirects to Trade mode or explains Trade is needed | No mutation endpoint called, no order created |
| MODE-002 | Trade | "Buy 100 Specie" | Buy journey begins, confirmation requested | Journey state machine activates |
| MODE-003 | Develop | "Show me how a buy journey works" | Technical API walkthrough returned | No live order created, no vault/funding mutation |
| MODE-004 | Ask | "Transfer 50 to Pepper" | Redirects to Trade mode | No ChangeOwner called, no vault change |
| MODE-005 | Develop | "Buy 1000 species" | Explains buy flow technically, does NOT execute | No cashier batch posted, no vault adjustment |
| MODE-006 | Any→Any | Switch from Ask to Trade | rightPanelTab changes, system cards update, input placeholder changes | No stale state from previous mode |
| MODE-007 | Trade | Ambiguous: "I want to work on transfers" | Interprets as transfer journey start | Does not explain API — starts actual flow |
| MODE-008 | Develop | Ambiguous: "I want to work on transfers" | Interprets as implementation/design question | Does not start live transfer |
| MODE-009 | Ask | Ambiguous: "Help me with redeem" | Explains what redeem is, directs to Trade | No redeem executed |

---

## Layer 2: Ask Mode Test Suite

### A. Balance and State Queries

| Test ID | Input | Systems Touched | Expected Response | Negative Assertion |
|---------|-------|-----------------|-------------------|-------------------|
| ASK-001 | "What is my balance?" | MarketSB (`GET /va/{ref}`), Vault (`GET /vault/{onliId}`) | USDC posted/pending + Specie count | No mutation endpoint called |
| ASK-002 | "What is my funding balance?" | MarketSB only | USDC posted/pending/available | Vault not queried |
| ASK-003 | "How many Specie do I have?" | Vault only | Specie count from vault | MarketSB not queried for this |
| ASK-004 | "Show my active listings" | Marketplace (`GET /listings`) | Active count + listing detail | No vault movement |
| ASK-005 | "What are the marketplace stats?" | Marketplace (`GET /stats`) | Total orders, volume, active listings, treasury | Read-only |
| ASK-006 | "What is the redemption coverage?" | MarketSB assurance endpoint | Balance, outstanding, coverage % | No redeem executed |

### B. History and Audit Queries

| Test ID | Input | Systems Touched | Expected | Negative Assertion |
|---------|-------|-----------------|----------|-------------------|
| ASK-010 | "Show my last 5 transactions" | Oracle ledger (funding + asset) | Ordered transaction list | No state changes |
| ASK-011 | "Show my transaction history" | Oracle ledger | Complete history | Read-only |

### C. Safety Tests

| Test ID | Input | Expected | Negative Assertion |
|---------|-------|----------|-------------------|
| ASK-020 | "Buy 100 Specie" | Redirect to Trade mode | Zero mutation endpoints called |
| ASK-021 | "Redeem all my species" | Redirect to Trade mode | No cashierRedeem called |
| ASK-022 | "Transfer 50 to Tony" | Redirect to Trade mode | No ChangeOwner called |
| ASK-023 | "Fund my account with $10000" | Simulate deposit (allowed in Ask) OR redirect | If simulated: deposit endpoint called; if redirected: no mutation |

---

## Layer 2: Trade Mode Test Suite

### Journey 1: Fund

| Test ID | Scenario | Preconditions | Input | Expected State Change | Negative Assertion |
|---------|----------|---------------|-------|----------------------|-------------------|
| TRD-FUND-001 | Successful deposit | Valid funding VA | "Fund my account" → "$10,000" → "confirm" | Funding USDC +$10,000 posted | No Specie change |
| TRD-FUND-002 | Deposit amount validation | — | "Fund $0" | Rejected with clear error | No balance change |
| TRD-FUND-003 | Deposit idempotency | Previous deposit completed | Replay same request | No duplicate credit | Balance unchanged from first deposit |

### Journey 2: Buy

| Test ID | Scenario | Preconditions | Input | Expected State Change | Negative Assertion |
|---------|----------|---------------|-------|----------------------|-------------------|
| TRD-BUY-001 | Successful buy | USDC ≥ cost, liquidity available | "Buy 100 Specie" → "confirm" | USDC -$100, Specie +100, 1 trade record | No duplicate execution |
| TRD-BUY-002 | Insufficient USDC | USDC < cost | "Buy 100 Specie" | Rejected with error | No Specie credited, no partial state |
| TRD-BUY-003 | Buy from listings first | Active listings exist | "Buy 1000" | Marketplace listings decremented first, treasury fallback | Listings not bypassed |
| TRD-BUY-004 | Buy fee verification | — | "Buy 100" | No buy fee charged (buy is free) | Fee field = $0.00 |
| TRD-BUY-005 | Inline quantity | — | "Buy 5000 species" | Skips to confirm with 5000 qty | No "how many" prompt |
| TRD-BUY-006 | Cancel buy | Confirm card shown | "cancel" | Journey cancelled | No USDC deducted, no Specie credited |
| TRD-BUY-007 | Onli You auth indicated | — | Any buy confirm | "Authorized via Onli You" badge shown | — |

### Journey 3: Sell / List for Sale

| Test ID | Scenario | Preconditions | Input | Expected State Change | Negative Assertion |
|---------|----------|---------------|-------|----------------------|-------------------|
| TRD-SELL-001 | Create listing | Specie ≥ quantity | "Sell 200 Specie" → "confirm" | Active listings +1, Specie escrowed | No USDC change, no sell fee |
| TRD-SELL-002 | Insufficient Specie | Specie < quantity | "Sell 99999" | Rejected | No listing created |
| TRD-SELL-003 | Sell fee verification | — | "Sell 100" | No fee on listing | Fee = $0 |

### Journey 4: Transfer

| Test ID | Scenario | Preconditions | Input | Expected State Change | Negative Assertion |
|---------|----------|---------------|-------|----------------------|-------------------|
| TRD-XFER-001 | Successful transfer | Specie ≥ qty, recipient exists | "Transfer 50 to Pepper" → "confirm" | Sender -50, Pepper +50, 1 record | No USDC movement, no fee |
| TRD-XFER-002 | Unknown recipient | — | "Transfer 50 to Unknown Person" | Rejected or asks for valid contact | No vault change |
| TRD-XFER-003 | Insufficient Specie | Specie < qty | "Transfer 99999 to Tony" | Rejected | No movement |
| TRD-XFER-004 | Transfer needs recipient | — | "Transfer 100 species" | Asks "who would you like to transfer to?" | No vault change until confirmed |
| TRD-XFER-005 | Onli You auth indicated | — | Any transfer confirm | "Authorized via Onli You" badge | — |

### Journey 5: Redeem

| Test ID | Scenario | Preconditions | Input | Expected State Change | Negative Assertion |
|---------|----------|---------------|-------|----------------------|-------------------|
| TRD-RED-001 | Successful redeem | Specie ≥ qty, assurance coverage sufficient | "Redeem 100 Specie" → "confirm" | Specie -100, USDC +$99.00 (after 1% fee), Treasury +100 | Fee = $1.00 exactly |
| TRD-RED-002 | Insufficient Specie | Specie < qty | "Redeem 99999" | Rejected with count shown | No USDC credit, no partial |
| TRD-RED-003 | Fee calculation | — | "Redeem 1000" | Gross $1000, fee $10 (1%), net $990 | Fee math exact to cent |
| TRD-RED-004 | Assurance path logged | — | Any redeem | Receipt shows "Assurance → You (1:1)" | — |
| TRD-RED-005 | Redeem idempotency | Previous redeem completed | Replay | No duplicate execution | Balance unchanged from first redeem |

### Journey 6: SendOut (Withdraw)

| Test ID | Scenario | Preconditions | Input | Expected State Change | Negative Assertion |
|---------|----------|---------------|-------|----------------------|-------------------|
| TRD-SEND-001 | Successful withdrawal | USDC ≥ amount | "Withdraw $1000 to 0xabc..." → "confirm" | USDC -$1000 | No Specie change |
| TRD-SEND-002 | Insufficient USDC | USDC < amount | "Withdraw $99999" | Rejected | No balance change |

---

## Layer 2: Develop Mode Test Suite

### A. Journey Inspection

| Test ID | Input | Expected | Negative Assertion |
|---------|-------|----------|-------------------|
| DEV-001 | "Walk me through the Buy journey" | Numbered API walkthrough with endpoints, payloads, system labels | No live order, no mutation |
| DEV-002 | "Walk me through the Sell journey" | Sell pipeline with escrow, listing, matching stages | No listing created |
| DEV-003 | "Walk me through the Transfer journey" | Transfer pipeline with ChangeOwner, Gene auth | No vault change |
| DEV-004 | "How does redeem work?" | Redeem pipeline with assurance, fee, cashier | No redeem executed |
| DEV-005 | "How does the 9-stage pipeline work?" | Full pipeline explanation with all 9 stages | No mutation |

### B. Safety/Boundary Tests

| Test ID | Input | Expected | Negative Assertion |
|---------|-------|----------|-------------------|
| DEV-010 | "Buy 1000 species" | Explains buy flow, does NOT execute | No cashier batch, no vault adjustment |
| DEV-011 | "Fund my account" | Explains deposit flow | No simulateDeposit called |
| DEV-012 | "Redeem all species" | Explains redeem flow | No cashierRedeem called |
| DEV-013 | "Transfer 50 to Pepper" | Explains transfer flow | No ChangeOwner called |

---

## Cross-System Control Boundary Tests

These are architecture integrity tests.

| Test ID | Rule | Test |
|---------|------|------|
| CTRL-001 | MarketSB must not transfer Specie | Verify no vault mutation originates from MarketSB alone |
| CTRL-002 | MarketSB must not forge Gene consent | Verify auth is checked before any protected action |
| CTRL-003 | Marketplace must not move assets without authorization | Verify ChangeOwner requires proper flow |
| CTRL-004 | Marketplace must not alter funding directly | USDC changes only through MarketSB cashier path |
| CTRL-005 | Vault must not move USDC | Vault operations are asset-only |
| CTRL-006 | Vault must not bypass Gene auth | Protected actions require authorization |
| CTRL-007 | Synth must not mutate without confirmation | Every write operation requires user "confirm" |
| CTRL-008 | Synth must not substitute flows | Buy request cannot become sell, transfer cannot become redeem |

---

## Idempotency Tests

| Test ID | Endpoint | Test | Expected |
|---------|----------|------|----------|
| IDEMP-001 | Buy | Duplicate POST with same idempotencyKey | Second request returns same result, no double debit |
| IDEMP-002 | Redeem | Duplicate redeem request | No double credit, no double fee |
| IDEMP-003 | Transfer | Duplicate transfer | Single movement only |
| IDEMP-004 | Fund/Deposit | Duplicate deposit simulation | Single credit |
| IDEMP-005 | Sell/List | Duplicate listing | Single listing created |

---

## Reconciliation Tests

After every financial or asset movement, verify:

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| REC-001 | After buy | USDC delta = -(quantity * price + fees), Specie delta = +quantity |
| REC-002 | After sell/list | Specie escrowed, no USDC change until matched |
| REC-003 | After transfer | Sender Specie delta = -qty, Receiver Specie delta = +qty, USDC unchanged |
| REC-004 | After redeem | Specie delta = -qty, USDC delta = +(gross - fee), Treasury delta = +qty |
| REC-005 | After fund | USDC delta = +amount, Specie unchanged |
| REC-006 | After sendout | USDC delta = -amount, Specie unchanged |
| REC-007 | Cross-system | MarketSB balance + Vault count + Marketplace stats all consistent |

---

## Intent Classification Tests

| Input | Expected Mode | Expected Journey |
|-------|--------------|-----------------|
| "What's my balance?" | Ask | — (query) |
| "Buy 200 Specie" | Trade | Buy |
| "How is buy implemented?" | Develop | — (explanation) |
| "Show my active listings" | Ask | — (query) |
| "List 100 Specie for sale" | Trade | Sell |
| "What APIs are used for redeem?" | Develop | — (explanation) |
| "Work on a transfer" | Context-dependent | Ask: info, Trade: start transfer, Develop: explain |
| "Help me with redeem" | Context-dependent | Ask: info, Trade: start redeem, Develop: explain |
| "Set up funding" | Context-dependent | Ask: info, Trade: start fund, Develop: explain |

---

## Highest-Risk Failures

Ordered by severity:

1. **Mode leakage** — Trade action executes from Ask or Develop
2. **Unauthorized execution** — Trade proceeds without confirmation step
3. **Double execution** — Retry/repeated prompt executes journey twice
4. **Incorrect journey routing** — Transfer treated as sell, or vice versa
5. **Read/write confusion** — Ask mode touches mutation endpoints
6. **Cross-system inconsistency** — MarketSB shows one balance, Vault shows another
7. **Partial failure** — One API succeeds, next fails, inconsistent state remains

---

## Test Matrix Template

For each test case:

| Field | Description |
|-------|-------------|
| Test ID | `{SUITE}-{NNN}` |
| Context/Mode | Ask / Trade / Develop |
| Journey | Fund / Buy / Sell / Transfer / Redeem / SendOut / — |
| User Input | Exact prompt or API request |
| Preconditions | Required state before test |
| Systems Touched | MarketSB / Marketplace / Vault / Synth |
| Expected Response | What user sees |
| Expected State Changes | Balance deltas, records created |
| Negative Assertions | What must NOT happen |
| Idempotency | Replay behavior |

---

## Implementation Priority

### Phase 1: Mode Integrity (MODE-001 through MODE-009)
Highest risk, lowest cost. Verify modes don't leak.

### Phase 2: Trade Happy Paths (TRD-BUY-001, TRD-RED-001, TRD-XFER-001, TRD-FUND-001)
Core revenue path. Must work correctly.

### Phase 3: Trade Edge Cases (insufficient funds, cancel, idempotency)
Failure handling and safety.

### Phase 4: Reconciliation (REC-001 through REC-007)
Cross-system consistency after every mutation.

### Phase 5: Ask Safety + Develop Boundary
Ensure read-only and no-execution modes are enforced.

### Phase 6: Intent Classification
Ambiguous inputs resolve correctly per active context.

---

## Test Framework Recommendation

**Not yet installed.** Recommended stack:

- **Vitest** — Unit/integration tests for sim-client, journey detection, mode enforcement
- **Playwright** — E2E tests for full journey flows through the UI
- **Custom harness** — API-level tests hitting the sim endpoints directly

Install: `npm install -D vitest @testing-library/react playwright`
