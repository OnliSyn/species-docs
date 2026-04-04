---
name: onli-synth-qa
description: "Onli Synth 듀얼 시스템 통합 QA — 경계면 교차 검증(API 응답 shape vs hook 타입), 금액 변환 정확성(bigint 라운드트립, 부동소수점 검출), TigerBeetle VA ↔ Onli Vault 정합성, TypeScript strict 빌드 검증. QA, 테스팅, 검증, 빌드 체크, 타입 검사, 금액 정확성 확인이 필요할 때 반드시 사용."
---

# Onli Synth QA Validation

듀얼 시스템 통합의 품질을 보장하는 교차 검증 스킬. "존재 확인"이 아닌 "경계면 교차 비교"가 핵심이다.

## 검증 우선순위

1. **금액 처리** (critical) — 부동소수점 사용 = 즉시 reject
2. **API ↔ Hook 타입 정합성** (critical) — shape 불일치 = 런타임 실패
3. **듀얼 시스템 정합성** (high) — VA 잔액 ↔ Vault 교차 참조 로직
4. **빌드 통과** (high) — `tsc --noEmit` + `npm run build`
5. **사용자 플로우 완전성** (medium) — 상태 전이 누락 없음

## 1. 금액 처리 검증

### 부동소수점 검출

코드베이스에서 다음 패턴을 검색한다:

```
grep 패턴:
- parseFloat.*amount|balance|fee|cost|price
- toFixed.*amount|balance|fee|cost|price
- \* 0\.|/ 100[^0n]  (정수 나눗셈이 아닌 부동소수점 연산)
- : number.*amount|balance|fee  (amount가 number 타입)
```

`src/lib/amount.ts`를 제외한 모든 파일에서 금액을 직접 연산하는 코드가 있으면 위반이다.

### 라운드트립 테스트

```typescript
// 이 assertion이 통과하는지 확인:
const testValues = [0n, 1n, 1_000_000n, 12_450_000_000n, 999_999_999_999n];
for (const v of testValues) {
  assert(parseUsdcInput(formatUsdcDecimal(v)) === v);
}
```

## 2. API ↔ Hook 경계면 교차 검증

### 방법

1. `src/api/` 파일에서 각 API 함수의 반환 타입 추출
2. `src/hooks/` 파일에서 대응 hook의 `data` 타입 추출
3. 두 shape을 비교:
   - 필드명 일치 (camelCase 통일)
   - 필드 타입 일치 (특히 `posted_balance`: string이어야 함, number 아님)
   - 래핑 여부 (`{ data: [...] }` vs 직접 배열)

### 주요 경계면

| API 응답 | Hook | 주의점 |
|----------|------|--------|
| `GET /virtual-accounts/{id}` → TigerBeetleBalanceDTO | `useVirtualAccount` | `posted_balance`는 string (bigint 변환 필요) |
| `GET /deposits/{id}` | `useDepositStatus` | status enum 값 일치 확인 |
| `GET /events/{eventId}/receipt` | `useOrderStatus` | Species pipeline 이벤트 타입 매핑 |
| SSE `/events/{eventId}/stream` | `useEventStream` | PipelineEvent 유니온 타입의 모든 variant 처리 |

## 3. 듀얼 시스템 정합성 검증

### VA ↔ Vault 교차 참조

```
검증 단계:
1. useAssetBalance hook이 MarketSB Species VA와 Onli Vault 모두 쿼리하는지 확인
2. 두 값의 비교 로직이 정수 연산인지 확인 (BigInt 사용)
3. isReconciled === false일 때 amber 경고가 렌더링되는지 확인
4. 경고 메시지에 양쪽 값을 모두 표시하는지 확인
```

### 탭 전환 상태 보존

```
검증 단계:
1. Neich 탭에서 Fund Card에 금액 입력
2. Species 탭으로 전환
3. Neich 탭으로 복귀
4. 입력한 금액이 보존되는지 확인 (Zustand store)
```

## 4. 빌드 검증

```bash
npx tsc --noEmit           # TypeScript strict 타입 체크
npm run build              # Vite 프로덕션 빌드
npm run lint               # ESLint
```

모든 명령이 0 exit code + 0 warning이어야 한다.

## 5. 사용자 플로우 완전성

### 매수 플로우 상태 전이

```
order.received → order.validated → order.classified → order.matched
→ asset.staged → ledger.posted → ownership.changed → order.completed
```

모든 전이가 UI 스테퍼에 매핑되고, `order.failed` 핸들링이 4단계(staging) 실패에서 올바른 메시지를 표시하는지 확인.

### 입금 플로우 상태 전이

```
detected → awaiting_confirmations → confirmed → credited
```

## 점진적 QA 실행 시점

| 모듈 완성 | 검증 항목 |
|----------|----------|
| amount.ts 완성 | 금액 처리 검증 전체 |
| API 클라이언트 완성 | API ↔ Hook 경계면 |
| 탭 UI 완성 | 듀얼 시스템 정합성 + 탭 전환 |
| 전체 기능 완성 | 빌드 검증 + 플로우 완전성 |

## 검증 보고서 형식

```markdown
# QA Report — {모듈명} — {날짜}

## Summary
- Critical: {N}
- Warning: {N}
- Info: {N}
- Status: PASS / FAIL

## Critical Issues
1. [{파일}:{라인}] {설명} — 수정 제안: {제안}

## Warnings
1. [{파일}:{라인}] {설명}
```
