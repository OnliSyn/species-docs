import { test, expect } from '@playwright/test';
import { dismissCoverAndHello, openTradeMode } from './helpers/onboarding';

const APP_BASE = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const isLocalApp = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(APP_BASE);

const MARKETSB = process.env.PLAYWRIGHT_MARKETSB_URL ?? 'http://localhost:3101';
const SPECIES = process.env.PLAYWRIGHT_SPECIES_URL ?? 'http://localhost:3102';

async function backendReady(): Promise<boolean> {
  if (!isLocalApp) {
    try {
      const r = await fetch(`${APP_BASE}/api/health`, { signal: AbortSignal.timeout(10_000) });
      return r.ok;
    } catch {
      return false;
    }
  }
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
    const hint = isLocalApp
      ? `Start sims first: npm run dev:sims (MarketSB ${MARKETSB}, Species ${SPECIES})`
      : `Deploy health check failed: GET ${APP_BASE}/api/health (needs MarketSB + Species reachable from the app)`;
    testInfo.skip(!(await backendReady()), hint);
  });

  test('Trade mode + Fund preset sends fund intent', async ({ page }) => {
    await dismissCoverAndHello(page);
    await openTradeMode(page);
    await page.getByRole('button', { name: 'Fund' }).click();
    await expect(page.getByText(/fund my account/i)).toBeVisible({ timeout: 15_000 });
  });
});
