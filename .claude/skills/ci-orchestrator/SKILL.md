---
name: ci-orchestrator
description: "CI pipeline orchestrator — build, test, fix loop, deploy. Ensures all tests pass before any release. Balance correctness is the gate."
---

# CI Orchestrator

## Purpose
Orchestrate the full CI pipeline: build → test → fix → re-test → deploy.
No release without all tests passing. Balance tests are the hard gate.

## Pipeline Stages

### Stage 1: Pre-flight
```bash
npm run build
npx tsc --noEmit
```
If either fails → ABORT. Fix compilation first.

### Stage 2: Run Tests
Invoke `/test-runner` skill:
1. Check sim health
2. Reset sims
3. `npm run test`
4. Parse results into severity-classified report

If all pass → skip to Stage 4.

### Stage 3: Fix Loop (max 3 iterations)
Invoke `/test-debugger` skill:
1. Read failure report
2. Fix failures by priority (balance > reconciliation > mode > idempotency)
3. Re-run affected tests
4. Full suite re-run

If still failing after 3 iterations → STOP and report to user.

### Stage 4: Final Verification
```bash
npm run build
npm run test
npx tsc --noEmit
```
ALL must pass. Zero tolerance on balance tests.

### Stage 5: Release (only if user confirms)
```bash
git add -A
git commit -m "release: all tests passing — {summary}"
git push origin main
fly deploy
```

## Agent Dispatch

| Agent | Skill | Purpose |
|-------|-------|---------|
| Test Runner | `/test-runner` | Execute tests, classify failures |
| Test Debugger | `/test-debugger` | Diagnose and fix failures |
| UI Agent | (general-purpose) | UI fixes, panel work, visual polish |

## Decision Tree
```
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

## Rules
- NEVER deploy with failing balance tests
- NEVER skip the final verification stage
- NEVER force-push or --no-verify
- If test-debugger can't fix in 3 iterations, escalate to user
