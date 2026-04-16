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

const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
);

test.describe.configure({ timeout: 300_000 });

test.describe('Journey — fund → buy → redeem (Trade chat)', () => {
  test.skip(
    !isLocalBase,
    'Resets MarketSB + Species sims — run with PLAYWRIGHT_BASE_URL=http://localhost:3000 and npm run dev:sims',
  );

  test.beforeEach(async () => {
    await resetLocalSims();
  });

  test('chat + assurance 1:1 + trade panel strip match API', async ({ page }) => {
    await dismissCoverAndHello(page);
    await openTradeMode(page);

    let n = await page.getByTestId('chat-message-assistant').count();

    // —— Fund ——
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
    expect(BigInt(api.fundingPosted)).toBe(BigInt(FUND_USD) * 1_000_000n);
    await expectTradePanelStripMatchesApi(page);

    // —— Buy ——
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

    const last = page.getByTestId('chat-message-assistant').last();
    await expect(last).toContainText(/\$[\d,]+\.\d{2}/);

    // —— Redeem (full qty) ——
    await sendTradeChat(page, `redeem ${BUY_QTY} species`);
    await waitForNewAssistantMessage(page, n);
    n = await page.getByTestId('chat-message-assistant').count();
    await expectLastAssistantContains(page, /confirm/i);

    await sendTradeChat(page, 'confirm');
    await waitForNewAssistantMessage(page, n);
    await expectLastAssistantContains(page, /redemption complete|redeemed/i);

    api = await fetchTradePanel(page);
    expect(api.vaultSpecieCount).toBe(0);
    assertAssuranceOneToOne(api);
    await expectTradePanelStripMatchesApi(page);
    await expectAssuranceCardMatchesApi(page, api);
  });
});
