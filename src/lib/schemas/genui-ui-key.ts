import { z } from 'zod/v4';

/** Keys registered via {@link registerUIComponent} — reject unknown `_ui` at the bridge boundary. */
export const GENUI_UI_KEYS = [
  'BalanceCard',
  'ConfirmCard',
  'CoverageCard',
  'DepositCard',
  'InfoCard',
  'LifecycleCard',
  'MarketStats',
  'PipelineCard',
  'ReceiptCard',
  'RotatingFactCard',
  'TransactionList',
  'VaultCard',
] as const;

export const genuiUiKeySchema = z.enum(GENUI_UI_KEYS);

export function isKnownGenUiUiKey(k: string): k is (typeof GENUI_UI_KEYS)[number] {
  return (GENUI_UI_KEYS as readonly string[]).includes(k);
}
