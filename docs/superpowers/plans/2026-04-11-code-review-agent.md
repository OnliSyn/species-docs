# Code Review Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `qa-engineer` agent with a pre-commit code review mode that analyzes staged diffs for Onli Synth domain violations, auto-fixes simple issues, and blocks commits with unfixable problems.

**Architecture:** A new `/code-review` skill contains the full review pipeline logic (diff collection, 6 domain checks, auto-fix rules, report generation). The existing `qa-engineer.md` agent definition gets a new section pointing to this skill. The `ci-orchestrator` skill is updated to run code review as Stage 0 before build.

**Tech Stack:** Git (diff analysis), Claude agent skills (`.claude/skills/`, `.claude/agents/`), Markdown reports

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.claude/skills/code-review/SKILL.md` | Create | Full review pipeline: diff collection, 6 domain checks with detection patterns, auto-fix rules, report format |
| `.claude/agents/qa-engineer.md` | Modify | Add "Pre-Commit Code Review" section referencing `/code-review` skill |
| `.claude/skills/ci-orchestrator/SKILL.md` | Modify | Insert Stage 0 (code review) before existing Stage 1 |
| `tests/reports/` | Verify exists | Report output directory |

---

### Task 1: Create the Code Review Skill

**Files:**
- Create: `.claude/skills/code-review/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/code-review
```

- [ ] **Step 2: Write the SKILL.md file**

Create `.claude/skills/code-review/SKILL.md` with this exact content:

```markdown
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
```

- [ ] **Step 3: Verify the skill file exists and has valid frontmatter**

```bash
head -5 .claude/skills/code-review/SKILL.md
```

Expected: YAML frontmatter with `name: code-review` and `description:` fields.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/code-review/SKILL.md
git commit -m "feat: add code-review skill for pre-commit domain verification"
```

---

### Task 2: Extend QA Engineer Agent Definition

**Files:**
- Modify: `.claude/agents/qa-engineer.md`

- [ ] **Step 1: Read the current qa-engineer.md**

```bash
cat .claude/agents/qa-engineer.md
```

Understand the existing structure before modifying.

- [ ] **Step 2: Add Pre-Commit Code Review section**

Insert the following section after the `# QA Engineer` heading and before `## Core Role`, making the agent dual-mode:

```markdown
## Operating Modes

This agent operates in two modes:

### Mode 1: Pre-Commit Code Review
Invoke via `/code-review` skill. Analyzes staged git diffs for domain violations (floating-point money, wrong fee formulas, API shape mismatches, mode isolation breaks, missing audit calls, regression patterns). Auto-fixes simple violations, blocks on unfixable issues. Runs as Stage 0 in the CI pipeline.

### Mode 2: Runtime QA (default)
Journey testing, observable behavior verification, balance checks. This is the existing behavior described below.
```

- [ ] **Step 3: Verify the modification**

```bash
head -20 .claude/agents/qa-engineer.md
```

Expected: The new "Operating Modes" section appears after the heading, before "Core Role".

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/qa-engineer.md
git commit -m "feat: extend qa-engineer with pre-commit code review mode"
```

---

### Task 3: Integrate into CI Orchestrator

**Files:**
- Modify: `.claude/skills/ci-orchestrator/SKILL.md`

- [ ] **Step 1: Read the current ci-orchestrator skill**

```bash
cat .claude/skills/ci-orchestrator/SKILL.md
```

- [ ] **Step 2: Add Stage 0 before existing Stage 1**

Insert the following section before `### Stage 1: Pre-flight`:

```markdown
### Stage 0: Code Review
Invoke `/code-review` skill:
1. Collect staged diff + identify boundary files
2. Run 6 domain checks (floating-point money, fee formulas, API shapes, mode isolation, audit gaps, regression patterns)
3. Auto-fix simple violations, re-stage fixed files
4. Generate report to `tests/reports/review-report-{timestamp}.md`

If status is `BLOCKED` → STOP pipeline. Report unfixable violations to user.
If status is `PASS` or `FIXED` → continue to Stage 1.
```

- [ ] **Step 3: Update the Agent Dispatch table**

Add the code review row to the existing table:

```markdown
| Agent | Skill | Purpose |
|-------|-------|---------|
| QA Engineer | `/code-review` | Pre-commit domain rule verification |
| Test Runner | `/test-runner` | Execute tests, classify failures |
| Test Debugger | `/test-debugger` | Diagnose and fix failures |
| UI Agent | (general-purpose) | UI fixes, panel work, visual polish |
```

- [ ] **Step 4: Update the Decision Tree**

Replace the existing decision tree with:

```markdown
## Decision Tree
```
code review passes?
  BLOCKED → report violations, STOP
  PASS/FIXED ↓
build passes?
  NO → fix compilation errors → retry
  YES ↓
all tests pass?
  YES → Stage 4 final check → deploy
  NO → classify failures
    CRITICAL (balance/reconciliation)?
      → test-debugger (priority 1)
    HIGH (mode/idempotency)?
      → test-debugger (priority 2)
    MEDIUM/LOW?
      → test-debugger (priority 3)
  re-run tests
  still failing after 3 loops?
    → STOP, report to user
```
```

- [ ] **Step 5: Verify the changes**

```bash
grep -n "Stage 0" .claude/skills/ci-orchestrator/SKILL.md
```

Expected: Stage 0 section found before Stage 1.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/ci-orchestrator/SKILL.md
git commit -m "feat: add code review as Stage 0 in CI pipeline"
```

---

### Task 4: Verify Reports Directory

**Files:**
- Verify: `tests/reports/`

- [ ] **Step 1: Check the reports directory exists**

```bash
ls -la tests/reports/ 2>/dev/null || echo "MISSING"
```

If MISSING, create it:

```bash
mkdir -p tests/reports
```

- [ ] **Step 2: Add .gitkeep if empty**

```bash
ls tests/reports/ | wc -l
```

If 0 files:

```bash
touch tests/reports/.gitkeep
git add tests/reports/.gitkeep
git commit -m "chore: ensure tests/reports directory exists"
```

---

### Task 5: Smoke Test the Skill

- [ ] **Step 1: Verify the skill appears in the skills list**

Check that `/code-review` is now listed as an available skill. The skill system reads `.claude/skills/*/SKILL.md` — verify the file is in the right location:

```bash
ls .claude/skills/code-review/SKILL.md
```

Expected: File exists.

- [ ] **Step 2: Create a test violation to verify detection**

Create a temporary test file with a deliberate floating-point violation:

```bash
cat > /tmp/test-violation.ts << 'EOF'
const amount = parseFloat("1000000");
const fee = amount * 0.02;
const balance: number = 5000000;
EOF
```

Stage it temporarily to test the diff analysis:

```bash
cp /tmp/test-violation.ts src/lib/test-violation-temp.ts
git add src/lib/test-violation-temp.ts
git diff --cached -- src/lib/test-violation-temp.ts
```

Expected: The diff shows the three violation patterns (parseFloat, `* 0.02`, `: number` on monetary field).

- [ ] **Step 3: Clean up the test file**

```bash
git reset HEAD src/lib/test-violation-temp.ts
rm src/lib/test-violation-temp.ts
```

- [ ] **Step 4: Run the code review skill on current staged changes**

Invoke the `/code-review` skill with whatever is currently staged (if anything). If nothing is staged, expect a `PASS` result with "no staged changes" message.

- [ ] **Step 5: Final commit — all files together**

Verify all 3 files are committed:

```bash
git log --oneline -5
```

Expected: 2-3 commits from Tasks 1-3 visible in the log.
