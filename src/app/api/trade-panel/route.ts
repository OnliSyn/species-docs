// GET /api/trade-panel?userRef=user-001 — Portfolio numbers from sim state only (no UI-side money math).

import { NextResponse } from 'next/server';
import { fetchMarketSb, fetchSpecies } from '@/lib/sim-gateway';
import { buildTradePanelReadModel } from '@/lib/trade-panel-read-model';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userRef = url.searchParams.get('userRef')?.trim() || 'user-001';

  try {
    const [msbRes, specRes] = await Promise.all([
      fetchMarketSb('/sim/state'),
      fetchSpecies('/sim/state'),
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
    const model = buildTradePanelReadModel(msb, spec, userRef);

    return NextResponse.json({
      ok: true,
      userRef: model.userRef,
      onliId: model.onliId,
      fundingPosted: model.fundingPosted.toString(),
      speciesVaPosted: model.speciesVaPosted.toString(),
      fundingPostedDisplay: model.fundingPostedDisplay,
      speciesVaPostedDisplay: model.speciesVaPostedDisplay,
      vaultSpecieCount: model.vaultSpecieCount,
      assuranceGlobalPosted: model.assuranceGlobalPosted.toString(),
      circulationSpecieCount: model.circulationSpecieCount,
      circulationValuePosted: model.circulationValuePosted.toString(),
      coveragePercent: model.coveragePercent,
      buyBackGuaranteeDollars: model.buyBackGuaranteeDollars,
      buyBackGuaranteeCents: model.buyBackGuaranteeCents,
      assuranceGlobalPostedDisplay: model.assuranceGlobalPostedDisplay,
      circulationValuePostedDisplay: model.circulationValuePostedDisplay,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `trade-panel: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
