# Code Review Agent — Design Spec

**Date:** 2026-04-11
**Approach:** Extend existing `qa-engineer` agent with pre-commit code review capability

## Overview

Add a pre-commit code review mode to the existing `qa-engineer` agent. The agent gains two operating modes:

- **Runtime QA** (existing) — journey testing, observable behavior, balance verification
- **Pre-Commit Review** (new) — static analysis of staged diffs + boundary cross-checks + auto-fix

A new skill `.claude/skills/code-review/SKILL.md` encapsulates the review logic. The CI orchestrator integrates it as Stage 0 before build.

## Trigger

- **Pre-commit gate:** Runs as Stage 0 in the `ci-orchestrator` pipeline
- **Invocable as:** `/code-review` skill or by dispatching the `qa-engineer` agent with a review prompt

## Review Pipeline

### Step 1: Collect Diff + Boundaries

1. Run `git diff --cached` to get staged changes. If no staged changes exist, report `PASS` immediately and skip all subsequent steps.
2. For each changed file, identify which domain boundaries it touches:
   - Amount handling (`src/lib/amount.ts`)
   - Fee calculations (`src/lib/amount.ts`, `src/features/species/BuyFlow.tsx`, `SellFlow.tsx`)
   - API type contracts (`src/types/marketsb.ts`, `src/types/species.ts`, `src/types/onli-cloud.ts`)
   - Mode store (`src/stores/tab-store.ts`)
   - Audit invariants (`src/lib/audit.ts`, `src/lib/journey-engine.ts`)
3. Read the full content of boundary files that the diff interacts with (via imports or direct modification)

### Step 2: Domain Rule Checks

Six checks ordered by severity:

| # | Check | Severity | Auto-fixable? | Detection Pattern |
|---|-------|----------|---------------|-------------------|
| 1 | Floating point on monetary values | CRITICAL | Yes | `parseFloat`, `toFixed`, `Number()` on amount/balance/fee/cost/price variables; `: number` type on monetary fields |
| 2 | Fee formula correctness | CRITICAL | Yes | Issuance must be `qty * 10_000n`; Liquidity must be `(amount * 2n) / 100n`; deviations from canonical formulas in `amount.ts` |
| 3 | API shape mismatch | CRITICAL | Yes | String balance properties (`posted_balance`, fees) used in arithmetic without `BigInt()` conversion |
| 4 | Mode isolation violation | HIGH | No | Cross-mode state access (e.g., Trade-only state read in Ask mode); missing tab reset in `setChatMode`; Canvas tab referenced outside Develop |
| 5 | Audit invariant gap | HIGH | Yes | Transaction execution (`execute*` functions in journey-engine) without subsequent `runAudit()` call |
| 6 | Regression patterns | MEDIUM | No | Double API paths (`/api/v1/api/v1`); missing fee fields in ConfirmCard data; invariant formula changes without test updates |

### Step 3: Auto-Fix

For violations marked auto-fixable:

1. Apply the minimal fix directly to the source file
2. Re-stage the fixed file (`git add <file>`)
3. Log the fix with file, line, before/after

**Auto-fix rules:**
- Floating point to bigint: Replace `parseFloat(x)` with `BigInt(x)` or appropriate `amount.ts` helper
- Fee formula: Replace with canonical formula from `amount.ts`
- API shape: Wrap string property access in `BigInt()`
- Audit gap: Insert `await runAudit(specState, msbState)` after transaction execution

### Step 4: Report

Write structured report to `tests/reports/review-report-{timestamp}.md`:

```markdown
# Code Review Report — {date}

## Summary
- Files reviewed: {N}
- Boundary files checked: {N}
- Violations found: {N}
- Auto-fixed: {N}
- Remaining: {N}
- Status: PASS / FIXED / BLOCKED

## Auto-Fixed
1. [{file}:{line}] {description} — Fix: {what was changed}

## Blocked (requires manual fix)
1. [{file}:{line}] {description} — Why: {explanation}

## Files Reviewed
{list of changed files + boundary files cross-checked}
```

**Status meanings:**
- `PASS` — no violations found
- `FIXED` — all violations auto-fixed, pipeline continues
- `BLOCKED` — unfixable violations remain, pipeline stops

## CI Integration

The `ci-orchestrator` pipeline becomes:

```
Stage 0: Code Review (NEW)
  ↓ PASS/FIXED → continue
  ↓ BLOCKED → stop pipeline, report to user
Stage 1: Build (npx tsc --noEmit, npm run build)
Stage 2: Test (test-runner)
Stage 3: Fix Loop (test-debugger, max 3 iterations)
Stage 4: Final Verification
Stage 5: Release (user confirms)
```

If Stage 0 auto-fixes issues, it re-stages the fixed files and continues to Stage 1. If unfixable issues remain, the pipeline stops immediately.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.claude/skills/code-review/SKILL.md` | Create | Review logic, domain checks, auto-fix rules |
| `.claude/agents/qa-engineer.md` | Modify | Add Pre-Commit Review section referencing the new skill |
| `.claude/skills/ci-orchestrator/SKILL.md` | Modify | Add Stage 0 before existing Stage 1 |

## Domain Rules Reference

These are the specific rules the reviewer enforces, derived from the current codebase:

### Amount Handling
- 1 USDC = 1,000,000 base units (bigint)
- All monetary arithmetic uses bigint only
- `src/lib/amount.ts` is the single source of truth for conversions
- `SPECIE_PRICE = 1_000_000n` ($1.00 per Specie)
- `baseUnitsToSpecie()` returns Number (acceptable for integer counts only)

### Fee Formulas
- Issuance fee: `quantity * 50_000n` ($0.05 per Specie)
- Liquidity fee (buy): `(assetCost * 1n) / 100n` (1% of cost)
- Liquidity fee (redeem): `gross * 0.01` (1% of gross proceeds)
- Sell (list): no fees
- Total buy cost: `assetCost + issuanceFee + liquidityFee`
- Net redeem proceeds: `gross - liquidityFee`

### API Shape Contracts
- MarketSB `posted_balance`: string (must `BigInt()` before arithmetic)
- Species `fees.*`: string (must parse before display)
- Species `quantity`: number (integer count, not base units)
- `intent`: exactly `'buy' | 'sell' | 'transfer'` for EventRequest

### Mode Isolation
- `setChatMode()` resets `leftPanelTab` to `DEFAULT_TAB[mode]`
- Canvas tab only in Develop mode
- Fund wizard resets to step 1 on mode change
- No cross-mode state leakage

### Audit Invariants (post-transaction)
- Specie conservation: `treasury + settlement + circulation = 1,000,000,000`
- Assurance 1:1 backing: `assuranceBalance = (circulation + userListedCount) * SPECIE_PRICE`
- No negative balances
- Settlement-listing match: `settlement.count = sum(active_listing.remainingQuantity)`
