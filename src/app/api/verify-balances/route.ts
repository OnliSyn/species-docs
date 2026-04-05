// GET /api/verify-balances — Cross-check MarketSB VAs vs Species vaults
// Compares USDC species VA balances with actual Specie counts in Onli vaults

import { NextResponse } from 'next/server';

const MARKETSB_URL = process.env.MARKETSB_URL || 'http://localhost:4001';
const SPECIES_URL = process.env.SPECIES_URL || 'http://localhost:4012';

interface UserCheck {
  userRef: string;
  onliId: string;
  speciesVaBalance: string;
  speciesVaSpecieCount: number;
  vaultSpecieCount: number;
  match: boolean;
  variance: number;
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
      fetch(`${MARKETSB_URL}/sim/state`),
      fetch(`${SPECIES_URL}/sim/state`),
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
    let allMatch = true;

    for (const user of USERS) {
      const speciesVaId = `va-species-${user.ref}`;

      // MarketSB: species VA balance (in base units, 1 USDC = 1M)
      const va = msbState.virtualAccounts?.[speciesVaId];
      const vaPosted = va?.posted ?? '0';
      // Species VA tracks USDC value of species: posted / 1_000_000 = specie count
      const vaSpecieCount = Math.floor(Number(BigInt(vaPosted)) / 1_000_000);

      // Species sim: vault count
      const vaultData = specState.vaults?.users?.[user.onliId];
      const vaultCount = vaultData?.count ?? 0;

      const match = vaSpecieCount === vaultCount;
      if (!match) allMatch = false;

      checks.push({
        userRef: user.ref,
        onliId: user.onliId,
        speciesVaBalance: vaPosted.toString(),
        speciesVaSpecieCount: vaSpecieCount,
        vaultSpecieCount: vaultCount,
        match,
        variance: vaultCount - vaSpecieCount,
      });
    }

    // Also check treasury
    const treasuryCount = specState.vaults?.treasury?.count ?? 0;

    // Check global assurance
    const assuranceVa = msbState.virtualAccounts?.['assurance-global'];
    const assuranceBalance = assuranceVa?.posted ?? '0';

    return NextResponse.json({
      ok: allMatch,
      timestamp: new Date().toISOString(),
      users: checks,
      treasury: { specieCount: treasuryCount },
      assurance: { balance: assuranceBalance.toString() },
      summary: allMatch
        ? 'All user balances match between MarketSB and Species vaults'
        : 'MISMATCH detected — see user details',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Verification failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
