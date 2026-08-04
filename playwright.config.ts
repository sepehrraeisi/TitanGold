import { defineConfig, devices } from '@playwright/test';

const stagingBase = process.env.PLAYWRIGHT_BASE_URL?.includes('titan.zala.ir');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: stagingBase ? 120_000 : 30_000,
  reporter: process.env.CI ? 'html' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: process.env.PLAYWRIGHT_TRACE === 'on' ? 'on' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(stagingBase
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --host 127.0.0.1 --port 3000',
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }),
});
