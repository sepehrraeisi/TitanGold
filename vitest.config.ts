import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    css: true,
    // CI and local default: only the real frontend suite — never deploy blue/green mirrors.
    include: ['src/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'deploy/**',
      'backend/**',
      'e2e/**',
      // Legacy flaky suites — restored in vitest.agents.config.ts for closeout runs.
      'src/__tests__/components/ai/TrendAgentControl.test.tsx',
      'src/__tests__/components/ai/ArbitrageAgentControl.wp1a.test.tsx',
      'src/__tests__/components/ai/ArbitrageAgentControl.wp1b1.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/build/',
        '**/deploy/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
