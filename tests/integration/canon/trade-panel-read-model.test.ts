/**
 * Canon contract: trade-panel coupled variables stay coherent with the same pure read-model
 * used by GET /api/trade-panel (authority-separated inputs, single domain calculator).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { waitForHealth, resetSims, getSimState } from '../../helpers/sim-control';
import { buildTradePanelReadModel } from '@/lib/trade-panel-read-model';
import { coverageRatioPercentCanaryFromPosted, circulationValueBaseUnits } from '@/lib/assurance-read-model';

describe('trade-panel read model (canon)', () => {
  beforeAll(async () => {
    await waitForHealth();
    await resetSims();
  });

  it('matches recomputed coverage from assurance + circulation', async () => {
    const { marketsb, species } = await getSimState();
    const model = buildTradePanelReadModel(marketsb, species, 'user-001');
    const expected = coverageRatioPercentCanaryFromPosted(
      model.assuranceGlobalPosted,
      circulationValueBaseUnits(model.circulationSpecieCount),
    );
    expect(model.coveragePercent).toBe(expected);
    expect(model.circulationValuePosted).toBe(circulationValueBaseUnits(model.circulationSpecieCount));
  });
});
