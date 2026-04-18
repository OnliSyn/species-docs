import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketSb, fetchSpecies } from '@/lib/sim-gateway';

/**
 * Proxy Oracle ledger requests to sims.
 * Frontend can't call sim hosts directly on deployed environments.
 *
 * GET /api/oracle?type=funding&userRef=user-001
 * GET /api/oracle?type=asset
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'funding';
  const userRef = req.nextUrl.searchParams.get('userRef') || 'user-001';

  try {
    const res =
      type === 'funding'
        ? await fetchMarketSb(`/api/v1/oracle/virtual-accounts/va-funding-${userRef}/ledger`)
        : await fetchSpecies('/oracle/ledger');
    if (!res.ok) {
      return NextResponse.json([], { status: res.status });
    }

    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.entries || data.ledger || []);
    return NextResponse.json(entries.slice(0, 50));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
