import { test, expect } from '@playwright/test';
import { dismissCoverAndHello, expectAskWelcome } from './helpers/onboarding';

test.describe('Smoke — desktop shell', () => {
  test('cover → dashboard shows Ask Synth', async ({ page }) => {
    await dismissCoverAndHello(page);
    await expectAskWelcome(page);
    await expect(page.getByPlaceholder(/Ask about your balances/i)).toBeVisible();
  });
});
