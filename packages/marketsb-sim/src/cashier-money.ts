// ── USD string ↔ USDC base units (6 decimals) for cashier spec API ──

const USDC_DECIMALS = 6n;
const SCALE = 10n ** USDC_DECIMALS;

export function parseUsdToBaseUnits(s: string): bigint {
  const t = s.trim();
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) {
    throw new Error(`Invalid amount: ${s}`);
  }
  const neg = t.startsWith('-');
  const u = neg ? t.slice(1) : t;
  const [whole, frac = ''] = u.split('.');
  const fracPadded = (frac + '000000').slice(0, Number(USDC_DECIMALS));
  const w = BigInt(whole || '0');
  const f = BigInt(fracPadded || '0');
  let v = w * SCALE + f;
  if (neg) v = -v;
  return v;
}

/** Map percent string like "1.00" to basis points (100 = 1.00%). */
export function parsePercentToBps(s: string): bigint {
  const n = parseFloat(s.trim());
  if (Number.isNaN(n) || n < 0) throw new Error(`Invalid percent: ${s}`);
  return BigInt(Math.round(n * 100));
}

export function formatBaseUnitsToUsd(v: bigint): string {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / SCALE;
  const frac = a % SCALE;
  const fracStr = frac.toString().padStart(Number(USDC_DECIMALS), '0').replace(/0+$/, '') || '0';
  const s = `${whole}.${fracStr}`;
  return neg ? `-${s}` : s;
}
