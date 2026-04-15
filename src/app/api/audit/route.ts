// GET /api/audit — Run market invariant checks against both sims
//
// 200 = all invariants pass
// 409 = violations detected
// 502 = sim unreachable

import { NextResponse } from 'next/server';
import { runAudit } from '@/lib/audit';
import type { SpeciesSimState, MarketSBSimState } from '@/lib/audit';

const MARKETSB_URL = process.env.MARKETSB_URL || 'http://localhost:3101';
const SPECIES_URL = process.env.SPECIES_URL || 'http://localhost:3102';

export async function GET() {
  try {
    const [msbRes, specRes] = await Promise.all([
      fetch(`${MARKETSB_URL}/sim/state`),
      fetch(`${SPECIES_URL}/sim/state`),
    ]);

    if (!msbRes.ok || !specRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch sim state', marketsb: msbRes.status, species: specRes.status },
        { status: 502 },
      );
    }

    const msbState = (await msbRes.json()) as MarketSBSimState;
    const specState = (await specRes.json()) as SpeciesSimState;

    const result = runAudit(specState, msbState);

    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Audit failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
