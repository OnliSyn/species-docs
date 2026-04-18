# ADR 0001: Species Core Canon — App Boundaries

## Status

Accepted

## Context

[`docs/Species_Core_Canon.md`](../Species_Core_Canon.md) defines non-negotiable invariants: append-only financial truth, separated authorities (money vs assets), UI reads oracle-traceable truth only, no silent correction.

The Onliai dashboard historically mixed concerns: duplicated USDC math, hardcoded sim hosts, and parallel fetch paths increased regression risk.

## Decision

1. **Single sim configuration** — [`src/config/sim-env.ts`](../../src/config/sim-env.ts) is the only supported source for MarketSB/Species origins. `MARKETSB_URL` and `SPECIES_URL` are **origin-only** (no `/api/v1` path segment).

2. **Money and coverage math** — USDC base units (6 decimals) and assurance/circulation read-model calculations live in [`src/lib/assurance-read-model.ts`](../../src/lib/assurance-read-model.ts) (and [`src/lib/amount.ts`](../../src/lib/amount.ts) for formatting). UI and route handlers do not reimplement `/ 1_000_000` for domain meaning.

3. **Server sim access** — [`src/lib/sim-gateway.ts`](../../src/lib/sim-gateway.ts) centralizes HTTP to sims with timeouts; `sim-client` and journey code use it instead of ad-hoc `fetch` URLs.

4. **Guardrails** — `npm run validate:canon` fails CI on new hardcoded `localhost:3101/3102`, stray `@ts-nocheck`, and ad-hoc money scaling outside allowlisted files.

## Consequences

- Next.js rewrites and Docker/Fly must set `MARKETSB_URL` / `SPECIES_URL` at process start where rewrites are evaluated.
- Refactors should extend the gateway and read-model modules rather than adding new fetch helpers.
