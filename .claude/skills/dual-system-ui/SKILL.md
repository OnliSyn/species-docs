---
name: dual-system-ui
description: "Onli Synth의 듀얼 시스템 UI 패턴 — Neich/Species 탭 스위처, Fund 카드(탭에 따라 동적 변경), Balance View(Funding/Asset 토글), Assurance 카드, Contact 리스트, 주문 진행 스테퍼. 탭 전환, 잔액 표시, 펀딩/자산 토글, 컨택트 이체, Fund 카드, 확인 카드 구현 시 반드시 사용."
---

# Dual-System UI Patterns

Onli Synth의 좌측 패널 UI 패턴을 정의하는 스킬. Neich(펀딩)와 Species(자산) 두 시스템을 하나의 일관된 인터페이스로 통합한다.

## 핵심 원칙

- 사용자는 두 제품을 쓰는 느낌이 아니라 하나의 대시보드를 쓰는 느낌이어야 한다
- 탭 전환은 페이지 리로드 없이, 상태 유실 없이 이루어져야 한다
- MarketSB는 돈을, Onli는 자산을 다룬다 — 이 경계는 절대적이다

## 탭 스위처: Neich / Species

Zustand store로 활성 탭 상태를 관리한다:

```typescript
interface TabStore {
  activeTab: 'neich' | 'species';
  setActiveTab: (tab: 'neich' | 'species') => void;
}
```

탭 전환 시 변경되는 컴포넌트:
| 컴포넌트 | Neich | Species |
|----------|-------|---------|
| Fund Card | USDC 입금 (금액 + 입금 주소) | Specie 매수 (수량 + 수수료 미리보기) |
| Balance View | Funding VA 잔액 (`$12,450.00`) | Species VA + Vault 교차 (`12,450 SPECIES`) |
| Contact 탭 액션 | USDC 이체 (`POST /transfers`) | Specie 이전 (EventRequest intent: transfer) |

## Fund Card

### Neich 모드 (USDC 입금)

| 필드 | 동작 |
|------|------|
| Enter Amount | 숫자 입력 (USDC 표시 단위) → 정수 기본 단위로 변환 |
| Pay With | 드롭다운: 연결된 지갑 주소 (절단된 주소 표시) |
| Approve 버튼 | 확인 카드 → VA deposit_address 표시 → 폴링 시작 |

### Species 모드 (Specie 매수)

| 필드 | 동작 |
|------|------|
| Enter Amount | 숫자 입력 — Specie 수량 (USDC 등가 표시) |
| Pay With | "USDC (0x...4a2b)" — Funding VA가 결제 소스 |
| Approve 버튼 | 수수료 포함 확인 카드 → EventRequest 제출 → 파이프라인 스테퍼 표시 |

수수료 미리보기:
```
수량: 1,000 SPECIES
단가: $1.00
발행 수수료: $10.00
유동성 수수료: $20.00
총 비용: $1,030.00
```

## Balance View

토글: **Funding** / **Asset**

**Funding 뷰:**
- 데이터: MarketSB `GET /virtual-accounts/{funding_va_id}` → `posted_balance`
- 표시: `$12,450.00` + 통화 아이콘

**Asset 뷰:**
- 데이터: MarketSB Species VA `posted_balance` + Onli Cloud Vault 쿼리
- 표시: `12,450 SPECIES` 또는 `$12,450.00`
- 교차 불일치 시 amber 경고 배지

## Assurance Account Card

| 필드 | 소스 | 계산 |
|------|------|------|
| Balance | MarketSB Assurance VA | 직접 읽기 |
| Total Outstanding | 유통 중 Specie × $1.00 | Reporter 또는 reconciliation |
| Coverage % | `(Assurance / Outstanding) × 100` | 클라이언트 계산 |
| 상태 색상 | ≥50% green, <50% amber, <25% red | 임계값 로직 |

## Contact List

- 각 연락처는 MarketSB VA 참조 + Onli Vault 주소를 모두 보유
- Neich 탭에서 탭: USDC 이체 드로어 (금액 입력 → 확인 → `POST /transfers`)
- Species 탭에서 탭: Specie 이전 드로어 (수량 입력 → 확인 → EventRequest)

## Order Progress Stepper

매수/매도 주문 진행 시 7단계 표시기:

| 단계 | 라벨 | 이벤트 | 시각 상태 |
|------|------|--------|----------|
| 1 | Order submitted | `order.received` | 스피너 |
| 2 | Validating | `order.validated` | 체크마크 |
| 3 | Matched | `order.matched` | 체크마크 |
| 4 | Staging asset | `asset.staged` | 스피너 → 체크마크 또는 ✕ |
| 5 | Processing payment | `ledger.posted` | 스피너 → 체크마크 |
| 6 | Delivering to Vault | `ownership.changed` | 스피너 → 체크마크 |
| 7 | Complete | `order.completed` | 최종 체크마크 |

4단계 실패 시: "Asset could not be reserved — no funds were charged" + 재시도 옵션
6단계 재시도 시: "Delivering to your Vault..." 지속 스피너 (사용자 조치 불필요)

## Confirmation Card Pattern

모든 금융/자산 변경 작업에 확인 카드를 사용한다:

```tsx
interface ConfirmationCardProps {
  title: string;              // "Buy 1,000 SPECIES"
  details: DetailLine[];      // [{label: "Cost", value: "$1,000.00"}, ...]
  system: 'funding' | 'asset'; // 어떤 시스템의 작업인지
  onConfirm: () => void;
  onCancel: () => void;
}
```

AI 채팅에서도 동일한 확인 카드를 인라인으로 표시한다.
