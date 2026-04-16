import { expect, type Page } from '@playwright/test';

/** Dismiss cover + hello so the main chat welcome is reachable (desktop viewport). */
export async function dismissCoverAndHello(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // MobileGate renders null until client check — wait for cover.
  // Prefer test id (local / current deploy); fall back to main CTA for older production builds.
  const enter = page
    .getByTestId('cover-enter')
    .or(page.getByRole('button', { name: /Enter/i }));
  await enter.first().waitFor({ state: 'visible', timeout: 30_000 });
  await enter.first().click();
  await expect(page.getByRole('heading', { name: /Welcome to Specie/i })).toBeHidden({
    timeout: 20_000,
  });
  // Hello: global click dismisses; prefer explicit "Tap to continue" when it appears.
  const tap = page.getByText('Tap to continue');
  try {
    await tap.waitFor({ state: 'visible', timeout: 12_000 });
    await tap.click();
  } catch {
    await page.waitForTimeout(1500);
    await page.mouse.click(640, 400);
  }
  await page.waitForTimeout(400);
}

export async function expectAskWelcome(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Ask Synth' })).toBeVisible({ timeout: 20_000 });
}

function chatBarForm(page: Page) {
  return page.locator('form').filter({
    has: page.getByPlaceholder(
      /Ask about your balances|Fund, Buy, Sell, Transfer|Ask about Onli concepts|Journey in progress/i,
    ),
  });
}

/** Mode dropdown on the floating chat bar (test ids on current builds; form heuristic for older deploys). */
function chatModeTrigger(page: Page) {
  return page
    .getByTestId('chat-mode-trigger')
    .or(chatBarForm(page).locator('button[type="button"]').first());
}

/** Open mode menu — scope options to the popover so we do not hit the cover card's Ask/Trade/Develop pills. */
function modeMenuHost(page: Page) {
  return page.getByTestId('chat-mode-menu').or(chatBarForm(page));
}

export async function openTradeMode(page: Page): Promise<void> {
  await chatModeTrigger(page).click();
  const tradeOpt = page
    .getByTestId('chat-mode-option-trade')
    .or(
      modeMenuHost(page)
        .locator('div.absolute.bottom-full')
        .getByRole('button', { name: 'Trade', exact: true }),
    );
  await tradeOpt.click();
  await expect(page.getByRole('heading', { name: 'Trade' })).toBeVisible({ timeout: 15_000 });
}

export async function openDevelopMode(page: Page): Promise<void> {
  await chatModeTrigger(page).click();
  const developOpt = page
    .getByTestId('chat-mode-option-develop')
    .or(
      modeMenuHost(page)
        .locator('div.absolute.bottom-full')
        .getByRole('button', { name: 'Develop', exact: true }),
    );
  await developOpt.click();
}
