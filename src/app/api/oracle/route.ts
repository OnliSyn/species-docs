import { NextRequest, NextResponse } from 'next/server';

const MARKETSB = process.env.MARKETSB_URL || 'http://localhost:3101';
const SPECIES = process.env.SPECIES_URL || 'http://localhost:3102';

/**
 * Proxy Oracle ledger requests to sims.
 * Frontend can't call localhost directly on deployed environments.
 *
 * GET /api/oracle?type=funding&userRef=user-001
 * GET /api/oracle?type=asset
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'funding';
  const userRef = req.nextUrl.searchParams.get('userRef') || 'user-001';

  try {
    let url: string;
    if (type === 'funding') {
      url = `${MARKETSB}/api/v1/oracle/virtual-accounts/va-funding-${userRef}/ledger`;
    } else {
      url = `${SPECIES}/oracle/ledger`;
    }

    const res = await fetch(url);
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
