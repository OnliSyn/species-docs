import { test, expect } from '@playwright/test';
import { dismissCoverAndHello } from './helpers/onboarding';

test.describe('Journey — Develop welcome', () => {
  test('Develop mode shows Species developer welcome', async ({ page }) => {
    await dismissCoverAndHello(page);
    await page.getByTestId('chat-mode-trigger').click();
    await page.getByTestId('chat-mode-option-develop').click();
    await expect(page.getByRole('heading', { name: 'Welcome to Species' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /How does a Buy work/i })).toBeVisible();
  });
});
