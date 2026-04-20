import { expect, type Page } from '@playwright/test';
import { formatUsdcDisplay } from '../../../src/lib/amount';

const USER_REF = 'user-001';

export type TradePanelApi = {
  fundingPosted: string;
  speciesVaPosted: string;
  vaultSpecieCount: number;
  assuranceGlobalPosted: string;
  circulationSpecieCount: number;
  circulationValuePosted: string;
  coveragePercent: number;
};

export async function resetLocalSims(): Promise<void> {
  await Promise.all([
    fetch('http://localhost:3101/sim/reset', { method: 'POST' }),
    fetch('http://localhost:3102/sim/reset', { method: 'POST' }),
  ]);
}

export async function fetchTradePanel(page: Page): Promise<TradePanelApi> {
  const res = await page.request.get(`/api/trade-panel?userRef=${USER_REF}`);
  expect(res.ok(), `trade-panel HTTP ${res.status()}`).toBeTruthy();
  const j = await res.json();
  expect(j.ok, j.error || 'trade-panel').toBeTruthy();
  return j as TradePanelApi;
}

/** Trade-mode chat composer (floating bar). */
export async function sendTradeChat(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder(
    /Fund, Buy, Sell, Transfer|Journey in progress|Ask about/i,
  );
  await input.fill(text);
  await input.press('Enter');
}

/** Streamed /api/chat — wait for UI assistant bubbles instead of response lifecycle. */
export async function waitForNewAssistantMessage(page: Page, previousCount: number): Promise<void> {
  await expect
    .poll(async () => page.getByTestId('chat-message-assistant').count(), { timeout: 180_000 })
    .toBeGreaterThan(previousCount);
  await page.waitForTimeout(500);
}

export async function expectLastAssistantContains(
  page: Page,
  pattern: RegExp | string,
  timeout = 180_000,
): Promise<void> {
  const last = page.getByTestId('chat-message-assistant').last();
  await expect(last).toContainText(pattern, { timeout });
}

/** Assurance pool backs aggregate user vault value 1:1 (same base units). */
export function assertAssuranceOneToOne(api: TradePanelApi): void {
  expect(BigInt(api.assuranceGlobalPosted), 'assurance vs circulation value (1:1)').toBe(
    BigInt(api.circulationValuePosted),
  );
  expect(api.coveragePercent, 'coverage %').toBe(100);
}

/** Hidden strip in AccountPanel must match a fresh GET /api/trade-panel (same source of truth). */
export async function expectTradePanelStripMatchesApi(page: Page): Promise<void> {
  const strip = page.getByTestId('trade-panel-truth');
  await expect(strip).toBeAttached({ timeout: 60_000 });
  await expect.poll(async () => {
    const api = await fetchTradePanel(page);
    const fp = await strip.getAttribute('data-funding-posted');
    const sp = await strip.getAttribute('data-species-va-posted');
    const ap = await strip.getAttribute('data-assurance-posted');
    const cv = await strip.getAttribute('data-circulation-value-posted');
    const cc = await strip.getAttribute('data-circulation-specie-count');
    const cov = await strip.getAttribute('data-coverage-percent');
    return (
      fp === api.fundingPosted &&
      sp === api.speciesVaPosted &&
      ap === api.assuranceGlobalPosted &&
      cv === api.circulationValuePosted &&
      cc === String(api.circulationSpecieCount) &&
      cov === String(api.coveragePercent)
    );
  }, { timeout: 45_000 }).toBe(true);
}

/** Assurance card visible amounts match API (formatting only — values from server). */
export async function expectAssuranceCardMatchesApi(page: Page, api: TradePanelApi): Promise<void> {
  const balEl = page.getByTestId('assurance-balance-display');
  await balEl.scrollIntoViewIfNeeded();
  const bal = formatUsdcDisplay(BigInt(api.assuranceGlobalPosted));
  const out = formatUsdcDisplay(BigInt(api.circulationValuePosted));
  await expect(balEl).toHaveText(bal);
  await expect(page.getByTestId('assurance-outstanding-display')).toHaveText(out);
  await expect(page.getByTestId('assurance-coverage-display')).toHaveText(`${api.coveragePercent}%`);
}
