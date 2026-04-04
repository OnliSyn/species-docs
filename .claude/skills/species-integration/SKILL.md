---
name: species-integration
description: "Species Marketplace 파이프라인 및 Onli Cloud API 통합. EventRequest(매수/매도/이전) 제출, 주문 상태 추적(7단계 파이프라인 스테퍼), SSE 이벤트 스트림, Onli Vault Specie 잔액 조회, 자산 인도(ChangeOwner) 상태. Species 주문, Specie 매수/매도, 마켓플레이스, Onli Cloud, Vault 잔액, 자산 이전, 이벤트 스트림 관련 작업 시 반드시 사용."
---

# Species Marketplace & Onli Cloud Integration

Species Marketplace 파이프라인 API 클라이언트와 Onli Cloud Vault 조회를 구현하는 스킬.

## Species Marketplace API 클라이언트

`src/api/species.ts`:

```typescript
const SPECIES_BASE_URL = import.meta.env.VITE_SPECIES_API_URL;
```

인증: API key + HMAC/nonce/timestamp 서명. 각 EventRequest에 서명을 포함한다.

## 엔드포인트 매핑

| Hook | Method | Endpoint | 용도 |
|------|--------|----------|------|
| `useSubmitOrder()` | POST | `/eventRequest` | 매수/매도/이전 주문 제출 (mutation) |
| `useOrderStatus(eventId)` | GET | `/events/{eventId}/receipt` | 주문 라이프사이클 상태 |
| `useEventStream(eventId)` | GET (SSE) | `/events/{eventId}/stream` | 실시간 이벤트 스트림 |
| `useMarketplaceStats()` | GET | `/stats` | 마켓플레이스 집계 통계 |

## EventRequest 구조

```typescript
interface EventRequest {
  intent: 'buy' | 'sell' | 'transfer';
  quantity: number;                        // Specie 수량 (정수)
  payment_source?: {
    va_id: string;                          // 매수 시: 사용자 Funding VA ID
  };
  recipient?: {
    onli_identity: string;                  // 이전 시: 수신자 Onli 신원
    vault_address: string;                  // 수신자 Vault 주소
  };
  idempotency_key: string;
}
```

## 파이프라인 이벤트 스트림

Species 파이프라인은 7단계를 거친다. SSE 스트림으로 각 단계의 이벤트를 수신한다:

```typescript
type PipelineEvent =
  | { type: 'order.received'; data: { eventId: string } }
  | { type: 'order.validated'; data: { checks: ValidationResult[] } }
  | { type: 'order.classified'; data: { intent: string } }
  | { type: 'order.matched'; data: { fills: Fill[] } }
  | { type: 'asset.staged'; data: { settlementVaultId: string } }
  | { type: 'ledger.posted'; data: { transferBatchId: string } }
  | { type: 'ownership.changed'; data: { vaultReceipt: string } }
  | { type: 'order.completed'; data: { eventReceipt: EventReceipt } }
  | { type: 'order.failed'; data: { stage: string; reason: string } };
```

## SSE 훅 구현

```typescript
function useEventStream(eventId: string | null) {
  // EventSource를 사용하여 SSE 연결
  // 이벤트를 상태 배열에 누적
  // 연결 끊김 시 3초 간격 폴링으로 폴백
  // order.completed 또는 order.failed에서 연결 종료
}
```

폴링 폴백: SSE 연결 실패 시 `GET /events/{eventId}/receipt`를 3초 간격으로 폴링한다.

## 매수 플로우 수수료 미리보기

프론트엔드에서 수수료를 미리보기로 계산한다 (실제 계산은 MarketSB Cashier가 수행):

```typescript
function previewBuyFees(quantity: number): FeePreview {
  const assetCostBaseUnits = BigInt(quantity) * 1_000_000n;      // $1/Specie
  const issuanceFee = BigInt(quantity) * 10_000n;                 // $0.01/Specie
  const liquidityFee = (assetCostBaseUnits * 2n) / 100n;         // 2%
  const totalCost = assetCostBaseUnits + issuanceFee + liquidityFee;

  return { assetCost: assetCostBaseUnits, issuanceFee, liquidityFee, totalCost };
}
```

이 미리보기는 사용자에게 확인 카드를 표시하기 위함이며, 실제 수수료는 MarketSB가 `payment.confirmed` 이벤트 처리 시 계산한다.

## Onli Cloud API 클라이언트

`src/api/onli-cloud.ts`:

| Hook | 용도 |
|------|------|
| `useVaultBalance(userId)` | 사용자 Vault의 실제 Specie 보유 수량 |
| `useTransferReceipt(receiptId)` | ChangeOwner 인도 확인 |

Vault 잔액은 "actual possession" — TigerBeetle의 Species VA 잔액(재무적 청구권)과 독립적이다. 두 값이 다르면 조정 경고를 표시한다.

## 듀얼 잔액 교차 참조

```typescript
function useAssetBalance(userId: string) {
  const { data: speciesVA } = useVirtualAccount(speciesVaId);
  const { data: vault } = useVaultBalance(userId);

  const financialBalance = BigInt(speciesVA?.posted_balance ?? '0');
  const possessionCount = vault?.specieCount ?? 0;
  const expectedFinancial = BigInt(possessionCount) * 1_000_000n;

  const isReconciled = financialBalance === expectedFinancial;

  return { financialBalance, possessionCount, isReconciled };
}
```

`isReconciled`가 false이면 UI에 amber 경고를 표시한다.
