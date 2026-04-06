import { NextResponse } from 'next/server';

const MARKETSB_URL = process.env.MARKETSB_URL || 'http://localhost:4001';
const SPECIES_URL = process.env.SPECIES_URL || 'http://localhost:4012';

export async function GET() {
  const checks: Record<string, unknown> = {};

  try {
    const [msb, spec] = await Promise.allSettled([
      fetch(`${MARKETSB_URL}/health`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${SPECIES_URL}/health`, { signal: AbortSignal.timeout(3000) }),
    ]);

    checks.marketsb = msb.status === 'fulfilled' && msb.value.ok ? 'ok' : 'down';
    checks.species = spec.status === 'fulfilled' && spec.value.ok ? 'ok' : 'down';
  } catch {
    checks.marketsb = 'error';
    checks.species = 'error';
  }

  checks.ai = !!process.env.ANTHROPIC_API_KEY ? 'configured' : 'no_key';
  checks.timestamp = new Date().toISOString();

  const allOk = checks.marketsb === 'ok' && checks.species === 'ok';

  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
