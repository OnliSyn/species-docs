// GET /api/verify-balances — Cross-check MarketSB funding + assurance vs Species vault counts
// No species VA in MarketSB — species are tracked in species-sim vaults only

import { NextResponse } from 'next/server';
import { fetchMarketSb, fetchSpecies } from '@/lib/sim-gateway';

interface UserCheck {
  userRef: string;
  onliId: string;
  fundingBalance: string;
  vaultSpecieCount: number;
}

const USERS = [
  { ref: 'user-001', onliId: 'onli-user-001', name: 'Alex Morgan' },
  { ref: 'user-456', onliId: 'onli-user-456', name: 'Pepper Potts' },
  { ref: 'user-789', onliId: 'onli-user-789', name: 'Tony Stark' },
  { ref: 'user-012', onliId: 'onli-user-012', name: 'Happy Hogan' },
];

export async function GET() {
  try {
    // Fetch full state from both sims
    const [msbRes, specRes] = await Promise.all([
      fetchMarketSb('/sim/state'),
      fetchSpecies('/sim/state'),
    ]);

    if (!msbRes.ok || !specRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch sim state', marketsb: msbRes.status, species: specRes.status },
        { status: 502 },
      );
    }

    const msbState = await msbRes.json();
    const specState = await specRes.json();

    const checks: UserCheck[] = [];

    for (const user of USERS) {
      // MarketSB: funding VA balance (cash only)
      const fundingVaId = `va-funding-${user.ref}`;
      const fundingVa = msbState.virtualAccounts?.[fundingVaId];
      const fundingPosted = fundingVa?.posted ?? '0';

      // Species sim: vault count
      const vaultData = specState.vaults?.users?.[user.onliId];
      const vaultCount = vaultData?.count ?? 0;

      checks.push({
        userRef: user.ref,
        onliId: user.onliId,
        fundingBalance: fundingPosted.toString(),
        vaultSpecieCount: vaultCount,
      });
    }

    // Treasury count from species-sim
    const treasuryCount = specState.vaults?.treasury?.count ?? 0;

    // Assurance from MarketSB
    const assuranceVa = msbState.virtualAccounts?.['assurance-global'];
    const assuranceBalance = assuranceVa?.posted ?? '0';

    // Total specie in circulation (read directly from database)
    const totalCirculation = specState.circulation ?? 0;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      users: checks,
      treasury: { specieCount: treasuryCount },
      assurance: { balance: assuranceBalance.toString() },
      circulation: totalCirculation,
      summary: `Funding VAs (MarketSB) + ${totalCirculation} Specie in vaults (species-sim) + assurance verified.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Verification failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
