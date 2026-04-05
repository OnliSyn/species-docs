// POST /api/seed — Reset both sims to their seeded state
// Calls POST /sim/reset on MarketSB (4001) and Species (4002)

import { NextResponse } from 'next/server';

const MARKETSB_URL = process.env.MARKETSB_URL || 'http://localhost:4001';
const SPECIES_URL = process.env.SPECIES_URL || 'http://localhost:4012';

export async function POST() {
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Reset both sims in parallel
  const [msbResult, specResult] = await Promise.allSettled([
    fetch(`${MARKETSB_URL}/sim/reset`, { method: 'POST' }),
    fetch(`${SPECIES_URL}/sim/reset`, { method: 'POST' }),
  ]);

  if (msbResult.status === 'fulfilled' && msbResult.value.ok) {
    results.marketsb = { status: 'reset', code: msbResult.value.status };
  } else {
    const reason =
      msbResult.status === 'rejected'
        ? msbResult.reason?.message
        : `HTTP ${msbResult.value.status}`;
    errors.push(`MarketSB reset failed: ${reason}`);
  }

  if (specResult.status === 'fulfilled' && specResult.value.ok) {
    results.species = { status: 'reset', code: specResult.value.status };
  } else {
    const reason =
      specResult.status === 'rejected'
        ? specResult.reason?.message
        : `HTTP ${specResult.value.status}`;
    errors.push(`Species reset failed: ${reason}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, results, errors }, { status: 502 });
  }

  return NextResponse.json({ ok: true, results, message: 'Both sims reset to seed state' });
}
