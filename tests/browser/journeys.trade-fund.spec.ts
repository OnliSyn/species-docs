import { test, expect } from '@playwright/test';
import { dismissCoverAndHello, openTradeMode } from './helpers/onboarding';

const MARKETSB = process.env.PLAYWRIGHT_MARKETSB_URL ?? 'http://127.0.0.1:3101';
const SPECIES = process.env.PLAYWRIGHT_SPECIES_URL ?? 'http://127.0.0.1:3102';

async function simsHealthy(): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([
      fetch(`${MARKETSB}/health`, { signal: AbortSignal.timeout(2000) }),
      fetch(`${SPECIES}/health`, { signal: AbortSignal.timeout(2000) }),
    ]);
    return a.ok && b.ok;
  } catch {
    return false;
  }
}

test.describe('Journey — Trade (mock chat)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(
      !(await simsHealthy()),
      `Start sims first: npm run dev:sims (MarketSB ${MARKETSB}, Species ${SPECIES})`,
    );
  });

  test('Trade mode + Fund preset sends fund intent', async ({ page }) => {
    await dismissCoverAndHello(page);
    await openTradeMode(page);
    await page.getByRole('button', { name: 'Fund' }).click();
    await expect(page.getByText(/fund my account/i)).toBeVisible({ timeout: 15_000 });
  });
});
