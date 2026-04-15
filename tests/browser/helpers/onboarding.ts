import { expect, type Page } from '@playwright/test';

/** Dismiss cover + hello so the main chat welcome is reachable (desktop viewport). */
export async function dismissCoverAndHello(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('cover-enter')).toBeVisible();
  await page.getByTestId('cover-enter').click();
  await page.waitForSelector('[data-testid="cover-enter"]', { state: 'detached', timeout: 15_000 });
  // Hello uses a global click listener; wait for animation then click the canvas area.
  await page.waitForTimeout(2000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(500);
}

export async function expectAskWelcome(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Ask Synth' })).toBeVisible({ timeout: 20_000 });
}

export async function openTradeMode(page: Page): Promise<void> {
  await page.getByTestId('chat-mode-trigger').click();
  await page.getByTestId('chat-mode-option-trade').click();
  await expect(page.getByRole('heading', { name: 'Trade' })).toBeVisible({ timeout: 15_000 });
}
