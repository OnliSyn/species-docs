# Runbook: Oracle / authority mismatch

Use this when reconciliation shows **non-zero imbalance**, oracle correlation fails, or **MarketSB vs Species** read models disagree on coupled variables (funding vs vault, assurance vs circulation).

## Principles (Species Core Canon)

1. **Append-only truth** — Do not “fix” ledger rows or oracle history in place. Record findings; corrections go through governed Cashier / pipeline flows only.
2. **Separated authorities** — MarketSB owns USDC posting; Species owns Specie inventory. Never debit one system to paper over the other.
3. **No silent correction** — If verification cannot explain a delta, **stop mutations** (no user trades, no sim resets in production) until root cause is classified.

## Immediate response (production)

1. **Freeze writes** — Disable or block trade execution paths that move USDC or Specie until scope is known (feature flag, maintenance page, or operator kill-switch per your deployment).
2. **Snapshot evidence** — Capture:
   - `GET /api/health` (both authorities)
   - `GET /api/verify-balances`
   - `GET /api/oracle` (or your oracle audit route)
   - `GET /api/trade-panel?userRef=…` for affected users
3. **Classify the gap**
   - **Funding vs vault** — User paid but asset not delivered (or reverse): trace Cashier batch id + Species `eventRequest` id.
   - **Assurance vs circulation** — Assurance posted below circulation value: treat as **coverage** incident; do not mint Specie to compensate.
4. **Communicate** — Internal: link batch/event ids. External: generic “settlement delayed” until numbers reconcile; never invent balances.

## Sim / dev

- Run `npm run validate:canon` after changes to catch URL and money drift.
- `sh scripts/smoke-sims.sh` confirms both sims are up before relying on local demos.
- Use `POST …/sim/reset` only in **non-production** environments.

## Recovery

- After root cause is fixed in code or config, replay or re-run governed settlement (per Cashier/Species design), then re-run `verify-balances` and oracle checks until green.
- Post-incident: add a **contract test** for the failure mode so regression is caught in CI.
