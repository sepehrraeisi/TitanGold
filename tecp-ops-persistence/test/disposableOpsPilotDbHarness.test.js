import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_REQUIRED_PG_VERSION,
  assertHarnessSourceHasNoEagerPgImport,
  cleanupDisposableOpsPilotCluster,
  createDisposableOpsPilotClient,
  detectPostgresVersion,
  evaluateOpsPilotHarnessSafety,
  startDisposableOpsPilotCluster,
  stopDisposableOpsPilotCluster,
} from '../src/disposableOpsPilotDbHarness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('S2 disposableOpsPilotDbHarness safety gates', () => {
  it('1) source contract allow without Tier-3/DB', () => {
    const result = evaluateOpsPilotHarnessSafety(
      { explicitNonProd: true, dataDir: '/tmp/disposable-ops-pilot' },
      { NODE_ENV: 'test' },
    );
    assert.equal(result.ok, true);
    assert.equal(result.dbExecutionAuthorized, false);
    assert.equal(result.tier3Authorized, false);
    assert.equal(result.requiredPgVersion, OPS_PILOT_REQUIRED_PG_VERSION);
  });

  it('2) DATABASE_URL and TCP denied', () => {
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true },
        { NODE_ENV: 'test', DATABASE_URL: 'postgres://x' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL,
    );
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true, host: '127.0.0.1' },
        { NODE_ENV: 'test' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST,
    );
  });

  it('3) production env and missing nonprod flag denied', () => {
    assert.equal(
      evaluateOpsPilotHarnessSafety({}, { NODE_ENV: 'production' }).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_PRODUCTION_ENV,
    );
    assert.equal(
      evaluateOpsPilotHarnessSafety({}, { NODE_ENV: 'test' }).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG,
    );
  });

  it('4) Tier-3 / DB execution attempts denied in Gate B', () => {
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true, authorizeTier3: true },
        { NODE_ENV: 'test' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_TIER3_NOT_AUTHORIZED,
    );
  });

  it('5) lifecycle operations deny without invoking PostgreSQL', async () => {
    const cfg = { explicitNonProd: true, dataDir: '/tmp/disposable-ops-pilot' };
    const env = { NODE_ENV: 'test' };
    for (const fn of [
      detectPostgresVersion,
      startDisposableOpsPilotCluster,
      stopDisposableOpsPilotCluster,
      createDisposableOpsPilotClient,
      cleanupDisposableOpsPilotCluster,
    ]) {
      const result = await fn(cfg, env);
      assert.equal(result.ok, false);
      assert.equal(result.postgresActions, 0);
    }
  });

  it('6) no eager pg import or spawnable postgres tooling in harness source', () => {
    const src = readFileSync(
      join(__dirname, '../src/disposableOpsPilotDbHarness.js'),
      'utf8',
    );
    const check = assertHarnessSourceHasNoEagerPgImport(src);
    assert.equal(check.ok, true);
    // Documentation may mention forbidden tools; executable spawn/exec must be absent.
    assert.equal(/\b(?:spawn|execFile|execSync)\s*\(/.test(src), false);
    assert.equal(/from ['"]pg['"]/.test(src), false);
    assert.equal(/require\(\s*['"]pg['"]\s*\)/.test(src), false);
  });
});
