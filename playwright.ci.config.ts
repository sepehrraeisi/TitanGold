import { defineConfig, devices } from '@playwright/test';

/**
 * PR-safe Playwright config.
 * - Dedicated CI port 3010 (avoids colliding with local/prod Vite on 3000)
 * - Does not require live MEXC, credentials, or Staging
 * - Runs only the CI smoke suite
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['ci-smoke.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3010 --strictPort',
    url: 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
