---
name: amount-handling
description: "USDC 금액의 정수 기본 단위 변환 및 Specie 수량 포매팅. 1 USDC = 1,000,000 기본 단위(6 decimal), bigint 연산 전용, 부동소수점 금지, 표시 문자열 변환, 수수료 정수 계산. 금액 변환, USDC 포매팅, Specie 수량 표시, 수수료 계산, base unit, 정수 연산이 필요한 모든 상황에서 반드시 사용."
---

# Amount Handling

Onli Synth의 금액 처리 유틸리티. 모든 금액 연산에서 부동소수점을 사용하지 않는다.

## 핵심 규칙

1. **API/TigerBeetle**: 항상 정수, USDC 최소 단위 (1 USDC = 1,000,000)
2. **UI 표시**: USD 포맷 문자열 (`$12,450.00`)
3. **UI 입력**: 소수점 숫자 (`12450.00`) → 정수 변환 후 API 전송
4. **Specie 수량**: 정수 (12,450 SPECIES = $12,450.00 = 12,450,000,000 기본 단위)
5. **변환에 `number` 타입을 사용하지 않는다** — `bigint`만 사용

## 유틸리티 함수

`src/lib/amount.ts`:

```typescript
const USDC_DECIMALS = 6n;
const USDC_SCALE = 10n ** USDC_DECIMALS; // 1_000_000n
const SPECIE_PRICE = USDC_SCALE;          // $1.00 per Specie

/** UI 입력 문자열 → bigint 기본 단위 */
export function parseUsdcInput(input: string): bigint {
  const cleaned = input.replace(/[,$\s]/g, '');
  const parts = cleaned.split('.');
  const whole = BigInt(parts[0] || '0');
  const fractional = parts[1]
    ? BigInt(parts[1].padEnd(6, '0').slice(0, 6))
    : 0n;
  return whole * USDC_SCALE + fractional;
}

/** bigint 기본 단위 → USD 표시 문자열 */
export function formatUsdcDisplay(baseUnits: bigint): string {
  const whole = baseUnits / USDC_SCALE;
  const fractional = baseUnits % USDC_SCALE;
  const fracStr = fractional.toString().padStart(6, '0').slice(0, 2);
  return `$${whole.toLocaleString()}.${fracStr}`;
}

/** bigint 기본 단위 → 소수점 문자열 (API 응답 표시용) */
export function formatUsdcDecimal(baseUnits: bigint): string {
  const whole = baseUnits / USDC_SCALE;
  const fractional = baseUnits % USDC_SCALE;
  const fracStr = fractional.toString().padStart(6, '0');
  return `${whole}.${fracStr}`;
}

/** Specie 수량 → 표시 문자열 */
export function formatSpecieCount(count: number): string {
  return `${count.toLocaleString()} SPECIES`;
}

/** Specie 수량 → USDC 기본 단위 (가치) */
export function specieToBaseUnits(count: number): bigint {
  return BigInt(count) * SPECIE_PRICE;
}

/** USDC 기본 단위 → Specie 수량 */
export function baseUnitsToSpecie(baseUnits: bigint): number {
  return Number(baseUnits / SPECIE_PRICE);
}
```

## 수수료 계산 (미리보기 전용)

실제 수수료는 MarketSB Cashier가 계산한다. 프론트엔드 미리보기는 정보 제공용이다:

```typescript
export function previewFees(quantity: number) {
  const cost = BigInt(quantity) * SPECIE_PRICE;
  const issuanceFee = BigInt(quantity) * 10_000n;
  const liquidityFee = (cost * 2n) / 100n;       // 정수 나눗셈

  return {
    assetCost: cost,
    issuanceFee,
    liquidityFee,
    totalCost: cost + issuanceFee + liquidityFee,
  };
}
```

## 금지 패턴

다음 패턴이 코드에 있으면 QA에서 즉시 reject한다:

```typescript
// 금지: number로 금액 계산
const amount = quantity * 1.00;
const fee = amount * 0.02;

// 금지: parseFloat로 금액 파싱
const value = parseFloat(input);

// 금지: toFixed로 금액 포맷
const display = (amount / 1000000).toFixed(2);
```

## 라운드트립 보장

`parseUsdcInput(formatUsdcDecimal(x)) === x`가 모든 유효한 bigint x에 대해 성립해야 한다.

테스트 케이스:
- `0n` → `$0.00` → `0n`
- `1n` → `$0.000001` → `1n`
- `1_000_000n` → `$1.00` → `1_000_000n`
- `12_450_000_000n` → `$12,450.00` → `12_450_000_000n`
- `999_999_999_999n` → `$999,999.999999` → `999_999_999_999n`
