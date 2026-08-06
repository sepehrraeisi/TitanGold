import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.e2e-playwright.env');

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.startsWith('#'))
      .map((line) => {
        const eq = line.indexOf('=');
        return [line.slice(0, eq), line.slice(eq + 1)];
      }),
  );
}

export default async function globalTeardown() {
  if (process.env.RUN_LOGIN_E2E !== '1') return;

  const vars = { ...readEnvFile(envFile), ...process.env } as Record<string, string>;
  const runtimeBackend = vars.TITAN_E2E_BACKEND_DIR;
  const fixtureUserId = vars.TITAN_E2E_FIXTURE_USER_ID;
  const fixtureUsername = vars.PLAYWRIGHT_LOGIN_USER;
  const fixtureEmail = vars.TITAN_E2E_FIXTURE_EMAIL;
  const fixtureOwner = vars.TITAN_E2E_FIXTURE_OWNER;
  const targetEnv = vars.TITAN_E2E_TARGET_ENV;

  if (!runtimeBackend || !fixtureUserId || !fixtureUsername || !fixtureEmail || !fixtureOwner || !targetEnv) {
    return;
  }

  execSync(
    `node scripts/cleanup_e2e_fixture_role.js --fixture-user-id "${fixtureUserId}" --fixture-username "${fixtureUsername}" --fixture-email "${fixtureEmail}" --fixture-owner "${fixtureOwner}" --target-env "${targetEnv}"`,
    {
      cwd: runtimeBackend,
      stdio: 'inherit',
    },
  );
}
