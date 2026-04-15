import { expect, type Page } from '@playwright/test';

/** Dismiss cover + hello so the main chat welcome is reachable (desktop viewport). */
export async function dismissCoverAndHello(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // MobileGate renders null until client check — wait for cover.
  const enter = page.getByTestId('cover-enter');
  await enter.waitFor({ state: 'visible', timeout: 30_000 });
  await enter.click();
  await page.locator('[data-testid="cover-enter"]').waitFor({ state: 'detached', timeout: 20_000 });
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

export async function openTradeMode(page: Page): Promise<void> {
  await page.getByTestId('chat-mode-trigger').click();
  await page.getByTestId('chat-mode-option-trade').click();
  await expect(page.getByRole('heading', { name: 'Trade' })).toBeVisible({ timeout: 15_000 });
}
