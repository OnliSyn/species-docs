/**
 * Audit test helpers — bridge between test infrastructure and audit logic.
 */

import { getSimState } from './sim-control';
import { runAudit, type AuditResult, type SpeciesSimState, type MarketSBSimState } from '../../src/lib/audit';

/** Run market audit against live sims. Returns the result. */
export async function getAuditResult(): Promise<AuditResult> {
  const { marketsb, species } = await getSimState();
  return runAudit(species as SpeciesSimState, marketsb as MarketSBSimState);
}

/** Run market audit and throw if any invariant fails. */
export async function assertAuditPasses(): Promise<AuditResult> {
  const result = await getAuditResult();
  if (!result.ok) {
    const failures = result.checks.filter(c => !c.passed);
    throw new Error(
      `Market audit failed:\n` +
      failures.map(f => `  [FAIL] ${f.name}: expected ${f.expected}, got ${f.actual}${f.details ? ` (${f.details})` : ''}`).join('\n'),
    );
  }
  return result;
}
