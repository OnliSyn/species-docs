const USDC_DECIMALS = 6n;
const USDC_SCALE = 10n ** USDC_DECIMALS; // 1_000_000n
const SPECIE_PRICE = USDC_SCALE;          // $1.00 per Specie

/** UI input string -> bigint base units */
export function parseUsdcInput(input: string): bigint {
  const cleaned = input.replace(/[,$\s]/g, '');
  const parts = cleaned.split('.');
  const whole = BigInt(parts[0] || '0');
  const fractional = parts[1]
    ? BigInt(parts[1].padEnd(6, '0').slice(0, 6))
    : 0n;
  return whole * USDC_SCALE + fractional;
}

/** bigint base units -> USD display string */
export function formatUsdcDisplay(baseUnits: bigint): string {
  const isNeg = baseUnits < 0n;
  const abs = isNeg ? -baseUnits : baseUnits;
  const whole = abs / USDC_SCALE;
  const fractional = abs % USDC_SCALE;
  const fracStr = fractional.toString().padStart(6, '0').slice(0, 2);
  const formatted = whole.toLocaleString('en-US');
  return `${isNeg ? '-' : ''}$${formatted}.${fracStr}`;
}

/** bigint base units -> decimal string for API display */
export function formatUsdcDecimal(baseUnits: bigint): string {
  const isNeg = baseUnits < 0n;
  const abs = isNeg ? -baseUnits : baseUnits;
  const whole = abs / USDC_SCALE;
  const fractional = abs % USDC_SCALE;
  const fracStr = fractional.toString().padStart(6, '0');
  return `${isNeg ? '-' : ''}${whole}.${fracStr}`;
}

/** Specie count -> display string */
export function formatSpecieCount(count: number): string {
  return `${count.toLocaleString('en-US')} SPECIES`;
}

/** Specie count -> USDC base units */
export function specieToBaseUnits(count: number): bigint {
  return BigInt(count) * SPECIE_PRICE;
}

/** USDC base units -> Specie count */
export function baseUnitsToSpecie(baseUnits: bigint): number {
  return Number(baseUnits / SPECIE_PRICE);
}

/** Fee preview (display only -- actual fees computed by MarketSB) */
export function previewBuyFees(quantity: number) {
  const cost = BigInt(quantity) * SPECIE_PRICE;
  const issuanceFee = BigInt(quantity) * 50_000n;
  const liquidityFee = (cost * 1n) / 100n;
  return {
    assetCost: cost,
    issuanceFee,
    liquidityFee,
    totalCost: cost + issuanceFee + liquidityFee,
  };
}

export { USDC_SCALE, SPECIE_PRICE };
