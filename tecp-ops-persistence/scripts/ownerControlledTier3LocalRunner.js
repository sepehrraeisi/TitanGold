/**
 * TECP-OPS-PILOT-001 S2 — Owner-controlled Tier-3 local runner entrypoint.
 *
 * Default: HARD DENY. Import causes zero filesystem / spawn / database side effects.
 * ARGV, env, caller booleans, process UID, and WeakSet/WeakMap membership are NOT
 * independent Owner authentication. This script is not a trusted credential authority.
 *
 * Live PostgreSQL remains closed while OPS_PILOT_DB_EXECUTION_AUTHORIZED=false and
 * while no out-of-process independent Owner capability is installed.
 */

import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';

import {
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_DEFAULT_ONESHOT_TTL_MS,
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_MAX_ONESHOT_TTL_MS,
  OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
  OPS_PILOT_OWNER_RUNNER_RELATIVE_PATH,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_TIER3_AUTHORIZED,
  TIER3_FINAL_EXECUTION_CONTRACT,
  TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
  assertApprovedSuiteAllowlist,
  cancelOwnerOneShotTicket,
  createDisposableOpsPilotClusterController,
  createInertOfflineOneShotTicketForTests,
  createRunnerOfflineSuiteGrantForTests,
  evaluateIndependentOwnerCapability,
  evaluateOwnerControlledLocalRunnerEvidence,
  isInertOfflineOneShotTicket,
  isOwnedDisposableOpsPilotClusterController,
  isOwnerOneShotTicket,
} from '../src/disposableOpsPilotDbHarness.js';

export const OWNER_RUNNER_MODE = 'OWNER_CONTROLLED_TIER3_LOCAL_RUNNER_DEFAULT_DENY';
export const OWNER_RUNNER_RELATIVE_PATH = OPS_PILOT_OWNER_RUNNER_RELATIVE_PATH;

export const OWNER_RUNNER_DECISIONS = Object.freeze({
  DENY_DEFAULT: 'DENY_DEFAULT',
  DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE:
    'DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
  DENY_CALLER_BOOLEAN_OR_ENV: 'DENY_CALLER_BOOLEAN_OR_ENV',
  DENY_WRONG_REPOSITORY_SHA: 'DENY_WRONG_REPOSITORY_SHA',
  DENY_WRONG_EXECUTABLE_IDENTITY: 'DENY_WRONG_EXECUTABLE_IDENTITY',
  DENY_WRONG_EXECUTION_PRINCIPAL: 'DENY_WRONG_EXECUTION_PRINCIPAL',
  DENY_UNAPPROVED_SUITE: 'DENY_UNAPPROVED_SUITE',
  DENY_LIVE_DB_GATE_CLOSED: 'DENY_LIVE_DB_GATE_CLOSED',
  DENY_EXTERNAL_DB_TARGET: 'DENY_EXTERNAL_DB_TARGET',
  DENY_ONESHOT_REPLAY: 'DENY_ONESHOT_REPLAY',
  DENY_INVALID_REQUEST: 'DENY_INVALID_REQUEST',
  ALLOW_OFFLINE_SUITE_ORCHESTRATION: 'ALLOW_OFFLINE_SUITE_ORCHESTRATION',
});

const RUNNER_MODULE_PATH = fileURLToPath(import.meta.url);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    postgresActions: 0,
    dbActions: 0,
    workerActions: 0,
    mcpMutations: 0,
    operationalDispatchActions: 0,
    productionActions: 0,
    ownerAuthenticationProven: false,
    ownerInvocationIndependentlyVerifiable: false,
    liveDbExecutionAuthorized: false,
    ...extra,
  });
}

function evidenceEnvelope(parts = {}) {
  return Object.freeze({
    authorization: parts.authorization || null,
    start: parts.start || null,
    stop: parts.stop || null,
    cleanup: parts.cleanup || null,
    failure: parts.failure || null,
    suite: parts.suite || null,
  });
}

/**
 * Import-time side-effect attestation for offline QA.
 * Must remain all-zero unless this module is executed as a CLI entrypoint.
 */
export function getRunnerImportSideEffectsReport() {
  return Object.freeze({
    filesystemActions: 0,
    processSpawnActions: 0,
    databaseActions: 0,
    networkActions: 0,
    postgresActions: 0,
  });
}

function rejectExternalDbTargets(request = {}, env = process.env) {
  if (request.connectionString || request.databaseUrl || request.DATABASE_URL) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['CALLER_DATABASE_URL_FORBIDDEN']);
  }
  if (request.host || request.pgHost || request.PGHOST) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['CALLER_PGHOST_FORBIDDEN']);
  }
  if (request.port || request.pgPort || request.PGPORT) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['CALLER_PGPORT_FORBIDDEN']);
  }
  if (request.pgService || request.PGSERVICE) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['CALLER_PGSERVICE_FORBIDDEN']);
  }
  if (request.pgBinDir || request.initdbBin || request.pgCtlBin || request.postgresBin) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['CALLER_DEFINED_BINARIES_FORBIDDEN']);
  }
  if (env?.DATABASE_URL || env?.PGHOST || env?.PGPORT || env?.PGSERVICE || env?.PGUSER) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['ENV_PG_TARGET_FORBIDDEN']);
  }
  return null;
}

async function loadSuiteExecutor(suitePath) {
  if (suitePath === OPS_PILOT_APPROVED_TEST_ACTIONS[0]) {
    return import('../test/cp2DbFencingDurability.test.js');
  }
  if (suitePath === OPS_PILOT_APPROVED_TEST_ACTIONS[1]) {
    return import('../test/cp2DbDispatcherIntegration.test.js');
  }
  return null;
}

/**
 * Programmatic Owner-controlled local runner invocation.
 * Never starts PostgreSQL without independent Owner capability + live gate.
 */
export async function invokeOwnerControlledTier3LocalRunner(request = {}, deps = {}) {
  if (!isPlainObject(request)) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, ['REQUEST_OBJECT_REQUIRED']);
  }

  const env = deps.env || process.env;
  const externalTargetDeny = rejectExternalDbTargets(request, env);
  if (externalTargetDeny) {
    return {
      ...externalTargetDeny,
      evidence: evidenceEnvelope({ failure: externalTargetDeny }),
    };
  }

  if (
    request.ownerAuthorizedByBoolean === true
    || request.envAuthorized === true
    || request.authorizeByUid === true
    || request.treatArgvAsOwnerAuth === true
  ) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV, [
        'BOOLEAN_ENV_UID_ARGV_NOT_OWNER_AUTHENTICATION',
      ]),
      evidence: evidenceEnvelope({
        failure: { decision: OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV },
      }),
    };
  }

  const suiteCheck = assertApprovedSuiteAllowlist(request.suitePath);
  if (!suiteCheck.ok) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_UNAPPROVED_SUITE, suiteCheck.reasons || []),
      evidence: evidenceEnvelope({ failure: suiteCheck }),
    };
  }

  // Do not inherit ambient node --test argv. Callers must supply explicit argv when
  // proving ARGV-marker context; otherwise construct a minimal runner argv.
  const execPath = deps.execPath || process.execPath;
  const argv = Array.isArray(deps.argv)
    ? deps.argv
    : [execPath, OPS_PILOT_OWNER_RUNNER_ARGV_MARKER, suiteCheck.suitePath];

  const structural = evaluateOwnerControlledLocalRunnerEvidence({
    repositorySha: request.repositorySha || OPS_PILOT_PINNED_MAIN_SHA,
    approvedActions: [suiteCheck.suitePath],
    executablePath: request.executablePath || execPath,
    harnessModulePath: request.harnessModulePath || resolve(
      dirname(RUNNER_MODULE_PATH),
      '../src/disposableOpsPilotDbHarness.js',
    ),
    executionPrincipal: request.executionPrincipal,
    affirmSameUidLimitationsAccepted: request.affirmSameUidLimitationsAccepted === true,
    ownerControlledLocalRunnerInvocation: true,
    authorizeLivePostgresSpawn: request.authorizeLivePostgresSpawn === true,
    ttlMs: request.ttlMs,
  }, {
    argv,
    execPath,
    getuid: deps.getuid || (() => process.getuid?.()),
  });

  if (
    structural.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_REPOSITORY_SHA
  ) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_WRONG_REPOSITORY_SHA, structural.reasons || []),
      evidence: evidenceEnvelope({ authorization: structural, failure: structural }),
    };
  }
  if (
    structural.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY
  ) {
    const reasons = structural.reasons || [];
    const principalMismatch = reasons.includes('EXECUTION_PRINCIPAL_MISMATCH');
    return {
      ...deny(
        principalMismatch
          ? OWNER_RUNNER_DECISIONS.DENY_WRONG_EXECUTION_PRINCIPAL
          : OWNER_RUNNER_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY,
        reasons,
      ),
      evidence: evidenceEnvelope({ authorization: structural, failure: structural }),
    };
  }
  if (
    structural.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION
  ) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_UNAPPROVED_SUITE, structural.reasons || []),
      evidence: evidenceEnvelope({ authorization: structural, failure: structural }),
    };
  }

  const independent = evaluateIndependentOwnerCapability(
    request.independentOwnerCapability || null,
  );
  const wantsLive = request.mode === 'LIVE_DISPOSABLE'
    || request.authorizeLivePostgresSpawn === true;

  if (wantsLive) {
    if (!independent.ok || independent.ownerAuthenticationProven !== true) {
      return {
        ...deny(
          OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE,
          [
            'DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
            'LOCAL_RUNNER_IS_NOT_TRUSTED_CREDENTIAL_AUTHORITY',
            ...(independent.reasons || []),
          ],
        ),
        requiredExternalTrustComponents: TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
        evidence: evidenceEnvelope({
          authorization: Object.freeze({ structural, independent }),
          failure: independent,
        }),
      };
    }
    if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true || OPS_PILOT_TIER3_AUTHORIZED === true) {
      // Tier3 module const must remain false; DB execution must be explicitly true for live.
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_DB_GATE_CLOSED, [
          'OPS_PILOT_DB_EXECUTION_AUTHORIZED=false',
          'LIVE_SPAWN_FORBIDDEN_IN_THIS_PHASE',
        ]),
        evidence: evidenceEnvelope({
          authorization: Object.freeze({ structural, independent }),
        }),
      };
    }
  }

  // Default and LIVE without proven capability: fail closed.
  if (request.mode !== 'OFFLINE_INERT_ORCHESTRATION') {
    return {
      ...deny(
        OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE,
        [
          'DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
          'DEFAULT_DENY',
          'OFFLINE_INERT_ORCHESTRATION_MODE_REQUIRED_FOR_TEST_ROUTING',
          ...(independent.reasons || []),
        ],
      ),
      requiredExternalTrustComponents: TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
      executionContract: TIER3_FINAL_EXECUTION_CONTRACT,
      evidence: evidenceEnvelope({
        authorization: Object.freeze({ structural, independent }),
        failure: { decision: OWNER_RUNNER_DECISIONS.DENY_DEFAULT },
      }),
    };
  }

  // OFFLINE_INERT_ORCHESTRATION: route suite wiring with inert fakes only.
  const clock = deps.clock || {};
  const ttlMs = Number(request.ttlMs ?? OPS_PILOT_DEFAULT_ONESHOT_TTL_MS);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > OPS_PILOT_MAX_ONESHOT_TTL_MS) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, ['TTL_OUT_OF_BOUNDS']);
  }

  let ticket = request.ownerOneShotTicket;
  if (ticket != null && !isInertOfflineOneShotTicket(ticket)) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_ONESHOT_REPLAY, [
        'NON_INERT_TICKET_FORBIDDEN_FOR_OFFLINE_ORCHESTRATION',
      ]),
      evidence: evidenceEnvelope({ failure: { ticketClass: 'NON_INERT' } }),
    };
  }
  if (ticket == null) {
    ticket = createInertOfflineOneShotTicketForTests({
      proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
      explicitNonProd: true,
      approvedActions: [suiteCheck.suitePath],
      ttlMs,
    }, { clock });
  }

  if (request.cancelBeforeRun === true) {
    cancelOwnerOneShotTicket(ticket, clock);
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_ONESHOT_REPLAY, ['TICKET_CANCELLED_BEFORE_RUN']),
      evidence: evidenceEnvelope({ failure: { cancelled: true } }),
    };
  }

  const spawnSyncFn = typeof request.spawnSyncFn === 'function'
    ? request.spawnSyncFn
    : (typeof deps.spawnSyncFn === 'function' ? deps.spawnSyncFn : null);
  if (!spawnSyncFn) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
        'INERT_SPAWN_REQUIRED_FOR_OFFLINE_ORCHESTRATION',
        'REAL_PG_BINARIES_FORBIDDEN_IN_THIS_PHASE',
      ]),
      evidence: evidenceEnvelope({ failure: { missingInertSpawn: true } }),
    };
  }

  const controller = createDisposableOpsPilotClusterController({
    explicitNonProd: true,
    ownerOneShotTicket: ticket,
    clock,
    spawnSyncFn,
    inspectFn: request.inspectFn || deps.inspectFn || (() => ({
      status: 'STOPPED',
      reason: 'inert_offline',
    })),
    stopFn: request.stopFn || deps.stopFn || (() => ({ status: 0 })),
  }, { NODE_ENV: 'test', ...(env || {}) });

  if (!isOwnedDisposableOpsPilotClusterController(controller)) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
        'OWNED_CONTROLLER_CREATE_FAILED',
        controller?.decision || 'UNKNOWN',
      ]),
      evidence: evidenceEnvelope({ failure: controller }),
    };
  }

  const prepared = await controller.prepare();
  if (!prepared.ok) {
    await controller.cleanup();
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, prepared.reasons || ['PREPARE_FAILED']),
      evidence: evidenceEnvelope({ start: prepared, failure: prepared }),
    };
  }

  const started = await controller.start();
  if (!started.ok) {
    const cleaned = await controller.cleanup();
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_ONESHOT_REPLAY, started.reasons || ['START_DENIED']),
      evidence: evidenceEnvelope({ start: started, cleanup: cleaned, failure: started }),
      postgresActions: started.postgresActions || 0,
    };
  }

  const grant = createRunnerOfflineSuiteGrantForTests({
    proofClass: 'TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT',
    suitePath: suiteCheck.suitePath,
  });

  const suiteModule = await loadSuiteExecutor(suiteCheck.suitePath);
  if (!suiteModule || typeof suiteModule.executeTier3SuiteViaRunnerContract !== 'function') {
    const stopped = await controller.stop();
    const cleaned = await controller.cleanup();
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
        'SUITE_EXECUTOR_MISSING',
        suiteCheck.suitePath,
      ]),
      evidence: evidenceEnvelope({
        start: started,
        stop: stopped,
        cleanup: cleaned,
        failure: { suiteExecutorMissing: true },
      }),
    };
  }

  const inertClient = request.inertClient || {
    kind: 'OFFLINE_INERT_DISPOSABLE_CLIENT',
    async query() {
      return { rows: [], rowCount: 0, command: 'SELECT' };
    },
  };

  let suiteResult;
  try {
    suiteResult = await suiteModule.executeTier3SuiteViaRunnerContract({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      runnerOfflineSuiteGrant: grant,
      clusterClient: inertClient,
      ownedController: controller,
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
      suitePath: suiteCheck.suitePath,
    });
  } catch (error) {
    suiteResult = deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
      'SUITE_ORCHESTRATION_THREW',
      error.message || String(error),
    ]);
  }

  const stopped = await controller.stop();
  const cleaned = await controller.cleanup();

  return Object.freeze({
    ok: suiteResult?.ok === true,
    allowed: suiteResult?.ok === true,
    decision: suiteResult?.ok === true
      ? OWNER_RUNNER_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION
      : (suiteResult?.decision || OWNER_RUNNER_DECISIONS.DENY_DEFAULT),
    reasons: Object.freeze([
      'OFFLINE_INERT_ORCHESTRATION_ONLY',
      'NOT_LIVE_POSTGRES_DURABILITY_PROOF',
      ...(suiteResult?.reasons || []),
    ]),
    suitePath: suiteCheck.suitePath,
    suiteResult,
    postgresActions: 0,
    dbActions: 0,
    workerActions: 0,
    mcpMutations: 0,
    operationalDispatchActions: 0,
    productionActions: 0,
    ownerAuthenticationProven: false,
    ownerInvocationIndependentlyVerifiable: false,
    liveDbExecutionAuthorized: false,
    evidence: evidenceEnvelope({
      authorization: Object.freeze({ structural, independent }),
      start: started,
      stop: stopped,
      cleanup: cleaned,
      suite: suiteResult,
    }),
  });
}

export function isOwnerControlledTier3LocalRunnerModule(metaUrl = import.meta.url) {
  try {
    return basename(fileURLToPath(metaUrl)) === 'ownerControlledTier3LocalRunner.js';
  } catch {
    return false;
  }
}

export async function runOwnerControlledTier3LocalRunnerCli(argv = process.argv, deps = {}) {
  const suiteArg = argv.find((a) => String(a).endsWith('.test.js'))
    || OPS_PILOT_APPROVED_TEST_ACTIONS[0];
  const result = await invokeOwnerControlledTier3LocalRunner({
    mode: 'DEFAULT_DENY',
    suitePath: suiteArg,
    repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    executablePath: deps.execPath || process.execPath,
    affirmSameUidLimitationsAccepted: true,
  }, { argv, ...deps });
  return result;
}

/**
 * Direct CLI entry. Only runs when this file is the process entrypoint.
 * Still defaults to DENY (no live PostgreSQL).
 */
export function isDirectCliEntrypoint(argv = process.argv, metaUrl = import.meta.url) {
  if (!Array.isArray(argv) || argv.length < 2) return false;
  try {
    return resolve(fileURLToPath(metaUrl)) === resolve(String(argv[1]));
  } catch {
    return false;
  }
}

const __autoCli = isDirectCliEntrypoint();
if (__autoCli) {
  runOwnerControlledTier3LocalRunnerCli(process.argv).then((result) => {
    // Structured evidence only — never spawn PostgreSQL from default CLI.
    process.stdout.write(`${JSON.stringify({
      ok: result.ok,
      decision: result.decision,
      reasons: result.reasons,
      postgresActions: result.postgresActions,
      ownerInvocationIndependentlyVerifiable: result.ownerInvocationIndependentlyVerifiable,
    })}\n`);
    process.exitCode = result.ok ? 0 : 1;
  }).catch((error) => {
    process.stderr.write(`${String(error && error.stack ? error.stack : error)}\n`);
    process.exitCode = 2;
  });
}
