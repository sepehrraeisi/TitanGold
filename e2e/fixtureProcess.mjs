/**
 * Shell-free child-process runner for disposable Trend E2E fixture scripts.
 * Never concatenates env-derived values into a shell command string.
 *
 * Promotion marker crash-safety:
 * - Never silently delete an unresolved marker at setup startup.
 * - Write state=promotion_pending before DB role promotion.
 * - Atomically update to state=promoted after successful promotion.
 * - Teardown cleans both pending and promoted markers using marker identity.
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

export const MARKER_STATE_PENDING = 'promotion_pending';
export const MARKER_STATE_PROMOTED = 'promoted';
export const MARKER_STATES = new Set([MARKER_STATE_PENDING, MARKER_STATE_PROMOTED]);

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

function assertNoSecretFields(payload) {
  const forbidden = ['password', 'token', 'secret', 'authorization'];
  for (const key of Object.keys(payload)) {
    if (forbidden.some((f) => key.toLowerCase().includes(f))) {
      throw new Error(`Promotion marker must not contain secret field ${key}`);
    }
  }
  const serialized = JSON.stringify(payload);
  if (/password|authorization|bearer\s/i.test(serialized) && /"(password|token|secret|authorization)"/i.test(serialized)) {
    throw new Error('Promotion marker must not contain secret field names');
  }
}

/**
 * Atomically write a promotion marker (temp file + rename).
 * Never stores passwords, tokens, secrets, or authorization data.
 */
export function writePromotionMarker(marker, markerPath = PROMOTION_MARKER_PATH) {
  const state = marker.state || MARKER_STATE_PROMOTED;
  if (!MARKER_STATES.has(state)) {
    throw new Error(`Promotion marker state must be one of: ${[...MARKER_STATES].join(', ')}`);
  }

  const payload = {
    fixtureUserId: marker.fixtureUserId,
    username: marker.username,
    email: marker.email,
    owner: marker.owner,
    targetEnv: marker.targetEnv,
    backendDir: marker.backendDir,
    state,
    timestamp: marker.timestamp || new Date().toISOString(),
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
  resolveExpectedBackendRoot(payload.backendDir);
  assertNoSecretFields(payload);

  const dir = path.dirname(markerPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${markerPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmpPath, markerPath);
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
  const required = ['fixtureUserId', 'username', 'email', 'owner', 'targetEnv', 'backendDir', 'state'];
  for (const key of required) {
    if (!marker[key]) {
      throw new Error(`Promotion marker missing required identity field: ${key}`);
    }
  }
  if (!MARKER_STATES.has(marker.state)) {
    throw new Error(
      `Promotion marker state is invalid (expected ${[...MARKER_STATES].join(' or ')}, got ${marker.state})`,
    );
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
  assertNoSecretFields(marker);
}

/**
 * Cleanup using the marker as the sole authoritative identity.
 * Cleans both promotion_pending and promoted states.
 * On failure, the marker is preserved for recovery.
 */
export function cleanupPromotedFixture({
  env = process.env,
  run = runNodeScript,
  markerPath = PROMOTION_MARKER_PATH,
} = {}) {
  if (!fs.existsSync(markerPath)) {
    return { cleaned: false, reason: 'no_promotion_marker' };
  }

  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  assertPromotionMarkerComplete(marker);
  assertCanonicalStagingDeployEnv({
    targetEnv: marker.targetEnv,
    deployEnv: env.TITAN_DEPLOY_ENV,
  });

  const { backendRoot, cleanupScript } = resolveExpectedBackendRoot(marker.backendDir);

  try {
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
  } catch (err) {
    // Preserve marker for recovery after cleanup failure.
    throw err;
  }

  clearPromotionMarker(markerPath);
  return {
    cleaned: true,
    fixtureUserId: marker.fixtureUserId,
    previousState: marker.state,
  };
}

/**
 * At setup startup: never silently delete an existing marker.
 * Valid pending/promoted markers are cleaned first; incomplete markers abort.
 */
export function recoverUnresolvedPromotionMarker({
  env = process.env,
  run = runNodeScript,
  markerPath = PROMOTION_MARKER_PATH,
} = {}) {
  if (!fs.existsSync(markerPath)) {
    return { recovered: false, reason: 'no_promotion_marker' };
  }

  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch {
    throw new Error('Existing promotion marker is unreadable or corrupt; refusing to overwrite');
  }

  try {
    assertPromotionMarkerComplete(marker);
  } catch (err) {
    throw new Error(
      `Existing promotion marker is incomplete or invalid; refusing to overwrite: ${err.message}`,
    );
  }

  const cleaned = cleanupPromotedFixture({ env, run, markerPath });
  if (!cleaned.cleaned) {
    throw new Error('Existing promotion marker cleanup did not complete');
  }
  if (fs.existsSync(markerPath)) {
    throw new Error('Promotion marker still present after cleanup; refusing to continue setup');
  }

  return {
    recovered: true,
    fixtureUserId: cleaned.fixtureUserId,
    previousState: cleaned.previousState,
  };
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

  // Crash-safety: never silently delete an unresolved marker.
  recoverUnresolvedPromotionMarker({ env, run, markerPath });

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
  if (parsed.TITAN_E2E_TARGET_ENV !== 'staging') {
    throw new Error('Prepared fixture targetEnv must be staging');
  }

  const identity = {
    fixtureUserId: parsed.TITAN_E2E_FIXTURE_USER_ID,
    username: parsed.PLAYWRIGHT_LOGIN_USER,
    email: parsed.TITAN_E2E_FIXTURE_EMAIL,
    owner: parsed.TITAN_E2E_FIXTURE_OWNER,
    targetEnv: parsed.TITAN_E2E_TARGET_ENV,
    backendDir: backendRoot,
  };

  // Persist pending marker BEFORE DB role promotion so a crash still leaves cleanup identity.
  writePromotionMarker({ ...identity, state: MARKER_STATE_PENDING }, markerPath);

  try {
    run({
      scriptPath: promoteScript,
      cwd: backendRoot,
      args: [
        '--fixture-user-id',
        identity.fixtureUserId,
        '--fixture-username',
        identity.username,
        '--fixture-email',
        identity.email,
        '--fixture-owner',
        identity.owner,
        '--target-env',
        identity.targetEnv,
      ],
    });
  } catch (err) {
    // Leave promotion_pending marker for teardown/recovery.
    throw err;
  }

  // Atomically advance marker to promoted after successful DB mutation.
  writePromotionMarker({ ...identity, state: MARKER_STATE_PROMOTED }, markerPath);

  fs.appendFileSync(envOut, 'TREND_E2E_ANALYZE_ENABLED=1\n', { mode: 0o600 });
  return {
    envOut,
    markerPath,
    fixtureUserId: identity.fixtureUserId,
    markerState: MARKER_STATE_PROMOTED,
  };
}
