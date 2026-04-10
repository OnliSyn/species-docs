/**
 * Market Audit — Pure invariant checks on sim state.
 *
 * Core invariant: every Specie in circulation is backed 1:1 by $1 USDC
 * in the assurance account.
 *
 * This module receives pre-fetched state and returns structured results.
 * No HTTP calls — reusable from API routes and tests.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TOTAL_SUPPLY = 1_000_000_000;
export const USDC_PER_SPECIE = 1_000_000; // 1 USDC in base units (6 decimals)

// ---------------------------------------------------------------------------
// Types — sim state dumps (from GET /sim/state)
// ---------------------------------------------------------------------------

export interface SpeciesSimState {
  vaults: {
    treasury: { count: number };
    settlement: { count: number };
    users: Record<string, { count: number }>;
  };
  listings?: Record<string, {
    status: string;
    remainingQuantity: number;
  }>;
}

export interface MarketSBSimState {
  virtualAccounts: Record<string, {
    posted: number | string; // may serialize as string from bigint
    subtype?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface AuditCheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export interface AuditSnapshot {
  treasuryCount: number;
  settlementCount: number;
  circulationCount: number;
  userVaults: Record<string, number>;
  assuranceBalance: number; // USDC base units
  listedSpecieCount: number;
}

export interface AuditResult {
  ok: boolean;
  timestamp: string;
  checks: AuditCheck[];
  snapshot: AuditSnapshot;
}

// ---------------------------------------------------------------------------
// Core audit function
// ---------------------------------------------------------------------------

export function runAudit(
  specState: SpeciesSimState,
  msbState: MarketSBSimState,
): AuditResult {
  const checks: AuditCheck[] = [];

  // --- Build snapshot ---
  const treasuryCount = specState.vaults?.treasury?.count ?? 0;
  const settlementCount = specState.vaults?.settlement?.count ?? 0;

  const userVaults: Record<string, number> = {};
  let circulationCount = 0;
  const users = specState.vaults?.users;
  if (users) {
    for (const [onliId, vault] of Object.entries(users)) {
      const count = vault?.count ?? 0;
      userVaults[onliId] = count;
      circulationCount += count;
    }
  }

  // Sum remaining quantity across all active listings
  let listedSpecieCount = 0;
  if (specState.listings) {
    for (const listing of Object.values(specState.listings)) {
      if (listing.status === 'active') {
        listedSpecieCount += listing.remainingQuantity ?? 0;
      }
    }
  }

  // Assurance VA balance (posted, in USDC base units)
  const assuranceVa = msbState.virtualAccounts?.['assurance-global'];
  const assuranceBalance = Number(assuranceVa?.posted ?? 0);

  const snapshot: AuditSnapshot = {
    treasuryCount,
    settlementCount,
    circulationCount,
    userVaults,
    assuranceBalance,
    listedSpecieCount,
  };

  // --- Check 1: Specie Conservation ---
  // treasury + settlement + circulation = TOTAL_SUPPLY
  const totalAccounted = treasuryCount + settlementCount + circulationCount;
  checks.push({
    name: 'Specie Conservation',
    passed: totalAccounted === TOTAL_SUPPLY,
    expected: `${TOTAL_SUPPLY}`,
    actual: `${totalAccounted}`,
    details: `treasury(${treasuryCount}) + settlement(${settlementCount}) + circulation(${circulationCount})`,
  });

  // --- Check 2: Assurance 1:1 Backing ---
  // assurance_balance == (circulation + settlement) × USDC_PER_SPECIE
  // All issued specie (user-held + escrowed for listings) must be backed $1 each.
  // Treasury buys credit assurance, redeems debit it but relist via MarketMaker,
  // and MarketMaker listing purchases replenish assurance.
  const issuedCount = circulationCount + settlementCount;
  const expectedAssurance = issuedCount * USDC_PER_SPECIE;
  checks.push({
    name: 'Assurance 1:1 Backing',
    passed: assuranceBalance === expectedAssurance,
    expected: `${expectedAssurance}`,
    actual: `${assuranceBalance}`,
    details: `${issuedCount} issued Specie (${circulationCount} circulating + ${settlementCount} escrowed) × $1 = $${(expectedAssurance / USDC_PER_SPECIE).toFixed(2)} expected, assurance holds $${(assuranceBalance / USDC_PER_SPECIE).toFixed(2)}`,
  });

  // --- Check 3: No Negative Balances ---
  const negatives: string[] = [];
  if (treasuryCount < 0) negatives.push(`treasury(${treasuryCount})`);
  if (settlementCount < 0) negatives.push(`settlement(${settlementCount})`);
  if (assuranceBalance < 0) negatives.push(`assurance(${assuranceBalance})`);
  for (const [onliId, count] of Object.entries(userVaults)) {
    if (count < 0) negatives.push(`${onliId}(${count})`);
  }
  checks.push({
    name: 'No Negative Balances',
    passed: negatives.length === 0,
    expected: 'all ≥ 0',
    actual: negatives.length === 0 ? 'all ≥ 0' : negatives.join(', '),
  });

  // --- Check 4: Settlement-Listing Match ---
  // settlement vault count should equal sum of active listing remaining quantities
  checks.push({
    name: 'Settlement-Listing Match',
    passed: settlementCount === listedSpecieCount,
    expected: `settlement(${settlementCount})`,
    actual: `listed(${listedSpecieCount})`,
    details: settlementCount === listedSpecieCount
      ? 'Settlement vault matches active listings'
      : `Mismatch: ${settlementCount} escrowed vs ${listedSpecieCount} listed`,
  });

  return {
    ok: checks.every(c => c.passed),
    timestamp: new Date().toISOString(),
    checks,
    snapshot,
  };
}
