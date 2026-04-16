// GET /api/trade-panel?userRef=user-001 — Portfolio numbers from sim state only (no UI-side money math).

import { NextResponse } from 'next/server';

const MARKETSB_URL = process.env.MARKETSB_URL || 'http://localhost:3101';
const SPECIES_URL = process.env.SPECIES_URL || 'http://localhost:3102';

const USDC_SCALE = 1_000_000n;

function toBigInt(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
  const s = String(v).trim();
  if (!s || s === 'null') return 0n;
  return BigInt(s.split('.')[0]);
}

function onliIdForUserRef(userRef: string): string {
  return `onli-${userRef}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userRef = url.searchParams.get('userRef')?.trim() || 'user-001';
  const onliId = onliIdForUserRef(userRef);

  try {
    const [msbRes, specRes] = await Promise.all([
      fetch(`${MARKETSB_URL}/sim/state`),
      fetch(`${SPECIES_URL}/sim/state`),
    ]);

    if (!msbRes.ok || !specRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to fetch sim state',
          marketsb: msbRes.status,
          species: specRes.status,
        },
        { status: 502 },
      );
    }

    const msb = await msbRes.json();
    const spec = await specRes.json();

    const vas = (msb.virtualAccounts ?? {}) as Record<string, { posted?: unknown; pending?: unknown }>;

    const fundingKey = `va-funding-${userRef}`;
    const speciesKey = `va-species-${userRef}`;

    const fundingPosted = toBigInt(vas[fundingKey]?.posted);
    const speciesVaPosted = vas[speciesKey] != null ? toBigInt(vas[speciesKey]?.posted) : 0n;

    const vaultUser = spec.vaults?.users?.[onliId] as { count?: unknown } | undefined;
    const vaultSpecieCount = Number(vaultUser?.count ?? 0);

    const assuranceGlobalPosted = toBigInt(vas['assurance-global']?.posted);

    let circulationSpecieCount = 0;
    const users = spec.vaults?.users;
    if (users && typeof users === 'object') {
      for (const [uid, vault] of Object.entries(users)) {
        if (uid === 'treasury') continue;
        circulationSpecieCount += Number((vault as { count?: unknown })?.count ?? 0);
      }
    }

    const circulationValuePosted = BigInt(circulationSpecieCount) * USDC_SCALE;

    const rawCoverage =
      circulationValuePosted > 0n
        ? Number((assuranceGlobalPosted * 100n) / circulationValuePosted)
        : 100;
    const coveragePercent = Math.min(100, Math.max(0, Math.round(rawCoverage)));

    return NextResponse.json({
      ok: true,
      userRef,
      onliId,
      fundingPosted: fundingPosted.toString(),
      speciesVaPosted: speciesVaPosted.toString(),
      vaultSpecieCount,
      assuranceGlobalPosted: assuranceGlobalPosted.toString(),
      circulationSpecieCount,
      circulationValuePosted: circulationValuePosted.toString(),
      coveragePercent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `trade-panel: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
