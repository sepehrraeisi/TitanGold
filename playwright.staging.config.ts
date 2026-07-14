import { defineConfig, devices } from '@playwright/test';

/** Staging/local runtime safety — reuses running dev server on :3000 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /runtime-safety|pre-human-qa|agent-panels|artemis-tabs|topic-routing-browser/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 5000,
    navigationTimeout: 15000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
