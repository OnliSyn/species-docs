---
name: marketsb-integration
description: "MarketSB-USDC REST API 통합 — Cashier(결제 엔진) 역할을 하는 MarketSB의 모든 엔드포인트에 대한 TanStack Query 훅 및 API 클라이언트 구현. TigerBeetle 계좌 토폴로지(코드 100-500), 입금/출금/이체 플로우, Oracle 감사 추적, 보증 잔액 조회, 조정(reconciliation) 기능. MarketSB API, USDC 잔액, 가상 계좌, 입금, 출금, 이체, Oracle, 조정 관련 작업 시 반드시 이 스킬을 사용할 것."
---

# MarketSB-USDC Integration

MarketSB-USDC REST API의 클라이언트 구현과 TanStack Query 훅을 정의하는 스킬.

## API 클라이언트 구조

`src/api/marketsb.ts`에 기본 클라이언트를 구현한다:

```typescript
const MARKETSB_BASE_URL = import.meta.env.VITE_MARKETSB_API_URL;

async function marketsbFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${MARKETSB_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new MarketSBError(response.status, await response.json());
  }
  return response.json();
}
```

## 엔드포인트 매핑

PRD Section 9.1의 전체 엔드포인트:

| Hook | Method | Endpoint | 용도 |
|------|--------|----------|------|
| `useVirtualAccount(id)` | GET | `/virtual-accounts/{id}` | VA 상세 + TigerBeetle 잔액 |
| `useVirtualAccounts(ownerRef)` | GET | `/virtual-accounts?owner_ref={ownerRef}` | 사용자의 모든 VA 목록 |
| `useDepositStatus(id)` | GET | `/deposits/{id}` | 입금 라이프사이클 상태 |
| `useWithdrawalStatus(id)` | GET | `/withdrawals/{id}` | 출금 라이프사이클 상태 |
| `useOracleLedger(vaId)` | GET | `/oracle/virtual-accounts/{id}/ledger` | VA 감사 이력 |
| `useWalletBalance(id)` | GET | `/wallets/{id}/balance` | 시스템 지갑 잔액 (운영자 전용) |
| `useReconciliationStatus()` | GET | `/reconciliation/status` | 조정 상태 |
| `useTransfer()` | POST | `/transfers` | 내부 USDC 이체 (mutation) |
| `useRequestWithdrawal()` | POST | `/withdrawals` | USDC 출금 요청 (mutation) |
| `useVerifyOracle(vaId)` | POST | `/oracle/virtual-accounts/{id}/verify` | Oracle 검증 |
| `useRunReconciliation()` | POST | `/reconciliation/run` | 조정 실행 (운영자 전용) |

## TigerBeetle Balance DTO

```typescript
interface TigerBeetleBalanceDTO {
  account_id: string;
  account_code: number;          // 100, 200, 300, 400, 450, 500
  subtype?: 'funding' | 'species' | 'assurance';
  posted_balance: string;        // 문자열로 전달 (bigint 변환 필요)
  pending_balance: string;
  posted_debits: string;
  posted_credits: string;
}
```

`posted_balance`는 문자열로 전달된다 — JSON은 bigint를 지원하지 않기 때문이다. 클라이언트에서 `BigInt(dto.posted_balance)`로 변환한다.

## 입금 상태 폴링

입금은 비동기 라이프사이클을 따른다:

```
detected → awaiting_confirmations → confirmed → credited
```

`useDepositStatus` 훅은 `refetchInterval: 5000`으로 폴링하되, `credited` 또는 에러 상태에서 폴링을 중단한다.

## 멱등성 키

모든 mutation에 멱등성 키를 포함한다:

```typescript
function generateIdempotencyKey(): string {
  return `${crypto.randomUUID()}`;
}
```

Species 파이프라인 연동 시에는 `{eventId}:{matchId}` 형식을 사용한다.

## Oracle 감사 추적

각 VA의 Oracle 이벤트:
- `deposit_detected`, `deposit_confirmed`, `deposit_credited`
- `withdrawal_requested`, `withdrawal_broadcast`, `withdrawal_confirmed`
- `internal_transfer_sent`, `internal_transfer_received`
- `internal_transfer_posted` (Cashier가 Species 파이프라인으로 전송)

## 에러 타입

```typescript
class MarketSBError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { code: string; message: string; details?: unknown }
  ) {
    super(body.message);
  }
}
```

주요 에러 처리:
- 409: 멱등성 응답 (정상 처리, 기존 결과 반환)
- 429: 자동 재시도 (TanStack Query의 retry 설정)
- 403: 정책 거부 (모달로 사유 표시)
