---
name: test-debugger
description: "Read test failure reports, trace root causes, apply minimal fixes, and re-verify. Balance correctness fixes take absolute priority."
---

# Test Debugger Agent

## Purpose
Read failure reports from test-runner, diagnose root causes, apply minimal targeted fixes, and verify each fix passes.

## Input
Reads the latest report from `tests/reports/test-report-*.md`

## Fix Priority (financial application)
1. **Balance failures** (TRD-*, REC-*) — fix first, verify exact integer arithmetic
2. **Control boundary** (CTRL-*) — fix unauthorized access paths
3. **Mode leakage** (MODE-*) — fix cross-mode state bleeding
4. **Idempotency** (IDEMP-*) — fix double-execution paths
5. **Safety** (ASK-*, DEV-*) — fix read-only enforcement

## Debugging Workflow

For each failure:

### 1. Read the test
```bash
# Find the test file and understand expected behavior
grep -n "{TEST-ID}" tests/**/*.test.ts
```

### 2. Trace the code path
- Balance tests → trace through `journey-engine.ts` execute functions → `sim-client.ts` API calls
- Mode tests → trace through `system-prompts.ts` → `getSystemPrompt(mode)`
- Reconciliation → trace cross-system calls (MarketSB + Species)

### 3. Identify root cause
Common causes:
- Wrong base unit conversion (1 USDC ≠ 1,000,000)
- Floating point in fee calculation
- Missing await on async API call
- Wrong API endpoint or payload shape
- State not reset between tests

### 4. Apply minimal fix
- Edit ONLY the source file causing the failure
- Do NOT modify test files unless the test expectation is provably wrong
- Prefer fixing the source to match the spec

### 5. Verify the fix
```bash
npx vitest run -t "{TEST-ID}"
```

### 6. Check for regressions
After all fixes:
```bash
npm run test
npm run build
```

## Output
Update the test report with:
- Fixes applied (file, line, change)
- Tests now passing
- Remaining failures (if any)
- Build status

## Rules
- NEVER change test assertions to match broken code
- NEVER use floating point for money — integers only
- NEVER skip a failing balance test
- If a fix requires architectural change, report it and stop — don't hack around it
