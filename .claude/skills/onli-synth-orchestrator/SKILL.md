---
name: onli-synth-orchestrator
description: "Onli Synth 프로젝트 빌드를 위한 에이전트 팀 오케스트레이터. PRD의 7개 Phase(0A-0G)에 따라 5명의 전문 에이전트(lead-architect, ui-engineer, feature-engineer, data-engineer, qa-engineer)를 조율하여 React 대시보드를 구축한다. 'Onli Synth 구축', '프로젝트 빌드 시작', '하네스 실행', 'Phase 시작' 요청 시 반드시 이 스킬을 사용할 것."
---

# Onli Synth Orchestrator

Onli Synth 프로젝트를 PRD에 따라 구축하는 에이전트 팀 오케스트레이터.

## 실행 모드: 에이전트 팀

## 에이전트 구성

| 팀원 | 에이전트 정의 | 역할 | 스킬 | 모델 |
|------|-------------|------|------|------|
| lead-architect | `.claude/agents/lead-architect.md` | 스캐폴딩, 디자인 시스템, 공유 유틸 | onli-synth-scaffold, amount-handling | opus |
| ui-engineer | `.claude/agents/ui-engineer.md` | 페이지, 레이아웃, 컴포넌트 | dual-system-ui | opus |
| feature-engineer | `.claude/agents/feature-engineer.md` | Neich/Species 기능, AI 채팅 | dual-system-ui, ai-chat-mcp | opus |
| data-engineer | `.claude/agents/data-engineer.md` | API 클라이언트, 훅, 스토어 | marketsb-integration, species-integration, amount-handling | opus |
| qa-engineer | `.claude/agents/qa-engineer.md` | 경계면 검증, 빌드 테스트 | onli-synth-qa | opus |

## PRD 참조

전체 PRD는 `references/prd-summary.md`에 요약되어 있다. 팀원들이 필요한 섹션만 참조할 수 있도록 섹션별로 정리되어 있다.

## 워크플로우

### Phase 1: 준비

1. PRD 분석 및 핵심 요구사항 추출
2. 작업 디렉토리에 `_workspace/` 생성
3. PRD 사본을 `_workspace/00_prd/` 에 저장

### Phase 2: 팀 구성 — Phase 0A (Scaffold)

첫 번째 팀: scaffold + 디자인 시스템 + 공유 기반

```
TeamCreate(
  team_name: "onli-synth-scaffold",
  members: [
    {
      name: "lead-architect",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/lead-architect.md and .claude/skills/onli-synth-scaffold/SKILL.md and .claude/skills/amount-handling/SKILL.md. Execute Phase 0A: initialize the Vite + React + TypeScript project, set up Tailwind design tokens, shadcn/ui theme, 3-column responsive layout shell, amount utility, and shared types. Write all files to the project root."
    },
    {
      name: "data-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/data-engineer.md and .claude/skills/marketsb-integration/SKILL.md and .claude/skills/species-integration/SKILL.md and .claude/skills/amount-handling/SKILL.md. Set up the API client infrastructure: MarketSB client, Species client, Onli Cloud client, TanStack Query provider, Zustand stores, and all shared TypeScript types for TigerBeetle account topology and API responses."
    }
  ]
)
```

작업 등록:
```
TaskCreate(tasks: [
  { title: "Initialize Vite project", assignee: "lead-architect" },
  { title: "Configure Tailwind design tokens", assignee: "lead-architect" },
  { title: "Set up shadcn/ui theme", assignee: "lead-architect" },
  { title: "Create layout shell (sidebar + left panel + main panel)", assignee: "lead-architect" },
  { title: "Implement amount utility (src/lib/amount.ts)", assignee: "lead-architect" },
  { title: "Create API client base (MarketSB + Species + Onli Cloud)", assignee: "data-engineer" },
  { title: "Define TypeScript types for all API responses", assignee: "data-engineer" },
  { title: "Set up TanStack Query provider + Zustand stores", assignee: "data-engineer" },
  { title: "Create routing configuration", assignee: "lead-architect" },
])
```

**완료 기준:** `npm run build` 통과, 레이아웃 셸 렌더링, amount 유틸리티 존재

### Phase 3: 팀 재구성 — Phase 0B-0C (Core Features)

Phase 0A 완료 후 팀을 해체하고 4명 팀을 구성:

```
TeamCreate(
  team_name: "onli-synth-features",
  members: [
    {
      name: "ui-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/ui-engineer.md and .claude/skills/dual-system-ui/SKILL.md. Build all shared UI components: sidebar navigation, top header bar, tab switcher, Fund card shell, Balance view shell, Assurance card, Contact list, Order progress stepper, Confirmation card. Use shadcn/ui primitives and the design tokens already configured in tailwind.config.ts."
    },
    {
      name: "feature-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/feature-engineer.md and .claude/skills/dual-system-ui/SKILL.md and .claude/skills/ai-chat-mcp/SKILL.md. Implement the Neich tab flows (deposit, withdrawal, transfer), Species tab flows (buy, sell, transfer), and the AI chat interface with dual MCP tools and confirmation cards. Use the hooks from data-engineer and components from ui-engineer."
    },
    {
      name: "data-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/data-engineer.md and .claude/skills/marketsb-integration/SKILL.md and .claude/skills/species-integration/SKILL.md. Implement all TanStack Query hooks: useVirtualAccount, useDepositStatus, useWithdrawalStatus, useTransfer, useSubmitOrder, useEventStream, useAssetBalance (dual cross-reference). Set up WebSocket/SSE real-time layer with polling fallback."
    },
    {
      name: "qa-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/qa-engineer.md and .claude/skills/onli-synth-qa/SKILL.md. Perform incremental QA: verify amount.ts roundtrip, check API↔Hook type alignment, verify dual-system reconciliation logic, run TypeScript strict build. Report issues to the relevant team member via SendMessage."
    }
  ]
)
```

작업 등록 — Phase 0B (Neich Tab):
```
TaskCreate(tasks: [
  { title: "Build sidebar navigation component", assignee: "ui-engineer" },
  { title: "Build top header bar", assignee: "ui-engineer" },
  { title: "Build tab switcher (Neich/Species)", assignee: "ui-engineer" },
  { title: "Build Fund card component", assignee: "ui-engineer" },
  { title: "Build Balance view component", assignee: "ui-engineer" },
  { title: "Build Assurance card component", assignee: "ui-engineer" },
  { title: "Build Contact list component", assignee: "ui-engineer" },
  { title: "Implement Neich deposit flow", assignee: "feature-engineer" },
  { title: "Implement USDC transfer to contact", assignee: "feature-engineer" },
  { title: "Implement all MarketSB query hooks", assignee: "data-engineer" },
  { title: "Implement deposit status polling hook", assignee: "data-engineer" },
  { title: "QA: Verify amount.ts roundtrip", assignee: "qa-engineer", depends_on: ["Implement amount utility"] },
  { title: "QA: Verify API↔Hook types", assignee: "qa-engineer", depends_on: ["Implement all MarketSB query hooks"] },
])
```

작업 등록 — Phase 0C (Species Tab):
```
TaskCreate(tasks: [
  { title: "Build Order progress stepper", assignee: "ui-engineer" },
  { title: "Build Confirmation card component", assignee: "ui-engineer" },
  { title: "Implement Species buy flow + fee preview", assignee: "feature-engineer" },
  { title: "Implement Species sell flow", assignee: "feature-engineer" },
  { title: "Implement Specie transfer to contact", assignee: "feature-engineer" },
  { title: "Implement Species API hooks + SSE stream", assignee: "data-engineer" },
  { title: "Implement dual-balance cross-reference hook", assignee: "data-engineer" },
  { title: "QA: Verify dual-system reconciliation logic", assignee: "qa-engineer" },
  { title: "QA: Verify Species pipeline event handling", assignee: "qa-engineer" },
])
```

**완료 기준:** Neich 탭 기능 동작, Species 탭 기능 동작, 탭 전환 상태 보존, 빌드 통과

### Phase 4: 팀 재구성 — Phase 0D-0G (Cross-cutting + Polish)

```
TeamCreate(
  team_name: "onli-synth-polish",
  members: [
    {
      name: "feature-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/feature-engineer.md. Build Transactions page (merged history, filters, detail drawer, Oracle audit), Assets page (VA list, Vault contents), Assurance page (coverage dashboard, reconciliation), Analytics page (charts with Recharts), Settings page."
    },
    {
      name: "ui-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/ui-engineer.md. Implement responsive design (mobile sidebar collapse, touch optimization), loading skeletons, error states, empty states for all pages, accessibility (ARIA labels, keyboard nav). Polish the AI chat interface."
    },
    {
      name: "qa-engineer",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "Read .claude/agents/qa-engineer.md and .claude/skills/onli-synth-qa/SKILL.md. Full system QA: build verification, all boundary checks, complete user flow testing (deposit → buy → transfer → sell → withdraw), role-based route guards, error handling for all failure modes in PRD Section 14."
    }
  ]
)
```

**완료 기준:** 모든 페이지 구현, 반응형, 접근성, 빌드 통과, QA 보고서 PASS

## 데이터 전달 프로토콜

### 파일 기반 산출물

| Phase | 경로 | 내용 |
|-------|------|------|
| 0A | 프로젝트 루트 전체 | scaffold 파일들 |
| 0B-0C | `src/features/`, `src/hooks/`, `src/api/` | 기능 코드 |
| 0D-0G | `src/features/`, `src/components/` | 페이지 + 폴리시 |
| QA | `_workspace/qa/` | 검증 보고서 |

### 팀원 간 통신 규칙

- **data-engineer → ui-engineer/feature-engineer**: hook 인터페이스 완성 시 SendMessage로 알림
- **ui-engineer → feature-engineer**: 공유 컴포넌트 완성 시 SendMessage로 props 인터페이스 공유
- **qa-engineer → 해당 팀원**: 이슈 발견 시 직접 SendMessage (critical은 리더에게도)
- **리더**: TaskGet으로 진행률 모니터링, 막힌 팀원에게 지시

## 에러 핸들링

| 에러 유형 | 전략 |
|----------|------|
| 빌드 실패 | qa-engineer가 에러 분석 → 해당 팀원에게 수정 요청 |
| 타입 불일치 | qa-engineer 발견 → data-engineer에게 타입 수정 요청 |
| 컴포넌트 prop 불일치 | feature-engineer가 ui-engineer에게 직접 조율 |
| Phase 지연 | 리더가 작업 재할당 또는 scope 조정 |

1회 재시도 후 재실패 시 해당 모듈을 스킵하고 다음 Phase로 진행한다 (보고서에 누락 명시).

## 테스트 시나리오

### 정상 흐름

```
1. Phase 0A: scaffold 생성 → npm run build 통과
2. Phase 0B: Neich 탭 기능 구현 → 입금 플로우 동작
3. Phase 0C: Species 탭 기능 구현 → 매수 플로우 동작 → 탭 전환 정상
4. Phase 0D: 트랜잭션 통합 목록 → 필터 동작
5. Phase 0E: AI 채팅 → 듀얼 MCP 도구 → 확인 카드
6. Phase 0F: 분석 차트 → 조정 대시보드
7. Phase 0G: 반응형 → 접근성 → E2E 플로우 → 최종 빌드 통과
```

### 에러 흐름

```
1. data-engineer의 hook 타입이 API 응답과 불일치
2. qa-engineer가 교차 검증에서 발견 → data-engineer에게 SendMessage
3. data-engineer가 타입 수정 → 빌드 재실행
4. qa-engineer 재검증 → PASS
5. feature-engineer에게 수정된 hook 사용 알림
```
