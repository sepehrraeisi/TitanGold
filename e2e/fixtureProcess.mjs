/**
 * Shell-free child-process runner for disposable Trend E2E fixture scripts.
 * Never concatenates env-derived values into a shell command string.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCanonicalStagingDeployEnv,
  assertSafeFixtureIdentity,
  resolveExpectedBackendRoot,
} from '../backend/scripts/e2eFixtureSafety.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROMOTION_MARKER_PATH = path.join(root, '.e2e-fixture-promotion.json');
export const E2E_ENV_PATH = path.join(root, '.e2e-playwright.env');

export function runNodeScript({ scriptPath, args, cwd, execFile = execFileSync }) {
  if (!Array.isArray(args)) {
    throw new Error('Child process args must be an explicit array');
  }
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new Error('Child process args must be strings');
    }
  }
  return execFile(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
}

export function parseEnvFile(filePath) {
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

export function writePromotionMarker(marker, markerPath = PROMOTION_MARKER_PATH) {
  const payload = {
    fixtureUserId: marker.fixtureUserId,
    username: marker.username,
    email: marker.email,
    owner: marker.owner,
    targetEnv: marker.targetEnv,
    backendDir: marker.backendDir,
    promotedAt: marker.promotedAt || new Date().toISOString(),
  };
  assertSafeFixtureIdentity({
    username: payload.username,
    email: payload.email,
    owner: payload.owner,
    fixtureUserId: payload.fixtureUserId,
    requireId: true,
  });
  if (payload.targetEnv !== 'staging') {
    throw new Error('Promotion marker targetEnv must be staging');
  }
  // Never persist secrets.
  const forbidden = ['password', 'token', 'secret', 'authorization'];
  for (const key of Object.keys(payload)) {
    if (forbidden.some((f) => key.toLowerCase().includes(f))) {
      throw new Error(`Promotion marker must not contain secret field ${key}`);
    }
  }
  fs.writeFileSync(markerPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return payload;
}

export function readPromotionMarker(markerPath = PROMOTION_MARKER_PATH) {
  if (!fs.existsSync(markerPath)) return null;
  return JSON.parse(fs.readFileSync(markerPath, 'utf8'));
}

export function clearPromotionMarker(markerPath = PROMOTION_MARKER_PATH) {
  if (fs.existsSync(markerPath)) {
    fs.unlinkSync(markerPath);
  }
}

export function assertPromotionMarkerComplete(marker) {
  if (!marker || typeof marker !== 'object') {
    throw new Error('Promotion marker is missing or invalid');
  }
  const required = ['fixtureUserId', 'username', 'email', 'owner', 'targetEnv', 'backendDir'];
  for (const key of required) {
    if (!marker[key]) {
      throw new Error(`Promotion marker missing required identity field: ${key}`);
    }
  }
  assertSafeFixtureIdentity({
    username: marker.username,
    email: marker.email,
    owner: marker.owner,
    fixtureUserId: marker.fixtureUserId,
    requireId: true,
  });
  if (marker.targetEnv !== 'staging') {
    throw new Error('Promotion marker targetEnv must be staging');
  }
  resolveExpectedBackendRoot(marker.backendDir);
}

export function prepareTrendStagingFixture({
  env = process.env,
  envOut = E2E_ENV_PATH,
  run = runNodeScript,
  markerPath = PROMOTION_MARKER_PATH,
} = {}) {
  const runtimeBackend = env.TITAN_E2E_BACKEND_DIR;
  const fixtureUsername = env.TITAN_E2E_FIXTURE_USERNAME;
  const fixtureEmail = env.TITAN_E2E_FIXTURE_EMAIL;
  const fixtureOwner = env.TITAN_E2E_FIXTURE_OWNER;
  const targetEnv = env.TITAN_E2E_TARGET_ENV;

  assertSafeFixtureIdentity({
    username: fixtureUsername,
    email: fixtureEmail,
    owner: fixtureOwner,
  });
  assertCanonicalStagingDeployEnv({ targetEnv, deployEnv: env.TITAN_DEPLOY_ENV });
  const { backendRoot, prepareScript, promoteScript } = resolveExpectedBackendRoot(runtimeBackend);

  // Ensure no stale promotion marker from a prior interrupted run.
  clearPromotionMarker(markerPath);

  run({
    scriptPath: prepareScript,
    cwd: backendRoot,
    args: [
      '--output-file',
      envOut,
      '--quiet-secrets',
      '--fixture-username',
      fixtureUsername,
      '--fixture-email',
      fixtureEmail,
      '--fixture-owner',
      fixtureOwner,
      '--target-env',
      targetEnv,
    ],
  });

  const parsed = parseEnvFile(envOut);
  assertSafeFixtureIdentity({
    username: parsed.PLAYWRIGHT_LOGIN_USER,
    email: parsed.TITAN_E2E_FIXTURE_EMAIL,
    owner: parsed.TITAN_E2E_FIXTURE_OWNER,
    fixtureUserId: parsed.TITAN_E2E_FIXTURE_USER_ID,
    requireId: true,
  });
  if (parsed.PLAYWRIGHT_LOGIN_USER !== fixtureUsername) {
    throw new Error('Prepared fixture username does not match requested disposable identity');
  }
  if (parsed.TITAN_E2E_FIXTURE_EMAIL !== fixtureEmail) {
    throw new Error('Prepared fixture email does not match requested disposable identity');
  }
  if (parsed.TITAN_E2E_FIXTURE_OWNER !== fixtureOwner) {
    throw new Error('Prepared fixture owner does not match requested disposable identity');
  }

  run({
    scriptPath: promoteScript,
    cwd: backendRoot,
    args: [
      '--fixture-user-id',
      parsed.TITAN_E2E_FIXTURE_USER_ID,
      '--fixture-username',
      parsed.PLAYWRIGHT_LOGIN_USER,
      '--fixture-email',
      parsed.TITAN_E2E_FIXTURE_EMAIL,
      '--fixture-owner',
      parsed.TITAN_E2E_FIXTURE_OWNER,
      '--target-env',
      parsed.TITAN_E2E_TARGET_ENV,
    ],
  });

  writePromotionMarker(
    {
      fixtureUserId: parsed.TITAN_E2E_FIXTURE_USER_ID,
      username: parsed.PLAYWRIGHT_LOGIN_USER,
      email: parsed.TITAN_E2E_FIXTURE_EMAIL,
      owner: parsed.TITAN_E2E_FIXTURE_OWNER,
      targetEnv: parsed.TITAN_E2E_TARGET_ENV,
      backendDir: backendRoot,
    },
    markerPath,
  );

  fs.appendFileSync(envOut, 'TREND_E2E_ANALYZE_ENABLED=1\n', { mode: 0o600 });
  return {
    envOut,
    markerPath,
    fixtureUserId: parsed.TITAN_E2E_FIXTURE_USER_ID,
  };
}

export function cleanupPromotedFixture({
  env = process.env,
  run = runNodeScript,
  markerPath = PROMOTION_MARKER_PATH,
} = {}) {
  if (!fs.existsSync(markerPath)) {
    // No promotion occurred — safe no-op.
    return { cleaned: false, reason: 'no_promotion_marker' };
  }

  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  assertPromotionMarkerComplete(marker);
  assertCanonicalStagingDeployEnv({
    targetEnv: marker.targetEnv,
    deployEnv: env.TITAN_DEPLOY_ENV,
  });

  const { backendRoot, cleanupScript } = resolveExpectedBackendRoot(marker.backendDir);

  run({
    scriptPath: cleanupScript,
    cwd: backendRoot,
    args: [
      '--fixture-user-id',
      marker.fixtureUserId,
      '--fixture-username',
      marker.username,
      '--fixture-email',
      marker.email,
      '--fixture-owner',
      marker.owner,
      '--target-env',
      marker.targetEnv,
    ],
  });

  clearPromotionMarker(markerPath);
  return { cleaned: true, fixtureUserId: marker.fixtureUserId };
}
