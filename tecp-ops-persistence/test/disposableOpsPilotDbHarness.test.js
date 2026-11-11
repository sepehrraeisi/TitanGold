import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_REQUIRED_PG_VERSION,
  TIER3_ACTIVATION_AUTHORITY,
  assertHarnessSourceHasNoEagerPgImport,
  assertPathInsideRoot,
  buildInitdbArgs,
  buildPgCtlStartArgs,
  buildPgCtlStopArgs,
  cleanupDisposableOpsPilotCluster,
  createDisposableOpsPilotClient,
  createDisposableOpsPilotClusterController,
  createPrivilegedTier3ActivationHandleForTests,
  detectPostgresVersion,
  evaluateOpsPilotHarnessSafety,
  planPostgresVersionProbe,
  startDisposableOpsPilotCluster,
  stopDisposableOpsPilotCluster,
} from '../src/disposableOpsPilotDbHarness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('S2 disposableOpsPilotDbHarness Gate C+D offline safety', () => {
  it('1) source contract allow without Tier-3/DB execution', () => {
    const result = evaluateOpsPilotHarnessSafety(
      { explicitNonProd: true, dataDir: '/tmp/disposable-ops-pilot' },
      { NODE_ENV: 'test' },
    );
    assert.equal(result.ok, true);
    assert.equal(result.dbExecutionAuthorized, false);
    assert.equal(result.tier3Authorized, false);
    assert.equal(result.requiredPgVersion, OPS_PILOT_REQUIRED_PG_VERSION);
    assert.equal(result.tier3ActivationAuthority, TIER3_ACTIVATION_AUTHORITY);
  });

  it('2) DATABASE_URL / PG* / TCP / remote denied', () => {
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true },
        { NODE_ENV: 'test', DATABASE_URL: 'postgres://x' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL,
    );
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true },
        { NODE_ENV: 'test', PGHOST: '127.0.0.1' },
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
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true, remote: true },
        { NODE_ENV: 'test' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK,
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

  it('4) caller boolean / env flip is not Tier-3 authority', () => {
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true, tier3Authorized: true },
        { NODE_ENV: 'test' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION,
    );
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true, authorizeTier3: true },
        { NODE_ENV: 'test', TITANGOLD_TECP_OPS_S2_TIER3: '1' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION,
    );
  });

  it('5) lifecycle entrypoints deny without privileged handle; zero postgres actions', async () => {
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
      assert.ok([
        OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_TIER3_HANDLE,
        OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION,
        OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
        OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP,
      ].includes(result.decision));
    }
  });

  it('6) no eager pg import; argv builders are deterministic and socket-only', () => {
    const src = readFileSync(
      join(__dirname, '../src/disposableOpsPilotDbHarness.js'),
      'utf8',
    );
    const check = assertHarnessSourceHasNoEagerPgImport(src);
    assert.equal(check.ok, true);
    assert.equal(/from ['"]pg['"]/.test(src), false);
    assert.equal(/require\(\s*['"]pg['"]\s*\)/.test(src), false);

    const initArgs = buildInitdbArgs({
      dataDir: '/tmp/tecp-ops-pilot-s2-xyz/data',
      pwfile: '/tmp/tecp-ops-pilot-s2-xyz/pwfile',
    });
    assert.ok(initArgs.includes('-D'));
    assert.ok(!initArgs.some((a) => String(a).includes(';')));

    const startArgs = buildPgCtlStartArgs({
      dataDir: '/tmp/tecp-ops-pilot-s2-xyz/data',
      logFile: '/tmp/tecp-ops-pilot-s2-xyz/pg.log',
      socketDir: '/tmp/tecp-ops-pilot-s2-xyz/socket',
      socketPort: 56123,
    });
    assert.ok(startArgs.some((a) => String(a).includes('listen_addresses=')));
    assert.ok(startArgs.some((a) => String(a).includes('unix_socket_directories=')));
    assert.deepEqual(buildPgCtlStopArgs('/tmp/tecp-ops-pilot-s2-xyz/data').slice(-1), ['stop']);

    const probe = planPostgresVersionProbe();
    assert.equal(probe.args[0], '--version');
    assert.match(probe.bin, /\/usr\/lib\/postgresql\/14\/bin\/postgres$/);

    assert.equal(
      assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-a', '/tmp/tecp-ops-pilot-s2-a/data'),
      '/tmp/tecp-ops-pilot-s2-a/data',
    );
    assert.throws(() => assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-a', '/etc/passwd'));
  });

  it('7) privileged handle still keeps start()/client execution gate closed', async () => {
    const handle = createPrivilegedTier3ActivationHandleForTests({
      proofClass: 'TEST_ONLY_TIER3_ACTIVATION_HANDLE',
      explicitNonProd: true,
    });
    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      tier3ActivationHandle: handle,
    }, { NODE_ENV: 'test' });
    // Without verified pg binaries in CI sandbox this may deny on bin check;
    // either missing-bin throw path or controller without start execution is ok.
    if (controller && controller.ok === false) {
      assert.equal(controller.postgresActions, 0);
      return;
    }
    assert.equal(controller.kind, 'DISPOSABLE_OPS_PILOT_CLUSTER_CONTROLLER');
    const started = await controller.start();
    assert.equal(started.ok, false);
    assert.equal(
      started.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
    );
    assert.equal(started.postgresActions, 0);
  });
});
