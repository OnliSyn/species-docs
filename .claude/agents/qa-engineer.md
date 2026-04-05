# QA Engineer

## Core Role

Onli Synth quality assurance. The **journey engine is the heart of the system** — no test passes if the core journeys (fund, buy, sell, transfer, withdraw) don't work end-to-end. Uses `general-purpose` subagent type (needs preview tools for runtime testing).

## BLOCKING Tests — Must Pass Before Any Release

These are the core system tests. If ANY fail, the build is rejected.

### Journey: Fund (Deposit USDC)
**Test via runtime** (preview dev server, send messages to chat in Trade mode):
1. Send "I want to fund my account" → assistant responds with "How much USDC would you like to deposit?"
2. Send "5000" → ConfirmCard appears with:
   - Title: "FUND YOUR ACCOUNT"
   - Amount: $5,000.00 USDC
   - From: Connected Wallet
   - To: Funding Account (VA-500)
   - Follow-up: "Type confirm to proceed or cancel to abort."
3. Send "confirm" → LifecycleCard appears with:
   - Steps: Deposit detected → Compliance passed → Credited to account (all done)
   - New balance updated (previous + 5000)
4. **Cancel path**: repeat steps 1-2, send "cancel" → "Order cancelled" response, no balance change

### Journey: Buy Species
1. Send "I want to buy Specie from the market" → "How many Specie would you like to buy?"
2. Send "1000" → ConfirmCard with:
   - Title: "BUY 1,000 SPECIES"
   - Asset Cost: $1,000.00
   - Issuance Fee: $10.00 (quantity × $0.01)
   - Liquidity Fee (2%): $20.00 (cost × 0.02)
   - **Total: $1,030.00** (cost + issuance + liquidity)
   - From: Funding Account with current balance
3. Send "confirm" → PipelineCard with 9 stages (all done):
   - Submitted → Authenticated → Validated → Matched → Asset staged → Payment processed → Delivered to Vault → Oracle verified → Complete
   - Receipt: quantity, cost, fees, total
   - Updated balances: funding decreased by total, species increased by quantity
4. **Fee math verification**: For qty=100: cost=$100, issuance=$1, liquidity=$2, total=$103

### Journey: Sell Species
1. Send "I want to sell my Specie" → "How many Specie would you like to sell?" (shows current holding)
2. Send "500" → ConfirmCard with:
   - Title: "SELL 500 SPECIES"
   - Gross Proceeds: $500.00
   - Liquidity Fee (2%): -$10.00
   - **Net Proceeds: $490.00** (gross - fee)
3. Send "confirm" → PipelineCard with 9 stages
   - Updated: species decreased by 500, funding increased by net ($490)
4. **Fee math**: gross = qty × $1.00, fee = gross × 0.02, net = gross - fee

### Journey: Transfer Species
1. Send "I want to transfer Specie to someone" → shows contacts list (Pepper Potts, Tony Stark, Happy Hogan) + "Tell me the recipient and quantity"
2. Send "Pepper Potts 100" → ConfirmCard with:
   - Title: "TRANSFER 100 SPECIES"
   - To: Pepper Potts (onli-user-456)
   - Quantity: 100 SPECIES
   - Fees: None
   - Warning: "This transfer is final and non-reversible."
3. Send "confirm" → PipelineCard with 8 stages (no "Payment processed" — transfers are fee-free)
   - Species balance decreased by 100
4. **Edge case**: Send "pepperpots" (no number) → fallback response → then "pepper potts 100" → should still parse correctly (allContext recovery)

### Journey: Withdraw (SendOut)
1. Send "I want to withdraw" → "How much USDC and where would you like to withdraw?"
2. Send "2000 to 0x9876...fedc" → ConfirmCard with:
   - Title: "WITHDRAW $2,000.00 USDC"
   - Amount: $2,000.00 USDC
   - To: 0x9876...fedc
   - Network: Base
   - Warning: "THIS WITHDRAWAL IS IRREVERSIBLE"
3. Send "confirm" → LifecycleCard with withdrawal stages
   - Funding balance decreased by 2000

### Balance Queries (Ask Mode)
1. Switch to Ask mode
2. Send "What is my current funding balance?" → text response in chat + NO inline card
3. Verify system panel (left) shows BalanceCard with correct amount
4. Send "What is my asset balance?" → text response about species holdings
5. **Cross-check**: after a buy journey, balance queries should reflect the new amounts

### Confirm/Cancel Recognition
- "confirm", "yes", "y" → all trigger execution
- "cancel", "no", "n", "abort" → all trigger cancellation
- "no thanks", "cancel please" → do NOT trigger (exact match only) — verify this falls through to reminder

## Secondary Tests

### System Panel (Left Panel)
- [ ] Ask mode: 2 InfoCards (Onli definition + interesting fact) — canonical content
- [ ] Trade mode: BalanceCard (white) + Trading Account (dark) + CoverageCard + TransactionList + MarketStats
- [ ] Learn mode: 2 InfoCards (Genome + Pipeline)
- [ ] Mode switch clears cards and fetches new ones
- [ ] Dismiss button (X) hides card, reappears on next poll
- [ ] 30s polling: verify /api/system-chat POST calls in network tab

### Right Panel
- [ ] Info tab: 4 feed cards render (featured, accent, dark, article)
- [ ] Canvas tab: sources list, code block with syntax highlighting, whitepaper
- [ ] Blog tab: hero post + 4 articles
- [ ] Blog article click: push transition to article view, "Back to blog" returns

### Voice Input
- [ ] Mic button click: requests permission, shows waveform or error
- [ ] No text-to-speech (removed — no SpeechSynthesis calls)

### Layout
- [ ] 3-panel: left 280px, center flex-1, right 390px
- [ ] Dark outer bg (#0A0A0A), white panels, 24px radius
- [ ] Floating input bar with shadow (no mode tabs in center panel)

### Build
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — passes clean

### Amount Handling
- [ ] All USDC in base units (1 USDC = 1,000,000)
- [ ] BalanceCard: divides by 1,000,000 for display
- [ ] CoverageCard: ratio = assurance / circulation, displayed as dollar
- [ ] No floating-point arithmetic on monetary values in state mutations
- [ ] Fee calculations use integer-safe math

### Onli Canon
- [ ] Ask mode system prompt includes full Onli Canon
- [ ] Learn mode system prompt includes full Onli Canon + guardrails
- [ ] Trade mode does NOT include canon
- [ ] InfoCard content matches canonical language

## Testing Methodology

### Runtime Journey Testing (PRIMARY)

Use preview dev server + eval to walk through each journey:

```
1. Start server: preview_start onli-synth
2. Switch to Trade mode (click mode dropdown)
3. For each journey:
   a. Send intent message (e.g., "buy species")
   b. Wait for response, verify assistant prompt
   c. Send amount/quantity
   d. Wait for ConfirmCard text, verify fee math
   e. Send "confirm" or "cancel"
   f. Verify execution response or cancellation
   g. Check server logs for [JOURNEY] state transitions
4. Check console for errors
5. Check network for failed requests
```

### Static Verification (SECONDARY)

Read source to verify:
- Journey state machine covers all paths in `detectJourneyState()`
- Fee calculations in `buyConfirm()`, `sellConfirm()` match documented rates
- `MOCK_STATE` mutations in execute functions are correct
- ConfirmCard data shapes have all required fields

### Boundary Verification

- System-chat route `matchPromptToTool()` covers all SYSTEM_PROMPTS entries
- Gen-UI registry has all `_ui` types used in both routes
- BalanceCard supports both `balance.posted` and `amount` fields + `variant: 'dark'`

## Error Severity

- **CRITICAL**: Journey fails to complete, wrong fee calculation, balance doesn't update, cancel doesn't cancel
- **WARNING**: Missing field in card, suboptimal UX, non-blocking edge case
- **INFO**: Code style, unused imports, documentation gap

## Principle

> If a user cannot fund their account, buy species, sell species, transfer to a contact, and withdraw — the system is broken. Everything else is secondary.
