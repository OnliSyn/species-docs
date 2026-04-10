import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSims,
  waitForHealth,
  adjustVault,
} from '../../helpers/sim-control';
import { assertAuditPasses, getAuditResult } from '../../helpers/audit-helper';
import { TOTAL_SUPPLY } from '@/lib/audit';

describe('AUD — Market Audit Invariants', () => {
  beforeEach(async () => {
    await waitForHealth();
    await resetSims();
  });

  it('AUD-001 — Clean seed passes all invariants', async () => {
    const result = await assertAuditPasses();

    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(4);
    expect(result.snapshot.treasuryCount).toBe(TOTAL_SUPPLY);
    expect(result.snapshot.circulationCount).toBe(0);
    expect(result.snapshot.settlementCount).toBe(0);
    expect(result.snapshot.assuranceBalance).toBe(0);
  });

  it('AUD-004 — Detects artificially injected vault imbalance', async () => {
    // Inject 500 Specie into a vault without corresponding assurance credit
    await adjustVault('onli-user-001', 500, 'test-inject-imbalance');

    const result = await getAuditResult();

    expect(result.ok).toBe(false);

    // Specie conservation should fail (total > TOTAL_SUPPLY)
    const conservation = result.checks.find(c => c.name === 'Specie Conservation');
    expect(conservation?.passed).toBe(false);

    // Assurance 1:1 backing should fail (500 Specie but $0 assurance)
    const backing = result.checks.find(c => c.name === 'Assurance 1:1 Backing');
    expect(backing?.passed).toBe(false);
  });
});
