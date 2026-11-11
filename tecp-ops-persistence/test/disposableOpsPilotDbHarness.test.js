import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ONE_SHOT_STATES,
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_REQUIRED_PG_VERSION,
  OPS_PILOT_TIER3_AUTHORIZED,
  TIER3_ACTIVATION_AUTHORITY,
  activateOwnerControlledLocalRunnerOneShot,
  assertHarnessSourceHasNoEagerPgImport,
  assertPathInsideRoot,
  buildInitdbArgs,
  buildPgCtlStartArgs,
  buildPgCtlStopArgs,
  cancelOwnerOneShotTicket,
  cleanupDisposableOpsPilotCluster,
  createDisposableOpsPilotClient,
  createDisposableOpsPilotClusterController,
  createInertOfflineOneShotTicketForTests,
  createPrivilegedTier3ActivationHandleForTests,
  detectPostgresVersion,
  evaluateOpsPilotHarnessSafety,
  evaluateOwnerControlledLocalRunnerEvidence,
  getOwnerOneShotTicketView,
  isActiveOwnerOneShotTicket,
  planOwnedUnixSocketClientConfig,
  planPostgresVersionProbe,
  startDisposableOpsPilotCluster,
  stopDisposableOpsPilotCluster,
} from '../src/disposableOpsPilotDbHarness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_SRC = join(__dirname, '../src/disposableOpsPilotDbHarness.js');

function makeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance(ms) { now += ms; },
  };
}

function inertSpawner() {
  return {
    calls: [],
    spawnSyncFn(bin, args) {
      this.calls.push({ bin, args: [...args] });
      if (String(bin).endsWith('postgres') && args[0] === '--version') {
        return { status: 0, stdout: 'postgres (PostgreSQL) 14.24 (Ubuntu)\n', stderr: '' };
      }
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  };
}

describe('S2 disposableOpsPilotDbHarness Tier-3 one-shot offline safety', () => {
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
    assert.equal(OPS_PILOT_DB_EXECUTION_AUTHORIZED, false);
    assert.equal(OPS_PILOT_TIER3_AUTHORIZED, false);
  });

  it('2) DATABASE_URL / PG* / TCP / remote / caller pg bin denied', () => {
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
    assert.equal(
      evaluateOpsPilotHarnessSafety(
        { explicitNonProd: true, pgBinDir: '/tmp/evil/bin' },
        { NODE_ENV: 'test' },
      ).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_PG_TARGET,
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

  it('5) lifecycle entrypoints deny without one-shot; zero postgres actions', async () => {
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
        OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED,
        OPS_PILOT_HARNESS_DECISIONS.DENY_WEAKSET_NOT_OWNER_AUTHORITY,
        OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP,
      ].includes(result.decision), result.decision);
    }
  });

  it('6) no eager pg import; argv builders deterministic and socket-only', () => {
    const src = readFileSync(HARNESS_SRC, 'utf8');
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

    const clientPlan = planOwnedUnixSocketClientConfig({
      socketDir: '/tmp/tecp-ops-pilot-s2-xyz/socket',
      socketPort: 56123,
    });
    assert.equal(clientPlan.host, '/tmp/tecp-ops-pilot-s2-xyz/socket');
    assert.equal(clientPlan.connectionStringForbidden, true);

    assert.equal(
      assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-a', '/tmp/tecp-ops-pilot-s2-a/data'),
      '/tmp/tecp-ops-pilot-s2-a/data',
    );
    assert.throws(() => assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-a', '/etc/passwd'));
  });

  it('7) WeakSet public factory cannot activate Owner one-shot or start', async () => {
    const handle = createPrivilegedTier3ActivationHandleForTests({
      proofClass: 'TEST_ONLY_TIER3_ACTIVATION_HANDLE',
      explicitNonProd: true,
    });
    assert.equal(handle.authorizesOneShot, false);
    const evidence = evaluateOwnerControlledLocalRunnerEvidence({
      treatWeakSetAsOwnerAuthority: true,
      tier3ActivationHandle: handle,
    });
    assert.equal(evidence.decision, OPS_PILOT_HARNESS_DECISIONS.DENY_PUBLIC_FACTORY_AS_OWNER);

    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      tier3ActivationHandle: handle,
    }, { NODE_ENV: 'test' });
    assert.equal(controller.ok, false);
    assert.equal(
      controller.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_WEAKSET_NOT_OWNER_AUTHORITY,
    );

    const started = await startDisposableOpsPilotCluster({
      explicitNonProd: true,
      tier3ActivationHandle: handle,
    }, { NODE_ENV: 'test' });
    assert.equal(started.ok, false);
    assert.equal(started.postgresActions, 0);
  });

  it('8) Owner invocation without argv marker is NOT_VERIFIABLE / fail-closed', () => {
    const result = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
    }, { argv: ['node', '--test', OPS_PILOT_APPROVED_TEST_ACTIONS[0]] });
    assert.equal(result.ok, false);
    assert.equal(
      result.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE,
    );
    assert.equal(result.ownerInvocationIndependentlyVerifiable, false);
    assert.equal(result.exactScopeInsufficientForStandaloneEntrypoint, true);

    const activated = activateOwnerControlledLocalRunnerOneShot({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      ownerControlledLocalRunnerInvocation: true,
    }, { argv: ['node', '--test', OPS_PILOT_APPROVED_TEST_ACTIONS[0]] });
    assert.equal(activated.ok, false);
    assert.equal(
      activated.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE,
    );
  });

  it('9) wrong SHA / executable / unapproved action / TTL denied', () => {
    const baseArgv = [
      'node',
      OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
      '--test',
      OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      OPS_PILOT_APPROVED_TEST_ACTIONS[1],
    ];
    const deps = {
      argv: baseArgv,
      execPath: process.execPath,
      getuid: () => 1000,
    };
    assert.equal(
      evaluateOwnerControlledLocalRunnerEvidence({
        repositorySha: 'deadbeef',
        approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
        executablePath: process.execPath,
        harnessModulePath: HARNESS_SRC,
        affirmSameUidLimitationsAccepted: true,
        executionPrincipal: 1000,
      }, deps).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_REPOSITORY_SHA,
    );
    assert.equal(
      evaluateOwnerControlledLocalRunnerEvidence({
        repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
        approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
        executablePath: '/tmp/evil-node',
        harnessModulePath: HARNESS_SRC,
        affirmSameUidLimitationsAccepted: true,
        executionPrincipal: 1000,
      }, deps).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY,
    );
    assert.equal(
      evaluateOwnerControlledLocalRunnerEvidence({
        repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
        approvedActions: ['tecp-ops-persistence/test/not-approved.test.js'],
        executablePath: process.execPath,
        harnessModulePath: HARNESS_SRC,
        affirmSameUidLimitationsAccepted: true,
        executionPrincipal: 1000,
      }, deps).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION,
    );
    assert.equal(
      evaluateOwnerControlledLocalRunnerEvidence({
        repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
        approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
        executablePath: process.execPath,
        harnessModulePath: HARNESS_SRC,
        affirmSameUidLimitationsAccepted: true,
        executionPrincipal: 1000,
        ttlMs: 999999999,
      }, deps).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG,
    );
  });

  it('10) verified Owner argv activates one-shot; live spawn request still denied by DB gate', () => {
    const argv = [
      process.execPath,
      OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
      '--test',
      OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      OPS_PILOT_APPROVED_TEST_ACTIONS[1],
    ];
    const deps = {
      argv,
      execPath: process.execPath,
      getuid: () => 1000,
      clock: makeClock(),
    };
    const liveDenied = activateOwnerControlledLocalRunnerOneShot({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
      authorizeLivePostgresSpawn: true,
    }, deps);
    assert.equal(liveDenied.ok, false);
    assert.equal(
      liveDenied.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
    );

    const activated = activateOwnerControlledLocalRunnerOneShot({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
    }, deps);
    assert.equal(activated.ok, true);
    assert.equal(activated.state, ONE_SHOT_STATES.ACTIVE_TEST_ONLY);
    assert.equal(activated.liveSpawnPermitted, false);
    assert.equal(activated.sameUidSealed, false);
    assert.equal(isActiveOwnerOneShotTicket(activated.ticket, deps.clock), true);
  });

  it('11) one-shot replay, TTL expiry, and cancellation fail closed', async () => {
    const clock = makeClock();
    const ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
      ttlMs: 1000,
    }, { clock });
    assert.equal(getOwnerOneShotTicketView(ticket, clock).state, ONE_SHOT_STATES.ACTIVE_TEST_ONLY);

    const spawner = inertSpawner();
    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket,
      spawnSyncFn: spawner.spawnSyncFn.bind(spawner),
      clock,
      inspectFn: () => ({ status: 'STOPPED', reason: 'inert' }),
      stopFn: () => ({ status: 0 }),
    }, { NODE_ENV: 'test' });
    assert.equal(controller.kind, 'DISPOSABLE_OPS_PILOT_CLUSTER_CONTROLLER');
    const prepared = await controller.prepare();
    assert.equal(prepared.ok, true);
    const started = await controller.start();
    assert.equal(started.ok, true);
    assert.ok(started.postgresActions >= 1);
    assert.equal(started.inert, true);

    const replay = await controller.start();
    assert.equal(replay.ok, false);
    assert.ok([
      OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED,
    ].includes(replay.decision));

    await controller.cleanup();

    const clock2 = makeClock();
    const expiring = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
      ttlMs: 50,
    }, { clock: clock2 });
    clock2.advance(100);
    const expired = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: expiring,
      clock: clock2,
    }, { NODE_ENV: 'test' });
    assert.equal(expired.ok, false);
    assert.equal(expired.decision, OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_EXPIRED);

    const clock3 = makeClock();
    const cancellable = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock: clock3 });
    cancelOwnerOneShotTicket(cancellable, clock3);
    const cancelled = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: cancellable,
      clock: clock3,
    }, { NODE_ENV: 'test' });
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.decision, OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED);
  });

  it('12) Owner one-shot without inert spawner cannot live-start; consumes capability', async () => {
    const argv = [
      process.execPath,
      OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
      '--test',
      ...OPS_PILOT_APPROVED_TEST_ACTIONS,
    ];
    const clock = makeClock();
    const activated = activateOwnerControlledLocalRunnerOneShot({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: process.getuid?.(),
    }, {
      argv,
      execPath: process.execPath,
      getuid: () => process.getuid?.(),
      clock,
    });
    assert.equal(activated.ok, true);
    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: activated.ticket,
      clock,
    }, { NODE_ENV: 'test' });
    const prepared = await controller.prepare();
    assert.equal(prepared.ok, true);
    const started = await controller.start();
    assert.equal(started.ok, false);
    assert.equal(
      started.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
    );
    assert.equal(started.postgresActions, 0);
    assert.ok(started.plannedArgs?.initdbArgs);
    assert.equal(isActiveOwnerOneShotTicket(activated.ticket, clock), false);
    await controller.cleanup();
  });

  it('13) path escape / symlink cleanup denial preserved by helpers', () => {
    assert.throws(() => assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-root', '/tmp/other'));
  });

  it('14) failed startup with inert spawner does not leave reusable activation', async () => {
    const clock = makeClock();
    const ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock });
    let calls = 0;
    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket,
      clock,
      spawnSyncFn() {
        calls += 1;
        if (calls === 1) return { status: 0, stdout: 'postgres (PostgreSQL) 14.24\n' };
        return { status: 1, stdout: '', stderr: 'initdb boom' };
      },
      inspectFn: () => ({ status: 'STOPPED', reason: 'inert' }),
    }, { NODE_ENV: 'test' });
    await controller.prepare();
    const started = await controller.start();
    assert.equal(started.ok, false);
    assert.equal(isActiveOwnerOneShotTicket(ticket, clock), false);
    const replayController = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket,
      clock,
      spawnSyncFn: () => ({ status: 0, stdout: 'ok' }),
    }, { NODE_ENV: 'test' });
    assert.equal(replayController.ok, false);
    assert.ok([
      OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED,
    ].includes(replayController.decision));
    await controller.cleanup();
  });
});
