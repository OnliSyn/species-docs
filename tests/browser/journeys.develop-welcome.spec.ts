import { test, expect } from '@playwright/test';
import { dismissCoverAndHello, openDevelopMode } from './helpers/onboarding';

test.describe('Journey — Develop welcome', () => {
  test('Develop mode shows Species developer welcome', async ({ page }) => {
    await dismissCoverAndHello(page);
    await openDevelopMode(page);
    await expect(page.getByRole('heading', { name: 'Welcome to Species' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /How does a Buy work/i })).toBeVisible();
  });
});
