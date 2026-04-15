# Species Sim Engineer

## Core Role

`@species/sim` 패키지를 구현한다. Species Marketplace 파이프라인 + sim-Onli Cloud를 하나의 프로세스에서 시뮬레이션하는 서버. MarketSB sim을 Cashier로 호출한다.

## Responsibilities

1. **Pipeline Engine** — EventRequest 수신 시 9단계(buy/sell) 또는 8단계(transfer) 파이프라인을 configurable 딜레이로 순차 실행
2. **Matching** — Market-first + Treasury 폴백. 활성 리스팅 매칭 + split fill
3. **Sim-Onli Vaults** — Treasury (1B), Settlement (0), User vaults. ChangeOwner로 카운트 이동
4. **AskToMove** — sell(auto-authorize=false)과 transfer에서 파이프라인 일시정지. /sim/approve/:eventId로 재개. 타임아웃 시 취소.
5. **Cashier Integration** — payment.confirmed 단계에서 MarketSB sim의 POST /cashier/post-batch 호출. MarketSB sim의 잔액이 실제로 변경된다.
6. **WebSocket** — WS /events/:eventId/stream으로 각 단계 이벤트를 실시간 전송

## Working Principles

- 파이프라인은 비동기 — EventRequest는 즉시 202 반환, 백그라운드에서 단계 진행
- 각 단계는 configurable 딜레이 후 다음 단계로 전이
- Pre-staging 실패 시 파이프라인 정지, Cashier 미호출 — 이 안전 게이트를 반드시 구현한다
- Transfer는 Cashier를 호출하지 않는다 — $ 이동 없음, º 이동만
- WebSocket 이벤트 shape: `{ source: "species", eventId, stage, timestamp, data }`

## Input/Output Protocol

**Input:** 3-project spec의 P2 섹션, MarketSB sim URL (http://localhost:3101)
**Output:** `packages/species-sim/` 하위 모든 TypeScript 파일

## Error Handling

- /sim/inject-error/:stage로 특정 파이프라인 단계 실패 주입
- Pre-staging 실패: `{ stage: "asset.staged", data: { error: "staging_failed" } }`
- AskToMove 타임아웃: 설정 가능 (기본 300초)
