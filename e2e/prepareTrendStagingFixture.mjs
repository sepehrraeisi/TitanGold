#!/usr/bin/env node
/**
 * Prepare disposable Staging E2E fixture with trader role for Trend analyze/settings tests.
 * Writes .e2e-playwright.env (gitignored) — never log passwords to stdout.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeBackend = process.env.TITAN_E2E_BACKEND_DIR || '/home/ubuntu/webapp/TitanGold/backend';
const envOut = path.join(root, '.e2e-playwright.env');

execSync(`node scripts/prepare_login_e2e_fixture.js --output-file "${envOut}" --quiet-secrets`, {
  cwd: runtimeBackend,
  stdio: 'inherit',
});

const envText = fs.readFileSync(envOut, 'utf8');
const lines = envText.split('\n').filter(Boolean);
const parsed = Object.fromEntries(
  lines.map((line) => {
    const idx = line.indexOf('=');
    return [line.slice(0, idx), line.slice(idx + 1)];
  }),
);

execSync(`node scripts/promote_e2e_fixture_trader.js "${parsed.PLAYWRIGHT_LOGIN_USER}"`, {
  cwd: runtimeBackend,
  stdio: 'inherit',
});

fs.appendFileSync(envOut, 'TREND_E2E_ANALYZE_ENABLED=1\n', { mode: 0o600 });
console.log('E2E fixture prepared (trader role, analyze enabled)');
