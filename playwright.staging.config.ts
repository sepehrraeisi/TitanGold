import { defineConfig, devices } from '@playwright/test';

/** Staging/local runtime safety — reuses running dev server on :3000 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'runtime-safety.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
