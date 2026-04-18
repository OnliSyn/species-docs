import { z } from 'zod/v4';

/** GET /api/trade-panel success body — runtime-validated at the boundary. */
export const tradePanelTruthSchema = z.object({
  ok: z.literal(true),
  userRef: z.string(),
  onliId: z.string(),
  fundingPosted: z.string(),
  speciesVaPosted: z.string(),
  fundingPostedDisplay: z.string(),
  speciesVaPostedDisplay: z.string(),
  vaultSpecieCount: z.number().int().nonnegative(),
  assuranceGlobalPosted: z.string(),
  circulationSpecieCount: z.number().int().nonnegative(),
  circulationValuePosted: z.string(),
  /** Uncapped ratio (can exceed 100) — Buy Back Guarantee panel canary. */
  coveragePercent: z.number().min(0).max(1_000_000),
  buyBackGuaranteeDollars: z.string(),
  buyBackGuaranteeCents: z.string(),
  assuranceGlobalPostedDisplay: z.string(),
  circulationValuePostedDisplay: z.string(),
  timestamp: z.string(),
});

export type TradePanelTruth = z.infer<typeof tradePanelTruthSchema>;
