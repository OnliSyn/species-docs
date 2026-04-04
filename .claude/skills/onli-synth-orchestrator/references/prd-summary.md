# Onli Synth PRD Summary

에이전트 팀원이 참조할 PRD 핵심 요약. 전체 PRD는 `/Users/syn/Downloads/onli_synth_marketsb_usdc_prd_v3_1.md`에 있다.

## 아키텍처 3계층

1. **Onli Synth** (Frontend) — React 대시보드, 이 프로젝트가 빌드하는 것
2. **Species Marketplace Pipeline** — 이벤트 기반 주문 처리 파이프라인
3. **MarketSB-USDC** (Cashier) + **Onli Cloud** (Asset Engine)

**핵심 인사이트**: MarketSB-USDC는 Cashier — Species 파이프라인의 결제 노드. 병렬 시스템이 아니라 파이프라인 내부 노드.

## 기술 스택

React 18+ TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand + TanStack Query, Recharts, Manrope font

## TigerBeetle 계좌 토폴로지

| Code | Type | 용도 |
|------|------|------|
| 100 | Treasury Reserve | USDC 준비금 |
| 200 | Settlement Reserve | 출금 운영 |
| 300 | Operating Revenue | 수수료 수입 |
| 400 | Pending Deposit | 입금 스테이징 |
| 450 | Pending Withdrawal | 출금 스테이징 |
| 500 (funding) | User Funding VA | USDC 잔액 |
| 500 (species) | User Species VA | Specie 자산 가치 |
| 500 (assurance) | Assurance VA | 보증 준비금 |

## 금액 처리 규칙

- 1 USDC = 1,000,000 기본 단위
- 1 Specie = $1.00 = 1,000,000 기본 단위
- 모든 API/TigerBeetle: 정수 기본 단위
- 모든 UI 표시: 포맷된 문자열
- 부동소수점 금지

## 수수료 구조

| 수수료 | 비율 |
|--------|------|
| 리스팅 | $100 flat (100,000,000 기본 단위) |
| 발행 | $0.01/Specie (10,000 기본 단위/Specie) |
| 유동성 | 2% (정수 나눗셈) |

## 페이지 구조

1. **Home** (Onli Synth) — 좌측 패널 + AI 채팅
2. **Assets** — VA 목록 + Vault 내용
3. **Transactions** — 통합 트랜잭션 이력
4. **Assurance** — 보증 커버리지 대시보드
5. **Contacts** — 연락처 관리
6. **Analytics** — 차트 및 통계
7. **Settings** — 프로필, 보안, Onli 신원

## 디자인 토큰

- Background: #FFFFFF (primary), #FAFAFA (card), #F5F5F5 (sidebar)
- CTA: #2D2D2D
- Accents: #C5DE8A (green), #FFCE73 (amber), #E74C3C (red)
- Text: #1A1A1A (primary), #6B6B6B (secondary)
- Card radius: 20px, Button: 12px, Input: 10px
- Font: Manrope (400, 500, 600, 700)

## API 엔드포인트 요약

### MarketSB (PRD 9.1)
GET: /virtual-accounts/{id}, /deposits/{id}, /withdrawals/{id}, /oracle/.../ledger, /wallets/{id}/balance, /reconciliation/status
POST: /transfers, /withdrawals, /oracle/.../verify, /reconciliation/run

### Species Marketplace (PRD 9.2)
POST: /eventRequest (buy/sell/transfer)
GET: /events/{eventId}/receipt, /stats
SSE: /events/{eventId}/stream

### Onli Cloud (PRD 9.3)
GET: Vault balance query, ChangeOwner receipt

## Phase별 배정 가이드

| Phase | 주요 팀원 | 산출물 |
|-------|----------|--------|
| 0A | lead-architect, data-engineer | scaffold, 디자인 시스템, API 클라이언트 기반 |
| 0B | ui-engineer, feature-engineer, data-engineer | Neich 탭 기능 |
| 0C | ui-engineer, feature-engineer, data-engineer | Species 탭 기능 |
| 0D | feature-engineer | Transactions 페이지 |
| 0E | feature-engineer | AI 채팅 인터페이스 |
| 0F | feature-engineer, ui-engineer | Analytics, Assurance, Settings |
| 0G | qa-engineer, ui-engineer | 폴리시, E2E, 접근성 |
