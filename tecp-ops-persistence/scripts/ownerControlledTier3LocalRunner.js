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
  OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
  OPS_PILOT_LIVE_VENUE,
  OPS_PILOT_MAX_ONESHOT_TTL_MS,
  OPS_PILOT_OWNER_RUNNER_ARGV_MARKER,
  OPS_PILOT_OWNER_RUNNER_RELATIVE_PATH,
  OPS_PILOT_PINNED_MAIN_SHA,
  OPS_PILOT_TIER3_AUTHORIZED,
  TIER3_FINAL_EXECUTION_CONTRACT,
  TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
  assertApprovedSuiteAllowlist,
  brandVerifiedIndependentOwnerCapability,
  cancelOwnerOneShotTicket,
  createDisposableOpsPilotClusterController,
  createInertOfflineOneShotTicketForTests,
  createLiveCapabilityGatedOneShotTicket,
  createLiveSuiteExecutionAuthority,
  LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS,
  isOwnedClusterClient,
  endOwnedClusterClient,
  isValidatedSuccessfulOwnedClientEnd,
  endAllOwnedClusterClients,
  listRegisteredOwnedClients,
  getOwnedClientAccounting,
  createRunnerOfflineSuiteGrantForTests,
  evaluateIndependentOwnerCapability,
  evaluateLiveRepositoryHeadBinding,
  evaluateLiveSpawnAuthorizationFromOwnerCapability,
  evaluateOwnerControlledLocalRunnerEvidence,
  isInertOfflineOneShotTicket,
  isOwnedDisposableOpsPilotClusterController,
  isOwnerOneShotTicket,
  isTestOnlyGitHeadObservationFixture,
  observeCanonicalRepositoryHeadSha,
} from '../src/disposableOpsPilotDbHarness.js';
import {
  applyDisposableOpsPilotSchemaBootstrap,
} from '../src/disposableOpsPilotSchemaBootstrap.js';
import {
  S2_OWNER_CAPABILITY_PURPOSE_SIMIN,
  S2_OWNER_CAPABILITY_VENUE_SIMIN,
  S2_TIER3_OWNER_CAPABILITY_DECISIONS,
  createOwnerInstalledFixedTrustVerifierDeps,
  evaluateVerifiedCapabilityLiveSpawnEligibility,
  getVerifierIssuedCapabilityTrustClass,
  isOwnerInstalledFixedTrustVerifierDeps,
  isTestOnlyS2Tier3OwnerCapabilityVerifierDeps,
  isVerifierIssuedCapabilityProvenance,
  verifierIssuedCapabilityAuthorizesLiveSubprocess,
  verifyS2Tier3OwnerCapabilityArtifact,
} from './s2Tier3OwnerCapabilityVerifier.js';

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
  DENY_STOP_OR_CLEANUP_FAILED: 'DENY_STOP_OR_CLEANUP_FAILED',
  DENY_STOP_FAILED: 'DENY_STOP_FAILED',
  DENY_CLEANUP_FAILED: 'DENY_CLEANUP_FAILED',
  DENY_SUITE_ACCEPTANCE_FAILED: 'DENY_SUITE_ACCEPTANCE_FAILED',
  DENY_CAPABILITY_REPLAY: 'DENY_CAPABILITY_REPLAY',
  DENY_CAPABILITY_REPLAY_STORAGE: 'DENY_CAPABILITY_REPLAY_STORAGE',
  DENY_MULTI_FAILURE: 'DENY_MULTI_FAILURE',
  DENY_CLIENT_CLOSE_FAILED: 'DENY_CLIENT_CLOSE_FAILED',
  DENY_VERIFIER_TRUST_MISSING: 'DENY_VERIFIER_TRUST_MISSING',
  DENY_CALLER_CUSTODY_BOOLEAN_NOT_PROOF: 'DENY_CALLER_CUSTODY_BOOLEAN_NOT_PROOF',
  DENY_LIVE_SHA_BINDING: 'DENY_LIVE_SHA_BINDING',
  DENY_LIVE_VENUE_BINDING: 'DENY_LIVE_VENUE_BINDING',
  ALLOW_OFFLINE_SUITE_ORCHESTRATION: 'ALLOW_OFFLINE_SUITE_ORCHESTRATION',
  ALLOW_LIVE_CAPABILITY_AUTHORIZATION: 'ALLOW_LIVE_CAPABILITY_AUTHORIZATION',
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


/**
 * Explicit validated successful lifecycle result.
 * Missing/null/undefined/malformed => not successful (fail closed).
 */
function isValidatedSuccessfulLifecycleResult(result) {
  if (result == null || typeof result !== 'object' || Array.isArray(result)) {
    return false;
  }
  if (result.ok !== true) {
    return false;
  }
  if (result.decision == null || typeof result.decision !== 'string') {
    return false;
  }
  if (!Array.isArray(result.reasons)) {
    return false;
  }
  return true;
}

/**
 * Live overall PASS requires verified owned-client disconnect evidence.
 * Failed/thrown/missing/unverified closes cannot yield LIVE_S2_PASS.
 */

/**
 * Map capability verifier denial to a distinct Runner decision.
 * Replay/storage denials must remain distinguishable from generic verify failure.
 */
/**
 * Shared canonical pre-start capability authorization boundary.
 * Used by the live Runner before any DB controller start.
 * Returns dbControllerStartPermitted=false on denial; callers must not start PostgreSQL.
 */
export function verifyLiveOwnerCapabilityForRunner(capabilityToken, expectation, trustedVerifierDeps) {
  let capabilityVerified;
  try {
    capabilityVerified = verifyS2Tier3OwnerCapabilityArtifact(
      capabilityToken,
      expectation,
      trustedVerifierDeps,
    );
  } catch (err) {
    capabilityVerified = {
      ok: false,
      decision: S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE,
      reasons: Object.freeze(['VERIFY_THREW', String(err.message || err)]),
    };
  }
  if (trustedVerifierDeps && trustedVerifierDeps.ok === false
    && trustedVerifierDeps.decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE) {
    return Object.freeze({
      ok: false,
      decision: OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE,
      capabilityVerified: trustedVerifierDeps,
      dbControllerStartPermitted: false,
      startInvocationCount: 0,
      reasons: Object.freeze([
        'OWNER_INSTALLED_DEPS_REPLAY_STORAGE_FAILURE',
        ...(trustedVerifierDeps.reasons || []),
        'DB_CONTROLLER_START_NOT_REACHED',
      ]),
    });
  }
  if (!capabilityVerified || capabilityVerified.ok !== true) {
    const mapped = mapCapabilityVerifyFailureToRunnerDecision(capabilityVerified);
    return Object.freeze({
      ok: false,
      decision: mapped,
      capabilityVerified,
      dbControllerStartPermitted: false,
      startInvocationCount: 0,
      reasons: Object.freeze([
        'OWNER_CAPABILITY_VERIFY_FAILED',
        ...(capabilityVerified?.reasons || []),
        capabilityVerified?.decision,
        'DB_CONTROLLER_START_NOT_REACHED',
      ]),
    });
  }
  return Object.freeze({
    ok: true,
    decision: null,
    capabilityVerified,
    dbControllerStartPermitted: true,
    startInvocationCount: 0,
    reasons: Object.freeze([]),
  });
}

export function enforceLiveCapabilityPreStartGate(authResult, startDbController) {
  if (!authResult || authResult.ok !== true || authResult.dbControllerStartPermitted !== true) {
    return Object.freeze({
      ...authResult,
      started: false,
      startInvocationCount: 0,
      prepareInvocationCount: 0,
    });
  }
  if (typeof startDbController !== 'function') {
    return Object.freeze({
      ok: false,
      started: false,
      startInvocationCount: 0,
      prepareInvocationCount: 0,
      decision: OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST,
      reasons: Object.freeze(['START_CALLBACK_REQUIRED_WHEN_PERMITTED']),
    });
  }
  startDbController();
  return Object.freeze({
    ...authResult,
    started: true,
    startInvocationCount: 1,
    prepareInvocationCount: 0,
  });
}

export function mapCapabilityVerifyFailureToRunnerDecision(capabilityVerified = {}) {
  const decision = capabilityVerified?.decision;
  if (decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY) {
    return OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY;
  }
  if (decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE) {
    return OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE;
  }
  return OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE;
}

/**
 * Deterministic Runner outcome classification.
 * Preserves all material failure causes; selects a primary decision.
 */
export function classifyOwnerRunnerOutcome({
  suiteOk = false,
  stopValidated = false,
  cleanupValidated = false,
  clientEndValidated = true,
  suiteDecision = null,
  successDecision = OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION,
} = {}) {
  const suiteSucceeded = suiteOk === true;
  const stopOk = stopValidated === true;
  const cleanupOk = cleanupValidated === true;
  const clientOk = clientEndValidated === true;
  const failureCauses = [];
  if (!suiteSucceeded) failureCauses.push('SUITE_ACCEPTANCE_FAILED');
  if (!stopOk) failureCauses.push('STOP_FAILED');
  if (!cleanupOk) failureCauses.push('CLEANUP_FAILED');
  if (!clientOk) failureCauses.push('CLIENT_CLOSE_FAILED');

  const overallOk = suiteSucceeded && stopOk && cleanupOk && clientOk;
  if (overallOk) {
    return Object.freeze({
      ok: true,
      decision: successDecision,
      primaryFailure: null,
      failureCauses: Object.freeze([]),
      suiteOk: true,
      stopValidated: true,
      cleanupValidated: true,
      clientEndValidated: true,
    });
  }

  let decision;
  let primaryFailure;
  if (!clientOk) {
    decision = OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED;
    primaryFailure = 'CLIENT_CLOSE_FAILED';
  } else if (!stopOk && !cleanupOk && !suiteSucceeded) {
    decision = OWNER_RUNNER_DECISIONS.DENY_MULTI_FAILURE;
    primaryFailure = 'STOP_FAILED';
  } else if (!stopOk && !cleanupOk) {
    decision = OWNER_RUNNER_DECISIONS.DENY_STOP_OR_CLEANUP_FAILED;
    primaryFailure = 'STOP_FAILED';
  } else if (!stopOk) {
    decision = OWNER_RUNNER_DECISIONS.DENY_STOP_FAILED;
    primaryFailure = 'STOP_FAILED';
  } else if (!cleanupOk) {
    decision = OWNER_RUNNER_DECISIONS.DENY_CLEANUP_FAILED;
    primaryFailure = 'CLEANUP_FAILED';
  } else if (!suiteSucceeded) {
    decision = OWNER_RUNNER_DECISIONS.DENY_SUITE_ACCEPTANCE_FAILED;
    primaryFailure = 'SUITE_ACCEPTANCE_FAILED';
  } else {
    decision = OWNER_RUNNER_DECISIONS.DENY_DEFAULT;
    primaryFailure = 'UNKNOWN';
  }

  return Object.freeze({
    ok: false,
    decision,
    primaryFailure,
    failureCauses: Object.freeze(failureCauses),
    suiteOk: suiteSucceeded,
    stopValidated: stopOk,
    cleanupValidated: cleanupOk,
    clientEndValidated: clientOk,
    suiteDecision: suiteDecision || null,
  });
}

export function evaluateLiveExecuteClosureGate({
  suiteOk,
  stopValidated,
  cleanupValidated,
  clientEndResult,
  allClientsEndResult,
} = {}) {
  const registryEndValidated = allClientsEndResult?.ok === true
    && allClientsEndResult?.allVerifiedClosed === true;
  const clientEndValidated = registryEndValidated
    || isValidatedSuccessfulOwnedClientEnd(clientEndResult);
  const overallOk = suiteOk === true
    && stopValidated === true
    && cleanupValidated === true
    && clientEndValidated === true;
  return Object.freeze({
    overallOk,
    clientEndValidated,
    registryEndValidated,
    suiteOk: suiteOk === true,
    stopValidated: stopValidated === true,
    cleanupValidated: cleanupValidated === true,
  });
}

async function boundedEndStopCleanup(controller, client) {
  let clientEndResult = null;
  try {
    if (client != null) {
      clientEndResult = await endOwnedClusterClient(client);
    }
  } catch (error) {
    clientEndResult = deny(OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED, [
      'OWNED_CLIENT_END_THREW',
      error.message || String(error),
    ]);
  }
  let stopped = null;
  let cleaned = null;
  let stopError = null;
  let cleanupError = null;
  try { stopped = await controller.stop(); } catch (error) { stopError = error; stopped = null; }
  try { cleaned = await controller.cleanup(); } catch (error) { cleanupError = error; cleaned = null; }
  return Object.freeze({
    clientEndResult,
    stopped,
    cleaned,
    stopError,
    cleanupError,
    clientEndValidated: isValidatedSuccessfulOwnedClientEnd(clientEndResult),
    stopValidated: isValidatedSuccessfulLifecycleResult(stopped),
    cleanupValidated: isValidatedSuccessfulLifecycleResult(cleaned),
  });
}

function lifecycleStageEvidence(stage, result, error = null) {
  return Object.freeze({
    stage,
    validatedSuccessful: isValidatedSuccessfulLifecycleResult(result),
    result: result == null ? null : result,
    error: error == null ? null : String(error && error.message ? error.message : error),
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
  // Static import-time attestation only — NOT a measured runtime telemetry report.
  // Shape preserved for compatibility; do not treat zeros as measured runtime evidence.
  return Object.freeze({
    filesystemActions: 0,
    processSpawnActions: 0,
    databaseActions: 0,
    networkActions: 0,
    postgresActions: 0,
  });
}

/** Explicit meta: clarifies report() is attestation, not measured telemetry. */
export function getRunnerImportSideEffectsAttestationMeta() {
  return Object.freeze({
    kind: 'IMPORT_TIME_STATIC_ATTESTATION_NOT_MEASURED_RUNTIME_EVIDENCE',
    reportIsMeasuredRuntimeEvidence: false,
  });
}

function rejectExternalDbTargets(request = {}, env = process.env, deps = {}) {
  if (request.connectionString || request.databaseUrl || request.DATABASE_URL) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, ['CALLER_DATABASE_URL_FORBIDDEN']);
  }
  if (
    request.client != null
    || request.Client != null
    || request.clientConstructor != null
    || request.clusterClient != null
    || deps.client != null
    || deps.Client != null
    || deps.clientConstructor != null
    || deps.clusterClient != null
  ) {
    return deny(OWNER_RUNNER_DECISIONS.DENY_EXTERNAL_DB_TARGET, [
      'CALLER_CLIENT_OR_CONSTRUCTOR_FORBIDDEN',
      'OWNED_CONTROLLER_CLIENT_ONLY',
    ]);
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
  const externalTargetDeny = rejectExternalDbTargets(request, env, deps);
  if (externalTargetDeny) {
    return {
      ...externalTargetDeny,
      evidence: evidenceEnvelope({ failure: externalTargetDeny }),
    };
  }

  if (
    request.ownerCapabilityArtifact != null
    && typeof request.ownerCapabilityArtifact === 'object'
    && (
      request.ownerCapabilityArtifact.trustAnchor
      || request.ownerCapabilityArtifact.publicKey
      || request.ownerCapabilityArtifact.verifier
      || request.ownerCapabilityArtifact.verifyKey
    )
  ) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV, [
        'REQUEST_CARRIED_TRUST_ANCHOR_FORBIDDEN',
      ]),
      evidence: evidenceEnvelope({
        failure: { decision: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR' },
      }),
    };
  }
  if (request.ownerCapabilityTrustAnchor || request.ownerPublicKey || request.verifierPublicKey) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV, [
        'REQUEST_CARRIED_TRUST_ANCHOR_FORBIDDEN',
      ]),
      evidence: evidenceEnvelope({
        failure: { decision: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR' },
      }),
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

  const liveRequestHint = (
    request.mode === 'LIVE_CAPABILITY_GATED_AUTHORIZATION'
    || request.mode === 'LIVE_CAPABILITY_GATED_EXECUTE'
    || (typeof request.ownerCapabilityArtifact === 'string' && request.ownerCapabilityArtifact.length > 0)
  );
  // For live modes, structural SHA is filled after independent Git observation.
  // Do not treat request/deps SHA fields as authoritative here.
  const structural = evaluateOwnerControlledLocalRunnerEvidence({
    repositorySha: liveRequestHint
      ? '0000000000000000000000000000000000000000'
      : (request.repositorySha || OPS_PILOT_PINNED_MAIN_SHA),
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
    skipOfflinePinShaCheck: liveRequestHint === true,
    liveCapabilityShaBinding: liveRequestHint === true,
  }, {
    argv,
    execPath,
    getuid: deps.getuid || (() => process.getuid?.()),
  });

  if (
    structural.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_REPOSITORY_SHA
    || structural.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING
  ) {
    return {
      ...deny(
        structural.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING
          ? OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING
          : OWNER_RUNNER_DECISIONS.DENY_WRONG_REPOSITORY_SHA,
        structural.reasons || [],
      ),
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

  // Request-carried verifierDeps / trust anchors are never operational authority.
  if (request.verifierDeps != null
    || request.trustAnchor != null
    || request.publicKey != null
    || request.keyRegistry != null) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV, [
        'CALLER_SUPPLIED_VERIFIER_DEPS_FORBIDDEN',
        'REQUEST_TRUST_ANCHOR_FORBIDDEN',
      ]),
      evidence: evidenceEnvelope({
        failure: { decision: OWNER_RUNNER_DECISIONS.DENY_CALLER_BOOLEAN_OR_ENV },
      }),
    };
  }
  if (request.ownerCustodyProven === true || request.recoveryAdminProven === true) {
    return {
      ...deny(OWNER_RUNNER_DECISIONS.DENY_CALLER_CUSTODY_BOOLEAN_NOT_PROOF, [
        'REQUEST_OWNER_CUSTODY_BOOLEAN_NOT_PROOF',
        'REQUEST_RECOVERY_ADMIN_BOOLEAN_NOT_PROOF',
      ]),
      evidence: evidenceEnvelope({
        failure: { decision: OWNER_RUNNER_DECISIONS.DENY_CALLER_CUSTODY_BOOLEAN_NOT_PROOF },
      }),
    };
  }

  const capabilityToken = typeof request.ownerCapabilityArtifact === 'string'
    ? request.ownerCapabilityArtifact
    : null;

  const liveModes = new Set([
    'LIVE_CAPABILITY_GATED_AUTHORIZATION',
    'LIVE_CAPABILITY_GATED_EXECUTE',
  ]);
  const isLiveMode = liveModes.has(request.mode) || capabilityToken != null;

  let capabilityVerified = null;
  let liveAuthorization = null;
  let liveTicketResult = null;

  if (isLiveMode) {
    if (!capabilityToken) {
      return {
        ...deny(
          OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE,
          [
            'DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
            'LIVE_MODE_REQUIRES_OWNER_CAPABILITY_ARTIFACT',
          ],
        ),
        evidence: evidenceEnvelope({ failure: { missingCapability: true } }),
      };
    }

    const isExecuteMode = request.mode === 'LIVE_CAPABILITY_GATED_EXECUTE';

    // Never allow request/deps trustHome to redirect the Owner trust registry.
    if (deps.trustHome != null || request.trustHome != null) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
          'CALLER_TRUST_HOME_OVERRIDE_FORBIDDEN',
        ]),
        evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
      };
    }

    let trustedVerifierDeps = null;
    if (isExecuteMode) {
      // Production-capable LIVE execute: self-load fixed Owner registry only.
      // Reject injected deps, clocks, keys, and TEST_ONLY fixtures — branding alone is not authority.
      if (deps.trustedVerifierDeps != null) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
            'LIVE_EXECUTE_REJECTS_CALLER_INJECTED_TRUSTED_VERIFIER_DEPS',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
        };
      }
      if (deps.clock != null || deps.nowMs != null || request.clock != null || request.nowMs != null) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
            'LIVE_EXECUTE_REJECTS_CALLER_CLOCK_OR_NOWMS',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
        };
      }
      if (
        deps.publicKey != null || deps.kid != null || deps.keyRegistry != null
        || request.publicKey != null || request.kid != null
      ) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
            'LIVE_EXECUTE_REJECTS_CALLER_KEY_MATERIAL',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
        };
      }
      if (deps.testOnlyGitObservationFixture != null || request.testOnlyGitObservationFixture != null) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING, [
            'TEST_ONLY_GIT_FIXTURE_FORBIDDEN_IN_LIVE_EXECUTE',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING } }),
        };
      }

      // Offline wiring probe: inert spawn/client injection for contract tests only.
      // Never authorizes real SQL PASS. Real LIVE_EXECUTE forbids these deps.
      if (deps.offlineWiringProbe === true) {
        if (typeof deps.spawnSyncFn !== 'function' || typeof deps.inertClientFactory !== 'function') {
          return {
            ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
              'OFFLINE_WIRING_PROBE_REQUIRES_INERT_SPAWN_AND_CLIENT_FACTORY',
            ]),
            evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST } }),
          };
        }
      } else if (deps.spawnSyncFn != null || deps.inertClientFactory != null || deps.offlineWiringProbe != null) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
            'LIVE_EXECUTE_REJECTS_INERT_LIFECYCLE_INJECTION_WITHOUT_OFFLINE_WIRING_PROBE',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST } }),
        };
      }
      const installed = createOwnerInstalledFixedTrustVerifierDeps({});
      if (installed && installed.ok === false) {
        const storageFail = installed.decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE;
        return {
          ...deny(storageFail
            ? OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE
            : OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, installed.reasons || [
            'OWNER_TRUST_REGISTRY_MISSING',
          ]),
          evidence: evidenceEnvelope({ failure: installed }),
        };
      }
      if (!isOwnerInstalledFixedTrustVerifierDeps(installed)) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
            'LIVE_EXECUTE_REQUIRES_OWNER_INSTALLED_TRUST_REGISTRY',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
        };
      }
      trustedVerifierDeps = installed;
    } else {
      // Offline / authorization-only: Owner-installed fixed registry OR explicit branded TEST_ONLY deps.
      trustedVerifierDeps = deps.trustedVerifierDeps;
      if (trustedVerifierDeps == null) {
        const installed = createOwnerInstalledFixedTrustVerifierDeps({});
        if (installed && installed.ok === false) {
          const storageFail = installed.decision === S2_TIER3_OWNER_CAPABILITY_DECISIONS.DENY_REPLAY_STORAGE;
          return {
            ...deny(storageFail
              ? OWNER_RUNNER_DECISIONS.DENY_CAPABILITY_REPLAY_STORAGE
              : OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, installed.reasons || [
              'OWNER_TRUST_REGISTRY_MISSING',
            ]),
            evidence: evidenceEnvelope({ failure: installed }),
          };
        }
        trustedVerifierDeps = installed;
      } else if (
        !isTestOnlyS2Tier3OwnerCapabilityVerifierDeps(trustedVerifierDeps)
        && !isOwnerInstalledFixedTrustVerifierDeps(trustedVerifierDeps)
      ) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
            'TRUSTED_VERIFIER_DEPS_MUST_BE_BRANDED_TEST_ONLY_OR_OWNER_INSTALLED',
          ]),
          evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
        };
      }
    }

    // Independently observe Git HEAD. Request/deps SHA are never authoritative.
    const gitObservation = observeCanonicalRepositoryHeadSha({
      allowTestOnlyGitFixture: isExecuteMode !== true,
      testOnlyGitObservationFixture: isExecuteMode
        ? null
        : (isTestOnlyGitHeadObservationFixture(deps.testOnlyGitObservationFixture)
          ? deps.testOnlyGitObservationFixture
          : null),
    });
    if (!gitObservation.ok) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING, gitObservation.reasons || [
          'GIT_HEAD_OBSERVATION_FAILED',
        ]),
        evidence: evidenceEnvelope({ failure: gitObservation }),
      };
    }
    if (isExecuteMode && gitObservation.authorizesLiveExecute !== true) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING, [
          'LIVE_EXECUTE_REQUIRES_CANONICAL_GIT_OBSERVATION',
        ]),
        evidence: evidenceEnvelope({ failure: gitObservation }),
      };
    }
    const headSha = gitObservation.headSha;

    // Optional consistency checks: if caller supplied SHA fields, they must match observed HEAD.
    const callerShaFields = [
      request.repositoryHeadSha,
      request.repositorySha,
      deps.repositoryHeadSha,
    ].filter((v) => v != null && v !== '');
    for (const callerSha of callerShaFields) {
      if (String(callerSha) !== headSha) {
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING, [
            'CALLER_SUPPLIED_SHA_MISMATCHES_OBSERVED_GIT_HEAD',
            `OBSERVED=${headSha}`,
            `CALLER=${callerSha}`,
          ]),
          evidence: evidenceEnvelope({
            failure: { observed: headSha, caller: callerSha, gitObservation },
          }),
        };
      }
    }

    const shaBind = evaluateLiveRepositoryHeadBinding({
      capabilityPinnedSha: headSha,
      repositoryHeadSha: headSha,
    });
    if (!shaBind.ok) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING, shaBind.reasons || [
          'LIVE_HEAD_SHA_BINDING_FAILED',
        ]),
        evidence: evidenceEnvelope({ failure: shaBind, gitObservation }),
      };
    }

    const preStartAuth = verifyLiveOwnerCapabilityForRunner(
      capabilityToken,
      {
        suitePath: suiteCheck.suitePath,
        purpose: S2_OWNER_CAPABILITY_PURPOSE_SIMIN,
        venue: S2_OWNER_CAPABILITY_VENUE_SIMIN,
        pinnedMainSha: headSha,
        forbidOfflinePinAsLiveSha: true,
      },
      trustedVerifierDeps,
    );
    capabilityVerified = preStartAuth.capabilityVerified;
    if (!preStartAuth.ok || preStartAuth.dbControllerStartPermitted !== true) {
      return {
        ...deny(preStartAuth.decision, [
          ...(preStartAuth.reasons || []),
        ]),
        capabilityVerified,
        classification: Object.freeze({
          decision: preStartAuth.decision,
          dbControllerStartPermitted: false,
          startInvocationCount: 0,
        }),
        evidence: evidenceEnvelope({
          authorization: Object.freeze({ structural, capabilityVerified, preStartAuth }),
          failure: capabilityVerified || preStartAuth,
          dbControllerStarted: false,
          startInvocationCount: 0,
        }),
      };
    }
    if (!isVerifierIssuedCapabilityProvenance(capabilityVerified)) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE, [
          'VERIFIER_ISSUED_PROVENANCE_MISSING_AFTER_VERIFY',
        ]),
        capabilityVerified,
        evidence: evidenceEnvelope({ failure: { decision: 'DENY_FORGED_VERIFIED_CAPABILITY' } }),
      };
    }
    if (isExecuteMode && verifierIssuedCapabilityAuthorizesLiveSubprocess(capabilityVerified) !== true) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING, [
          'LIVE_EXECUTE_REQUIRES_OWNER_INSTALLED_PROVENANCE',
          `TRUST_CLASS=${getVerifierIssuedCapabilityTrustClass(capabilityVerified)}`,
        ]),
        capabilityVerified,
        evidence: evidenceEnvelope({ failure: { decision: OWNER_RUNNER_DECISIONS.DENY_VERIFIER_TRUST_MISSING } }),
      };
    }

    const claimShaBind = evaluateLiveRepositoryHeadBinding({
      capabilityPinnedSha: capabilityVerified.claims?.pinnedMainSha,
      repositoryHeadSha: headSha,
    });
    if (!claimShaBind.ok) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_SHA_BINDING, claimShaBind.reasons || []),
        capabilityVerified,
        evidence: evidenceEnvelope({ failure: claimShaBind, authorization: { structural, capabilityVerified } }),
      };
    }

    const spawnEligibility = evaluateVerifiedCapabilityLiveSpawnEligibility(capabilityVerified, {
      custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
      ohsaCustodyClaimed: false,
    });
    liveAuthorization = evaluateLiveSpawnAuthorizationFromOwnerCapability({
      verifiedCapability: capabilityVerified,
      custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
      ohsaCustodyClaimed: false,
      venue: OPS_PILOT_LIVE_VENUE,
      repositoryHeadSha: headSha,
      suitePath: suiteCheck.suitePath,
    });
    if (!liveAuthorization.ok || !spawnEligibility.ok || liveAuthorization.liveSpawnEligible !== true) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_DB_GATE_CLOSED, [
          'LIVE_CAPABILITY_NOT_ELIGIBLE',
          liveAuthorization.decision || spawnEligibility.decision,
          ...(liveAuthorization.reasons || []),
          ...(spawnEligibility.reasons || []),
        ]),
        capabilityVerified,
        evidence: evidenceEnvelope({
          authorization: Object.freeze({ structural, capabilityVerified, liveAuthorization, spawnEligibility }),
          failure: liveAuthorization,
        }),
      };
    }

    // Brand verified capability (does not mint/sign). Create live one-shot ticket.
    // Branding is non-authoritative bookkeeping only; ticket requires verifier provenance.
    brandVerifiedIndependentOwnerCapability(capabilityVerified);
    liveTicketResult = createLiveCapabilityGatedOneShotTicket({
      proofClass: 'LIVE_CAPABILITY_GATED_ONESHOT_TICKET',
      verifiedCapability: capabilityVerified,
      custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
      venue: OPS_PILOT_LIVE_VENUE,
      repositoryHeadSha: headSha,
      suitePath: suiteCheck.suitePath,
      ttlMs: request.ttlMs ?? OPS_PILOT_DEFAULT_ONESHOT_TTL_MS,
      requireOwnerInstalledTrust: isExecuteMode === true,
    }, { clock: deps.clock || {} });
    if (!liveTicketResult.ok) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_DB_GATE_CLOSED, liveTicketResult.reasons || [
          'LIVE_ONESHOT_CREATE_FAILED',
        ]),
        capabilityVerified,
        evidence: evidenceEnvelope({ failure: liveTicketResult }),
      };
    }

    // AUTHORIZATION mode: validate + ticket only. No PostgreSQL side effects.
    if (request.mode !== 'LIVE_CAPABILITY_GATED_EXECUTE') {
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION,
        reasons: Object.freeze([
          'LIVE_CAPABILITY_AUTHORIZATION_ONLY',
          'NO_POSTGRES_SIDE_EFFECTS',
          'MODULE_CONSTS_REMAIN_FALSE',
          'OHSA_NOT_PROVEN',
          'RECOVERY_ADMIN_NOT_PROVEN',
          'SEPARATE_EXECUTE_MODE_REQUIRED_FOR_PG_SPAWN',
          ...liveAuthorization.reasons,
        ]),
        suitePath: suiteCheck.suitePath,
        ticket: liveTicketResult.ticket,
        capabilityVerified,
        liveAuthorization,
        custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
        venue: OPS_PILOT_LIVE_VENUE,
        postgresActions: 0,
        dbActions: 0,
        workerActions: 0,
        mcpMutations: 0,
        operationalDispatchActions: 0,
        productionActions: 0,
        ownerAuthenticationProven: true,
        ownerInvocationIndependentlyVerifiable: true,
        ownerCustodyProven: false,
        recoveryAdminProven: false,
        liveDbExecutionAuthorized: false,
        moduleConsts: Object.freeze({
          OPS_PILOT_DB_EXECUTION_AUTHORIZED,
          OPS_PILOT_TIER3_AUTHORIZED,
        }),
        gitObservation: Object.freeze({
          headSha,
          source: gitObservation.source,
          authorizesLiveExecute: gitObservation.authorizesLiveExecute === true,
        }),
        trustClass: getVerifierIssuedCapabilityTrustClass(capabilityVerified),
        evidence: evidenceEnvelope({
          authorization: Object.freeze({
            structural,
            capabilityVerified,
            liveAuthorization,
            spawnEligibility,
            gitObservation,
          }),
        }),
      });
    }

    // EXECUTE mode: capability-gated disposable lifecycle (post-merge Owner step only).
    // Still refuses env/boolean overrides and keeps module consts false.
    if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== false || OPS_PILOT_TIER3_AUTHORIZED !== false) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_DB_GATE_CLOSED, [
          'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
        ]),
        evidence: evidenceEnvelope({ failure: { moduleConstsUnexpected: true } }),
      };
    }

    const clock = deps.clock || {};
    const controller = createDisposableOpsPilotClusterController({
      explicitNonProd: true,
      ownerOneShotTicket: liveTicketResult.ticket,
      clock,
      offlineWiringProbe: deps.offlineWiringProbe === true,
      spawnSyncFn: deps.spawnSyncFn, // optional inject for offline inert proofs / wiring probe only
    }, { NODE_ENV: 'test', ...(env || {}) });
    if (!isOwnedDisposableOpsPilotClusterController(controller)) {
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
          'LIVE_OWNED_CONTROLLER_CREATE_FAILED',
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
        postgresActions: prepared.postgresActions || 0,
      };
    }
    const started = await controller.start();
    if (!started.ok) {
      const cleaned = await controller.cleanup();
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_LIVE_DB_GATE_CLOSED, started.reasons || ['START_DENIED']),
        evidence: evidenceEnvelope({ start: started, cleanup: cleaned, failure: started }),
        postgresActions: started.postgresActions || 0,
      };
    }

    const clientResult = await controller.createOwnedClusterClient({
      offlineWiringProbe: deps.offlineWiringProbe === true,
      inertClientFactory: deps.inertClientFactory,
    });
    if (!clientResult?.ok || !clientResult.client) {
      const stoppedEarly = await controller.stop();
      const cleanedEarly = await controller.cleanup();
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, clientResult?.reasons || [
          'OWNED_CLUSTER_CLIENT_REQUIRED',
        ]),
        evidence: evidenceEnvelope({
          start: started,
          stop: stoppedEarly,
          cleanup: cleanedEarly,
          failure: clientResult,
        }),
        postgresActions: (started.postgresActions || 0) + (clientResult?.postgresActions || 0),
      };
    }
    if (!isOwnedClusterClient(clientResult.client) && deps.offlineWiringProbe !== true) {
      const closed = await boundedEndStopCleanup(controller, clientResult.client);
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
          'CLUSTER_CLIENT_NOT_OWNED_LATCHED',
        ]),
        evidence: evidenceEnvelope({
          start: started,
          clientEnd: closed.clientEndResult,
          stop: lifecycleStageEvidence('stop', closed.stopped, closed.stopError),
          cleanup: lifecycleStageEvidence('cleanup', closed.cleaned, closed.cleanupError),
        }),
        postgresActions: started.postgresActions || 0,
      };
    }

    let schemaBootstrapEvidence = null;
    let dlpProofClient = null;
    let dlpProofSecondaryClient = null;
    const isDisposableDbLiveSuite = suiteCheck.suitePath === OPS_PILOT_APPROVED_TEST_ACTIONS[0]
      || suiteCheck.suitePath === OPS_PILOT_APPROVED_TEST_ACTIONS[1]
      || suiteCheck.suitePath === 'tecp-ops-persistence/test/cp2DbFencingDurability.test.js'
      || suiteCheck.suitePath === 'tecp-ops-persistence/test/cp2DbDispatcherIntegration.test.js';
    const authorityResult = createLiveSuiteExecutionAuthority({
      proofClass: LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS,
      ownedController: controller,
      ownerOneShotTicket: liveTicketResult.ticket,
      suitePath: suiteCheck.suitePath,
      repositoryHeadSha: headSha,
      venue: OPS_PILOT_LIVE_VENUE,
      authorizesRealSql: deps.offlineWiringProbe !== true && clientResult.inert !== true,
      offlineWiringProbe: deps.offlineWiringProbe === true,
    });
    if (!authorityResult.ok) {
      const closed = await boundedEndStopCleanup(controller, clientResult.client);
      return {
        ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, authorityResult.reasons || [
          'LIVE_SUITE_EXECUTION_AUTHORITY_MINT_FAILED',
        ]),
        evidence: evidenceEnvelope({
          start: started,
          clientEnd: closed.clientEndResult,
          stop: lifecycleStageEvidence('stop', closed.stopped, closed.stopError),
          cleanup: lifecycleStageEvidence('cleanup', closed.cleaned, closed.cleanupError),
          failure: authorityResult,
        }),
        postgresActions: started.postgresActions || 0,
      };
    }

    if (isDisposableDbLiveSuite && authorityResult.ok && deps.offlineWiringProbe === true) {
      schemaBootstrapEvidence = Object.freeze({
        offlineWiringProbe: true,
        inert: true,
        filesAllowlisted: 6,
      });
    } else if (isDisposableDbLiveSuite && authorityResult.ok) {
      const preamble = await applyDisposableOpsPilotSchemaBootstrap({
        clusterClient: clientResult.client,
        liveExecutionAuthority: authorityResult.authority,
        suitePath: suiteCheck.suitePath,
        repositoryHeadSha: headSha,
        authorizesRealSql: authorityResult.authority?.authorizesRealSql === true,
        offlineWiringProbe: deps.offlineWiringProbe === true,
        phase: 'PREAMBLE_ONLY',
      });
      if (!preamble.ok) {
        const closed = await boundedEndStopCleanup(controller, clientResult.client);
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, preamble.reasons || [
            'SCHEMA_BOOTSTRAP_PREAMBLE_FAILED',
          ]),
          evidence: evidenceEnvelope({
            start: started,
            bootstrap: preamble,
            clientEnd: closed.clientEndResult,
            stop: lifecycleStageEvidence('stop', closed.stopped, closed.stopError),
            cleanup: lifecycleStageEvidence('cleanup', closed.cleaned, closed.cleanupError),
          }),
          postgresActions: started.postgresActions || 0,
        };
      }
      const dlpClientResult = await controller.createOwnedClusterClient({
        database: 'dlp_proof',
        offlineWiringProbe: deps.offlineWiringProbe === true,
        inertClientFactory: deps.inertClientFactory,
      });
      if (!dlpClientResult?.ok || !isOwnedClusterClient(dlpClientResult.client)) {
        const closed = await boundedEndStopCleanup(controller, clientResult.client);
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
            'DLP_PROOF_PRIMARY_CLIENT_REQUIRED',
          ]),
          evidence: evidenceEnvelope({
            start: started,
            bootstrap: preamble,
            dlpClient: dlpClientResult,
            clientEnd: closed.clientEndResult,
            stop: lifecycleStageEvidence('stop', closed.stopped, closed.stopError),
            cleanup: lifecycleStageEvidence('cleanup', closed.cleaned, closed.cleanupError),
          }),
          postgresActions: started.postgresActions || 0,
        };
      }
      dlpProofClient = dlpClientResult.client;
      const dlpSecondaryClientResult = await controller.createOwnedClusterClient({
        database: 'dlp_proof',
        offlineWiringProbe: deps.offlineWiringProbe === true,
        inertClientFactory: deps.inertClientFactory,
      });
      if (!dlpSecondaryClientResult?.ok || !isOwnedClusterClient(dlpSecondaryClientResult.client)) {
        const closed = await boundedEndStopCleanup(controller, clientResult.client);
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
            'DLP_PROOF_SECONDARY_CLIENT_REQUIRED',
          ]),
          evidence: evidenceEnvelope({
            start: started,
            bootstrap: preamble,
            dlpClient: dlpClientResult,
            dlpSecondary: dlpSecondaryClientResult,
            clientEnd: closed.clientEndResult,
            stop: lifecycleStageEvidence('stop', closed.stopped, closed.stopError),
            cleanup: lifecycleStageEvidence('cleanup', closed.cleaned, closed.cleanupError),
          }),
          postgresActions: started.postgresActions || 0,
        };
      }
      dlpProofSecondaryClient = dlpSecondaryClientResult.client;
      const bootstrap = await applyDisposableOpsPilotSchemaBootstrap({
        clusterClient: clientResult.client,
        dlpProofClient,
        liveExecutionAuthority: authorityResult.authority,
        suitePath: suiteCheck.suitePath,
        repositoryHeadSha: headSha,
        authorizesRealSql: authorityResult.authority?.authorizesRealSql === true,
        offlineWiringProbe: deps.offlineWiringProbe === true,
        phase: 'APPLY_SCHEMAS',
        preambleEvidence: preamble,
      });
      if (!bootstrap.ok) {
        const closed = await boundedEndStopCleanup(controller, clientResult.client);
        return {
          ...deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, bootstrap.reasons || [
            'SCHEMA_BOOTSTRAP_FAILED',
          ]),
          evidence: evidenceEnvelope({
            start: started,
            bootstrap,
            clientEnd: closed.clientEndResult,
            stop: lifecycleStageEvidence('stop', closed.stopped, closed.stopError),
            cleanup: lifecycleStageEvidence('cleanup', closed.cleaned, closed.cleanupError),
          }),
          postgresActions: started.postgresActions || 0,
        };
      }
      schemaBootstrapEvidence = bootstrap;
    }

    let suiteResult;
    let clientEndResult = null;
    let allClientsEndResult = null;
    let stopped;
    let cleaned;
    let stopError = null;
    let cleanupError = null;
    try {
      const suiteModule = await loadSuiteExecutor(suiteCheck.suitePath);
      try {
        suiteResult = await suiteModule.executeTier3SuiteViaRunnerContract({
          mode: 'LIVE_CAPABILITY_GATED_EXECUTE',
          ownedController: controller,
          clusterClient: dlpProofClient || clientResult.client,
          extraClients: isDisposableDbLiveSuite && dlpProofSecondaryClient
            ? Object.freeze([dlpProofSecondaryClient])
            : [],
          liveExecutionAuthority: authorityResult.authority,
          repositorySha: headSha,
          repositoryHeadSha: headSha,
          suitePath: suiteCheck.suitePath,
          liveCapabilityAuthorized: true,
          custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
          schemaBootstrapEvidence,
          restartBudget: getOwnedClientAccounting(controller)?.restartBudgetRemaining ?? 0,
        });
      } catch (error) {
        suiteResult = deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
          'SUITE_ORCHESTRATION_THREW',
          error.message || String(error),
        ]);
      }
    } catch (error) {
      suiteResult = deny(OWNER_RUNNER_DECISIONS.DENY_INVALID_REQUEST, [
        'SUITE_LOAD_OR_ORCHESTRATION_THREW',
        error.message || String(error),
      ]);
    } finally {
      // Disconnect before Postmaster stop / disposable cleanup, including suite/load failures.
      try {
        allClientsEndResult = await endAllOwnedClusterClients(controller);
        clientEndResult = allClientsEndResult;
        if (allClientsEndResult?.ok !== true) {
          const single = await endOwnedClusterClient(clientResult.client);
          clientEndResult = clientEndResult?.ok ? clientEndResult : single;
        }
      } catch (endError) {
        clientEndResult = deny(OWNER_RUNNER_DECISIONS.DENY_CLIENT_CLOSE_FAILED, [
          'OWNED_CLIENT_END_THREW',
          endError.message || String(endError),
        ]);
      }
      try { stopped = await controller.stop(); } catch (error) { stopError = error; stopped = null; }
      try { cleaned = await controller.cleanup(); } catch (error) { cleanupError = error; cleaned = null; }
    }
    const stopValidated = isValidatedSuccessfulLifecycleResult(stopped);
    const cleanupValidated = isValidatedSuccessfulLifecycleResult(cleaned);
    const closureGate = evaluateLiveExecuteClosureGate({
      suiteOk: suiteResult?.ok === true,
      stopValidated,
      cleanupValidated,
      clientEndResult,
      allClientsEndResult,
    });
    const classified = classifyOwnerRunnerOutcome({
      suiteOk: closureGate.suiteOk,
      stopValidated: closureGate.stopValidated,
      cleanupValidated: closureGate.cleanupValidated,
      clientEndValidated: closureGate.clientEndValidated,
      suiteDecision: suiteResult?.decision || null,
      successDecision: OWNER_RUNNER_DECISIONS.ALLOW_LIVE_CAPABILITY_AUTHORIZATION,
    });
    const overallOk = classified.ok === true;
    const decision = classified.decision;
    return Object.freeze({
      ok: overallOk,
      allowed: overallOk,
      decision,
      classification: classified,
      closureGate,
      reasons: Object.freeze([
        'LIVE_CAPABILITY_GATED_EXECUTE',
        'MODULE_CONSTS_REMAIN_FALSE',
        'OHSA_NOT_PROVEN',
        ...(classified.failureCauses || []),
        ...(closureGate.clientEndValidated !== true ? ['VERIFIED_OWNED_CLIENT_CLOSE_REQUIRED'] : []),
        ...(suiteResult?.reasons || []),
      ]),
      suitePath: suiteCheck.suitePath,
      suiteResult,
      closureGate,
      postgresActions: started.postgresActions || 0,
      dbActions: suiteResult?.sqlExecuted === true ? 1 : 0,
      workerActions: 0,
      mcpMutations: 0,
      operationalDispatchActions: 0,
      productionActions: 0,
      ownerAuthenticationProven: true,
      ownerInvocationIndependentlyVerifiable: true,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
      liveDbExecutionAuthorized: false,
      evidence: evidenceEnvelope({
        authorization: Object.freeze({ structural, capabilityVerified, liveAuthorization }),
        start: started,
        clientEnd: clientEndResult,
        stop: lifecycleStageEvidence('stop', stopped, stopError),
        cleanup: lifecycleStageEvidence('cleanup', cleaned, cleanupError),
        suite: suiteResult,
      }),
    });
  }

  // Default without capability: fail closed (non-offline modes).
  if (request.mode !== 'OFFLINE_INERT_ORCHESTRATION') {
    return {
      ...deny(
        OWNER_RUNNER_DECISIONS.DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE,
        [
          'DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
          'DEFAULT_DENY',
          'CAPABILITY_REQUIRED_FOR_LIVE_BRIDGE',
        ],
      ),
      requiredExternalTrustComponents: TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
      evidence: evidenceEnvelope({
        authorization: Object.freeze({ structural }),
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

  let stopped;
  let cleaned;
  let stopError = null;
  let cleanupError = null;
  try {
    stopped = await controller.stop();
  } catch (error) {
    stopError = error;
    stopped = null;
  }
  // Never delete while stop is unproven / failed / malformed.
  const stopValidated = isValidatedSuccessfulLifecycleResult(stopped);
  if (!stopValidated) {
    // Best-effort cleanup attempt still recorded, but overall DENY.
    try {
      cleaned = await controller.cleanup();
    } catch (error) {
      cleanupError = error;
      cleaned = null;
    }
    return Object.freeze({
      ok: false,
      allowed: false,
      decision: OWNER_RUNNER_DECISIONS.DENY_STOP_FAILED,
      classification: classifyOwnerRunnerOutcome({
        suiteOk: suiteResult?.ok === true,
        stopValidated: false,
        cleanupValidated: isValidatedSuccessfulLifecycleResult(cleaned),
        suiteDecision: suiteResult?.decision || null,
        successDecision: OWNER_RUNNER_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION,
      }),
      reasons: Object.freeze([
        'STOP_FAILURE_OR_MALFORMED_CANNOT_PASS',
        'SUITE_SUCCESS_REQUIRES_VALIDATED_STOP_AND_CLEANUP',
        ...(stopError ? ['STOP_THREW'] : []),
        ...(stopped == null ? ['STOP_RESULT_MISSING'] : ['STOP_RESULT_NOT_VALIDATED']),
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
        authorization: Object.freeze({ structural, capabilityVerified }),
        start: started,
        stop: lifecycleStageEvidence('stop', stopped, stopError),
        cleanup: lifecycleStageEvidence('cleanup', cleaned, cleanupError),
        suite: suiteResult,
        failure: Object.freeze({ decision: OWNER_RUNNER_DECISIONS.DENY_STOP_OR_CLEANUP_FAILED }),
      }),
    });
  }

  try {
    cleaned = await controller.cleanup();
  } catch (error) {
    cleanupError = error;
    cleaned = null;
  }

  const cleanupValidated = isValidatedSuccessfulLifecycleResult(cleaned);
  const classified = classifyOwnerRunnerOutcome({
    suiteOk: suiteResult?.ok === true,
    stopValidated,
    cleanupValidated,
    suiteDecision: suiteResult?.decision || null,
    successDecision: OWNER_RUNNER_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION,
  });
  const overallOk = classified.ok === true;

  return Object.freeze({
    ok: overallOk,
    allowed: overallOk,
    decision: classified.decision,
    classification: classified,
    reasons: Object.freeze([
      'OFFLINE_INERT_ORCHESTRATION_ONLY',
      'NOT_LIVE_POSTGRES_DURABILITY_PROOF',
      ...(classified.failureCauses || []),
      ...(!cleanupValidated ? ['CLEANUP_FAILURE_OR_MALFORMED_CANNOT_PASS'] : []),
      ...(cleanupError ? ['CLEANUP_THREW'] : []),
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
      authorization: Object.freeze({ structural, capabilityVerified }),
      start: started,
      stop: lifecycleStageEvidence('stop', stopped, stopError),
      cleanup: lifecycleStageEvidence('cleanup', cleaned, cleanupError),
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
