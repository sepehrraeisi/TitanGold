/**
 * Shared disposable E2E fixture safety helpers.
 * Fail-closed validation + canonical staging deploy-env gate for role mutation scripts.
 */

import fs from 'node:fs';
import path from 'node:path';

export const FIXTURE_USERNAME_RE = /^e2e_[a-z0-9_]{3,48}$/i;
export const FIXTURE_EMAIL_RE = /^[a-z0-9._+-]+@titangold\.test$/i;
export const FIXTURE_OWNER_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/i;
export const FIXTURE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildFixtureFullName(owner) {
  return `E2E Login Fixture (${owner})`;
}

export function assertSafeFixtureIdentity({
  username,
  email,
  owner,
  fixtureUserId = null,
  requireId = false,
}) {
  if (!FIXTURE_USERNAME_RE.test(String(username || ''))) {
    throw new Error('Fixture username must match disposable e2e_ contract');
  }
  if (!FIXTURE_EMAIL_RE.test(String(email || ''))) {
    throw new Error('Fixture email must use the disposable @titangold.test domain');
  }
  if (!FIXTURE_OWNER_RE.test(String(owner || ''))) {
    throw new Error('Fixture owner must match the strict safe-character pattern');
  }
  if (requireId || fixtureUserId != null) {
    if (!FIXTURE_ID_RE.test(String(fixtureUserId || ''))) {
      throw new Error('Fixture ID must match the canonical database UUID format');
    }
  }
  // Reject shell metacharacters even if regex somehow drifts.
  for (const [label, value] of [
    ['username', username],
    ['email', email],
    ['owner', owner],
    ['fixtureUserId', fixtureUserId],
  ]) {
    if (value == null) continue;
    if (/[\s"'`;$\\|&<>()\n\r]/.test(String(value))) {
      throw new Error(`Fixture ${label} contains unsafe shell metacharacters`);
    }
  }
}

/**
 * Caller-provided --target-env is not enough. Role mutation requires the
 * canonical process environment to already be staging-safe.
 *
 * GitHub Actions PR-safe E2E uses an isolated disposable Postgres service and
 * sets TITAN_DEPLOY_ENV=staging explicitly; that isolated test database is
 * authorized under this staging-safe fixture contract.
 */
export function assertCanonicalStagingDeployEnv({
  targetEnv,
  deployEnv = process.env.TITAN_DEPLOY_ENV,
} = {}) {
  if (targetEnv !== 'staging') {
    throw new Error('Disposable fixture role mutation requires --target-env=staging');
  }
  if (!deployEnv) {
    throw new Error('TITAN_DEPLOY_ENV is required before disposable fixture role mutation');
  }
  if (deployEnv === 'production') {
    throw new Error('Disposable fixture role mutation is forbidden when TITAN_DEPLOY_ENV=production');
  }
  if (deployEnv !== 'staging') {
    throw new Error(`Disposable fixture role mutation requires TITAN_DEPLOY_ENV=staging (got ${deployEnv})`);
  }
}

export function resolveExpectedBackendRoot(backendDir) {
  if (!backendDir || typeof backendDir !== 'string') {
    throw new Error('Backend directory is required');
  }
  const resolved = path.resolve(backendDir);
  if (path.basename(resolved) !== 'backend') {
    throw new Error('Backend directory must resolve to a directory named backend');
  }
  const packageJson = path.join(resolved, 'package.json');
  if (!fs.existsSync(packageJson)) {
    throw new Error('Backend directory must contain package.json');
  }
  const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  if (pkg.name !== 'titangold-backend') {
    throw new Error('Backend directory must resolve to titangold-backend package root');
  }
  const prepareScript = path.join(resolved, 'scripts', 'prepare_login_e2e_fixture.js');
  const promoteScript = path.join(resolved, 'scripts', 'promote_e2e_fixture_trader.js');
  const cleanupScript = path.join(resolved, 'scripts', 'cleanup_e2e_fixture_role.js');
  for (const scriptPath of [prepareScript, promoteScript, cleanupScript]) {
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Expected backend script missing: ${path.basename(scriptPath)}`);
    }
  }
  return {
    backendRoot: resolved,
    prepareScript,
    promoteScript,
    cleanupScript,
  };
}

export function readArg(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1 || index + 1 >= argv.length) return null;
  return argv[index + 1];
}

export function requireArg(argv, flag) {
  const value = readArg(argv, flag);
  if (!value) throw new Error(`Missing required flag ${flag}`);
  return value;
}
