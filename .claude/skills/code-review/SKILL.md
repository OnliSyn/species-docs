---
name: code-review
description: "Pre-commit code review for Onli Synth. Analyzes staged git diffs + boundary files for domain violations: floating-point money, wrong fee formulas, API shape mismatches, mode isolation breaks, missing audit calls, regression patterns. Auto-fixes simple violations, blocks on unfixable issues. Invoke before any commit, or as Stage 0 in the CI pipeline. Use whenever code is about to be committed, staged, or reviewed."
---

# Code Review — Pre-Commit Domain Verification

Analyze staged changes against Onli Synth domain rules. Auto-fix simple violations, block on unfixable issues.

## Pipeline

### Step 1: Collect Diff + Boundaries
1. Run `git diff --cached` to get staged changes.
   - If no staged changes exist, report `PASS` immediately and stop.
   - If the diff is empty but there are untracked files (`git status --porcelain`), warn the user that untracked files won't be reviewed.
2. Parse the diff to identify changed files and changed lines within each file.
3. For each changed file, check if it imports from or modifies any of these boundary files:
   - Amount handling: `src/lib/amount.ts`
   - Fee calculations: `src/lib/amount.ts`, `src/features/species/BuyFlow.tsx`, `src/features/species/SellFlow.tsx`
   - API type contracts: `src/types/marketsb.ts`, `src/types/species.ts`, `src/types/onli-cloud.ts`
   - Mode store: `src/stores/tab-store.ts`
   - Audit invariants: `src/lib/audit.ts`, `src/lib/journey-engine.ts`
4. Read the full content of each identified boundary file. These provide the context for domain rule checks.

### Step 2: Domain Rule Checks
Run all 6 checks against the staged diff. For each violation, record: file, line number, check number, severity, description, whether it was auto-fixed.

#### Check 1: Floating Point on Monetary Values (CRITICAL, auto-fixable)
Search the diff for these patterns in files that handle money (any file importing from `amount.ts`, or files in `src/features/`, `src/api/`, `src/lib/`):

**Detection patterns (grep the diff output):**
- `parseFloat` used on variables named `amount`, `balance`, `fee`, `cost`, `price`, `proceeds`, `total`
- `toFixed` called on monetary values
- `Number()` wrapping monetary strings
- `: number` type annotation on fields named `amount`, `balance`, `fee`, `cost`, `price`, `posted_balance`
- `Math.round`, `Math.floor`, `Math.ceil` on monetary values
- Multiplication or division with decimal literals (`* 0.02`, `/ 100` without `n` suffix)

**Auto-fix:** Replace with the appropriate `amount.ts` helper:
- `parseFloat(x)` on USDC string → `BigInt(x)` or `parseUsdcInput(x)`
- `* 0.02` → `* 2n / 100n`
- `/ 100` → `/ 100n`
- `: number` on monetary field → `: bigint`

#### Check 2: Fee Formula Correctness (CRITICAL, auto-fixable)
Search the diff for fee calculations and verify they match the canonical formulas:

**Canonical formulas (from `src/lib/amount.ts`):**
- Issuance fee: `quantity * 10_000n` (exactly $0.01 per Specie)
- Liquidity fee (buy): `(assetCost * 2n) / 100n` (2% of asset cost)
- Liquidity fee (sell): `(grossProceeds * 2n) / 100n` (2% of gross proceeds)
- Total buy cost: `assetCost + issuanceFee + liquidityFee`
- Net sell proceeds: `grossProceeds - liquidityFee`

**Detection:** Any arithmetic on variables named `fee`, `issuance`, `liquidity`, `cost`, `proceeds` that doesn't match these formulas.

**Auto-fix:** Replace the incorrect formula with the canonical one.

#### Check 3: API Shape Mismatch (CRITICAL, auto-fixable)
Search the diff for uses of API response properties that are strings but need bigint conversion:

**Detection patterns:**
- `posted_balance`, `pending_balance`, `posted_debits`, `posted_credits` used in arithmetic (`+`, `-`, `*`, `/`, comparison) without `BigInt()` wrapping
- `fees.issuance`, `fees.liquidity`, `fees.total` from Species receipts used directly in arithmetic
- Any MarketSB balance DTO field used as a number

**Auto-fix:** Wrap in `BigInt()`. Example: `account.posted_balance + amount` → `BigInt(account.posted_balance) + amount`

#### Check 4: Mode Isolation Violation (HIGH, report only)
Search the diff for cross-mode state access:

**Detection patterns:**
- Importing Trade-specific state (funding balance, species vault) in Ask or Learn mode components
- Referencing `canvas` tab outside of Develop mode code paths
- `setChatMode` call that doesn't reset `leftPanelTab` and `rightPanelTab`
- Fund wizard state accessed outside Trade mode

**Report:** Describe which mode boundary was violated and which file/line.

#### Check 5: Audit Invariant Gap (HIGH, auto-fixable)
Search the diff for transaction execution without audit:

**Detection patterns:**
- Functions matching `execute*` pattern in journey-engine that call MarketSB or Species APIs but don't call `runAudit()` afterward
- New transaction flows added without a corresponding audit call
- Modifications to audit formulas without matching test updates

**Auto-fix:** Insert `await runAudit(specState, msbState)` after the transaction completion block. Log a warning that the developer should verify the audit parameters.

#### Check 6: Regression Patterns (MEDIUM, report only)
Search the diff for known bug patterns from git history:

**Detection patterns:**
- Double API path segments: `/api/v1/api/v1` or any repeated path prefix
- ConfirmCard data objects missing required fields: `title`, `amount`, `from`, `to`, `fees`
- Invariant formula changes in `audit.ts` without corresponding changes in test files (`tests/`)
- `MOCK_STATE` mutations that don't update all affected balances (e.g., buy decreases funding but doesn't increase species)

**Report:** Describe the regression risk and reference the original fix commit if known.

### Step 3: Auto-Fix
For each auto-fixable violation found in Step 2:

1. Read the full source file containing the violation
2. Apply the minimal fix (change only the violating line/expression)
3. Write the fixed file
4. Re-stage it: `git add <file>`
5. Record the fix: `{file}:{line} — {before} → {after}`

**Rules:**
- Never change test files — only fix source code
- If an auto-fix would require changing more than 3 lines, downgrade to "report only" — the fix is too complex to be safe
- After all auto-fixes, run `npx tsc --noEmit` on the fixed files to verify the fixes don't introduce type errors. If they do, revert the fix and report as BLOCKED instead.

### Step 4: Report
Write the report to `tests/reports/review-report-{timestamp}.md` where timestamp is `YYYYMMDD-HHmmss`.

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

**Status determination:**
- `PASS` — zero violations found
- `FIXED` — violations found but all were auto-fixed successfully (tsc passes after fixes)
- `BLOCKED` — at least one unfixable violation remains (CRITICAL or HIGH severity)

**Output:** Print the summary section to the console. If BLOCKED, print the full Blocked section too.
