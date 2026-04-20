/**
 * Journey acceptance test (canonical checklist)
 *
 * 1. Fund X → confirm
 *    - Funding balance matches GET /api/trade-panel (UI strip vs API).
 *    - Chat shows plausible completion (deposit / funding).
 *    - Assurance account balance matches API (1:1 vs circulation liability).
 *    - Circulation (count + peg value) matches API.
 *
 * 2. Buy X → confirm
 *    - Vault / species possession count matches API.
 *    - Chat shows order completion with dollar amounts.
 *    - Assurance vs circulation remains 1:1.
 *
 * 3. Sell — list for sale (quantity)
 *    - Vault count decreases by listed amount (escrow); funding unchanged.
 *    - Chat reflects listing success.
 *    - Assurance / circulation unchanged by listing alone (no USDC movement).
 *
 * 4. Redeem X → confirm
 *    - Vault count correct after redemption.
 *    - Funding balance increases by net redemption (gross − 1% liquidity fee) in base units.
 *    - Chat shows net payout.
 *    - Assurance vs circulation still 1:1.
 *
 * Automated as Playwright against local app + sims (see beforeEach reset).
 */

import { test, expect } from '@playwright/test';
import { dismissCoverAndHello, openTradeMode } from './helpers/onboarding';
import {
  assertAssuranceOneToOne,
  expectAssuranceCardMatchesApi,
  expectLastAssistantContains,
  expectTradePanelStripMatchesApi,
  fetchTradePanel,
  resetLocalSims,
  sendTradeChat,
  waitForNewAssistantMessage,
} from './helpers/trade-journey';

const FUND_USD = 5_000;
const BUY_QTY = 6;
/** Listed for sale from vault (escrow) — remainder is redeemed next. */
const LIST_QTY = 2;
const REDEEM_QTY = BUY_QTY - LIST_QTY;

const USDC_BASE = 1_000_000n;
/** Net USDC base units credited on redeem: $1/Specie − 1% liquidity fee. */
function expectedRedeemNetBaseUnits(quantity: number): bigint {
  const gross = BigInt(quantity) * USDC_BASE;
  const fee = gross / 100n; // 1%
  return gross - fee;
}

const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
);

test.describe.configure({ timeout: 300_000 });

test.describe('Journey — fund → buy → sell (list) → redeem (Trade chat)', () => {
  test.skip(
    !isLocalBase,
    'Resets MarketSB + Species sims — run with PLAYWRIGHT_BASE_URL=http://localhost:3000 and npm run dev:sims',
  );

  test.beforeEach(async () => {
    await resetLocalSims();
  });

  test('checklist: balances, chat amounts, assurance, circulation', async ({ page }) => {
    await dismissCoverAndHello(page);
    await openTradeMode(page);

    let n = await page.getByTestId('chat-message-assistant').count();

    // —— 1. Fund ——
    await sendTradeChat(page, `fund my account ${FUND_USD}`);
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /confirm/i);

    await sendTradeChat(page, 'confirm');
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /deposit complete|received.*funding/i);

    let api = await fetchTradePanel(page);
    expect(api.vaultSpecieCount).toBe(0);
    expect(api.circulationSpecieCount).toBe(0);
    expect(BigInt(api.fundingPosted)).toBe(BigInt(FUND_USD) * USDC_BASE);
    assertAssuranceOneToOne(api);
    await expectTradePanelStripMatchesApi(page);
    await expectAssuranceCardMatchesApi(page, api);

    // —— 2. Buy ——
    await sendTradeChat(page, `buy ${BUY_QTY} species`);
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /confirm/i);

    await sendTradeChat(page, 'confirm');
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /order complete|bought|pipeline/i);

    api = await fetchTradePanel(page);
    expect(api.vaultSpecieCount).toBe(BUY_QTY);
    assertAssuranceOneToOne(api);
    await expectTradePanelStripMatchesApi(page);
    await expectAssuranceCardMatchesApi(page, api);

    const lastAfterBuy = page.getByTestId('chat-message-assistant').last();
    await expect(lastAfterBuy).toContainText(/\$[\d,]+\.\d{2}/);

    // —— 3. Sell (list for sale) ——
    await sendTradeChat(page, `list ${LIST_QTY} species for sale`);
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /confirm/i);

    const fundingBeforeList = BigInt((await fetchTradePanel(page)).fundingPosted);

    await sendTradeChat(page, 'confirm');
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /listing|listed|sale|pipeline/i);

    api = await fetchTradePanel(page);
    expect(api.vaultSpecieCount).toBe(BUY_QTY - LIST_QTY);
    expect(BigInt(api.fundingPosted)).toBe(fundingBeforeList);
    assertAssuranceOneToOne(api);
    await expectTradePanelStripMatchesApi(page);
    await expectAssuranceCardMatchesApi(page, api);

    // —— 4. Redeem ——
    await sendTradeChat(page, `redeem ${REDEEM_QTY} species`);
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /confirm/i);

    const fundingBeforeRedeem = BigInt((await fetchTradePanel(page)).fundingPosted);

    await sendTradeChat(page, 'confirm');
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /redemption complete|redeemed|net/i);

    const lastAfterRedeem = page.getByTestId('chat-message-assistant').last();
    await expect(lastAfterRedeem).toContainText(/\$[\d,]+\.\d{2}/);

    api = await fetchTradePanel(page);
    expect(api.vaultSpecieCount).toBe(0);
    expect(BigInt(api.fundingPosted)).toBe(fundingBeforeRedeem + expectedRedeemNetBaseUnits(REDEEM_QTY));
    assertAssuranceOneToOne(api);
    await expectTradePanelStripMatchesApi(page);
    await expectAssuranceCardMatchesApi(page, api);
  });
});
