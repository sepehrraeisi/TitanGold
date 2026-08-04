import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.e2e-playwright.env');

export default async function globalSetup() {
  if (process.env.RUN_LOGIN_E2E !== '1') {
    return;
  }

  execSync('node e2e/prepareTrendStagingFixture.mjs', {
    cwd: root,
    stdio: 'inherit',
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
