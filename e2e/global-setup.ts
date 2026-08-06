import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.e2e-playwright.env');
const prepareScript = path.join(root, 'e2e', 'prepareTrendStagingFixture.mjs');

export function assertE2EFixtureEnv(env = process.env) {
  if (env.RUN_LOGIN_E2E !== '1') {
    return;
  }

  if (env.TITAN_E2E_TARGET_ENV !== 'staging') {
    throw new Error('RUN_LOGIN_E2E requires TITAN_E2E_TARGET_ENV=staging');
  }
  if (!env.TITAN_E2E_BACKEND_DIR) {
    throw new Error('RUN_LOGIN_E2E requires explicit TITAN_E2E_BACKEND_DIR');
  }
  if (!env.TITAN_E2E_FIXTURE_USERNAME || !env.TITAN_E2E_FIXTURE_EMAIL || !env.TITAN_E2E_FIXTURE_OWNER) {
    throw new Error('RUN_LOGIN_E2E requires explicit fixture username, email, and owner');
  }
}

export default async function globalSetup() {
  if (process.env.RUN_LOGIN_E2E !== '1') {
    return;
  }
  assertE2EFixtureEnv(process.env);

  execFileSync(process.execPath, [prepareScript], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (!fs.existsSync(envFile)) {
    throw new Error('E2E fixture env file missing after prepare');
  }

  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    process.env[key] = value;
  }
}
