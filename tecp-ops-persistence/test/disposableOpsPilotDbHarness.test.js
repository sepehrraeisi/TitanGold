import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  ONE_SHOT_STATES,
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_HARNESS_CHECKPOINT,
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_HARNESS_MARKER_MAGIC,
  OPS_PILOT_HARNESS_MARKER_NAME,
  OPS_PILOT_HARNESS_ROOT_PREFIX,
  OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_REQUIRED_PG_VERSION,
  OPS_PILOT_TIER3_AUTHORIZED,
  POSTMASTER_STATUS,
  TIER3_ACTIVATION_AUTHORITY,
  TIER3_FINAL_EXECUTION_CONTRACT,
  TIER3_READINESS_VERDICTS,
  TIER3_REQUIRED_ADDITIONAL_PATHS,
  TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
  activateOwnerControlledLocalRunnerOneShot,
  assertApprovedSuiteAllowlist,
  assertHarnessSourceHasNoEagerPgImport,
  assertNoSymlink,
  assertPathInsideRoot,
  assertVerifiedHarnessPaths,
  buildInitdbArgs,
  buildPgCtlStartArgs,
  buildPgCtlStopArgs,
  cancelOwnerOneShotTicket,
  cleanupDisposableOpsPilotCluster,
  createDisposableOpsPilotClient,
  createDisposableOpsPilotClusterController,
  createInertOfflineOneShotTicketForTests,
  createPrivilegedTier3ActivationHandleForTests,
  createRunnerOfflineSuiteGrantForTests,
  detectPostgresVersion,
  evaluateIndependentOwnerCapability,
  evaluateOpsPilotHarnessSafety,
  evaluateOwnerControlledLocalRunnerEvidence,
  evaluateTier3FinalExecutionReadiness,
  getOwnerOneShotTicketView,
  inspectPostmasterStatus,
  isActiveOwnerOneShotTicket,
  isOwnedDisposableOpsPilotClusterController,
  isOwnerOneShotTicket,
  isRunnerOfflineSuiteGrant,
  planOwnedUnixSocketClientConfig,
  planPostgresVersionProbe,
  startDisposableOpsPilotCluster,
  stopClusterAndProveTerminated,
  stopDisposableOpsPilotCluster,
  writeHarnessMarker,
} from '../src/disposableOpsPilotDbHarness.js';
import {
  OWNER_RUNNER_DECISIONS,
  getRunnerImportSideEffectsReport,
  invokeOwnerControlledTier3LocalRunner,
  isDirectCliEntrypoint,
} from '../scripts/ownerControlledTier3LocalRunner.js';

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
  const calls = [];
  return {
    calls,
    spawnSyncFn(bin, args) {
      // Closure-bound: safe when extracted as request.spawnSyncFn without .bind(this).
      calls.push({ bin, args: [...args] });
      if (String(bin).endsWith('postgres') && args[0] === '--version') {
        return { status: 0, stdout: 'postgres (PostgreSQL) 14.24 (Ubuntu)\n', stderr: '' };
      }
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  };
}

function withIsolatedDisposableFixture(run) {
  const root = mkdtempSync(join(tmpdir(), `${OPS_PILOT_HARNESS_ROOT_PREFIX}p1cov-`));
  const dataDir = join(root, 'data');
  mkdirSync(dataDir);
  try {
    return run(root, dataDir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('S2 disposableOpsPilotDbHarness Tier-3 final execution readiness offline safety', () => {
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
    assert.equal(OPS_PILOT_HARNESS_CHECKPOINT, 'S2_TIER3_FINAL_EXECUTION_READINESS');
    assert.equal(OPS_PILOT_PINNED_MAIN_SHA, 'ee26aa367475c0002b077bd0ae02838ce8c055e6');
    assert.deepEqual([...OPS_PILOT_APPROVED_TEST_ACTIONS], [
      'tecp-ops-persistence/test/cp2DbFencingDurability.test.js',
      'tecp-ops-persistence/test/cp2DbDispatcherIntegration.test.js',
    ]);
    assert.equal(TIER3_FINAL_EXECUTION_CONTRACT.pinnedMainSha, OPS_PILOT_PINNED_MAIN_SHA);
    assert.equal(TIER3_FINAL_EXECUTION_CONTRACT.liveDbExecutionAuthorized, false);
    assert.equal(TIER3_FINAL_EXECUTION_CONTRACT.executableLaunchCommand, null);
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

  it('10) ARGV marker / env / boolean cannot independently authorize Owner one-shot or DB', () => {
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

    const evidence = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
    }, deps);
    assert.equal(evidence.ok, false);
    assert.equal(
      evidence.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ARGV_ONLY_AUTHORIZATION,
    );
    assert.equal(evidence.ownerAuthenticationProven, false);
    assert.equal(evidence.ownerInvocationIndependentlyVerifiable, false);

    const activated = activateOwnerControlledLocalRunnerOneShot({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
    }, deps);
    assert.equal(activated.ok, false);
    assert.equal(
      activated.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_AUTHENTICATION_UNPROVEN,
    );
    assert.equal(activated.ticket, undefined);

    assert.equal(
      evaluateOwnerControlledLocalRunnerEvidence({
        ownerAuthorizedByBoolean: true,
      }, deps).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION,
    );
    assert.equal(
      evaluateOwnerControlledLocalRunnerEvidence({
        envAuthorized: true,
      }, deps).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION,
    );
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

  it('12) inert ticket without fake spawner cannot live-start; consumes; prepare is one-shot', async () => {
    const clock = makeClock();
    const ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock });
    assert.equal(Object.isFrozen(ticket), true);
    assert.throws(() => {
      ticket.liveSpawnPermitted = true;
    });
    assert.throws(() => {
      ticket.consumed = false;
    });

    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket,
      clock,
    }, { NODE_ENV: 'test' });
    const prepared = await controller.prepare();
    assert.equal(prepared.ok, true);
    const preparedAgain = await controller.prepare();
    assert.equal(preparedAgain.ok, false);
    assert.equal(
      preparedAgain.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_PREPARE_ALREADY_USED,
    );

    const secondController = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket,
      clock,
    }, { NODE_ENV: 'test' });
    const secondPrepare = await secondController.prepare();
    assert.equal(secondPrepare.ok, false);
    assert.equal(
      secondPrepare.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_PREPARE_ALREADY_USED,
    );

    const started = await controller.start();
    assert.equal(started.ok, false);
    assert.equal(
      started.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
    );
    assert.equal(started.postgresActions, 0);
    assert.ok(started.plannedArgs?.initdbArgs);
    assert.equal(isActiveOwnerOneShotTicket(ticket, clock), false);
    await controller.cleanup();
  });

  it('13) assertPathInsideRoot rejects canonical path escape', () => {
    assert.throws(
      () => assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-root', '/tmp/other'),
      /path escapes disposable root/,
    );
    assert.throws(
      () => assertPathInsideRoot('/tmp/tecp-ops-pilot-s2-root', '/tmp/tecp-ops-pilot-s2-root/../escape'),
      /path escapes disposable root/,
    );
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

  it('15) default pg_ctl status/stop helpers deny without owned controller', () => {
    const status = inspectPostmasterStatus('/tmp/tecp-ops-pilot-s2-not-owned/data');
    assert.equal(status.blocked, true);
    assert.equal(
      status.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );
    assert.equal(status.status, 'UNCERTAIN');

    const stopped = stopClusterAndProveTerminated('/tmp/tecp-ops-pilot-s2-not-owned/data');
    assert.equal(stopped.blocked, true);
    assert.equal(
      stopped.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );
    assert.equal(stopped.terminated, false);
  });

  it('16) ticket privilege is module-private; public mutation cannot escalate', () => {
    const clock = makeClock();
    const ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock });
    assert.equal(isOwnerOneShotTicket(ticket), true);
    assert.equal(Object.isFrozen(ticket), true);
    assert.equal(ticket.authorizesLivePostgres, false);
    const view = getOwnerOneShotTicketView(ticket, clock);
    assert.equal(view.liveSpawnPermitted, false);
    assert.equal(view.ownerAuthenticationProven, false);
    assert.equal(view.prepareUsed, false);
    cancelOwnerOneShotTicket(ticket, clock);
    assert.equal(isActiveOwnerOneShotTicket(ticket, clock), false);
    assert.equal(getOwnerOneShotTicketView(ticket, clock).cancelled, true);
  });

  it('17) EXECUTION_PRINCIPAL_MISMATCH and extra ARGV .test.js paths fail closed', () => {
    const baseArgv = [
      process.execPath,
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

    const mismatched = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1,
    }, deps);
    assert.equal(mismatched.ok, false);
    assert.equal(
      mismatched.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY,
    );
    assert.ok(mismatched.reasons.includes('EXECUTION_PRINCIPAL_MISMATCH'));
    assert.equal(mismatched.ownerAuthenticationProven, undefined);

    const matchingPrincipalStillArgvOnly = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
    }, deps);
    assert.equal(matchingPrincipalStillArgvOnly.ok, false);
    assert.equal(
      matchingPrincipalStillArgvOnly.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ARGV_ONLY_AUTHORIZATION,
    );
    assert.equal(matchingPrincipalStillArgvOnly.ownerAuthenticationProven, false);

    const extraArgv = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
    }, {
      ...deps,
      argv: [
        ...baseArgv,
        'tecp-ops-persistence/test/not-on-allowlist.test.js',
      ],
    });
    assert.equal(extraArgv.ok, false);
    assert.equal(
      extraArgv.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION,
    );
    assert.ok(extraArgv.reasons.includes('UNAPPROVED_TEST_PATH_IN_ARGV'));

    const activated = activateOwnerControlledLocalRunnerOneShot({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      executionPrincipal: 1000,
    }, deps);
    assert.equal(activated.ok, false);
    assert.equal(
      activated.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_AUTHENTICATION_UNPROVEN,
    );
    assert.equal(activated.ticket, undefined);
  });

  it('18) assertNoSymlink / marker / assertVerifiedHarnessPaths adversarial denials', () => {
    withIsolatedDisposableFixture((root, dataDir) => {
      writeHarnessMarker(root, dataDir);
      assert.deepEqual(
        assertVerifiedHarnessPaths(root, dataDir),
        { resolvedRoot: resolve(root), resolvedData: resolve(dataDir) },
      );

      assert.throws(
        () => assertVerifiedHarnessPaths('', dataDir),
        /harness root missing/,
      );
      assert.throws(
        () => assertVerifiedHarnessPaths(root, ''),
        /harness dataDir missing/,
      );
      assert.throws(
        () => assertVerifiedHarnessPaths(root, '/tmp/not-inside-root'),
        /path escapes disposable root/,
      );

      const missingMarkerRoot = mkdtempSync(join(tmpdir(), `${OPS_PILOT_HARNESS_ROOT_PREFIX}nomarker-`));
      const missingMarkerData = join(missingMarkerRoot, 'data');
      mkdirSync(missingMarkerData);
      try {
        assert.throws(
          () => assertVerifiedHarnessPaths(missingMarkerRoot, missingMarkerData),
          /harness marker missing/,
        );
      } finally {
        rmSync(missingMarkerRoot, { recursive: true, force: true });
      }

      writeFileSync(join(root, OPS_PILOT_HARNESS_MARKER_NAME), JSON.stringify({
        magic: 'WRONG_MAGIC',
        root: resolve(root),
        dataDir: resolve(dataDir),
      }), { mode: 0o600 });
      assert.throws(
        () => assertVerifiedHarnessPaths(root, dataDir),
        /harness marker magic mismatch/,
      );

      writeFileSync(join(root, OPS_PILOT_HARNESS_MARKER_NAME), JSON.stringify({
        magic: OPS_PILOT_HARNESS_MARKER_MAGIC,
        root: resolve(root),
        dataDir: resolve(join(root, 'other-data')),
      }), { mode: 0o600 });
      assert.throws(
        () => assertVerifiedHarnessPaths(root, dataDir),
        /harness marker path substitution detected/,
      );

      writeHarnessMarker(root, dataDir);

      const badPrefixRoot = mkdtempSync(join(tmpdir(), 'not-disposable-prefix-'));
      const badPrefixData = join(badPrefixRoot, 'data');
      mkdirSync(badPrefixData);
      writeHarnessMarker(badPrefixRoot, badPrefixData);
      try {
        assert.throws(
          () => assertVerifiedHarnessPaths(badPrefixRoot, badPrefixData),
          /disposable root prefix mismatch/,
        );
      } finally {
        rmSync(badPrefixRoot, { recursive: true, force: true });
      }
    });

    // Direct assertNoSymlink rejects existing symlink paths (lstat, not follow).
    const linkParent = mkdtempSync(join(tmpdir(), `${OPS_PILOT_HARNESS_ROOT_PREFIX}symlink-`));
    const realTarget = mkdtempSync(join(tmpdir(), `${OPS_PILOT_HARNESS_ROOT_PREFIX}target-`));
    const realData = join(realTarget, 'data');
    mkdirSync(realData);
    const rootLink = join(linkParent, 'root-link');
    const dataLink = join(linkParent, 'data-link');
    try {
      symlinkSync(realTarget, rootLink);
      symlinkSync(realData, dataLink);
      assert.throws(() => assertNoSymlink(rootLink), /symlink refused/);
      assert.throws(() => assertNoSymlink(dataLink), /symlink refused/);
    } finally {
      rmSync(linkParent, { recursive: true, force: true });
      rmSync(realTarget, { recursive: true, force: true });
    }

    // Symlinked dataDir that resolves outside the disposable root is rejected.
    withIsolatedDisposableFixture((root, dataDir) => {
      writeHarnessMarker(root, dataDir);
      const outside = mkdtempSync(join(tmpdir(), 'outside-not-disposable-'));
      const escapeLink = join(root, 'escape-link');
      try {
        symlinkSync(outside, escapeLink);
        assert.throws(() => assertNoSymlink(escapeLink), /symlink refused/);
        assert.throws(
          () => assertVerifiedHarnessPaths(root, escapeLink),
          /path escapes disposable root|symlink refused/,
        );
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  it('19) owned-controller dataDir binding for default pg_ctl helpers without real postgres', async () => {
    const clock = makeClock();
    const ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock });
    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket,
      clock,
      spawnSyncFn: inertSpawner().spawnSyncFn,
      inspectFn: () => ({ status: POSTMASTER_STATUS.STOPPED, reason: 'inert' }),
      stopFn: () => ({ status: 0 }),
    }, { NODE_ENV: 'test' });
    assert.equal(isOwnedDisposableOpsPilotClusterController(controller), true);
    const prepared = await controller.prepare();
    assert.equal(prepared.ok, true);
    const { root, dataDir } = controller.getPaths();
    assert.ok(root && dataDir);

    // Remove FS so default inspect cannot reach real pg_ctl after ownership passes.
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(dataDir), false);

    const positive = inspectPostmasterStatus(dataDir, { ownedController: controller });
    assert.equal(positive.status, POSTMASTER_STATUS.STOPPED);
    assert.equal(positive.reason, 'dataDir_absent');
    assert.notEqual(positive.blocked, true);
    assert.equal(positive.decision, undefined);

    const mismatch = inspectPostmasterStatus('/tmp/tecp-ops-pilot-s2-foreign/data', {
      ownedController: controller,
    });
    assert.equal(mismatch.blocked, true);
    assert.equal(
      mismatch.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );

    const stopMismatch = stopClusterAndProveTerminated('/tmp/tecp-ops-pilot-s2-foreign/data', {
      ownedController: controller,
    });
    assert.equal(stopMismatch.blocked, true);
    assert.equal(stopMismatch.terminated, false);
    assert.equal(
      stopMismatch.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );

    const fakeController = { kind: 'DISPOSABLE_OPS_PILOT_CLUSTER_CONTROLLER' };
    const unowned = inspectPostmasterStatus(dataDir, { ownedController: fakeController });
    assert.equal(unowned.blocked, true);
    assert.equal(
      unowned.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );
    const unownedStop = stopClusterAndProveTerminated(dataDir, { ownedController: fakeController });
    assert.equal(unownedStop.blocked, true);
    assert.equal(
      unownedStop.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );

    const alienRoot = mkdtempSync(join(tmpdir(), `${OPS_PILOT_HARNESS_ROOT_PREFIX}alien-`));
    const linkParent = mkdtempSync(join(tmpdir(), `${OPS_PILOT_HARNESS_ROOT_PREFIX}subst-`));
    const substituted = join(linkParent, 'data');
    try {
      symlinkSync(alienRoot, substituted);
      const substStatus = inspectPostmasterStatus(substituted, { ownedController: controller });
      assert.equal(substStatus.blocked, true);
      assert.equal(
        substStatus.decision,
        OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
      );
      const substStop = stopClusterAndProveTerminated(substituted, { ownedController: controller });
      assert.equal(substStop.blocked, true);
      assert.equal(
        substStop.decision,
        OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
      );
    } finally {
      rmSync(linkParent, { recursive: true, force: true });
      rmSync(alienRoot, { recursive: true, force: true });
    }

    const clock2 = makeClock();
    const ticket2 = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock: clock2 });
    const other = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket2,
      clock: clock2,
      inspectFn: () => ({ status: POSTMASTER_STATUS.STOPPED, reason: 'inert' }),
      stopFn: () => ({ status: 0 }),
    }, { NODE_ENV: 'test' });
    const otherPrepared = await other.prepare();
    assert.equal(otherPrepared.ok, true);
    const otherPaths = other.getPaths();
    const cross = inspectPostmasterStatus(dataDir, { ownedController: other });
    assert.equal(cross.blocked, true);
    assert.equal(
      cross.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
    );
    assert.notEqual(resolve(otherPaths.dataDir), resolve(dataDir));

    // Legitimate cleanup after one-shot consumption must still succeed with owned controller.
    const clock3 = makeClock();
    const ticket3 = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
    }, { clock: clock3 });
    const spawner = inertSpawner();
    const liveCycle = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: ticket3,
      clock: clock3,
      spawnSyncFn: spawner.spawnSyncFn.bind(spawner),
      inspectFn: () => ({ status: POSTMASTER_STATUS.STOPPED, reason: 'inert' }),
      stopFn: () => ({ status: 0 }),
    }, { NODE_ENV: 'test' });
    await liveCycle.prepare();
    const started = await liveCycle.start();
    assert.equal(started.ok, true);
    assert.equal(isActiveOwnerOneShotTicket(ticket3, clock3), false);
    const cleaned = await liveCycle.cleanup();
    assert.equal(cleaned.ok, true);
    assert.ok([
      'CLEANUP_SAFE_DELETE',
      'ALREADY_CLEANED',
    ].includes(cleaned.reasons?.[0]) || cleaned.decision === OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE);

    await other.cleanup();
    // External deletion of controller root without marker must fail closed (no silent cleanup).
    const cleanedPrimary = await controller.cleanup();
    assert.equal(cleanedPrimary.ok, false);
    assert.ok([
      OPS_PILOT_HARNESS_DECISIONS.DENY_PATH_ESCAPE,
      OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP,
    ].includes(cleanedPrimary.decision));
  });

  it('20) final execution readiness remains DENY with external Owner-trust blockers', () => {
    const denied = evaluateTier3FinalExecutionReadiness({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      ownerControlledLocalRunnerInvocation: true,
      fiveFileOfflineIntegrationComplete: true,
    }, {
      argv: [
        process.execPath,
        OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
        ...OPS_PILOT_APPROVED_TEST_ACTIONS,
      ],
      execPath: process.execPath,
      getuid: () => process.getuid(),
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.allowed, false);
    assert.equal(
      denied.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_FINAL_EXECUTION_NOT_READY,
    );
    assert.equal(
      denied.verdict,
      TIER3_READINESS_VERDICTS.OFFLINE_INTEGRATION_COMPLETE_EXTERNAL_TRUST_BLOCKED,
    );
    assert.equal(
      denied.ownerInvocationBoundary,
      'OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
    );
    assert.equal(denied.liveDbGate.closed, true);
    assert.equal(denied.executionContract.executableLaunchCommand, null);
    assert.equal(denied.postgresActions, 0);
    assert.equal(TIER3_REQUIRED_ADDITIONAL_PATHS.length, 0);
    assert.ok(TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS.length >= 3);
    assert.equal(
      evaluateIndependentOwnerCapability(null).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_INDEPENDENT_OWNER_CAPABILITY_MISSING,
    );
    assert.equal(
      evaluateIndependentOwnerCapability({ fake: true }).decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE,
    );

    const spoof = evaluateTier3FinalExecutionReadiness({
      claimReadyDespiteTrustGaps: true,
      ownerAuthorizedByBoolean: true,
    });
    assert.equal(spoof.ok, false);
    assert.equal(spoof.verdict, TIER3_READINESS_VERDICTS.SECURITY_BLOCKED);

    const argvOnly = evaluateOwnerControlledLocalRunnerEvidence({
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      approvedActions: [...OPS_PILOT_APPROVED_TEST_ACTIONS],
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
    }, {
      argv: [
        process.execPath,
        OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
        ...OPS_PILOT_APPROVED_TEST_ACTIONS,
      ],
      execPath: process.execPath,
    });
    assert.equal(
      argvOnly.decision,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ARGV_ONLY_AUTHORIZATION,
    );
  });

  it('21) Owner runner defaults DENY; offline inert suite routing works without PG', async () => {
    assert.deepEqual(getRunnerImportSideEffectsReport(), {
      filesystemActions: 0,
      processSpawnActions: 0,
      databaseActions: 0,
      networkActions: 0,
      postgresActions: 0,
    });
    assert.equal(isDirectCliEntrypoint(['node', '/tmp/not-the-runner.js']), false);

    const defaultDeny = await invokeOwnerControlledTier3LocalRunner({
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
    }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
    assert.equal(defaultDeny.ok, false);
    assert.equal(
      defaultDeny.decision,
      OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE,
    );
    assert.equal(defaultDeny.postgresActions, 0);

    const argvOnly = await invokeOwnerControlledTier3LocalRunner({
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      treatArgvAsOwnerAuth: true,
    }, {
      argv: [process.execPath, OPS_PILOT_OWNER_RUNNER_ARGV_MARKER, OPS_PILOT_APPROVED_TEST_ACTIONS[0]],
      execPath: process.execPath,
      env: { NODE_ENV: 'test' },
    });
    assert.equal(argvOnly.decision, OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV);

    const envOnly = await invokeOwnerControlledTier3LocalRunner({
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      envAuthorized: true,
    }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
    assert.equal(envOnly.decision, OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV);

    const wrongSha = await invokeOwnerControlledTier3LocalRunner({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: '0'.repeat(40),
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      spawnSyncFn: inertSpawner().spawnSyncFn,
    }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
    assert.equal(wrongSha.decision, OWNER_RUNNER_DECISIONS.DENY_WRONG_REPOSITORY_SHA);

    const wrongExec = await invokeOwnerControlledTier3LocalRunner({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: '/tmp/not-node',
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      spawnSyncFn: inertSpawner().spawnSyncFn,
    }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
    assert.equal(wrongExec.decision, OWNER_RUNNER_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY);

    const wrongPrincipal = await invokeOwnerControlledTier3LocalRunner({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      executionPrincipal: 999999,
      affirmSameUidLimitationsAccepted: true,
      spawnSyncFn: inertSpawner().spawnSyncFn,
    }, {
      execPath: process.execPath,
      getuid: () => 1,
      env: { NODE_ENV: 'test' },
    });
    assert.equal(wrongPrincipal.decision, OWNER_RUNNER_DECISIONS.DENY_WRONG_EXECUTION_PRINCIPAL);

    const unapproved = await invokeOwnerControlledTier3LocalRunner({
      suitePath: 'tecp-ops-persistence/test/notApproved.test.js',
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
    }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
    assert.equal(unapproved.decision, OWNER_RUNNER_DECISIONS.DENY_UNAPPROVED_SUITE);

    const externalDb = await invokeOwnerControlledTier3LocalRunner({
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      databaseUrl: 'postgres://example',
    }, { env: { NODE_ENV: 'test' } });
    assert.equal(externalDb.decision, OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET);

    const liveDenied = await invokeOwnerControlledTier3LocalRunner({
      mode: 'LIVE_DISPOSABLE',
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      authorizeLivePostgresSpawn: true,
    }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
    assert.equal(
      liveDenied.decision,
      OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE,
    );
    assert.equal(liveDenied.postgresActions, 0);

    const clock = makeClock();
    const ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
      approvedActions: [OPS_PILOT_APPROVED_TEST_ACTIONS[0]],
    }, { clock });
    cancelOwnerOneShotTicket(ticket, clock);
    const cancelled = await invokeOwnerControlledTier3LocalRunner({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[0],
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      executablePath: process.execPath,
      harnessModulePath: HARNESS_SRC,
      affirmSameUidLimitationsAccepted: true,
      ownerOneShotTicket: ticket,
      spawnSyncFn: inertSpawner().spawnSyncFn,
    }, { execPath: process.execPath, clock, env: { NODE_ENV: 'test' } });
    assert.equal(cancelled.ok, false);
    assert.ok([
      OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST,
      OWNER_RUNNER_DECISIONS.DENY_ONESHOT_REPLAY,
      OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED,
    ].includes(cancelled.decision) || (cancelled.evidence?.failure != null));

    for (const suitePath of OPS_PILOT_APPROVED_TEST_ACTIONS) {
      const routed = await invokeOwnerControlledTier3LocalRunner({
        mode: 'OFFLINE_INERT_ORCHESTRATION',
        suitePath,
        repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
        executablePath: process.execPath,
        harnessModulePath: HARNESS_SRC,
        affirmSameUidLimitationsAccepted: true,
        spawnSyncFn: inertSpawner().spawnSyncFn,
        inspectFn: () => ({ status: POSTMASTER_STATUS.STOPPED, reason: 'inert' }),
        stopFn: () => ({ status: 0 }),
      }, { execPath: process.execPath, env: { NODE_ENV: 'test' } });
      assert.equal(routed.ok, true, `${suitePath}:${routed.decision}`);
      assert.equal(routed.decision, OWNER_RUNNER_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION);
      assert.equal(routed.postgresActions, 0);
      assert.equal(routed.suiteResult.sqlExecuted, false);
    }

    assert.equal(assertApprovedSuiteAllowlist(OPS_PILOT_APPROVED_TEST_ACTIONS[0]).ok, true);
    const grant = createRunnerOfflineSuiteGrantForTests({
      proofClass: 'TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT',
      suitePath: OPS_PILOT_APPROVED_TEST_ACTIONS[1],
    });
    assert.equal(isRunnerOfflineSuiteGrant(grant), true);
  });
});
