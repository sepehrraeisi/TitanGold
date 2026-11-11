/**
 * TECP-OPS-PILOT-001 S2 Tier-3 — disposable ops-pilot DB harness.
 *
 * Owner-controlled local runner model with same-UID limitations accepted for
 * disposable TEST_ONLY only. Default: HARD DENY.
 *
 * WeakSet brands, caller booleans, and environment flips are NOT Owner authority.
 * Live PostgreSQL spawn remains closed while OPS_PILOT_DB_EXECUTION_AUTHORIZED=false.
 * Offline tests may inject inert spawnSyncFn under an inert one-shot ticket only.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OPS_PILOT_HARNESS_MODE = 'DISPOSABLE_OPS_PILOT_ONESHOT_ACTIVATION_DEFAULT_DENY';
export const OPS_PILOT_HARNESS_CHECKPOINT = 'S2_TIER3_ONESHOT_ACTIVATION';
export const OPS_PILOT_REQUIRED_PG_VERSION = '14.24';
export const OPS_PILOT_REQUIRED_PG_VERSION_PREFIX = 'postgres (PostgreSQL) 14.24';
export const OPS_PILOT_PG_BIN_DIR = '/usr/lib/postgresql/14/bin';
export const OPS_PILOT_HARNESS_ROOT_PREFIX = 'tecp-ops-pilot-s2-';
export const OPS_PILOT_HARNESS_MARKER_NAME = '.tecp-ops-pilot-harness';
export const OPS_PILOT_HARNESS_MARKER_MAGIC = 'TECP-OPS-PILOT-S2-DISPOSABLE-HARNESS';
export const OPS_PILOT_DB_EXECUTION_AUTHORIZED = false;
export const OPS_PILOT_TIER3_AUTHORIZED = false;
export const TIER3_ACTIVATION_AUTHORITY = 'TIER3_ACTIVATION_AUTHORITY_UNPROVEN';
export const OPS_PILOT_PINNED_MAIN_SHA = 'b1036a5035a9c58e430e202086763b8acf963301';
export const OPS_PILOT_OWNER_RUNNER_ARGV_MARKER = '--tecp-ops-s2-owner-controlled-local-runner';
export const OPS_PILOT_DEFAULT_ONESHOT_TTL_MS = 120000;
export const OPS_PILOT_MAX_ONESHOT_TTL_MS = 300000;
export const OPS_PILOT_APPROVED_TEST_ACTIONS = Object.freeze([
  'tecp-ops-persistence/test/cp2DbFencingDurability.test.js',
  'tecp-ops-persistence/test/cp2DbDispatcherIntegration.test.js',
]);

export const ONE_SHOT_STATES = Object.freeze({
  DISABLED: 'DISABLED',
  VERIFIED_OWNER_INVOKED: 'VERIFIED_OWNER_INVOKED',
  RESERVED: 'RESERVED',
  ACTIVE_TEST_ONLY: 'ACTIVE_TEST_ONLY',
  CONSUMED: 'CONSUMED',
  TERMINATED: 'TERMINATED',
  DENIED_OR_TERMINATED: 'DENIED_OR_TERMINATED',
});

export const OPS_PILOT_HARNESS_DECISIONS = Object.freeze({
  ALLOW_SOURCE_CONTRACT: 'ALLOW_SOURCE_CONTRACT',
  ALLOW_LIFECYCLE: 'ALLOW_LIFECYCLE',
  ALLOW_ONESHOT_ACTIVE: 'ALLOW_ONESHOT_ACTIVE',
  DENY_PRODUCTION_ENV: 'DENY_PRODUCTION_ENV',
  DENY_REMOTE_ENDPOINT: 'DENY_REMOTE_ENDPOINT',
  DENY_ENV_DATABASE_URL: 'DENY_ENV_DATABASE_URL',
  DENY_TCP_HOST: 'DENY_TCP_HOST',
  DENY_UNSAFE_FALLBACK: 'DENY_UNSAFE_FALLBACK',
  DENY_DB_EXECUTION_NOT_AUTHORIZED: 'DENY_DB_EXECUTION_NOT_AUTHORIZED',
  DENY_TIER3_NOT_AUTHORIZED: 'DENY_TIER3_NOT_AUTHORIZED',
  DENY_MISSING_EXPLICIT_NONPROD_FLAG: 'DENY_MISSING_EXPLICIT_NONPROD_FLAG',
  DENY_INVALID_CONFIG: 'DENY_INVALID_CONFIG',
  DENY_PG_VERSION_MISMATCH: 'DENY_PG_VERSION_MISMATCH',
  DENY_NON_DISPOSABLE_ROOT: 'DENY_NON_DISPOSABLE_ROOT',
  DENY_LIFECYCLE_WITHOUT_OWNERSHIP: 'DENY_LIFECYCLE_WITHOUT_OWNERSHIP',
  DENY_MISSING_TIER3_HANDLE: 'DENY_MISSING_TIER3_HANDLE',
  DENY_CALLER_BOOLEAN_ACTIVATION: 'DENY_CALLER_BOOLEAN_ACTIVATION',
  DENY_SYMLINK_OR_PREEXISTING: 'DENY_SYMLINK_OR_PREEXISTING',
  DENY_PATH_ESCAPE: 'DENY_PATH_ESCAPE',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_WEAKSET_NOT_OWNER_AUTHORITY: 'DENY_WEAKSET_NOT_OWNER_AUTHORITY',
  DENY_OWNER_INVOCATION_NOT_VERIFIABLE: 'DENY_OWNER_INVOCATION_NOT_VERIFIABLE',
  DENY_ONESHOT_DISABLED: 'DENY_ONESHOT_DISABLED',
  DENY_ONESHOT_REPLAY: 'DENY_ONESHOT_REPLAY',
  DENY_ONESHOT_EXPIRED: 'DENY_ONESHOT_EXPIRED',
  DENY_ONESHOT_CANCELLED: 'DENY_ONESHOT_CANCELLED',
  DENY_WRONG_REPOSITORY_SHA: 'DENY_WRONG_REPOSITORY_SHA',
  DENY_WRONG_EXECUTABLE_IDENTITY: 'DENY_WRONG_EXECUTABLE_IDENTITY',
  DENY_UNAPPROVED_TEST_ACTION: 'DENY_UNAPPROVED_TEST_ACTION',
  DENY_UNSAFE_PG_TARGET: 'DENY_UNSAFE_PG_TARGET',
  DENY_PUBLIC_FACTORY_AS_OWNER: 'DENY_PUBLIC_FACTORY_AS_OWNER',
});

export const POSTMASTER_STATUS = Object.freeze({
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
  UNCERTAIN: 'UNCERTAIN',
});

const PRODUCTION_MARKERS = Object.freeze(['production', 'prod', 'live']);
const HARNESS_MODULE_PATH = fileURLToPath(import.meta.url);
const privilegedTier3Latch = new WeakSet();
const ownedClusterLatch = new WeakSet();
const oneShotTicketLatch = new WeakSet();
const inertOneShotLatch = new WeakSet();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    dbExecutionAuthorized: false,
    tier3Authorized: false,
    postgresActions: 0,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    ...extra,
  });
}

function allowSource(extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_SOURCE_CONTRACT,
    reasons: Object.freeze(['DISPOSABLE_SOURCE_CONTRACT_ONLY']),
    dbExecutionAuthorized: false,
    tier3Authorized: false,
    postgresActions: 0,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    ...extra,
  });
}

function envSnapshot(env = process.env) {
  return {
    NODE_ENV: env.NODE_ENV,
    DATABASE_URL: env.DATABASE_URL,
    PGHOST: env.PGHOST,
    PGPORT: env.PGPORT,
    PGDATABASE: env.PGDATABASE,
    PGUSER: env.PGUSER,
    PGPASSWORD: env.PGPASSWORD,
    PGSERVICE: env.PGSERVICE,
    PGSERVICEFILE: env.PGSERVICEFILE,
    TITANGOLD_TECP_OPS_NONPROD: env.TITANGOLD_TECP_OPS_NONPROD,
    TITANGOLD_TECP_OPS_CP2_DB: env.TITANGOLD_TECP_OPS_CP2_DB,
    TITANGOLD_TECP_OPS_S2_TIER3: env.TITANGOLD_TECP_OPS_S2_TIER3,
  };
}

function monotonicNowMs(clock = {}) {
  if (typeof clock.now === 'function') return Number(clock.now());
  if (typeof clock.hrtimeBigint === 'function') {
    return Number(clock.hrtimeBigint() / 1000000n);
  }
  return Number(process.hrtime.bigint() / 1000000n);
}

/**
 * Pure offline safety evaluation. Never opens sockets or loads `pg`.
 */
export function evaluateOpsPilotHarnessSafety(config = {}, env = process.env) {
  if (!isPlainObject(config)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, ['CONFIG_OBJECT_REQUIRED']);
  }

  const snap = envSnapshot(env);
  const nodeEnv = String(snap.NODE_ENV || '').toLowerCase();
  if (PRODUCTION_MARKERS.includes(nodeEnv) || config.forceProduction === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PRODUCTION_ENV, [
      `NODE_ENV=${snap.NODE_ENV || ''}`,
    ]);
  }

  if (snap.DATABASE_URL != null && String(snap.DATABASE_URL).length > 0) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, ['DATABASE_URL_FORBIDDEN']);
  }
  if (config.databaseUrl != null || config.connectionString != null) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, [
      'CONFIG_DATABASE_URL_FORBIDDEN',
    ]);
  }
  for (const key of [
    'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE',
  ]) {
    if (snap[key] != null && String(snap[key]).length > 0) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, [
        `EXTERNAL_${key}_FORBIDDEN`,
      ]);
    }
  }

  if (config.host != null || config.hostname != null) {
    const host = String(config.host || config.hostname || '');
    if (host && host !== '/tmp' && !host.startsWith('/')) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST, [`HOST=${host}`]);
    }
    if (/amazonaws\.com|azure|googleapis|neon\.tech|supabase|remote/i.test(host)) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_REMOTE_ENDPOINT, [`HOST=${host}`]);
    }
  }

  if (config.tcp === true || config.listenAddresses === '*' || config.port != null) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST, ['TCP_LISTENER_FORBIDDEN']);
  }
  if (config.remote === true || config.allowRemote === true || config.fallbackToRemote === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, ['REMOTE_FALLBACK_FORBIDDEN']);
  }
  if (config.allowEnvDatabaseUrl === true || config.useProcessEnvCredentials === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, [
      'ENV_CREDENTIAL_FALLBACK_FORBIDDEN',
    ]);
  }
  if (config.pgBinDir != null && resolve(String(config.pgBinDir)) !== OPS_PILOT_PG_BIN_DIR) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_PG_TARGET, [
      'CALLER_PG_BIN_DIR_FORBIDDEN',
      String(config.pgBinDir),
    ]);
  }

  if (config.explicitNonProd !== true && snap.TITANGOLD_TECP_OPS_NONPROD !== '1') {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG, [
      'EXPLICIT_NONPROD_REQUIRED',
    ]);
  }

  if (
    config.dataDir != null
    && typeof config.dataDir === 'string'
    && !config.dataDir.includes('disposable')
    && !String(config.dataDir).includes(OPS_PILOT_HARNESS_ROOT_PREFIX)
    && config.requireDisposableMarkedRoot !== false
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_NON_DISPOSABLE_ROOT, [
      'DISPOSABLE_MARKED_TEMPORARY_ROOT_REQUIRED',
    ]);
  }

  if (
    config.reportedPgVersion != null
    && String(config.reportedPgVersion) !== OPS_PILOT_REQUIRED_PG_VERSION
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PG_VERSION_MISMATCH, [
      `REQUIRED=${OPS_PILOT_REQUIRED_PG_VERSION}`,
      `REPORTED=${config.reportedPgVersion}`,
    ]);
  }

  // Caller boolean / env flip alone is NEVER enough.
  if (
    config.tier3Authorized === true
    || config.authorizeTier3 === true
    || config.authorizeDbExecution === true
    || snap.TITANGOLD_TECP_OPS_CP2_DB === '1'
    || snap.TITANGOLD_TECP_OPS_S2_TIER3 === '1'
  ) {
    if (!isActiveOwnerOneShotTicket(config.ownerOneShotTicket)
      && !isInertOfflineOneShotTicket(config.ownerOneShotTicket)) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION, [
        'CALLER_BOOLEAN_OR_ENV_NOT_TIER3_AUTHORITY',
        'OWNER_ONESHOT_REQUIRED',
        TIER3_ACTIVATION_AUTHORITY,
      ]);
    }
  }

  return allowSource({
    mode: OPS_PILOT_HARNESS_MODE,
    checkpoint: OPS_PILOT_HARNESS_CHECKPOINT,
    requiredPgVersion: OPS_PILOT_REQUIRED_PG_VERSION,
    socketOnly: true,
    tcpDisabled: true,
    envDatabaseUrlForbidden: true,
  });
}

/**
 * Privileged offline TEST_ONLY Tier-3 activation handle factory.
 * Process-local WeakSet brand. Does NOT prove Owner custody.
 * Does NOT authorize one-shot lifecycle or PostgreSQL execution.
 */
export function createPrivilegedTier3ActivationHandleForTests(input = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('TIER3_HANDLE_OPTIONS_REQUIRED');
  }
  if (input.operationalOwnerCustodyClaim === true) {
    throw new Error('OPERATIONAL_OWNER_CUSTODY_CLAIM_FORBIDDEN');
  }
  if (input.proofClass !== 'TEST_ONLY_TIER3_ACTIVATION_HANDLE') {
    throw new TypeError('TEST_ONLY_PROOF_CLASS_REQUIRED');
  }
  if (input.explicitNonProd !== true) {
    throw new TypeError('EXPLICIT_NONPROD_REQUIRED');
  }
  const handle = Object.freeze({
    kind: 'PRIVILEGED_TIER3_ACTIVATION_HANDLE',
    proofClass: 'TEST_ONLY_TIER3_ACTIVATION_HANDLE',
    operationalOwnerCustodyProven: false,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    checkpoint: OPS_PILOT_HARNESS_CHECKPOINT,
    authorizesOneShot: false,
    authorizesPostgresLifecycle: false,
  });
  privilegedTier3Latch.add(handle);
  return handle;
}

export function isPrivilegedTier3ActivationHandle(value) {
  return value !== null && typeof value === 'object' && privilegedTier3Latch.has(value);
}

function normalizeApprovedActions(actions) {
  if (!Array.isArray(actions)) return null;
  const out = [];
  for (const action of actions) {
    if (typeof action !== 'string' || action.length === 0) return null;
    if (action.includes('\0') || action.includes('..') || action.startsWith('/')) return null;
    if (!OPS_PILOT_APPROVED_TEST_ACTIONS.includes(action)) return null;
    out.push(action);
  }
  return Object.freeze([...new Set(out)]);
}

/**
 * Independently inspect Owner-controlled local runner evidence.
 * Same-UID forgeability remains an accepted disposable limitation.
 */
export function evaluateOwnerControlledLocalRunnerEvidence(evidence = {}, deps = {}) {
  if (!isPlainObject(evidence)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, ['EVIDENCE_OBJECT_REQUIRED']);
  }
  if (evidence.ownerAuthorizedByBoolean === true || evidence.envAuthorized === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION, [
      'BOOLEAN_EVIDENCE_FORBIDDEN',
    ]);
  }
  if (isPrivilegedTier3ActivationHandle(evidence.tier3ActivationHandle)
    || evidence.treatWeakSetAsOwnerAuthority === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PUBLIC_FACTORY_AS_OWNER, [
      'WEAKSET_FACTORY_IS_NOT_OWNER_AUTHORITY',
    ]);
  }

  const argv = Array.isArray(deps.argv) ? deps.argv : process.argv;
  const hasRunnerMarker = argv.includes(OPS_PILOT_OWNER_RUNNER_ARGV_MARKER);
  if (!hasRunnerMarker && evidence.ownerControlledLocalRunnerInvocation !== true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE, [
      'OWNER_INVOCATION_NOT_VERIFIABLE',
      'MISSING_ARGV_RUNNER_MARKER',
      'DEDICATED_OWNER_RUNNER_ENTRYPOINT_NOT_IN_THREE_FILE_SCOPE',
      `REQUIRED_MARKER=${OPS_PILOT_OWNER_RUNNER_ARGV_MARKER}`,
    ], {
      ownerInvocationIndependentlyVerifiable: false,
      exactScopeInsufficientForStandaloneEntrypoint: true,
    });
  }
  if (!hasRunnerMarker) {
    // Caller claimed invocation without observable argv marker → fail closed.
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE, [
      'OWNER_INVOCATION_CLAIM_WITHOUT_ARGV_MARKER',
      'OWNER_INVOCATION_NOT_VERIFIABLE',
    ], {
      ownerInvocationIndependentlyVerifiable: false,
    });
  }

  const repositorySha = String(evidence.repositorySha || '');
  if (repositorySha !== OPS_PILOT_PINNED_MAIN_SHA) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_REPOSITORY_SHA, [
      `EXPECTED=${OPS_PILOT_PINNED_MAIN_SHA}`,
      `GOT=${repositorySha || 'MISSING'}`,
    ]);
  }

  const approvedActions = normalizeApprovedActions(evidence.approvedActions);
  if (!approvedActions || approvedActions.length === 0) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, [
      'APPROVED_ACTIONS_REQUIRED',
    ]);
  }
  for (const action of approvedActions) {
    const matched = argv.some((arg) => String(arg).endsWith(action) || String(arg) === action);
    if (!matched) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, [
        'APPROVED_ACTION_NOT_PRESENT_IN_ARGV',
        action,
      ]);
    }
  }
  // Reject arbitrary extra test paths outside allowlist when present as *.test.js args.
  for (const arg of argv) {
    const s = String(arg);
    if (s.endsWith('.test.js')) {
      const allowed = OPS_PILOT_APPROVED_TEST_ACTIONS.some(
        (a) => s === a || s.endsWith(`/${a}`) || s.endsWith(a),
      );
      if (!allowed) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, [
          'UNAPPROVED_TEST_PATH_IN_ARGV',
          s,
        ]);
      }
    }
  }

  const expectedExec = String(evidence.executablePath || '');
  const actualExec = String(deps.execPath || process.execPath);
  if (!expectedExec || expectedExec !== actualExec) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY, [
      'EXECUTABLE_PATH_MISMATCH',
      `EXPECTED=${expectedExec || 'MISSING'}`,
      `ACTUAL=${actualExec}`,
    ]);
  }
  const expectedHarness = String(evidence.harnessModulePath || '');
  if (!expectedHarness || resolve(expectedHarness) !== resolve(HARNESS_MODULE_PATH)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY, [
      'HARNESS_MODULE_PATH_MISMATCH',
    ]);
  }

  const ttlMs = Number(evidence.ttlMs ?? OPS_PILOT_DEFAULT_ONESHOT_TTL_MS);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > OPS_PILOT_MAX_ONESHOT_TTL_MS) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, ['TTL_OUT_OF_BOUNDS']);
  }

  const observedUid = typeof deps.getuid === 'function' ? deps.getuid() : process.getuid?.();
  const claimedPrincipal = evidence.executionPrincipal;
  if (claimedPrincipal != null && Number(claimedPrincipal) !== Number(observedUid)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_EXECUTABLE_IDENTITY, [
      'EXECUTION_PRINCIPAL_MISMATCH',
      `CLAIMED=${claimedPrincipal}`,
      `OBSERVED=${observedUid}`,
    ]);
  }

  if (evidence.affirmSameUidLimitationsAccepted !== true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
      'SAME_UID_LIMITATION_AFFIRMATION_REQUIRED',
    ]);
  }

  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_ONESHOT_ACTIVE,
    reasons: Object.freeze([
      'OWNER_CONTROLLED_LOCAL_RUNNER_ARGV_MARKER_OBSERVED',
      'PINNED_SHA_BOUND',
      'APPROVED_ACTIONS_BOUND',
      'SAME_UID_LIMITATIONS_ACCEPTED',
    ]),
    ownerInvocationIndependentlyVerifiable: true,
    ownerInvocationMechanism: 'ARGV_MARKER_PLUS_PINNED_SHA_PLUS_ALLOWLIST',
    sameUidSealed: false,
    repositorySha,
    approvedActions,
    ttlMs,
    executionPrincipal: observedUid,
    executablePath: actualExec,
    harnessModulePath: HARNESS_MODULE_PATH,
    liveSpawnRequested: evidence.authorizeLivePostgresSpawn === true,
  });
}

function createTicketRecord(fields) {
  const ticket = {
    kind: 'OWNER_ONESHOT_ACTIVATION_TICKET',
    ...fields,
  };
  oneShotTicketLatch.add(ticket);
  return ticket;
}

function readTicketState(ticket) {
  return ticket?.__state;
}

function writeTicketState(ticket, state) {
  ticket.__state = state;
}

function isTicketExpired(ticket, clock) {
  return monotonicNowMs(clock) > ticket.expiresAtMonotonicMs;
}

export function isOwnerOneShotTicket(value) {
  return value !== null && typeof value === 'object' && oneShotTicketLatch.has(value);
}

export function isInertOfflineOneShotTicket(value) {
  return isOwnerOneShotTicket(value) && inertOneShotLatch.has(value);
}

export function isActiveOwnerOneShotTicket(value, clock = {}) {
  if (!isOwnerOneShotTicket(value)) return false;
  const state = readTicketState(value);
  if (state !== ONE_SHOT_STATES.ACTIVE_TEST_ONLY && state !== ONE_SHOT_STATES.RESERVED) {
    return false;
  }
  if (isTicketExpired(value, clock)) return false;
  return true;
}

export function getOwnerOneShotTicketView(ticket, clock = {}) {
  if (!isOwnerOneShotTicket(ticket)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, ['TICKET_REQUIRED']);
  }
  const expired = isTicketExpired(ticket, clock);
  return Object.freeze({
    ok: true,
    state: expired && readTicketState(ticket) === ONE_SHOT_STATES.ACTIVE_TEST_ONLY
      ? ONE_SHOT_STATES.DENIED_OR_TERMINATED
      : readTicketState(ticket),
    inert: isInertOfflineOneShotTicket(ticket),
    consumed: ticket.consumed === true,
    cancelled: ticket.cancelled === true,
    expiresAtMonotonicMs: ticket.expiresAtMonotonicMs,
    approvedActions: ticket.approvedActions,
    repositorySha: ticket.repositorySha,
    liveSpawnPermitted: ticket.liveSpawnPermitted === true,
    operationalOwnerCustodyProven: false,
    sameUidSealed: false,
  });
}

/**
 * Activate a one-shot Owner-controlled local runner ticket.
 * Fail-closed unless argv marker + pinned SHA + allowlist verify.
 */
export function activateOwnerControlledLocalRunnerOneShot(evidence = {}, deps = {}) {
  const verified = evaluateOwnerControlledLocalRunnerEvidence(evidence, deps);
  if (!verified.ok) {
    return verified;
  }

  // This instruction keeps live PostgreSQL execution closed.
  const liveSpawnPermitted = false;
  if (verified.liveSpawnRequested === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
      'LIVE_SPAWN_REQUESTED_BUT_TIER3_DB_EXECUTION_AUTHORIZED_NO',
      'ONESHOT_MAY_BE_ACTIVATED_ONLY_AFTER_SEPARATE_OWNER_EXECUTION_GATE',
    ], {
      ownerInvocationIndependentlyVerifiable: verified.ownerInvocationIndependentlyVerifiable,
    });
  }

  const clock = deps.clock || {};
  const now = monotonicNowMs(clock);
  const ticket = createTicketRecord({
    proofClass: 'OWNER_CONTROLLED_LOCAL_RUNNER_ONESHOT',
    repositorySha: verified.repositorySha,
    approvedActions: verified.approvedActions,
    executablePath: verified.executablePath,
    harnessModulePath: verified.harnessModulePath,
    executionPrincipal: verified.executionPrincipal,
    nonce: randomBytes(16).toString('hex'),
    createdAtMonotonicMs: now,
    expiresAtMonotonicMs: now + verified.ttlMs,
    ttlMs: verified.ttlMs,
    liveSpawnPermitted,
    consumed: false,
    cancelled: false,
    inert: false,
    __state: ONE_SHOT_STATES.VERIFIED_OWNER_INVOKED,
  });
  writeTicketState(ticket, ONE_SHOT_STATES.RESERVED);
  writeTicketState(ticket, ONE_SHOT_STATES.ACTIVE_TEST_ONLY);
  Object.freeze(ticket.approvedActions);

  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_ONESHOT_ACTIVE,
    reasons: Object.freeze(['ONESHOT_ACTIVE_TEST_ONLY']),
    ticket,
    state: ONE_SHOT_STATES.ACTIVE_TEST_ONLY,
    liveSpawnPermitted: false,
    dbExecutionAuthorized: false,
    ownerInvocationIndependentlyVerifiable: true,
    sameUidSealed: false,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
  });
}

/**
 * Offline-only inert ticket for testing lifecycle planning with fake spawners.
 * Explicitly NOT Owner authority and NEVER permits live postgres binaries.
 */
export function createInertOfflineOneShotTicketForTests(input = {}, deps = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('INERT_ONESHOT_OPTIONS_REQUIRED');
  }
  if (input.proofClass !== 'TEST_ONLY_INERT_ONESHOT_TICKET') {
    throw new TypeError('TEST_ONLY_INERT_PROOF_CLASS_REQUIRED');
  }
  if (input.explicitNonProd !== true) {
    throw new TypeError('EXPLICIT_NONPROD_REQUIRED');
  }
  if (input.operationalOwnerCustodyClaim === true || input.liveSpawnPermitted === true) {
    throw new Error('INERT_TICKET_CANNOT_CLAIM_OWNER_OR_LIVE_SPAWN');
  }
  const approvedActions = normalizeApprovedActions(
    input.approvedActions || [...OPS_PILOT_APPROVED_TEST_ACTIONS],
  );
  if (!approvedActions) {
    throw new TypeError('APPROVED_ACTIONS_INVALID');
  }
  const clock = deps.clock || {};
  const now = monotonicNowMs(clock);
  const ttlMs = Number(input.ttlMs ?? OPS_PILOT_DEFAULT_ONESHOT_TTL_MS);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > OPS_PILOT_MAX_ONESHOT_TTL_MS) {
    throw new TypeError('TTL_OUT_OF_BOUNDS');
  }
  const ticket = createTicketRecord({
    proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
    repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    approvedActions,
    executablePath: process.execPath,
    harnessModulePath: HARNESS_MODULE_PATH,
    executionPrincipal: process.getuid?.(),
    nonce: randomBytes(16).toString('hex'),
    createdAtMonotonicMs: now,
    expiresAtMonotonicMs: now + ttlMs,
    ttlMs,
    liveSpawnPermitted: false,
    consumed: false,
    cancelled: false,
    inert: true,
    __state: ONE_SHOT_STATES.ACTIVE_TEST_ONLY,
  });
  inertOneShotLatch.add(ticket);
  return ticket;
}

export function cancelOwnerOneShotTicket(ticket, clock = {}) {
  if (!isOwnerOneShotTicket(ticket)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, ['TICKET_REQUIRED']);
  }
  ticket.cancelled = true;
  writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
  return Object.freeze({
    ok: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED,
    state: ONE_SHOT_STATES.DENIED_OR_TERMINATED,
    cancelled: true,
    nowMonotonicMs: monotonicNowMs(clock),
  });
}

function requireOneShotForLifecycle(config = {}, clock = {}) {
  const ticket = config.ownerOneShotTicket;
  if (isPrivilegedTier3ActivationHandle(config.tier3ActivationHandle)
    && !isOwnerOneShotTicket(ticket)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_WEAKSET_NOT_OWNER_AUTHORITY, [
      'WEAKSET_HANDLE_IS_NOT_OWNER_ONESHOT',
      'CREATE_PRIVILEGED_TIER3_HANDLE_CANNOT_ACTIVATE',
    ]);
  }
  if (!isOwnerOneShotTicket(ticket)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, [
      'OWNER_ONESHOT_TICKET_REQUIRED',
      'DEFAULT_DENY',
    ]);
  }
  if (ticket.cancelled === true) {
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED, ['TICKET_CANCELLED']);
  }
  if (ticket.consumed === true
    || readTicketState(ticket) === ONE_SHOT_STATES.CONSUMED
    || readTicketState(ticket) === ONE_SHOT_STATES.TERMINATED
    || readTicketState(ticket) === ONE_SHOT_STATES.DENIED_OR_TERMINATED) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY, [
      'ONESHOT_ALREADY_CONSUMED_OR_TERMINATED',
    ]);
  }
  if (isTicketExpired(ticket, clock)) {
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_EXPIRED, ['ONESHOT_TTL_EXCEEDED']);
  }
  const state = readTicketState(ticket);
  if (state !== ONE_SHOT_STATES.ACTIVE_TEST_ONLY && state !== ONE_SHOT_STATES.RESERVED) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, [
      `INVALID_STATE=${state}`,
    ]);
  }
  return null;
}

function consumeOneShotOrDeny(ticket, clock = {}) {
  if (ticket.cancelled === true) {
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED, ['TICKET_CANCELLED']);
  }
  if (ticket.consumed === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY, ['REPLAY_FORBIDDEN']);
  }
  if (isTicketExpired(ticket, clock)) {
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_EXPIRED, ['ONESHOT_TTL_EXCEEDED']);
  }
  ticket.consumed = true;
  writeTicketState(ticket, ONE_SHOT_STATES.CONSUMED);
  return null;
}

function recheckBeforeLifecycle(opName, config = {}, env = process.env) {
  const safety = evaluateOpsPilotHarnessSafety(
    { ...config, explicitNonProd: config.explicitNonProd === true ? true : config.explicitNonProd },
    env,
  );
  const oneShotDeny = requireOneShotForLifecycle(config, config.clock || {});
  if (oneShotDeny) return oneShotDeny;
  if (
    safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_PRODUCTION_ENV
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_REMOTE_ENDPOINT
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_PG_VERSION_MISMATCH
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_NON_DISPOSABLE_ROOT
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_PG_TARGET
  ) {
    return safety;
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED === true || OPS_PILOT_TIER3_AUTHORIZED === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TIER3_NOT_AUTHORIZED, [
      'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
      opName,
    ]);
  }
  return null;
}

/**
 * Build argv for lifecycle tools without shell interpolation.
 */
export function buildInitdbArgs({ dataDir, pwfile, user = 'tecp_ops_pilot_proof' }) {
  if (typeof dataDir !== 'string' || (!dataDir.includes('disposable') && !dataDir.includes(OPS_PILOT_HARNESS_ROOT_PREFIX))) {
    throw new Error('DISPOSABLE_DATA_DIR_REQUIRED');
  }
  return Object.freeze([
    '-D', dataDir,
    '-U', user,
    '--auth-local=trust',
    '--auth-host=scram-sha-256',
    '--pwfile', pwfile,
    '--encoding=UTF8',
    '--locale=C',
  ]);
}

export function buildPgCtlStartArgs({ dataDir, logFile, socketDir, socketPort }) {
  if (typeof socketDir !== 'string' || !socketDir.startsWith('/')) {
    throw new Error('ABSOLUTE_SOCKET_DIR_REQUIRED');
  }
  if (!Number.isSafeInteger(socketPort) || socketPort < 1) {
    throw new Error('SOCKET_PORT_REQUIRED');
  }
  return Object.freeze([
    '-D', dataDir,
    '-l', logFile,
    '-o', `-c listen_addresses= -c unix_socket_directories=${socketDir} -c port=${socketPort}`,
    '-w',
    'start',
  ]);
}

export function buildPgCtlStopArgs(dataDir) {
  return Object.freeze(['-D', dataDir, '-m', 'fast', '-w', 'stop']);
}

export function planOwnedUnixSocketClientConfig({ socketDir, socketPort, user = 'tecp_ops_pilot_proof', database = 'postgres' }) {
  if (typeof socketDir !== 'string' || !socketDir.startsWith('/')) {
    throw new Error('ABSOLUTE_SOCKET_DIR_REQUIRED');
  }
  if (!Number.isSafeInteger(socketPort) || socketPort < 1) {
    throw new Error('SOCKET_PORT_REQUIRED');
  }
  return Object.freeze({
    host: socketDir,
    port: socketPort,
    user,
    database,
    connectionStringForbidden: true,
    tcpDisabled: true,
  });
}

export function assertVerifiedPgBinDir(binDir = OPS_PILOT_PG_BIN_DIR) {
  const resolved = resolve(binDir);
  if (resolved !== OPS_PILOT_PG_BIN_DIR) {
    throw new Error(`BLOCKED: unexpected pg bin dir ${resolved}`);
  }
  for (const name of ['initdb', 'pg_ctl', 'postgres', 'psql', 'pg_isready']) {
    const p = join(resolved, name);
    if (!existsSync(p)) throw new Error(`BLOCKED: missing ${p}`);
  }
  return resolved;
}

export function planPostgresVersionProbe(binDir = OPS_PILOT_PG_BIN_DIR) {
  const dir = assertVerifiedPgBinDir(binDir);
  return Object.freeze({
    bin: join(dir, 'postgres'),
    args: Object.freeze(['--version']),
    expectedPrefix: OPS_PILOT_REQUIRED_PG_VERSION_PREFIX,
  });
}

export function assertPathInsideRoot(root, candidate) {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(resolvedRoot + sep)) {
    throw new Error('BLOCKED: path escapes disposable root');
  }
  return resolvedCandidate;
}

export function assertNoSymlink(path) {
  if (!existsSync(path)) return;
  const st = lstatSync(path);
  if (st.isSymbolicLink()) {
    throw new Error('BLOCKED: symlink refused in disposable harness paths');
  }
}

export function writeHarnessMarker(root, dataDir) {
  const marker = {
    magic: OPS_PILOT_HARNESS_MARKER_MAGIC,
    root: resolve(root),
    dataDir: resolve(dataDir),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(root, OPS_PILOT_HARNESS_MARKER_NAME), JSON.stringify(marker), {
    mode: 0o600,
  });
  return marker;
}

export function assertVerifiedHarnessPaths(root, dataDir) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('BLOCKED: harness root missing');
  }
  if (typeof dataDir !== 'string' || dataDir.length === 0) {
    throw new Error('BLOCKED: harness dataDir missing');
  }
  const resolvedRoot = resolve(root);
  const resolvedData = resolve(dataDir);
  assertPathInsideRoot(resolvedRoot, resolvedData);
  assertNoSymlink(resolvedRoot);
  assertNoSymlink(resolvedData);
  const markerPath = join(resolvedRoot, OPS_PILOT_HARNESS_MARKER_NAME);
  if (!existsSync(markerPath)) {
    throw new Error('BLOCKED: harness marker missing; refusing cleanup');
  }
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  if (marker.magic !== OPS_PILOT_HARNESS_MARKER_MAGIC) {
    throw new Error('BLOCKED: harness marker magic mismatch');
  }
  if (resolve(marker.root) !== resolvedRoot || resolve(marker.dataDir) !== resolvedData) {
    throw new Error('BLOCKED: harness marker path substitution detected');
  }
  if (!basename(resolvedRoot).startsWith(OPS_PILOT_HARNESS_ROOT_PREFIX)
    && !resolvedRoot.includes(OPS_PILOT_HARNESS_ROOT_PREFIX)) {
    throw new Error('BLOCKED: disposable root prefix mismatch');
  }
  return { resolvedRoot, resolvedData };
}

export function inspectPostmasterStatus(dataDir, { pgCtlStatusFn } = {}) {
  if (!dataDir || typeof dataDir !== 'string') {
    return { status: POSTMASTER_STATUS.UNCERTAIN, reason: 'missing_dataDir' };
  }
  if (!existsSync(dataDir)) {
    return { status: POSTMASTER_STATUS.STOPPED, reason: 'dataDir_absent' };
  }
  const statusFn = pgCtlStatusFn || ((dir) => spawnSync(
    join(OPS_PILOT_PG_BIN_DIR, 'pg_ctl'),
    ['-D', dir, 'status'],
    { encoding: 'utf8' },
  ));
  let statusResult;
  try {
    statusResult = statusFn(dataDir);
  } catch (error) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pg_ctl_status_threw:${error.message || error}`,
    };
  }
  if (statusResult?.error) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pg_ctl_status_error:${statusResult.error.message || 'unknown'}`,
    };
  }
  if (statusResult?.status === 0) {
    return { status: POSTMASTER_STATUS.RUNNING, reason: 'pg_ctl_status_running' };
  }
  if (statusResult?.status === 3) {
    return { status: POSTMASTER_STATUS.STOPPED, reason: 'pg_ctl_status_not_running' };
  }
  return {
    status: POSTMASTER_STATUS.UNCERTAIN,
    reason: `pg_ctl_status_unexpected:${statusResult?.status}`,
  };
}

export function stopClusterAndProveTerminated(dataDir, { stopFn, inspectFn } = {}) {
  const stopper = stopFn || ((dir) => spawnSync(
    join(OPS_PILOT_PG_BIN_DIR, 'pg_ctl'),
    [...buildPgCtlStopArgs(dir)],
    { encoding: 'utf8' },
  ));
  const inspect = inspectFn || inspectPostmasterStatus;
  let stopError = null;
  try {
    const result = stopper(dataDir);
    if (result?.error) stopError = result.error;
    else if (result && result.status !== 0) {
      stopError = new Error(result.stderr || result.stdout || `pg_ctl stop status=${result.status}`);
    }
  } catch (error) {
    stopError = error;
  }
  const after = inspect(dataDir);
  if (after.status !== POSTMASTER_STATUS.STOPPED) {
    return {
      terminated: false,
      blocked: true,
      status: after.status,
      reason: after.reason,
      stopError: stopError ? String(stopError.message || stopError) : after.reason,
    };
  }
  return {
    terminated: true,
    blocked: false,
    status: after.status,
    reason: after.reason,
    stopError: stopError ? String(stopError.message || stopError) : null,
  };
}

export function removeHarnessRootIfSafe(root, dataDir, { inspectFn } = {}) {
  const verified = assertVerifiedHarnessPaths(root, dataDir);
  const inspection = (inspectFn || inspectPostmasterStatus)(verified.resolvedData);
  if (inspection.status !== POSTMASTER_STATUS.STOPPED) {
    throw new Error(
      `BLOCKED: refusing delete; postmaster status=${inspection.status} (${inspection.reason})`,
    );
  }
  rmSync(verified.resolvedRoot, { recursive: true, force: true });
  return {
    deleted: true,
    root: verified.resolvedRoot,
    dataDir: verified.resolvedData,
  };
}

function runFixedSpawn(spawnSyncFn, bin, args, label) {
  const result = spawnSyncFn(bin, args, {
    encoding: 'utf8',
    env: Object.freeze({
      PATH: '',
      PGHOST: '',
      PGPORT: '',
      PGDATABASE: '',
      PGUSER: '',
      PGPASSWORD: '',
      DATABASE_URL: '',
      LANG: 'C',
      LC_ALL: 'C',
    }),
    shell: false,
  });
  if (result?.error) {
    throw new Error(`${label}_SPAWN_ERROR:${result.error.message || result.error}`);
  }
  if (result && result.status !== 0) {
    throw new Error(
      `${label}_FAILED:status=${result.status}:${result.stderr || result.stdout || ''}`,
    );
  }
  return result;
}

/**
 * Owned disposable cluster controller.
 * Privileged lifecycle requires an Owner/inert one-shot ticket.
 * Live postgres binaries run only when module DB const is true (currently false)
 * or an injected inert spawnSyncFn is supplied for offline tests.
 */
export function createDisposableOpsPilotClusterController(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('CREATE_CONTROLLER', {
    ...config,
    explicitNonProd: true,
  }, env);
  if (gate) {
    return gate;
  }

  let binDir;
  try {
    binDir = assertVerifiedPgBinDir(config.pgBinDir || OPS_PILOT_PG_BIN_DIR);
  } catch (error) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
      error.message || 'PG_BIN_DIR_UNVERIFIED',
    ]);
  }
  let root = null;
  let dataDir = null;
  let socketDir = null;
  let logFile = null;
  let socketPort = null;
  let started = false;
  let startupAttempted = false;
  let cleaned = false;
  let postgresActions = 0;
  const clock = config.clock || {};
  const ticket = config.ownerOneShotTicket;
  const usingInertTicket = isInertOfflineOneShotTicket(ticket);
  const injectedSpawn = typeof config.spawnSyncFn === 'function';
  const runners = {
    spawnSyncFn: injectedSpawn ? config.spawnSyncFn : spawnSync,
    inspectFn: config.inspectFn,
    stopFn: config.stopFn,
    startClusterFn: config.startClusterFn,
  };

  const controller = {
    kind: 'DISPOSABLE_OPS_PILOT_CLUSTER_CONTROLLER',
    proofClass: OPS_PILOT_HARNESS_MODE,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    getPaths() {
      return Object.freeze({ root, dataDir, socketDir, logFile, socketPort, binDir });
    },
    async prepare() {
      const again = recheckBeforeLifecycle('PREPARE', {
        ...config,
        explicitNonProd: true,
        ownerOneShotTicket: ticket,
        clock,
      }, env);
      if (again) return again;
      if (root != null) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_SYMLINK_OR_PREEXISTING, [
          'CLUSTER_ALREADY_PREPARED',
        ]);
      }
      root = mkdtempSync(join(tmpdir(), OPS_PILOT_HARNESS_ROOT_PREFIX));
      dataDir = join(root, 'data');
      socketDir = join(root, 'socket');
      logFile = join(root, 'pg.log');
      socketPort = 56000 + (randomBytes(2).readUInt16BE(0) % 4000);
      mkdirSync(dataDir);
      mkdirSync(socketDir);
      writeHarnessMarker(root, dataDir);
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
        reasons: Object.freeze(['CLUSTER_ROOT_PREPARED_NOT_STARTED']),
        paths: this.getPaths(),
        postgresActions: 0,
        dbExecutionAuthorized: false,
        tier3Authorized: false,
        tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
      });
    },
    async start() {
      const again = recheckBeforeLifecycle('START', {
        ...config,
        explicitNonProd: true,
        ownerOneShotTicket: ticket,
        clock,
      }, env);
      if (again) return again;
      if (root == null) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
          'PREPARE_REQUIRED_BEFORE_START',
        ]);
      }

      const planned = Object.freeze({
        initdbBin: join(binDir, 'initdb'),
        initdbArgs: buildInitdbArgs({
          dataDir,
          pwfile: join(root, 'pwfile'),
        }),
        pgCtlBin: join(binDir, 'pg_ctl'),
        startArgs: buildPgCtlStartArgs({
          dataDir,
          logFile,
          socketDir,
          socketPort,
        }),
        versionProbe: planPostgresVersionProbe(binDir),
        client: planOwnedUnixSocketClientConfig({ socketDir, socketPort }),
      });

      const allowInertLifecycle = usingInertTicket && injectedSpawn;
      const allowLiveLifecycle = ticket.liveSpawnPermitted === true
        && OPS_PILOT_DB_EXECUTION_AUTHORIZED === true
        && !usingInertTicket;

      if (!allowInertLifecycle && !allowLiveLifecycle) {
        // Consume so failure cannot be retried with the same ticket.
        const consumeDeny = consumeOneShotOrDeny(ticket, clock);
        if (consumeDeny) return consumeDeny;
        writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
          'START_PATH_IMPLEMENTED_BUT_LIVE_EXECUTION_GATE_CLOSED',
          'OPS_PILOT_DB_EXECUTION_AUTHORIZED=false',
          'INERT_SPAWN_INJECTION_REQUIRED_FOR_OFFLINE_LIFECYCLE_PROOF',
          'OWNER_TIER3_DISPOSABLE_DB_EXECUTION_STILL_REQUIRED',
        ], {
          plannedArgs: planned,
          oneShotState: ONE_SHOT_STATES.DENIED_OR_TERMINATED,
        });
      }

      const consumeDeny = consumeOneShotOrDeny(ticket, clock);
      if (consumeDeny) return consumeDeny;

      startupAttempted = true;
      try {
        writeFileSync(join(root, 'pwfile'), 'tecp-ops-pilot-disposable\n', { mode: 0o600 });
        const version = runFixedSpawn(
          runners.spawnSyncFn,
          planned.versionProbe.bin,
          [...planned.versionProbe.args],
          'POSTGRES_VERSION',
        );
        const versionText = String(version?.stdout || '');
        if (!versionText.includes(OPS_PILOT_REQUIRED_PG_VERSION_PREFIX)
          && !allowInertLifecycle) {
          throw new Error(`PG_VERSION_MISMATCH:${versionText}`);
        }
        postgresActions += 1;
        runFixedSpawn(
          runners.spawnSyncFn,
          planned.initdbBin,
          [...planned.initdbArgs],
          'INITDB',
        );
        postgresActions += 1;
        if (typeof runners.startClusterFn === 'function') {
          runners.startClusterFn({
            bin: planned.pgCtlBin,
            args: planned.startArgs,
            paths: this.getPaths(),
          });
        } else {
          runFixedSpawn(
            runners.spawnSyncFn,
            planned.pgCtlBin,
            [...planned.startArgs],
            'PG_CTL_START',
          );
        }
        postgresActions += 1;
        started = true;
        writeTicketState(ticket, ONE_SHOT_STATES.TERMINATED);
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze([
            allowInertLifecycle
              ? 'INERT_OFFLINE_LIFECYCLE_EXECUTED_WITH_FAKE_SPAWNER'
              : 'LIVE_DISPOSABLE_CLUSTER_STARTED',
          ]),
          paths: this.getPaths(),
          plannedArgs: planned,
          postgresActions,
          dbExecutionAuthorized: allowLiveLifecycle,
          tier3Authorized: false,
          oneShotState: ONE_SHOT_STATES.TERMINATED,
          inert: allowInertLifecycle,
          startupEvidence: Object.freeze({
            versionProbe: true,
            initdb: true,
            pgCtlStart: true,
            listenAddressesEmpty: true,
            unixSocketOnly: true,
          }),
        });
      } catch (error) {
        writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
          'STARTUP_FAILED',
          error.message || String(error),
          'CLEANUP_REQUIRED_BEFORE_RETRY_WITH_NEW_ONESHOT',
        ], {
          plannedArgs: planned,
          startupAttempted: true,
          postgresActions,
          oneShotState: ONE_SHOT_STATES.DENIED_OR_TERMINATED,
        });
      }
    },
    async stop() {
      const again = recheckBeforeLifecycle('STOP', {
        ...config,
        explicitNonProd: true,
        ownerOneShotTicket: ticket,
        clock,
      }, env);
      // Stop may run after consume; allow owned controller stop when startup attempted.
      if (again
        && again.decision !== OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY
        && again.decision !== OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_EXPIRED
        && !(started || startupAttempted)) {
        return again;
      }
      if (!startupAttempted && !started) {
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['STOP_NOOP_NEVER_STARTED']),
          postgresActions: 0,
          dbExecutionAuthorized: false,
          tier3Authorized: false,
        });
      }
      const proof = stopClusterAndProveTerminated(dataDir, {
        stopFn: runners.stopFn || ((dir) => runners.spawnSyncFn(
          join(binDir, 'pg_ctl'),
          [...buildPgCtlStopArgs(dir)],
          { encoding: 'utf8', shell: false },
        )),
        inspectFn: runners.inspectFn || ((dir) => inspectPostmasterStatus(dir, {
          pgCtlStatusFn: (d) => runners.spawnSyncFn(
            join(binDir, 'pg_ctl'),
            ['-D', d, 'status'],
            { encoding: 'utf8', shell: false },
          ),
        })),
      });
      if (!proof.terminated) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
          'STOP_DID_NOT_PROVE_TERMINATION',
          proof.reason || 'not_terminated',
        ]);
      }
      started = false;
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
        reasons: Object.freeze(['STOP_TERMINATION_PROVEN']),
        postgresActions: 0,
        dbExecutionAuthorized: false,
        tier3Authorized: false,
        terminationEvidence: Object.freeze(proof),
      });
    },
    async cleanup() {
      if (!isOwnedDisposableOpsPilotClusterController(this)) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
          'OWNED_CONTROLLER_REQUIRED',
        ]);
      }
      if (cleaned) {
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['ALREADY_CLEANED']),
          postgresActions: 0,
        });
      }
      if (root == null) {
        cleaned = true;
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['CLEANUP_NOOP_NO_ROOT']),
          postgresActions: 0,
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'NOT_APPLICABLE',
            residualDataDir: 'NONE_CREATED',
          }),
        });
      }
      if (started || startupAttempted) {
        const proof = stopClusterAndProveTerminated(dataDir, {
          stopFn: runners.stopFn || ((dir) => runners.spawnSyncFn(
            join(binDir, 'pg_ctl'),
            [...buildPgCtlStopArgs(dir)],
            { encoding: 'utf8', shell: false },
          )),
          inspectFn: runners.inspectFn || ((dir) => inspectPostmasterStatus(dir, {
            pgCtlStatusFn: (d) => runners.spawnSyncFn(
              join(binDir, 'pg_ctl'),
              ['-D', d, 'status'],
              { encoding: 'utf8', shell: false },
            ),
          })),
        });
        if (!proof.terminated) {
          return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
            'REFUSING_DELETE_WITHOUT_STOP_PROOF',
            proof.reason || 'not_terminated',
            'PRESERVE_FAILED_CLEANUP_EVIDENCE',
          ], {
            cleanupEvidence: Object.freeze({
              stopBeforeDelete: 'FAILED',
              root,
              dataDir,
              proof,
            }),
          });
        }
      }
      try {
        const removed = removeHarnessRootIfSafe(root, dataDir, {
          inspectFn: runners.inspectFn || (() => ({ status: POSTMASTER_STATUS.STOPPED, reason: 'cleanup_owned' })),
        });
        cleaned = true;
        const deletedRoot = removed.root;
        root = null;
        dataDir = null;
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['CLEANUP_SAFE_DELETE']),
          postgresActions: 0,
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'REQUIRED_AND_PROVEN_OR_NEVER_STARTED',
            deletedRoot,
          }),
        });
      } catch (error) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PATH_ESCAPE, [
          error.message || 'CLEANUP_FAILED',
          'PRESERVE_FAILED_CLEANUP_EVIDENCE',
        ], {
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'UNKNOWN',
            root,
            dataDir,
          }),
        });
      }
    },
  };
  ownedClusterLatch.add(controller);
  return controller;
}

export function isOwnedDisposableOpsPilotClusterController(value) {
  return value !== null && typeof value === 'object' && ownedClusterLatch.has(value);
}

export async function detectPostgresVersion(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('DETECT_POSTGRES_VERSION', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  const plan = planPostgresVersionProbe(config.pgBinDir || OPS_PILOT_PG_BIN_DIR);
  const ticket = config.ownerOneShotTicket;
  const allowInert = isInertOfflineOneShotTicket(ticket) && typeof config.spawnSyncFn === 'function';
  if (!allowInert && OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true) {
    const consumeDeny = consumeOneShotOrDeny(ticket, config.clock || {});
    if (consumeDeny) return consumeDeny;
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
      'DETECT_PLANNED_BUT_EXECUTION_GATE_CLOSED',
      `BIN=${plan.bin}`,
    ], { plannedProbe: plan });
  }
  const consumeDeny = consumeOneShotOrDeny(ticket, config.clock || {});
  if (consumeDeny) return consumeDeny;
  try {
    const result = runFixedSpawn(
      config.spawnSyncFn || spawnSync,
      plan.bin,
      [...plan.args],
      'POSTGRES_VERSION',
    );
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
      reasons: Object.freeze(['VERSION_PROBE_EXECUTED']),
      stdout: String(result?.stdout || ''),
      plannedProbe: plan,
      postgresActions: 1,
      inert: allowInert,
    });
  } catch (error) {
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PG_VERSION_MISMATCH, [
      error.message || 'VERSION_PROBE_FAILED',
    ], { plannedProbe: plan });
  }
}

export async function startDisposableOpsPilotCluster(config = {}, env = process.env) {
  const controller = createDisposableOpsPilotClusterController(config, env);
  if (controller && controller.ok === false) return controller;
  return controller.start();
}

export async function stopDisposableOpsPilotCluster(config = {}, env = process.env) {
  if (!isOwnedDisposableOpsPilotClusterController(config.ownedController)) {
    const gate = recheckBeforeLifecycle('STOP_CLUSTER', {
      ...config,
      explicitNonProd: config.explicitNonProd ?? true,
    }, env);
    if (gate) return gate;
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
      'OWNED_CONTROLLER_REQUIRED_FOR_STOP',
    ]);
  }
  return config.ownedController.stop();
}

export async function createDisposableOpsPilotClient(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('CREATE_CLIENT', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  if (typeof config.inertClientFactory === 'function'
    && isInertOfflineOneShotTicket(config.ownerOneShotTicket)) {
    const consumeDeny = consumeOneShotOrDeny(config.ownerOneShotTicket, config.clock || {});
    if (consumeDeny) return consumeDeny;
    const client = config.inertClientFactory({
      ...planOwnedUnixSocketClientConfig({
        socketDir: config.socketDir || '/tmp/tecp-ops-pilot-s2-inert/socket',
        socketPort: config.socketPort || 56111,
      }),
    });
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
      reasons: Object.freeze(['INERT_CLIENT_FACTORY_USED']),
      client,
      postgresActions: 0,
      inert: true,
    });
  }
  const consumeDeny = consumeOneShotOrDeny(config.ownerOneShotTicket, config.clock || {});
  if (consumeDeny) return consumeDeny;
  writeTicketState(config.ownerOneShotTicket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    'CREATE_CLIENT_FORBIDDEN_UNTIL_TIER3_EXECUTION_GATE',
    'NO_PG_MODULE_LOAD_WHILE_DB_EXECUTION_UNAUTHORIZED',
    'UNIX_SOCKET_CLIENT_PLAN_ONLY',
  ], {
    plannedClient: config.socketDir && config.socketPort
      ? planOwnedUnixSocketClientConfig({
        socketDir: config.socketDir,
        socketPort: config.socketPort,
      })
      : null,
  });
}

export async function cleanupDisposableOpsPilotCluster(config = {}, env = process.env) {
  if (isOwnedDisposableOpsPilotClusterController(config.ownedController)) {
    return config.ownedController.cleanup();
  }
  const gate = recheckBeforeLifecycle('CLEANUP', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  if (config.root != null && config.dataDir != null) {
    try {
      assertVerifiedHarnessPaths(config.root, config.dataDir);
    } catch (error) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PATH_ESCAPE, [error.message || 'PATH_VERIFY']);
    }
  }
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
    'CLEANUP_REQUIRES_OWNED_CONTROLLER_OR_VERIFIED_MARKER',
    'STOP_BEFORE_DELETE_MANDATORY',
  ]);
}

export function assertHarnessSourceHasNoEagerPgImport(sourceText) {
  const text = String(sourceText || '');
  const eager = /^\s*import\s+.*\bfrom\s+['"]pg['"]/m.test(text)
    || /^\s*const\s+.*\s*=\s*require\(\s*['"]pg['"]\s*\)/m.test(text);
  return Object.freeze({
    ok: !eager,
    eagerPgImport: eager,
  });
}

// Keep realpathSync referenced for future containment hardening without using it at import.
void realpathSync;
