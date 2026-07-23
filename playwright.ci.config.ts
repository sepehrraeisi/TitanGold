import { defineConfig, devices } from '@playwright/test';

/**
 * PR-safe Playwright config.
 * - Dedicated CI port 3010 (avoids colliding with local/prod Vite on 3000)
 * - Disposable login E2E against local backend on 5002
 * - Does not require live MEXC, Staging credentials, or injected sessions
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['ci-smoke.spec.ts', 'login-real.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
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
  webServer: [
    {
      command:
        'cd backend && NODE_ENV=development PORT=5002 DISABLE_ENGINES=true DB_SSL=false node server.js',
      url: 'http://127.0.0.1:5002/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres@localhost:5432/titangold_test?sslmode=disable',
        DB_SSL: 'false',
        TITAN_DEPLOY_ENV: 'staging',
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3010,http://localhost:3010',
        JWT_SECRET: process.env.JWT_SECRET || 'test',
        NODE_ENV: 'development',
        PORT: '5002',
        DISABLE_ENGINES: 'true',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3010 --strictPort',
      url: 'http://127.0.0.1:3010',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
