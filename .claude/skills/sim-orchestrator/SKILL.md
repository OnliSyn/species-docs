---
name: sim-orchestrator
description: "@marketsb/sim + @species/sim 빌드 오케스트레이터. 두 sim 패키지를 병렬로 구축하고 Onli Synth 프론트엔드와 통합한다. 'sim 빌드', 'sim 패키지 구축', '@marketsb/sim', '@species/sim' 요청 시 사용."
---

# Sim Package Build Orchestrator

@marketsb/sim과 @species/sim을 병렬 구축하고 Onli Synth에 통합하는 오케스트레이터.

## Execution Mode: Sub-agents (fan-out/fan-in)

MarketSB sim은 Species sim의 의존성이지만, 빌드 자체는 병렬 가능 — Species sim은 MarketSB sim의 URL만 알면 된다. 통합은 3번째 에이전트가 담당.

## Agent Dispatch

**Agent 1: marketsb-sim-engineer** (opus)
- Read `.claude/agents/marketsb-sim-engineer.md` and `.claude/skills/marketsb-sim/SKILL.md`
- Read `.claude/skills/onli-synth-orchestrator/references/three-project-spec.md` (P1 section)
- Create `packages/marketsb-sim/` with all files: package.json, tsconfig.json, src/server.ts, src/state.ts, src/seed.ts, src/handlers/*.ts, src/control.ts, src/index.ts
- All amounts in bigint. Response shapes match spec P1-4 DTOs exactly.

**Agent 2: species-sim-engineer** (opus)
- Read `.claude/agents/species-sim-engineer.md` and `.claude/skills/species-sim/SKILL.md`
- Read `.claude/skills/onli-synth-orchestrator/references/three-project-spec.md` (P2 section)
- Create `packages/species-sim/` with all files: package.json, tsconfig.json, src/server.ts, src/state.ts, src/seed.ts, src/sim-species/*.ts, src/sim-onli/*.ts, src/sim-websocket/*.ts, src/control.ts, src/index.ts
- Pipeline with configurable delays. Real HTTP call to MarketSB sim at Cashier stage.

**Agent 3: integration-engineer** (opus)
- Wire sims into Onli Synth:
  - Update root package.json with workspace config
  - Update vite.config.ts to proxy /api/v1 → port 3101, /marketplace/v1 → port 3102
  - Create dev script that starts both sims + Vite
  - Update src/api/marketsb.ts and src/api/species.ts to use sim URLs
  - Replace/remove server.mjs (superseded by sim packages)
  - Update server.mjs /api/chat to proxy tool calls to sim endpoints

## Verification

1. `cd packages/marketsb-sim && npx tsc --noEmit` — TypeScript compiles
2. `cd packages/species-sim && npx tsc --noEmit` — TypeScript compiles
3. `npm run build` — frontend still compiles
4. Start sims: `node packages/marketsb-sim/src/index.ts` → port 3101
5. `curl http://localhost:3101/api/v1/virtual-accounts?ownerRef=user-001` → BalanceDTO[]
6. Start species sim: `node packages/species-sim/src/index.ts` → port 3102
7. `curl -X POST http://localhost:3102/marketplace/v1/eventRequest -H "Content-Type: application/json" -d '{"eventId":"test","intent":"buy","quantity":100}'` → 202
8. Frontend chat journeys still work through sims
