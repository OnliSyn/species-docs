import { defineConfig, devices } from '@playwright/test';

/** Match `next dev` URL so webServer readiness + reuseExistingServer align with the running app */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/** Only auto-start Next when tests target this machine; use PLAYWRIGHT_BASE_URL for deploy smoke */
const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseURL);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 25_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    navigationTimeout: 90_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    ...devices['Desktop Chrome'],
    // After device preset — desktop-only app (MobileGate)
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium' }],
  ...(isLocalBase
    ? {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }
    : {}),
});
