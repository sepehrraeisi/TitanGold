/**
 * TECP-OPS-PILOT-001 S2 Tier-3 — disposable ops-pilot DB harness.
 *
 * Owner-controlled local runner model with same-UID limitations accepted for
 * disposable TEST_ONLY only. Default: HARD DENY.
 *
 * WeakSet brands, caller booleans, ARGV markers, and environment flips are NOT
 * Owner authentication and never independently authorize PostgreSQL execution.
 * Live PostgreSQL spawn remains closed while OPS_PILOT_DB_EXECUTION_AUTHORIZED=false.
 * Privileged ticket state is module-private (WeakMap); exported tickets are frozen.
 * Offline tests may inject inert spawnSyncFn under an inert one-shot ticket only.
 * Public pg_ctl helpers require an owned disposable controller identity.
 *
 * SIMIN Hyper-V activation prep (2026-11-17): records activation-era target SHA and
 * venue metadata only. Does NOT flip live DB/Tier-3 hard-deny constants, does NOT
 * mint Owner capability latches, and does NOT allow npm test / env / ARGV to spawn PG.
 * Live Tier-3 remains separately Owner-gated after Human QA / merge / capability proof.
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
import { basename, dirname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const OPS_PILOT_HARNESS_MODE = 'DISPOSABLE_OPS_PILOT_ONESHOT_ACTIVATION_DEFAULT_DENY';
export const OPS_PILOT_HARNESS_CHECKPOINT = 'S2_TIER3_FINAL_EXECUTION_READINESS';
export const OPS_PILOT_REQUIRED_PG_VERSION = '14.24';
export const OPS_PILOT_REQUIRED_PG_VERSION_PREFIX = 'postgres (PostgreSQL) 14.24';
export const OPS_PILOT_PG_BIN_DIR = '/usr/lib/postgresql/14/bin';
export const OPS_PILOT_HARNESS_ROOT_PREFIX = 'tecp-ops-pilot-s2-';
export const OPS_PILOT_HARNESS_MARKER_NAME = '.tecp-ops-pilot-harness';
export const OPS_PILOT_HARNESS_MARKER_MAGIC = 'TECP-OPS-PILOT-S2-DISPOSABLE-HARNESS';
export const OPS_PILOT_DB_EXECUTION_AUTHORIZED = false;
export const OPS_PILOT_TIER3_AUTHORIZED = false;
export const TIER3_ACTIVATION_AUTHORITY = 'TIER3_ACTIVATION_AUTHORITY_UNPROVEN';
/** Canonical main tip after PR #295 merge. Offline pin retained; live pin-swap gated. */
export const OPS_PILOT_PINNED_MAIN_SHA = 'ee26aa367475c0002b077bd0ae02838ce8c055e6';
/**
 * Activation-era target tip for future Owner-authorized live Tier-3 on SIMIN Hyper-V.
 * NOT interchangeable with OPS_PILOT_PINNED_MAIN_SHA until a separate Owner live
 * instruction flips the runtime pin AND updates locked offline assertions.
 */
export const OPS_PILOT_ACTIVATION_ERA_TARGET_MAIN_SHA = '5df4ae58572a79acdefccaa5e868e2f191e0a4d2';
/** Venue binding for activation prep — guest Hyper-V VM only. */
export const OPS_PILOT_ACTIVATION_PREP_VENUE =
  'SIMIN_HYPERV_UBUNTU_VM_TITANGOLD_S2_LAB_ONLY';
/** Prep status: binaries/Rule02 prep may advance; live gates remain closed. */
export const OPS_PILOT_ACTIVATION_PREP_STATUS =
  'PG14_BINARIES_AND_RULE02_PREP_ONLY_LIVE_DB_AND_TIER3_GATES_REMAIN_CLOSED';
/** Historical offline regression pin alias (immutable offline invariant). */
export const OPS_PILOT_OFFLINE_CONTRACT_PIN_SHA = OPS_PILOT_PINNED_MAIN_SHA;
/** Live venue binding for SIMIN Hyper-V lab capabilities. */
export const OPS_PILOT_LIVE_VENUE = 'SIMIN_HYPERV_UBUNTU_VM_TITANGOLD_S2_LAB_ONLY';
/** Functional-lab custody class — NOT OHSA / NOT independent recovery-admin proof. */
export const OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB =
  'FUNCTIONAL_LAB_OWNER_SIGNED_CAPABILITY_SAME_UID_ACCEPTED_FOR_DISPOSABLE_ONLY';
export const OPS_PILOT_LIVE_BRIDGE_MODE =
  'CAPABILITY_GATED_ONESHOT_LIVE_LIFECYCLE_MODULE_CONSTS_REMAIN_FALSE';
export const OPS_PILOT_OWNER_TRUST_REGISTRY_RELATIVE_DIR =
  '.tecp-ops-pilot/s2-simin-owner-trust';
export const OPS_PILOT_OWNER_TRUST_PUBKEY_FILENAME = 'ed25519-spki.pem';
export const OPS_PILOT_OWNER_TRUST_KID_FILENAME = 'kid.txt';
export const OPS_PILOT_CANONICAL_GIT_BIN = '/usr/bin/git';
/** Repo root derived from this module path — never caller-supplied. */
export const OPS_PILOT_CANONICAL_REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const TEST_ONLY_GIT_OBSERVATION_PROOF_CLASS = 'TEST_ONLY_GIT_HEAD_OBSERVATION_FIXTURE';
const testOnlyGitObservationLatch = new WeakSet();
/** Governance merge base for offline five-path implementation (PR #307). */
export const OPS_PILOT_GOVERNANCE_MERGE_BASE_SHA =
  '361eaab9d449f3070b87b5ad0c88e5f5a38da49d';
export const OPS_PILOT_LIVE_ACTIVATION_SHA_POLICY =
  'REQUIRES_SEPARATE_OWNER_LIVE_TIER3_INSTRUCTION_PLUS_PIN_SWAP_AND_TEST_ALLOWLIST_UPDATE';
export const OPS_PILOT_OWNER_RUNNER_ARGV_MARKER = '--tecp-ops-s2-owner-controlled-local-runner';
export const OPS_PILOT_DEFAULT_ONESHOT_TTL_MS = 120000;
export const OPS_PILOT_MAX_ONESHOT_TTL_MS = 300000;
export const OPS_PILOT_APPROVED_TEST_ACTIONS = Object.freeze([
  'tecp-ops-persistence/test/cp2DbFencingDurability.test.js',
  'tecp-ops-persistence/test/cp2DbDispatcherIntegration.test.js',
]);

/**
 * Non-executable future Tier-3 contract (documentation + offline readiness only).
 * Does not authorize PostgreSQL, Worker, MCP mutation, dispatch, or Production.
 */
export const TIER3_FINAL_EXECUTION_CONTRACT = Object.freeze({
  repository: 'sepehrraeisi/TitanGold',
  pinnedMainSha: OPS_PILOT_PINNED_MAIN_SHA,
  governanceMergeBaseSha: OPS_PILOT_GOVERNANCE_MERGE_BASE_SHA,
  liveActivationShaPolicy: OPS_PILOT_LIVE_ACTIVATION_SHA_POLICY,
  ownerCapabilityVerifierPath:
    'tecp-ops-persistence/scripts/s2Tier3OwnerCapabilityVerifier.js',
  ownerApproval: 'SEPARATELY_REQUIRED',
  executionPrincipal: 'EXPLICITLY_UNVERIFIED_AS_OWNER',
  executorIdentity: 'EXPLICITLY_UNVERIFIED_AS_OWNER_CUSTODY',
  testSuites: Object.freeze([...OPS_PILOT_APPROVED_TEST_ACTIONS]),
  postgresVersion: OPS_PILOT_REQUIRED_PG_VERSION,
  postgresBinDir: OPS_PILOT_PG_BIN_DIR,
  network: 'UNIX_SOCKET_ONLY',
  externalDbTargets: 'DENY',
  oneShot: true,
  ttlDefaultSeconds: OPS_PILOT_DEFAULT_ONESHOT_TTL_MS / 1000,
  ttlMaxSeconds: OPS_PILOT_MAX_ONESHOT_TTL_MS / 1000,
  cleanup: 'MANDATORY',
  auditEvidence: 'MANDATORY',
  worker: 'DENY',
  mcpMutation: 'DENY',
  operationalDispatch: 'DENY',
  production: 'DENY',
  liveDbExecutionAuthorized: false,
  executableLaunchCommand: null,
  activationEraTargetMainSha: OPS_PILOT_ACTIVATION_ERA_TARGET_MAIN_SHA,
  activationPrepVenue: OPS_PILOT_ACTIVATION_PREP_VENUE,
  activationPrepStatus: OPS_PILOT_ACTIVATION_PREP_STATUS,
  activationEraTargetIsHistoricalPrepOnly: true,
  liveBridgeMode: OPS_PILOT_LIVE_BRIDGE_MODE,
  liveVenue: OPS_PILOT_LIVE_VENUE,
  liveCustodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
  offlineContractPinSha: OPS_PILOT_OFFLINE_CONTRACT_PIN_SHA,
  liveShaPolicy: 'CAPABILITY_PINNED_SHA_MUST_EQUAL_GIT_HEAD_NOT_OFFLINE_PIN',
  windowsPg17: 'DENY',
  wsl2: 'DENY',
  remoteServer: 'DENY',
});

export const TIER3_READINESS_VERDICTS = Object.freeze({
  READY_FOR_SEPARATE_OWNER_TIER3_EXECUTION_AUTHORIZATION:
    'READY_FOR_SEPARATE_OWNER_TIER3_EXECUTION_AUTHORIZATION',
  SOURCE_READY_TRUST_BOUNDARY_BLOCKED: 'SOURCE_READY_TRUST_BOUNDARY_BLOCKED',
  EXACT_SCOPE_INSUFFICIENT: 'EXACT_SCOPE_INSUFFICIENT',
  SECURITY_BLOCKED: 'SECURITY_BLOCKED',
  OFFLINE_INTEGRATION_COMPLETE_EXTERNAL_TRUST_BLOCKED:
    'OFFLINE_INTEGRATION_COMPLETE_EXTERNAL_TRUST_BLOCKED',
});

export const OPS_PILOT_OWNER_RUNNER_RELATIVE_PATH =
  'tecp-ops-persistence/scripts/ownerControlledTier3LocalRunner.js';
export const OPS_PILOT_OWNER_CAPABILITY_VERIFIER_RELATIVE_PATH =
  'tecp-ops-persistence/scripts/s2Tier3OwnerCapabilityVerifier.js';

/**
 * Five-path offline completion: verifier path is in-repo; latch install remains external.
 * Remaining blockers are Owner custody / recovery-admin / separate live authorization.
 */
export const TIER3_REQUIRED_ADDITIONAL_PATHS = Object.freeze([]);

export const TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS = Object.freeze([
  'INDEPENDENT_OWNER_INVOCATION_OR_CUSTODY_BOUNDARY_OUTSIDE_UNTRUSTED_NODE_PROCESS',
  'SEPARATE_EXPLICIT_OWNER_TIER3_LIVE_EXECUTION_INSTRUCTION',
  'FRESH_EXACT_SHA_SAFETY_PREFLIGHT_BEFORE_ANY_PG_SPAWN',
  'VERIFIED_S2_TIER3_OWNER_CAPABILITY_VIA_PUBLIC_KEY_ONLY_VERIFIER',
  'OPS_PILOT_OWNER_CAPABILITY_VERIFIER_RELATIVE_PATH',
  'OWNER_CUSTODY_AND_RECOVERY_ADMIN_INDEPENDENTLY_PROVEN_OUTSIDE_UNTRUSTED_NODE',
  'ACTIVATION_ERA_PIN_SWAP_FROM_OFFLINE_ee26aa_TO_TARGET_TIP_REQUIRES_SEPARATE_OWNER_AND_TEST_ALLOWLIST',
  'DO_NOT_FLIP_OPS_PILOT_DB_EXECUTION_AUTHORIZED_WITHOUT_CAPABILITY_GATED_LIVE_PATH',
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
  DENY_ARGV_ONLY_AUTHORIZATION: 'DENY_ARGV_ONLY_AUTHORIZATION',
  DENY_TICKET_MUTATION_ESCALATION: 'DENY_TICKET_MUTATION_ESCALATION',
  DENY_PREPARE_ALREADY_USED: 'DENY_PREPARE_ALREADY_USED',
  DENY_HELPER_WITHOUT_OWNED_CONTROLLER: 'DENY_HELPER_WITHOUT_OWNED_CONTROLLER',
  DENY_OWNER_AUTHENTICATION_UNPROVEN: 'DENY_OWNER_AUTHENTICATION_UNPROVEN',
  DENY_FINAL_EXECUTION_NOT_READY: 'DENY_FINAL_EXECUTION_NOT_READY',
  DENY_INDEPENDENT_OWNER_CAPABILITY_MISSING: 'DENY_INDEPENDENT_OWNER_CAPABILITY_MISSING',
  DENY_OWNER_CAPABILITY_INVALID: 'DENY_OWNER_CAPABILITY_INVALID',
  DENY_OWNER_CUSTODY_NOT_PROVEN: 'DENY_OWNER_CUSTODY_NOT_PROVEN',
  DENY_OHSA_CUSTODY_CLAIM: 'DENY_OHSA_CUSTODY_CLAIM',
  DENY_LIVE_SHA_BINDING: 'DENY_LIVE_SHA_BINDING',
  DENY_LIVE_VENUE_BINDING: 'DENY_LIVE_VENUE_BINDING',
  DENY_FORGED_VERIFIED_CAPABILITY: 'DENY_FORGED_VERIFIED_CAPABILITY',
  DENY_LIVE_EXECUTION_AUTHORITY: 'DENY_LIVE_EXECUTION_AUTHORITY',
  DENY_PUBLIC_LIVE_DISPOSABLE: 'DENY_PUBLIC_LIVE_DISPOSABLE',
  DENY_TEST_ONLY_TRUST_FOR_LIVE_SUBPROCESS: 'DENY_TEST_ONLY_TRUST_FOR_LIVE_SUBPROCESS',
  DENY_GIT_HEAD_OBSERVATION: 'DENY_GIT_HEAD_OBSERVATION',
  DENY_CALLER_GIT_OVERRIDE: 'DENY_CALLER_GIT_OVERRIDE',
  ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY: 'ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY',
  ALLOW_LIVE_SPAWN_ELIGIBLE_FUNCTIONAL_LAB: 'ALLOW_LIVE_SPAWN_ELIGIBLE_FUNCTIONAL_LAB',
  DENY_RECOVERY_ADMIN_NOT_PROVEN: 'DENY_RECOVERY_ADMIN_NOT_PROVEN',
  DENY_RUNNER_SUITE_GRANT_INVALID: 'DENY_RUNNER_SUITE_GRANT_INVALID',
  ALLOW_OFFLINE_SUITE_ORCHESTRATION: 'ALLOW_OFFLINE_SUITE_ORCHESTRATION',
  DENY_PG_CONNECT_FAILED: 'DENY_PG_CONNECT_FAILED',
  DENY_CALLER_CLIENT_SUBSTITUTION: 'DENY_CALLER_CLIENT_SUBSTITUTION',
  ALLOW_OWNED_CLIENT_ENDED: 'ALLOW_OWNED_CLIENT_ENDED',
  DENY_OWNED_CLIENT_END_FAILED: 'DENY_OWNED_CLIENT_END_FAILED',
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
/** Offline-only runner→suite grants. NEVER Owner authentication or live PG authority. */
const runnerOfflineSuiteGrantLatch = new WeakSet();
/**
 * Independent Owner capability brands. Intentionally never minted by this module —
 * ARGV/env/boolean/UID/WeakSet factories cannot create them. Live PG stays DENY
 * until an out-of-process Owner custody boundary installs a verified capability.
 */
const independentOwnerCapabilityLatch = new WeakSet();
/** Runner-issued live suite authority. Never public-factory mintable. */
const liveSuiteExecutionAuthorityLatch = new WeakSet();
const liveSuiteExecutionAuthorityMeta = new WeakMap();
/** Owned unix-socket clients created by controller for live suites. */
const ownedClusterClientLatch = new WeakSet();
/** Clients that successfully connected before latch. */
const ownedConnectedClusterClientLatch = new WeakSet();
/** Successfully ended owned clients — idempotent end only after verified success. */
const ownedClusterClientEndedLatch = new WeakSet();
/** Owned clients whose end() failed — never report false idempotent success. */
const ownedClusterClientEndFailedLatch = new WeakSet();

/**
 * Provenance checks are bound exclusively to the in-repo verifier module via ESM import.
 * There is no public registration/wire entrypoint — callers cannot substitute fake callbacks.
 * Circular init is safe: verifier only reads harness consts inside functions; harness only
 * calls these inside functions after both modules finish evaluating.
 */
import {
  getVerifierIssuedCapabilityTrustClass,
  isVerifierIssuedCapabilityProvenance,
  verifierIssuedCapabilityAuthorizesLiveSubprocess,
} from '../scripts/s2Tier3OwnerCapabilityVerifier.js';
/** Module-private privileged state. Exported ticket objects are frozen and non-authoritative. */
const ticketPrivilegeByRef = new WeakMap();
const controllerCleanupAuthority = new WeakMap();
const runnerOfflineGrantPrivilege = new WeakMap();

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
  const skipOfflinePin = evidence.skipOfflinePinShaCheck === true
    && evidence.liveCapabilityShaBinding === true;
  if (!skipOfflinePin && repositorySha !== OPS_PILOT_PINNED_MAIN_SHA) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_WRONG_REPOSITORY_SHA, [
      `EXPECTED=${OPS_PILOT_PINNED_MAIN_SHA}`,
      `GOT=${repositorySha || 'MISSING'}`,
    ]);
  }
  if (skipOfflinePin) {
    if (!/^[0-9a-f]{40}$/.test(repositorySha)) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
        'LIVE_REPOSITORY_SHA_MUST_BE_40_HEX',
      ]);
    }
    if (repositorySha === OPS_PILOT_PINNED_MAIN_SHA) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
        'LIVE_SHA_MUST_NOT_BE_HISTORICAL_OFFLINE_PIN',
        OPS_PILOT_LIVE_ACTIVATION_SHA_POLICY,
      ]);
    }
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

  // Structural context may be observed, but ARGV is NOT Owner authentication.
  return Object.freeze({
    ok: false,
    allowed: false,
    decision: OPS_PILOT_HARNESS_DECISIONS.DENY_ARGV_ONLY_AUTHORIZATION,
    reasons: Object.freeze([
      'ARGV_MARKER_IS_INVOCATION_CONTEXT_ONLY',
      'OWNER_AUTHENTICATION_NOT_PROVEN',
      'PINNED_SHA_AND_ALLOWLIST_CONTEXT_OBSERVED_BUT_NOT_AUTHORIZING',
      'SAME_UID_LIMITATIONS_ACCEPTED',
    ]),
    ownerInvocationIndependentlyVerifiable: false,
    ownerAuthenticationProven: false,
    ownerInvocationContextObserved: true,
    ownerInvocationMechanism: 'ARGV_MARKER_CONTEXT_ONLY_NOT_OWNER_AUTHORITY',
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

function createTicketRecord(publicFields, privilegeFields) {
  const ticket = Object.freeze({
    kind: 'OWNER_ONESHOT_ACTIVATION_TICKET',
    ...publicFields,
  });
  ticketPrivilegeByRef.set(ticket, {
    state: privilegeFields.state,
    consumed: privilegeFields.consumed === true,
    cancelled: privilegeFields.cancelled === true,
    inert: privilegeFields.inert === true,
    liveSpawnPermitted: privilegeFields.liveSpawnPermitted === true,
    prepareUsed: privilegeFields.prepareUsed === true,
    expiresAtMonotonicMs: privilegeFields.expiresAtMonotonicMs,
    createdAtMonotonicMs: privilegeFields.createdAtMonotonicMs,
    ttlMs: privilegeFields.ttlMs,
    repositorySha: privilegeFields.repositorySha,
    approvedActions: privilegeFields.approvedActions,
    nonce: privilegeFields.nonce,
  });
  oneShotTicketLatch.add(ticket);
  return ticket;
}

function getTicketPrivilege(ticket) {
  return ticketPrivilegeByRef.get(ticket) || null;
}

function readTicketState(ticket) {
  const priv = getTicketPrivilege(ticket);
  return priv ? priv.state : undefined;
}

function writeTicketState(ticket, state) {
  const priv = getTicketPrivilege(ticket);
  if (!priv) return;
  priv.state = state;
}

function isTicketExpired(ticket, clock) {
  const priv = getTicketPrivilege(ticket);
  if (!priv) return true;
  return monotonicNowMs(clock) > priv.expiresAtMonotonicMs;
}

function assertTicketNotEscalatedByMutation(ticket) {
  const priv = getTicketPrivilege(ticket);
  if (!priv) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, ['TICKET_PRIVILEGE_MISSING']);
  }
  // Exported frozen tickets have no authoritative mutable fields. If a caller
  // somehow attaches own props, they must never grant live spawn.
  if (ticket && ticket.liveSpawnPermitted === true && priv.liveSpawnPermitted !== true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TICKET_MUTATION_ESCALATION, [
      'CALLER_MUTATED_LIVESPAWN_IGNORED',
      'PRIVILEGE_STATE_IS_MODULE_PRIVATE',
    ]);
  }
  if (ticket && ticket.consumed === false && priv.consumed === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TICKET_MUTATION_ESCALATION, [
      'CALLER_CLEARED_CONSUMED_IGNORED',
    ]);
  }
  return null;
}

export function isOwnerOneShotTicket(value) {
  return value !== null && typeof value === 'object' && oneShotTicketLatch.has(value);
}

export function isInertOfflineOneShotTicket(value) {
  return isOwnerOneShotTicket(value) && inertOneShotLatch.has(value);
}

export function isActiveOwnerOneShotTicket(value, clock = {}) {
  if (!isOwnerOneShotTicket(value)) return false;
  const priv = getTicketPrivilege(value);
  if (!priv || priv.consumed === true || priv.cancelled === true) return false;
  const state = priv.state;
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
  const priv = getTicketPrivilege(ticket);
  const expired = isTicketExpired(ticket, clock);
  return Object.freeze({
    ok: true,
    state: expired && priv.state === ONE_SHOT_STATES.ACTIVE_TEST_ONLY
      ? ONE_SHOT_STATES.DENIED_OR_TERMINATED
      : priv.state,
    inert: isInertOfflineOneShotTicket(ticket),
    consumed: priv.consumed === true,
    cancelled: priv.cancelled === true,
    prepareUsed: priv.prepareUsed === true,
    expiresAtMonotonicMs: priv.expiresAtMonotonicMs,
    approvedActions: ticket.approvedActions,
    repositorySha: ticket.repositorySha,
    liveSpawnPermitted: false,
    operationalOwnerCustodyProven: false,
    ownerAuthenticationProven: false,
    sameUidSealed: false,
  });
}

/**
 * Activate a one-shot Owner-controlled local runner ticket.
 * Fail-closed unless argv marker + pinned SHA + allowlist verify.
 */
export function activateOwnerControlledLocalRunnerOneShot(evidence = {}, deps = {}) {
  const verified = evaluateOwnerControlledLocalRunnerEvidence(evidence, deps);
  // Even when ARGV/context structurally matches, do NOT mint Owner authority.
  // Same-UID ARGV spoofing is not independent Owner authentication.
  if (verified.liveSpawnRequested === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
      'LIVE_SPAWN_REQUESTED_BUT_TIER3_DB_EXECUTION_AUTHORIZED_NO',
      'OWNER_AUTHENTICATION_NOT_PROVEN_IN_TWO_FILE_SCOPE',
    ], {
      ownerAuthenticationProven: false,
      ownerInvocationIndependentlyVerifiable: false,
    });
  }
  if (verified.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_ARGV_ONLY_AUTHORIZATION) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_AUTHENTICATION_UNPROVEN, [
      'OWNER_AUTHENTICATION_NOT_PROVEN_IN_TWO_FILE_SCOPE',
      'ARGV_MARKER_ENV_BOOLEAN_WEAKSET_NOT_OWNER_AUTHORITY',
      'LIVE_EXECUTION_GATE_REMAINS_CLOSED',
      'USE_INERT_OFFLINE_TICKET_FOR_FAKE_SPAWNER_TESTS_ONLY',
      ...(verified.reasons || []),
    ], {
      ownerAuthenticationProven: false,
      ownerInvocationIndependentlyVerifiable: false,
      ownerInvocationContextObserved: true,
      exactScopeInsufficientForIndependentOwnerCustody: true,
    });
  }
  if (!verified.ok) {
    return verified;
  }
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_AUTHENTICATION_UNPROVEN, [
    'OWNER_AUTHENTICATION_NOT_PROVEN_IN_TWO_FILE_SCOPE',
    'DEFAULT_DENY',
  ], {
    ownerAuthenticationProven: false,
    ownerInvocationIndependentlyVerifiable: false,
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
  const nonce = randomBytes(16).toString('hex');
  const ticket = createTicketRecord({
    proofClass: 'TEST_ONLY_INERT_ONESHOT_TICKET',
    repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    approvedActions,
    executablePath: process.execPath,
    harnessModulePath: HARNESS_MODULE_PATH,
    executionPrincipal: process.getuid?.(),
    nonce,
    authorizesLivePostgres: false,
    ownerAuthenticationProven: false,
  }, {
    state: ONE_SHOT_STATES.ACTIVE_TEST_ONLY,
    consumed: false,
    cancelled: false,
    inert: true,
    prepareUsed: false,
    createdAtMonotonicMs: now,
    expiresAtMonotonicMs: now + ttlMs,
    ttlMs,
    repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    approvedActions,
    nonce,
  });
  inertOneShotLatch.add(ticket);
  return ticket;
}

export function cancelOwnerOneShotTicket(ticket, clock = {}) {
  if (!isOwnerOneShotTicket(ticket)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, ['TICKET_REQUIRED']);
  }
  const priv = getTicketPrivilege(ticket);
  priv.cancelled = true;
  priv.state = ONE_SHOT_STATES.DENIED_OR_TERMINATED;
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
  const escalation = assertTicketNotEscalatedByMutation(ticket);
  if (escalation) return escalation;
  const priv = getTicketPrivilege(ticket);
  if (priv.cancelled === true) {
    priv.state = ONE_SHOT_STATES.DENIED_OR_TERMINATED;
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED, ['TICKET_CANCELLED']);
  }
  if (priv.consumed === true
    || priv.state === ONE_SHOT_STATES.CONSUMED
    || priv.state === ONE_SHOT_STATES.TERMINATED
    || priv.state === ONE_SHOT_STATES.DENIED_OR_TERMINATED) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY, [
      'ONESHOT_ALREADY_CONSUMED_OR_TERMINATED',
    ]);
  }
  if (isTicketExpired(ticket, clock)) {
    priv.state = ONE_SHOT_STATES.DENIED_OR_TERMINATED;
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_EXPIRED, ['ONESHOT_TTL_EXCEEDED']);
  }
  if (priv.state !== ONE_SHOT_STATES.ACTIVE_TEST_ONLY && priv.state !== ONE_SHOT_STATES.RESERVED) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, [
      `INVALID_STATE=${priv.state}`,
    ]);
  }
  // Admit: (1) inert offline tickets, or (2) module-private liveSpawnPermitted
  // privilege minted only by createLiveCapabilityGatedOneShotTicket after verifier provenance.
  // Booleans/proofClass/copied objects cannot forge liveSpawnPermitted.
  const privLive = getTicketPrivilege(ticket);
  const liveAdmitted = privLive?.liveSpawnPermitted === true
    && privLive?.inert !== true
    && isOwnerOneShotTicket(ticket);
  if (!isInertOfflineOneShotTicket(ticket) && !liveAdmitted) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_AUTHENTICATION_UNPROVEN, [
      'NON_INERT_TICKET_NOT_AUTHORIZED_FOR_LIFECYCLE',
      'LIVE_SPAWN_PRIVILEGE_REQUIRED_OR_INERT_OFFLINE_TICKET',
    ]);
  }
  return null;
}

function consumeOneShotOrDeny(ticket, clock = {}) {
  const priv = getTicketPrivilege(ticket);
  if (!priv) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, ['TICKET_PRIVILEGE_MISSING']);
  }
  if (priv.cancelled === true) {
    priv.state = ONE_SHOT_STATES.DENIED_OR_TERMINATED;
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_CANCELLED, ['TICKET_CANCELLED']);
  }
  if (priv.consumed === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY, ['REPLAY_FORBIDDEN']);
  }
  if (isTicketExpired(ticket, clock)) {
    priv.state = ONE_SHOT_STATES.DENIED_OR_TERMINATED;
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_EXPIRED, ['ONESHOT_TTL_EXCEEDED']);
  }
  priv.consumed = true;
  priv.state = ONE_SHOT_STATES.CONSUMED;
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
    '--locale=C.utf8',
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


const harnessRequire = createRequire(import.meta.url);

export function resolveOpsPilotPgClientDependency() {
  try {
    const resolved = harnessRequire.resolve('pg');
    const version = harnessRequire('pg/package.json').version;
    const pg = harnessRequire('pg');
    const Client = pg && pg.Client;
    if (typeof Client !== 'function') {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
        'PG_CLIENT_CONSTRUCTOR_MISSING',
      ]);
    }
    if (String(version) !== '8.16.3') {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
        'PG_CLIENT_VERSION_UNEXPECTED',
        String(version),
      ]);
    }
    return Object.freeze({
      ok: true,
      allowed: true,
      version: String(version),
      resolved,
      clientCtorType: 'function',
      packageName: '@titangold/tecp-ops-persistence',
    });
  } catch (error) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
      'PG_MODULE_LOAD_FAILED',
      String(error && error.message ? error.message : error),
    ]);
  }
}

function loadPgClientConstructor() {
  const dep = resolveOpsPilotPgClientDependency();
  if (!dep.ok) {
    const err = new Error((dep.reasons || ['PG_MODULE_LOAD_FAILED']).join(','));
    err.dependencyResult = dep;
    throw err;
  }
  return harnessRequire('pg').Client;
}

function rejectCallerClientAuthority(config = {}) {
  if (
    config.client != null
    || config.Client != null
    || config.clientConstructor != null
    || config.pgClient != null
    || config.connectionString != null
    || config.databaseUrl != null
    || config.DATABASE_URL != null
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_CLIENT_SUBSTITUTION, [
      'CALLER_CLIENT_OR_DATABASE_URL_FORBIDDEN',
      'OWNED_CONTROLLER_SOCKET_PLAN_ONLY',
    ]);
  }
  return null;
}

async function safeEndClient(client) {
  if (!client || typeof client.end !== 'function') {
    return { ok: true, ended: false };
  }
  try {
    await client.end();
    return { ok: true, ended: true };
  } catch (error) {
    return {
      ok: false,
      ended: false,
      error: String(error && error.message ? error.message : error),
    };
  }
}

/**
 * End an owned latched client once. Idempotent. Never treats end as SQL PASS.
 */
export async function endOwnedClusterClient(client) {
  if (client == null) {
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_OWNED_CLIENT_ENDED,
      reasons: Object.freeze(['CLIENT_END_NOOP_NULL']),
      postgresActions: 0,
      verifiedClosed: false,
      endInvoked: false,
    });
  }
  // Only successful prior closes are idempotent success. Failed closes never upgrade to PASS.
  if (ownedClusterClientEndedLatch.has(client)) {
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_OWNED_CLIENT_ENDED,
      reasons: Object.freeze(['CLIENT_END_IDEMPOTENT']),
      postgresActions: 0,
      alreadyEnded: true,
      verifiedClosed: true,
      endInvoked: false,
    });
  }
  if (ownedClusterClientEndFailedLatch.has(client)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNED_CLIENT_END_FAILED, [
      'PRIOR_OWNED_CLIENT_END_FAILED',
      'NO_FALSE_IDEMPOTENT_SUCCESS',
      'REFUSING_UNSAFE_SECOND_CLOSE',
    ], {
      clientEndAttempted: true,
      verifiedClosed: false,
      endInvoked: false,
    });
  }
  if (!ownedClusterClientLatch.has(client)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_CLIENT_SUBSTITUTION, [
      'CLIENT_NOT_OWNED_LATCHED',
      'REFUSING_END_OF_FOREIGN_CLIENT',
    ], { verifiedClosed: false, endInvoked: false });
  }
  const ended = await safeEndClient(client);
  if (!ended.ok) {
    ownedClusterClientEndFailedLatch.add(client);
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNED_CLIENT_END_FAILED, [
      'OWNED_CLIENT_END_FAILED',
      ended.error || 'END_FAILED',
      'CLIENT_NOT_MARKED_SUCCESSFULLY_CLOSED',
    ], {
      clientEndAttempted: true,
      verifiedClosed: false,
      endInvoked: true,
    });
  }
  ownedClusterClientEndedLatch.add(client);
  try { ownedClusterClientLatch.delete(client); } catch (_) { /* WeakSet delete */ }
  try { ownedConnectedClusterClientLatch.delete(client); } catch (_) { /* WeakSet delete */ }
  try { ownedClusterClientEndFailedLatch.delete(client); } catch (_) { /* WeakSet delete */ }
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_OWNED_CLIENT_ENDED,
    reasons: Object.freeze(['OWNED_CLIENT_ENDED_BEFORE_POSTGRES_STOP']),
    postgresActions: 0,
    verifiedClosed: true,
    endInvoked: true,
  });
}

/**
 * Verified owned-client close required for live overall PASS.
 * Null/missing/failed/unverified closes are not success.
 */
export function isValidatedSuccessfulOwnedClientEnd(result) {
  if (result == null || typeof result !== 'object' || Array.isArray(result)) {
    return false;
  }
  if (result.ok !== true || result.verifiedClosed !== true) {
    return false;
  }
  if (result.decision !== OPS_PILOT_HARNESS_DECISIONS.ALLOW_OWNED_CLIENT_ENDED) {
    return false;
  }
  if (!Array.isArray(result.reasons)) {
    return false;
  }
  return true;
}

export function isOwnedConnectedClusterClient(value) {
  return value != null
    && typeof value === 'object'
    && ownedClusterClientLatch.has(value)
    && ownedConnectedClusterClientLatch.has(value)
    && !ownedClusterClientEndedLatch.has(value);
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

function assertOwnedControllerBindsDataDir(ownedController, dataDir) {
  if (!isOwnedDisposableOpsPilotClusterController(ownedController)) {
    return false;
  }
  const auth = controllerCleanupAuthority.get(ownedController);
  if (!auth || !auth.dataDir || typeof dataDir !== 'string') {
    return false;
  }
  return resolve(auth.dataDir) === resolve(dataDir);
}

/**
 * Inspect postmaster status. Direct/default pg_ctl status is restricted to a
 * verified controller-owned disposable dataDir. Injected status fns are offline-safe.
 */
export function inspectPostmasterStatus(dataDir, { pgCtlStatusFn, ownedController } = {}) {
  if (!dataDir || typeof dataDir !== 'string') {
    return { status: POSTMASTER_STATUS.UNCERTAIN, reason: 'missing_dataDir' };
  }
  if (!pgCtlStatusFn) {
    if (!assertOwnedControllerBindsDataDir(ownedController, dataDir)) {
      return {
        status: POSTMASTER_STATUS.UNCERTAIN,
        reason: 'DENY_HELPER_WITHOUT_OWNED_CONTROLLER',
        decision: OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
        blocked: true,
        ok: false,
        allowed: false,
      };
    }
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

export function stopClusterAndProveTerminated(dataDir, { stopFn, inspectFn, ownedController } = {}) {
  if (!stopFn) {
    if (!assertOwnedControllerBindsDataDir(ownedController, dataDir)) {
      return {
        terminated: false,
        blocked: true,
        status: POSTMASTER_STATUS.UNCERTAIN,
        reason: 'DENY_HELPER_WITHOUT_OWNED_CONTROLLER',
        decision: OPS_PILOT_HARNESS_DECISIONS.DENY_HELPER_WITHOUT_OWNED_CONTROLLER,
        ok: false,
        allowed: false,
        stopError: 'OWNED_CONTROLLER_REQUIRED_FOR_DEFAULT_PG_CTL_STOP',
      };
    }
  }
  const stopper = stopFn || ((dir) => spawnSync(
    join(OPS_PILOT_PG_BIN_DIR, 'pg_ctl'),
    [...buildPgCtlStopArgs(dir)],
    { encoding: 'utf8' },
  ));
  const inspect = inspectFn || ((dir) => inspectPostmasterStatus(dir, { ownedController }));
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

export function removeHarnessRootIfSafe(root, dataDir, { inspectFn, ownedController } = {}) {
  const verified = assertVerifiedHarnessPaths(root, dataDir);
  if (!inspectFn && !assertOwnedControllerBindsDataDir(ownedController, verified.resolvedData)) {
    throw new Error('BLOCKED: ownedController or inspectFn required; refusing default pg_ctl');
  }
  const inspection = inspectFn
    ? inspectFn(verified.resolvedData)
    : inspectPostmasterStatus(verified.resolvedData, { ownedController });
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
  let ownedClusterClientRef = null;
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
      const priv = getTicketPrivilege(ticket);
      if (!priv) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_DISABLED, ['TICKET_PRIVILEGE_MISSING']);
      }
      if (priv.prepareUsed === true || root != null) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PREPARE_ALREADY_USED, [
          'PREPARE_ONE_SHOT_PER_TICKET',
          'REPEATED_ALLOCATION_FORBIDDEN',
        ]);
      }
      // Filesystem allocation only for inert TEST_ONLY tickets or capability-gated
      // live one-shot (liveSpawnPermitted private privilege). Never via ARGV/env/boolean.
      const allowLivePrepare = priv.liveSpawnPermitted === true && !usingInertTicket;
      if (!usingInertTicket && !allowLivePrepare) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_AUTHENTICATION_UNPROVEN, [
          'PREPARE_REQUIRES_INERT_OR_LIVE_CAPABILITY_TICKET',
          'ARGV_ENV_BOOLEAN_PUBLIC_FACTORY_CANNOT_AUTHORIZE_FS_ALLOCATION',
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
      priv.prepareUsed = true;
      controllerCleanupAuthority.set(controller, {
        root,
        dataDir,
        socketDir,
        preparedAtMonotonicMs: monotonicNowMs(clock),
      });
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
      const ticketPriv = getTicketPrivilege(ticket);
      // Live lifecycle is capability-gated one-shot privilege only.
      // Global module consts MUST remain false (offline invariant).
      // Offline wiring probe may combine liveSpawnPermitted + injected spawn without real SQL authority.
      const allowOfflineLiveWiring = ticketPriv?.liveSpawnPermitted === true
        && !usingInertTicket
        && injectedSpawn
        && config.offlineWiringProbe === true;
      const allowLiveLifecycle = ticketPriv?.liveSpawnPermitted === true
        && OPS_PILOT_DB_EXECUTION_AUTHORIZED === false
        && OPS_PILOT_TIER3_AUTHORIZED === false
        && !usingInertTicket
        && (!injectedSpawn || allowOfflineLiveWiring);

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
          && !allowInertLifecycle
          && !allowOfflineLiveWiring) {
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
              : (allowOfflineLiveWiring
                ? 'OFFLINE_LIVE_WIRING_PROBE_LIFECYCLE_WITH_FAKE_SPAWNER'
                : 'LIVE_DISPOSABLE_CLUSTER_STARTED'),
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
    async createOwnedClusterClient(options = {}) {
      const again = recheckBeforeLifecycle('CREATE_CLIENT', {
        ...config,
        explicitNonProd: true,
        ownerOneShotTicket: ticket,
        clock,
      }, env);
      // start() consumes/terminates the one-shot by design; CREATE_CLIENT remains
      // allowed only on this still-started owned controller (not a replayed start).
      if (again
        && !(started === true
          && again.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY)) {
        return again;
      }
      if (!started) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
          'START_REQUIRED_BEFORE_OWNED_CLIENT',
        ]);
      }
      if (
        options.client != null
        || options.Client != null
        || options.clientConstructor != null
        || options.pgClient != null
        || options.socketDir != null
        || options.socketPort != null
        || options.connectionString != null
        || options.databaseUrl != null
        || options.DATABASE_URL != null
      ) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_CLIENT_SUBSTITUTION, [
          'CALLER_CLIENT_SOCKET_OR_DATABASE_URL_FORBIDDEN',
          'CONTROLLER_PATHS_ONLY',
        ]);
      }
      const paths = this.getPaths();
      const clientResult = await createDisposableOpsPilotClient({
        explicitNonProd: true,
        ownerOneShotTicket: ticket,
        clock,
        socketDir: paths.socketDir,
        socketPort: paths.socketPort,
        ownedControllerIssued: true,
        allowConsumedTicketAfterOwnedStart: true,
        offlineWiringProbe: options.offlineWiringProbe === true,
        inertClientFactory: options.inertClientFactory,
      }, env);
      if (clientResult?.ok && clientResult.client) {
        ownedClusterClientRef = clientResult.client;
      }
      return clientResult;
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
      let clientEndResult = null;
      if (ownedClusterClientRef != null) {
        try {
          clientEndResult = await endOwnedClusterClient(ownedClusterClientRef);
        } catch (error) {
          clientEndResult = deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNED_CLIENT_END_FAILED, [
            'OWNED_CLIENT_END_THREW',
            String(error && error.message ? error.message : error),
          ], { verifiedClosed: false, endInvoked: true });
        }
        // Clear ref only after verified close; retain for truthful failed-close evidence otherwise.
        if (isValidatedSuccessfulOwnedClientEnd(clientEndResult)) {
          ownedClusterClientRef = null;
        }
      }
      const proof = stopClusterAndProveTerminated(dataDir, {
        ownedController: this,
        stopFn: runners.stopFn || ((dir) => runners.spawnSyncFn(
          join(binDir, 'pg_ctl'),
          [...buildPgCtlStopArgs(dir)],
          { encoding: 'utf8', shell: false },
        )),
        inspectFn: runners.inspectFn || ((dir) => inspectPostmasterStatus(dir, {
          ownedController: this,
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
        ], { clientEndResult, clientClosed: isValidatedSuccessfulOwnedClientEnd(clientEndResult) });
      }
      started = false;
      if (clientEndResult != null && !isValidatedSuccessfulOwnedClientEnd(clientEndResult)) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNED_CLIENT_END_FAILED, [
          'OWNED_CLIENT_END_FAILED_BEFORE_OR_DURING_STOP',
          'POSTMASTER_STOP_ATTEMPTED_WITHOUT_CLAIMING_CLIENT_CLOSE',
          ...(clientEndResult.reasons || []),
        ], {
          clientEndResult,
          clientClosed: false,
          terminationEvidence: Object.freeze(proof),
        });
      }
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
        reasons: Object.freeze([
          'STOP_TERMINATION_PROVEN',
          ...(clientEndResult != null ? ['OWNED_CLIENT_ENDED_BEFORE_POSTGRES_STOP'] : ['STOP_NO_OWNED_CLIENT_REF']),
        ]),
        postgresActions: 0,
        dbExecutionAuthorized: false,
        tier3Authorized: false,
        clientEndResult,
        clientClosed: clientEndResult == null ? null : true,
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
      let clientEndResult = null;
      if (ownedClusterClientRef != null) {
        try {
          clientEndResult = await endOwnedClusterClient(ownedClusterClientRef);
        } catch (error) {
          clientEndResult = deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNED_CLIENT_END_FAILED, [
            'OWNED_CLIENT_END_THREW_DURING_CLEANUP',
            String(error && error.message ? error.message : error),
          ], { verifiedClosed: false, endInvoked: true });
        }
        if (isValidatedSuccessfulOwnedClientEnd(clientEndResult)) {
          ownedClusterClientRef = null;
        }
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
            clientEndResult,
            clientClosed: isValidatedSuccessfulOwnedClientEnd(clientEndResult),
            cleanupEvidence: Object.freeze({
              stopBeforeDelete: 'FAILED',
              root,
              dataDir,
              proof,
              clientEndResult,
            }),
          });
        }
      }
      try {
        const removed = removeHarnessRootIfSafe(root, dataDir, {
          ownedController: this,
          inspectFn: runners.inspectFn || (() => ({ status: POSTMASTER_STATUS.STOPPED, reason: 'cleanup_owned' })),
        });
        cleaned = true;
        const deletedRoot = removed.root;
        root = null;
        dataDir = null;
        if (clientEndResult != null && !isValidatedSuccessfulOwnedClientEnd(clientEndResult)) {
          return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNED_CLIENT_END_FAILED, [
            'CLEANUP_COMPLETED_WITHOUT_VERIFIED_CLIENT_CLOSE',
            'NO_FALSE_CLIENT_DISCONNECT_CLAIM',
            ...(clientEndResult.reasons || []),
          ], {
            clientEndResult,
            clientClosed: false,
            cleanupEvidence: Object.freeze({
              stopBeforeDelete: 'REQUIRED_AND_PROVEN_OR_NEVER_STARTED',
              deletedRoot,
              clientEndResult,
            }),
          });
        }
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze([
            'CLEANUP_SAFE_DELETE',
            ...(clientEndResult != null ? ['OWNED_CLIENT_ENDED_BEFORE_CLEANUP'] : []),
          ]),
          postgresActions: 0,
          clientEndResult,
          clientClosed: clientEndResult == null ? null : true,
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'REQUIRED_AND_PROVEN_OR_NEVER_STARTED',
            deletedRoot,
            clientEndResult,
          }),
        });
      } catch (error) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PATH_ESCAPE, [
          error.message || 'CLEANUP_FAILED',
          'PRESERVE_FAILED_CLEANUP_EVIDENCE',
        ], {
          clientEndResult,
          clientClosed: isValidatedSuccessfulOwnedClientEnd(clientEndResult),
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'UNKNOWN',
            root,
            dataDir,
            clientEndResult,
          }),
        });
      }
    },
  };
  ownedClusterLatch.add(controller);
  controllerCleanupAuthority.set(controller, { root: null, dataDir: null, socketDir: null });
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
  // Fail closed on caller client/DATABASE_URL substitution before any other gate.
  const substitution = rejectCallerClientAuthority(config);
  if (substitution) return substitution;

  const gate = recheckBeforeLifecycle('CREATE_CLIENT', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) {
    const allowAfterStart = config.allowConsumedTicketAfterOwnedStart === true
      && config.ownedControllerIssued === true
      && gate.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY;
    if (!allowAfterStart) return gate;
  }

  if (typeof config.inertClientFactory === 'function'
    && isInertOfflineOneShotTicket(config.ownerOneShotTicket)) {
    const privExisting = getTicketPrivilege(config.ownerOneShotTicket);
    const alreadyConsumedForOwnedStart = config.allowConsumedTicketAfterOwnedStart === true
      && config.ownedControllerIssued === true
      && privExisting?.consumed === true;
    if (!alreadyConsumedForOwnedStart) {
      const consumeDeny = consumeOneShotOrDeny(config.ownerOneShotTicket, config.clock || {});
      if (consumeDeny) return consumeDeny;
    }
    const client = config.inertClientFactory({
      ...planOwnedUnixSocketClientConfig({
        socketDir: config.socketDir || '/tmp/tecp-ops-pilot-s2-inert/socket',
        socketPort: config.socketPort || 56111,
      }),
    });
    // Controller-issued inert clients: connect hook (if any) before latch; never SQL PASS authority.
    if (config.ownedControllerIssued === true) {
      if (typeof client?.connect === 'function') {
        try {
          await client.connect();
        } catch (error) {
          await safeEndClient(client);
          return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PG_CONNECT_FAILED, [
            'OWNED_INERT_CLIENT_CONNECT_FAILED',
            String(error && error.message ? error.message : error),
            'FAIL_CLOSED_NO_LATCH',
          ]);
        }
      }
      ownedConnectedClusterClientLatch.add(client);
      ownedClusterClientLatch.add(client);
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
        reasons: Object.freeze([
          'INERT_OWNED_CLIENT_CONNECTED_BEFORE_SQL_GATE',
          'INERT_CLIENT_FACTORY_USED',
        ]),
        client,
        postgresActions: 0,
        inert: true,
        connected: true,
      });
    }
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
      reasons: Object.freeze(['INERT_CLIENT_FACTORY_USED']),
      client,
      postgresActions: 0,
      inert: true,
      connected: false,
    });
  }
  const ticket = config.ownerOneShotTicket;
  const priv = isOwnerOneShotTicket(ticket) ? getTicketPrivilege(ticket) : null;
  const liveClientAllowed = priv?.liveSpawnPermitted === true
    && priv?.inert !== true
    && OPS_PILOT_DB_EXECUTION_AUTHORIZED === false
    && OPS_PILOT_TIER3_AUTHORIZED === false;

  // Offline wiring: inert factory may pair with liveSpawnPermitted ticket ONLY when
  // explicitly requested for probe (never reports real SQL PASS).
  if (liveClientAllowed
    && config.offlineWiringProbe === true
    && typeof config.inertClientFactory === 'function') {
    const client = config.inertClientFactory({
      ...planOwnedUnixSocketClientConfig({
        socketDir: config.socketDir,
        socketPort: config.socketPort,
      }),
    });
    if (typeof client?.connect === 'function') {
      try {
        await client.connect();
      } catch (error) {
        await safeEndClient(client);
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PG_CONNECT_FAILED, [
          'OFFLINE_WIRING_CLIENT_CONNECT_FAILED',
          String(error && error.message ? error.message : error),
          'FAIL_CLOSED_NO_LATCH',
        ]);
      }
    }
    ownedConnectedClusterClientLatch.add(client);
    ownedClusterClientLatch.add(client);
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
      reasons: Object.freeze([
        'OFFLINE_WIRING_OWNED_INERT_CLIENT',
        'CONNECT_BEFORE_LATCH',
      ]),
      client,
      postgresActions: 0,
      inert: true,
      offlineWiringProbe: true,
      connected: true,
    });
  }

  if (liveClientAllowed
    && typeof config.socketDir === 'string'
    && Number.isSafeInteger(config.socketPort)) {
    // Capability-gated live client: resolve pg from this package only after live privilege.
    let Client;
    try {
      Client = loadPgClientConstructor();
    } catch (error) {
      const dep = error && error.dependencyResult;
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
        'PG_MODULE_LOAD_FAILED',
        ...(dep?.reasons || [String(error && error.message ? error.message : error)]),
      ]);
    }
    const planned = planOwnedUnixSocketClientConfig({
      socketDir: config.socketDir,
      socketPort: config.socketPort,
    });
    const client = new Client({
      host: planned.host,
      port: planned.port,
      user: planned.user,
      database: planned.database,
      password: planned.password,
    });
    // Unix-socket directory is host for node-pg; never connectionString / DATABASE_URL.
    if (planned.socketDir || planned.host) {
      client.host = planned.host;
      client.port = planned.port;
    }
    try {
      await client.connect();
    } catch (error) {
      await safeEndClient(client);
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PG_CONNECT_FAILED, [
        'UNIX_SOCKET_CONNECT_FAILED',
        String(error && error.message ? error.message : error),
        'FAIL_CLOSED_BEFORE_SQL',
        'CLIENT_NOT_LATCHED',
      ]);
    }
    // Latch ONLY after genuine connect — constructed-but-never-connected is not live SQL evidence.
    ownedConnectedClusterClientLatch.add(client);
    ownedClusterClientLatch.add(client);
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
      reasons: Object.freeze([
        'LIVE_OWNED_UNIX_SOCKET_CLIENT_CONNECTED',
        'CONNECT_BEFORE_SQL',
      ]),
      client,
      plannedClient: planned,
      postgresActions: 0,
      inert: false,
      connected: true,
    });
  }

  const consumeDeny = consumeOneShotOrDeny(ticket, config.clock || {});
  if (consumeDeny) return consumeDeny;
  if (isOwnerOneShotTicket(ticket)) {
    writeTicketState(ticket, ONE_SHOT_STATES.DENIED_OR_TERMINATED);
  }
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    'CREATE_CLIENT_FORBIDDEN_UNTIL_LIVE_CAPABILITY_GATE',
    'NO_PG_MODULE_LOAD_WITHOUT_LIVE_SPAWN_PRIVILEGE',
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

export function assertHarnessSourceHasOwnedClientConnectBeforeLatch(sourceText) {
  const text = String(sourceText || '');
  const connectIdx = text.indexOf('await client.connect()');
  const latchIdx = text.indexOf('ownedClusterClientLatch.add(client)');
  // Build needles at runtime so this helper source cannot false-positive itself.
  const createdEmit = "reasons: Object.freeze(['LIVE_OWNED_UNIX_SOCKET_CLIENT_" + "CREATED'])";
  const connectedToken = 'LIVE_OWNED_UNIX_SOCKET_CLIENT_' + 'CONNECTED';
  const createdOnlyReason = text.includes(createdEmit);
  const connectedReason = text.includes(connectedToken);
  const ok = connectIdx >= 0
    && latchIdx >= 0
    && connectIdx < latchIdx
    && connectedReason
    && !createdOnlyReason;
  return Object.freeze({
    ok,
    connectBeforeLatch: connectIdx >= 0 && latchIdx >= 0 && connectIdx < latchIdx,
    connectedReasonPresent: connectedReason,
    createdOnlyReasonAbsent: !createdOnlyReason,
  });
}

export function assertHarnessSourceHasClientEndBeforePostgresStop(sourceText) {
  const text = String(sourceText || '');
  const marker = 'await endOwnedClusterClient(ownedClusterClientRef)';
  const endIdx = text.indexOf(marker);
  if (endIdx < 0) {
    return Object.freeze({ ok: false, endBeforeStop: false });
  }
  const stopRel = text.slice(endIdx).indexOf('stopClusterAndProveTerminated(dataDir');
  const ok = stopRel >= 0;
  return Object.freeze({
    ok,
    endBeforeStop: ok,
  });
}

export function normalizeApprovedSuitePath(suitePath) {
  const s = String(suitePath || '');
  for (const approved of OPS_PILOT_APPROVED_TEST_ACTIONS) {
    if (s === approved || s.endsWith(`/${approved}`) || s.endsWith(approved)) {
      return approved;
    }
  }
  return null;
}

export function assertApprovedSuiteAllowlist(suitePath) {
  const normalized = normalizeApprovedSuitePath(suitePath);
  if (!normalized) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, [
      'UNAPPROVED_SUITE_PATH',
      String(suitePath || 'MISSING'),
    ]);
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    suitePath: normalized,
  });
}

/**
 * Independent Owner capability verification.
 * This process never mints such capabilities. Shape/boolean/ARGV/UID cannot pass.
 */
export function evaluateIndependentOwnerCapability(capability = null) {
  if (capability == null) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INDEPENDENT_OWNER_CAPABILITY_MISSING, [
      'INDEPENDENT_OWNER_CAPABILITY_REQUIRED',
      'ARGV_ENV_BOOLEAN_UID_WEAKSET_NOT_OWNER_CUSTODY',
    ], {
      ownerInvocationIndependentlyVerifiable: false,
      ownerAuthenticationProven: false,
    });
  }
  if (!independentOwnerCapabilityLatch.has(capability)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_INVOCATION_NOT_VERIFIABLE, [
      'DENY_OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE',
      'CAPABILITY_NOT_INSTALLED_BY_OUT_OF_PROCESS_OWNER_CUSTODY',
      'LOCAL_RUNNER_SCRIPT_IS_NOT_A_TRUSTED_CREDENTIAL_AUTHORITY',
    ], {
      ownerInvocationIndependentlyVerifiable: false,
      ownerAuthenticationProven: false,
    });
  }
  // Even a branded capability would still require the live module gate.
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
      'INDEPENDENT_CAPABILITY_OBSERVED_BUT_LIVE_GATE_CLOSED',
    ], {
      ownerInvocationIndependentlyVerifiable: true,
      ownerAuthenticationProven: true,
      liveGateClosed: true,
    });
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    ownerInvocationIndependentlyVerifiable: true,
    ownerAuthenticationProven: true,
  });
}

/**
 * Fail-closed live spawn bridge from a crypto-verified Owner capability artifact.
 * Never mints independentOwnerCapabilityLatch or live tickets in this offline slice.
 */
export function createTestOnlyGitHeadObservationFixture(input = {}) {
  if (!isPlainObject(input) || input.proofClass !== TEST_ONLY_GIT_OBSERVATION_PROOF_CLASS) {
    throw new TypeError('TEST_ONLY_GIT_OBSERVATION_PROOF_CLASS_REQUIRED');
  }
  if (input.authorizesLiveExecute === true || input.authorizesLiveSubprocess === true) {
    throw new Error('TEST_ONLY_GIT_FIXTURE_CANNOT_AUTHORIZE_LIVE_EXECUTE');
  }
  const headSha = String(input.headSha || '');
  if (!/^[0-9a-f]{40}$/.test(headSha)) {
    throw new TypeError('TEST_ONLY_GIT_FIXTURE_HEAD_SHA_REQUIRED');
  }
  const fixture = Object.freeze({
    proofClass: TEST_ONLY_GIT_OBSERVATION_PROOF_CLASS,
    headSha,
    authorizesLiveExecute: false,
    source: 'TEST_ONLY_FIXTURE',
  });
  testOnlyGitObservationLatch.add(fixture);
  return fixture;
}

export function isTestOnlyGitHeadObservationFixture(value) {
  return value != null && typeof value === 'object' && testOnlyGitObservationLatch.has(value);
}

/**
 * Independently observe repository HEAD via fixed /usr/bin/git and module-derived repo root.
 * Caller repoRoot/gitBin/repositoryHeadSha overrides are rejected.
 * TEST_ONLY fixture may be used only for offline authorization tests (never LIVE execute authority).
 */
export function observeCanonicalRepositoryHeadSha(options = {}) {
  if (!isPlainObject(options)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, ['OPTIONS_OBJECT_REQUIRED']);
  }
  if (
    options.repoRoot != null
    || options.gitBin != null
    || options.repositoryHeadSha != null
    || options.cwd != null
    || options.gitExecutable != null
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_GIT_OVERRIDE, [
      'CALLER_GIT_OR_REPO_OVERRIDE_FORBIDDEN',
    ]);
  }
  if (options.testOnlyGitObservationFixture != null) {
    const fixture = options.testOnlyGitObservationFixture;
    if (!isTestOnlyGitHeadObservationFixture(fixture)) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
        'UNBRANDED_GIT_FIXTURE_FORBIDDEN',
      ]);
    }
    if (options.allowTestOnlyGitFixture !== true) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
        'TEST_ONLY_GIT_FIXTURE_NOT_ENABLED_FOR_THIS_CALL',
      ]);
    }
    return Object.freeze({
      ok: true,
      allowed: true,
      decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY,
      reasons: Object.freeze(['TEST_ONLY_GIT_HEAD_FIXTURE']),
      headSha: fixture.headSha,
      source: 'TEST_ONLY_FIXTURE',
      authorizesLiveExecute: false,
      repoRoot: OPS_PILOT_CANONICAL_REPO_ROOT,
      gitBin: OPS_PILOT_CANONICAL_GIT_BIN,
    });
  }
  let result;
  try {
    result = spawnSync(
      OPS_PILOT_CANONICAL_GIT_BIN,
      ['-C', OPS_PILOT_CANONICAL_REPO_ROOT, 'rev-parse', 'HEAD'],
      {
        encoding: 'utf8',
        timeout: 5000,
        env: { PATH: '/usr/bin:/bin' },
      },
    );
  } catch (err) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
      'GIT_SPAWN_FAILED',
      String(err && err.message ? err.message : err),
    ]);
  }
  if (!result || result.error || result.status !== 0) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
      'GIT_REV_PARSE_FAILED',
      String(result?.stderr || result?.error || 'NO_STATUS'),
    ], {
      repoRoot: OPS_PILOT_CANONICAL_REPO_ROOT,
    });
  }
  const headSha = String(result.stdout || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(headSha)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
      'GIT_HEAD_NOT_40_HEX',
      `GOT=${headSha || 'EMPTY'}`,
    ]);
  }

  let mainResult;
  let symResult;
  try {
    mainResult = spawnSync(
      OPS_PILOT_CANONICAL_GIT_BIN,
      ['-C', OPS_PILOT_CANONICAL_REPO_ROOT, 'rev-parse', 'refs/heads/main'],
      {
        encoding: 'utf8',
        timeout: 5000,
        env: { PATH: '/usr/bin:/bin' },
      },
    );
    symResult = spawnSync(
      OPS_PILOT_CANONICAL_GIT_BIN,
      ['-C', OPS_PILOT_CANONICAL_REPO_ROOT, 'symbolic-ref', '-q', 'HEAD'],
      {
        encoding: 'utf8',
        timeout: 5000,
        env: { PATH: '/usr/bin:/bin' },
      },
    );
  } catch (err) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
      'GIT_MAIN_OR_SYMBOLIC_REF_SPAWN_FAILED',
      String(err && err.message ? err.message : err),
    ], {
      headSha,
      repoRoot: OPS_PILOT_CANONICAL_REPO_ROOT,
    });
  }
  if (!mainResult || mainResult.error || mainResult.status !== 0) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
      'GIT_MAIN_REF_UNREADABLE',
      String(mainResult?.stderr || mainResult?.error || 'NO_STATUS'),
    ], {
      headSha,
      repoRoot: OPS_PILOT_CANONICAL_REPO_ROOT,
      authorizesLiveExecute: false,
    });
  }
  const mainSha = String(mainResult.stdout || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(mainSha)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_GIT_HEAD_OBSERVATION, [
      'GIT_MAIN_SHA_NOT_40_HEX',
    ], { headSha, authorizesLiveExecute: false });
  }
  const symbolicHead = String(symResult?.stdout || '').trim();
  const onMainBranch = symbolicHead === 'refs/heads/main'
    && (symResult?.status === 0);
  const headMatchesMain = headSha === mainSha;
  // Live execute authority requires attached HEAD on refs/heads/main equal to main tip.
  // Self-consistent feature-branch / detached worktrees observe HEAD but cannot authorize LIVE execute.
  const authorizesLiveExecute = onMainBranch && headMatchesMain;
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY,
    reasons: Object.freeze(authorizesLiveExecute
      ? ['CANONICAL_MAIN_HEAD_OBSERVED']
      : [
        'CANONICAL_GIT_HEAD_OBSERVED_NON_MAIN_WORKTREE',
        onMainBranch ? 'HEAD_ATTACHED_MAIN' : 'HEAD_NOT_ATTACHED_MAIN',
        headMatchesMain ? 'HEAD_EQUALS_MAIN_TIP' : 'HEAD_DIFFERS_FROM_MAIN_TIP',
        `HEAD=${headSha}`,
        `MAIN=${mainSha}`,
        `SYMBOLIC=${symbolicHead || 'DETACHED_OR_UNAVAILABLE'}`,
      ]),
    headSha,
    mainSha,
    symbolicHead: symbolicHead || null,
    source: 'CANONICAL_GIT',
    authorizesLiveExecute,
    repoRoot: OPS_PILOT_CANONICAL_REPO_ROOT,
    gitBin: OPS_PILOT_CANONICAL_GIT_BIN,
  });
}

export function evaluateLiveRepositoryHeadBinding(input = {}) {
  const capabilitySha = String(input.capabilityPinnedSha || '');
  const headSha = String(input.repositoryHeadSha || '');
  if (!/^[0-9a-f]{40}$/.test(capabilitySha) || !/^[0-9a-f]{40}$/.test(headSha)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
      'CAPABILITY_AND_HEAD_SHA_REQUIRED_40_HEX',
    ]);
  }
  if (capabilitySha !== headSha) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
      'CAPABILITY_PINNED_SHA_MUST_EQUAL_GIT_HEAD',
      `CAPABILITY=${capabilitySha}`,
      `HEAD=${headSha}`,
    ]);
  }
  if (capabilitySha === OPS_PILOT_PINNED_MAIN_SHA) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
      'LIVE_SHA_MUST_NOT_EQUAL_OFFLINE_CONTRACT_PIN',
    ]);
  }
  if (capabilitySha === OPS_PILOT_ACTIVATION_ERA_TARGET_MAIN_SHA) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
      'PR310_ACTIVATION_ERA_TARGET_IS_HISTORICAL_PREP_NOT_LIVE_PIN',
    ]);
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY,
    reasons: Object.freeze(['LIVE_SHA_BINDING_OK']),
    capabilityPinnedSha: capabilitySha,
    repositoryHeadSha: headSha,
  });
}

/**
 * Fail-closed live spawn bridge from a crypto-verified Owner capability artifact.
 * Module consts remain false. Functional-lab custody class is accepted without
 * fabricating OHSA / recovery-admin TRUE evidence.
 */
export function evaluateLiveSpawnAuthorizationFromOwnerCapability(input = {}) {
  const verified = input.verifiedCapability || input.capabilityVerification || null;
  if (!verified || verified.ok !== true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_CAPABILITY_INVALID, [
      'VERIFIED_OWNER_CAPABILITY_REQUIRED',
      ...(verified?.reasons || []),
    ], {
      liveSpawnEligible: false,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
      custodyClass: null,
    });
  }
  // Unforgeable verifier-issued provenance required. Plain/frozen/copied objects DENY.
  if (!isVerifierIssuedCapabilityProvenance(verified)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_FORGED_VERIFIED_CAPABILITY, [
      'VERIFIER_ISSUED_PROVENANCE_REQUIRED',
      'PLAIN_OK_CLAIMS_OBJECT_NOT_AUTHORITY',
      'COPIED_OR_FORGED_VERIFIED_CAPABILITY_DENIED',
    ], {
      liveSpawnEligible: false,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
    });
  }
  if (input.ohsaCustodyClaimed === true || input.claimOhsaIndependentCustody === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OHSA_CUSTODY_CLAIM, [
      'OHSA_INDEPENDENT_CUSTODY_NOT_AUTHORIZED_IN_FUNCTIONAL_LAB_PATH',
    ], { liveSpawnEligible: false, ohsaClaim: 'NOT_PROVEN' });
  }
  // Reject fabricated stronger custody/recovery booleans.
  if (input.ownerCustodyProven === true || input.recoveryAdminProven === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_CUSTODY_NOT_PROVEN, [
      'CALLER_CUSTODY_OR_RECOVERY_BOOLEAN_FORBIDDEN',
      'FUNCTIONAL_LAB_PATH_MUST_NOT_FABRICATE_OHSA_EVIDENCE',
    ], {
      liveSpawnEligible: false,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
    });
  }
  if (input.custodyClass !== OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_OWNER_CUSTODY_NOT_PROVEN, [
      'FUNCTIONAL_LAB_CUSTODY_CLASS_REQUIRED',
      'OHSA_NOT_PROVEN',
      'RECOVERY_ADMIN_NOT_PROVEN',
    ], {
      liveSpawnEligible: false,
      ownerCustodyProven: false,
      recoveryAdminProven: false,
    });
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== false || OPS_PILOT_TIER3_AUTHORIZED !== false) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
      'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
      'LIVE_USES_CAPABILITY_GATED_ONESHOT_NOT_GLOBAL_CONST_FLIP',
    ], { liveSpawnEligible: false, liveGateClosed: true });
  }
  const venue = String(input.venue || verified.claims?.venue || '');
  if (venue !== OPS_PILOT_LIVE_VENUE) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_VENUE_BINDING, [
      'SIMIN_HYPERV_VENUE_REQUIRED',
      `GOT=${venue || 'MISSING'}`,
    ], { liveSpawnEligible: false });
  }
  const shaBind = evaluateLiveRepositoryHeadBinding({
    capabilityPinnedSha: verified.claims?.pinnedMainSha,
    repositoryHeadSha: input.repositoryHeadSha,
  });
  if (!shaBind.ok) {
    return deny(shaBind.decision, shaBind.reasons || [], { liveSpawnEligible: false });
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIVE_SPAWN_ELIGIBLE_FUNCTIONAL_LAB,
    reasons: Object.freeze([
      'VERIFIED_OWNER_CAPABILITY',
      'FUNCTIONAL_LAB_CUSTODY_CLASS_ACCEPTED',
      'MODULE_CONSTS_REMAIN_FALSE',
      'OHSA_NOT_PROVEN',
      'RECOVERY_ADMIN_NOT_PROVEN',
      'LIVE_SHA_BINDING_OK',
    ]),
    liveSpawnEligible: true,
    ownerCustodyProven: false,
    recoveryAdminProven: false,
    custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
    venue: OPS_PILOT_LIVE_VENUE,
    capabilityPinnedSha: verified.claims?.pinnedMainSha,
  });
}

/**
 * Brand a crypto-verified capability object for independent-capability checks.
 * Does NOT mint/sign an Owner capability token.
 */
export function brandVerifiedIndependentOwnerCapability(verifiedCapability) {
  if (!verifiedCapability || verifiedCapability.ok !== true || !verifiedCapability.claims) {
    throw new TypeError('VERIFIED_CAPABILITY_REQUIRED_FOR_BRAND');
  }
  // Branding helper NEVER installs verifier provenance and NEVER grants live spawn.
  // Even if input was verifier-issued, the returned object is a new plain brand
  // that must not pass isVerifierIssuedCapabilityProvenance.
  if (!isVerifierIssuedCapabilityProvenance(verifiedCapability)) {
    throw new TypeError('BRAND_REQUIRES_VERIFIER_ISSUED_PROVENANCE_INPUT');
  }
  const branded = Object.freeze({
    kind: 'VERIFIED_INDEPENDENT_OWNER_CAPABILITY_BRAND',
    proofClass: 'CRYPTO_VERIFIED_OWNER_CAPABILITY_NOT_MINTED_HERE',
    claims: Object.freeze({ ...verifiedCapability.claims }),
    custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
    ownerCustodyProven: false,
    recoveryAdminProven: false,
    ohsaClaim: 'NOT_PROVEN',
    authorizesLiveSpawn: false,
  });
  independentOwnerCapabilityLatch.add(branded);
  return branded;
}

/**
 * Create a live one-shot ticket after capability authorization.
 * liveSpawnPermitted is module-private only.
 */

export const LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS = 'RUNNER_ISSUED_LIVE_SUITE_EXECUTION_AUTHORITY_V1';

export function isLiveSuiteExecutionAuthority(value) {
  return value != null && typeof value === 'object' && liveSuiteExecutionAuthorityLatch.has(value);
}

export function isOwnedClusterClient(value) {
  return value != null && typeof value === 'object' && ownedClusterClientLatch.has(value);
}

/**
 * Mint runner-owned live suite execution authority. Not a public Owner substitute.
 * Requires owned controller + liveSpawnPermitted ticket + exact suite/sha binding.
 */
export function createLiveSuiteExecutionAuthority(input = {}) {
  if (!isPlainObject(input) || input.proofClass !== LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS_REQUIRED',
    ]);
  }
  if (!isOwnedDisposableOpsPilotClusterController(input.ownedController)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'OWNED_CONTROLLER_REQUIRED',
    ]);
  }
  if (!isOwnerOneShotTicket(input.ownerOneShotTicket)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'LIVE_ONESHOT_TICKET_REQUIRED',
    ]);
  }
  const priv = getTicketPrivilege(input.ownerOneShotTicket);
  if (!priv || priv.liveSpawnPermitted !== true || priv.inert === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'LIVE_SPAWN_PRIVILEGE_REQUIRED',
    ]);
  }
  if (priv.cancelled === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'TICKET_CANCELLED',
    ]);
  }
  // start() consumes the one-shot before returning success; require that consumption.
  if (priv.consumed !== true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'TICKET_MUST_BE_CONSUMED_BY_SUCCESSFUL_START_BEFORE_AUTHORITY',
    ]);
  }
  const suiteCheck = assertApprovedSuiteAllowlist(input.suitePath);
  if (!suiteCheck.ok) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, suiteCheck.reasons || []);
  }
  const headSha = String(input.repositoryHeadSha || '');
  if (!/^[0-9a-f]{40}$/.test(headSha)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, ['AUTHORITY_HEAD_SHA_REQUIRED']);
  }
  if (input.venue != null && input.venue !== OPS_PILOT_LIVE_VENUE) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_VENUE_BINDING, ['AUTHORITY_VENUE_MISMATCH']);
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== false || OPS_PILOT_TIER3_AUTHORIZED !== false) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TIER3_NOT_AUTHORIZED, [
      'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
    ]);
  }
  const offlineWiringProbe = input.offlineWiringProbe === true;
  const authorizesRealSql = offlineWiringProbe !== true && input.authorizesRealSql === true;
  const authority = Object.freeze({
    proofClass: LIVE_SUITE_EXECUTION_AUTHORITY_PROOF_CLASS,
    suitePath: suiteCheck.suitePath,
    repositoryHeadSha: headSha,
    venue: OPS_PILOT_LIVE_VENUE,
    custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
    offlineWiringProbe,
    authorizesRealSql,
    ownerCustodyProven: false,
    ohsaClaim: 'NOT_PROVEN',
  });
  liveSuiteExecutionAuthorityLatch.add(authority);
  liveSuiteExecutionAuthorityMeta.set(authority, Object.freeze({
    suitePath: suiteCheck.suitePath,
    repositoryHeadSha: headSha,
    ownedController: input.ownedController,
    ownerOneShotTicket: input.ownerOneShotTicket,
    authorizesRealSql,
    offlineWiringProbe,
  }));
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY,
    reasons: Object.freeze([
      offlineWiringProbe ? 'OFFLINE_WIRING_AUTHORITY_MINTED' : 'LIVE_SUITE_EXECUTION_AUTHORITY_MINTED',
    ]),
    authority,
  });
}

export function assertLiveSuiteExecutionAuthorityForSuite(authority, suitePath, repositoryHeadSha) {
  if (!isLiveSuiteExecutionAuthority(authority)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, [
      'RUNNER_ISSUED_LIVE_SUITE_AUTHORITY_REQUIRED',
    ]);
  }
  const meta = liveSuiteExecutionAuthorityMeta.get(authority);
  if (!meta) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_EXECUTION_AUTHORITY, ['AUTHORITY_META_MISSING']);
  }
  const normalized = normalizeApprovedSuitePath(suitePath);
  if (meta.suitePath !== normalized) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, [
      'AUTHORITY_SUITE_MISMATCH',
    ]);
  }
  if (String(repositoryHeadSha || '') !== meta.repositoryHeadSha) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIVE_SHA_BINDING, [
      'AUTHORITY_SHA_MISMATCH',
    ]);
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    authorizesRealSql: meta.authorizesRealSql === true,
    offlineWiringProbe: meta.offlineWiringProbe === true,
    suitePath: meta.suitePath,
    repositoryHeadSha: meta.repositoryHeadSha,
  });
}


export function createLiveCapabilityGatedOneShotTicket(input = {}, deps = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('LIVE_ONESHOT_OPTIONS_REQUIRED');
  }
  if (input.proofClass !== 'LIVE_CAPABILITY_GATED_ONESHOT_TICKET') {
    throw new TypeError('LIVE_CAPABILITY_GATED_ONESHOT_PROOF_CLASS_REQUIRED');
  }
  if (input.authorizeByBoolean === true || input.envAuthorized === true) {
    throw new Error('LIVE_ONESHOT_BOOLEAN_ENV_FORBIDDEN');
  }
  const verified = input.verifiedCapability || input.capabilityVerification || null;
  if (!isVerifierIssuedCapabilityProvenance(verified)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_FORGED_VERIFIED_CAPABILITY, [
      'TICKET_FACTORY_REQUIRES_VERIFIER_ISSUED_PROVENANCE',
    ]);
  }
  const auth = evaluateLiveSpawnAuthorizationFromOwnerCapability(input);
  if (!auth.ok || auth.liveSpawnEligible !== true) {
    return auth;
  }
  const trustClass = getVerifierIssuedCapabilityTrustClass(verified);
  const allowLiveSubprocess = verifierIssuedCapabilityAuthorizesLiveSubprocess(verified) === true
    && trustClass === 'OWNER_INSTALLED';
  if (input.requireOwnerInstalledTrust === true && !allowLiveSubprocess) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TEST_ONLY_TRUST_FOR_LIVE_SUBPROCESS, [
      'OWNER_INSTALLED_TRUST_REQUIRED_FOR_LIVE_SUBPROCESS',
      `TRUST_CLASS=${trustClass || 'MISSING'}`,
    ]);
  }
  const clock = deps.clock || {};
  const ttlMs = Number(input.ttlMs ?? OPS_PILOT_DEFAULT_ONESHOT_TTL_MS);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > OPS_PILOT_MAX_ONESHOT_TTL_MS) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, ['TTL_OUT_OF_BOUNDS']);
  }
  const suiteCheck = assertApprovedSuiteAllowlist(input.suitePath);
  if (!suiteCheck.ok) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION, suiteCheck.reasons || []);
  }
  const createdAtMonotonicMs = monotonicNowMs(clock);
  const ticket = createTicketRecord({
    proofClass: 'LIVE_CAPABILITY_GATED_ONESHOT_TICKET',
    repositorySha: auth.capabilityPinnedSha,
    approvedActions: Object.freeze([suiteCheck.suitePath]),
    venue: OPS_PILOT_LIVE_VENUE,
    custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
    authorizesLivePostgres: false,
    ownerAuthenticationProven: true,
    classification: allowLiveSubprocess
      ? 'CAPABILITY_GATED_LIVE_ONESHOT_OWNER_INSTALLED_TRUST'
      : 'CAPABILITY_GATED_OFFLINE_AUTH_TICKET_TEST_ONLY_TRUST_NO_SUBPROCESS',
  }, {
    state: ONE_SHOT_STATES.ACTIVE_TEST_ONLY,
    consumed: false,
    cancelled: false,
    inert: allowLiveSubprocess !== true,
    liveSpawnPermitted: allowLiveSubprocess === true,
    prepareUsed: false,
    expiresAtMonotonicMs: createdAtMonotonicMs + ttlMs,
    createdAtMonotonicMs,
    ttlMs,
    repositorySha: auth.capabilityPinnedSha,
    approvedActions: [suiteCheck.suitePath],
    nonce: randomBytes(16).toString('hex'),
  });
  if (allowLiveSubprocess !== true) {
    inertOneShotLatch.add(ticket);
  }
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIVE_ONESHOT_FROM_VERIFIED_CAPABILITY,
    reasons: Object.freeze([
      allowLiveSubprocess ? 'LIVE_ONESHOT_CREATED_OWNER_INSTALLED' : 'OFFLINE_AUTH_TICKET_TEST_ONLY_TRUST',
      `TRUST_CLASS=${trustClass}`,
      ...auth.reasons,
    ]),
    ticket,
    liveSpawnEligible: allowLiveSubprocess === true,
    liveSubprocessAuthorized: allowLiveSubprocess === true,
    trustClass,
    ownerCustodyProven: false,
    recoveryAdminProven: false,
    custodyClass: OPS_PILOT_LIVE_CUSTODY_CLASS_FUNCTIONAL_LAB,
    postgresActions: 0,
  });
}

/**
 * Offline-only suite grant issued by the Owner runner for TEST_ONLY orchestration.
 * Does NOT authorize live PostgreSQL spawn or operational dispatch.
 */
export function createRunnerOfflineSuiteGrantForTests(input = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('RUNNER_OFFLINE_SUITE_GRANT_OPTIONS_REQUIRED');
  }
  if (input.proofClass !== 'TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT') {
    throw new TypeError('TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT_PROOF_CLASS_REQUIRED');
  }
  if (input.authorizeLivePostgresSpawn === true || input.ownerAuthenticationProven === true) {
    throw new Error('OFFLINE_SUITE_GRANT_CANNOT_CLAIM_LIVE_OR_OWNER_AUTH');
  }
  const suiteCheck = assertApprovedSuiteAllowlist(input.suitePath);
  if (!suiteCheck.ok) {
    throw new TypeError(`UNAPPROVED_SUITE:${input.suitePath}`);
  }
  const grant = Object.freeze({
    kind: 'RUNNER_OFFLINE_SUITE_GRANT',
    proofClass: 'TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT',
    suitePath: suiteCheck.suitePath,
    repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    authorizesLivePostgres: false,
    ownerAuthenticationProven: false,
    classification: 'OFFLINE_ORCHESTRATION_NOT_LIVE_PG',
  });
  runnerOfflineSuiteGrantLatch.add(grant);
  runnerOfflineGrantPrivilege.set(grant, {
    suitePath: suiteCheck.suitePath,
    consumed: false,
    liveSpawnPermitted: false,
  });
  return grant;
}

export function isRunnerOfflineSuiteGrant(value) {
  return value !== null && typeof value === 'object' && runnerOfflineSuiteGrantLatch.has(value);
}

export function consumeRunnerOfflineSuiteGrant(grant) {
  if (!isRunnerOfflineSuiteGrant(grant)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_RUNNER_SUITE_GRANT_INVALID, [
      'RUNNER_OFFLINE_SUITE_GRANT_REQUIRED',
    ]);
  }
  const priv = runnerOfflineGrantPrivilege.get(grant);
  if (!priv || priv.consumed === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY, [
      'RUNNER_OFFLINE_SUITE_GRANT_ALREADY_CONSUMED',
    ]);
  }
  priv.consumed = true;
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION,
    suitePath: priv.suitePath,
    authorizesLivePostgres: false,
  });
}

/**
 * Offline final-execution readiness decision. Never authorizes live PostgreSQL.
 * After five-file offline completion, reports external-trust blocked when gates closed.
 */
export function evaluateTier3FinalExecutionReadiness(input = {}, deps = {}) {
  if (input && input.claimReadyDespiteTrustGaps === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_FINAL_EXECUTION_NOT_READY, [
      'READY_CLAIM_FORBIDDEN_WHILE_TRUST_OR_SCOPE_BLOCKED',
    ], {
      verdict: TIER3_READINESS_VERDICTS.SECURITY_BLOCKED,
    });
  }

  const evidence = evaluateOwnerControlledLocalRunnerEvidence({
    repositorySha: input.repositorySha || OPS_PILOT_PINNED_MAIN_SHA,
    approvedActions: input.approvedActions || [...OPS_PILOT_APPROVED_TEST_ACTIONS],
    executablePath: input.executablePath || (deps.execPath || process.execPath),
    harnessModulePath: input.harnessModulePath || HARNESS_MODULE_PATH,
    executionPrincipal: input.executionPrincipal,
    affirmSameUidLimitationsAccepted: input.affirmSameUidLimitationsAccepted === true,
    ownerControlledLocalRunnerInvocation: input.ownerControlledLocalRunnerInvocation === true,
    authorizeLivePostgresSpawn: input.authorizeLivePostgresSpawn === true,
    ownerAuthorizedByBoolean: input.ownerAuthorizedByBoolean,
    envAuthorized: input.envAuthorized,
    treatWeakSetAsOwnerAuthority: input.treatWeakSetAsOwnerAuthority,
    tier3ActivationHandle: input.tier3ActivationHandle,
    ttlMs: input.ttlMs,
  }, deps);

  const independent = evaluateIndependentOwnerCapability(input.independentOwnerCapability || null);
  const liveGateClosed = OPS_PILOT_DB_EXECUTION_AUTHORIZED === false
    && OPS_PILOT_TIER3_AUTHORIZED === false;
  const ownerInvocationIndependentlyVerifiable = independent.ownerInvocationIndependentlyVerifiable === true
    && independent.ownerAuthenticationProven === true;
  const ownerInvocationBoundary = ownerInvocationIndependentlyVerifiable
    ? 'OWNER_INVOCATION_INDEPENDENTLY_VERIFIABLE'
    : 'OWNER_INVOCATION_NOT_INDEPENDENTLY_VERIFIABLE';

  const fiveFileOfflineComplete = input.fiveFileOfflineIntegrationComplete === true;
  const requiredAdditionalPaths = TIER3_REQUIRED_ADDITIONAL_PATHS;

  let verdict = TIER3_READINESS_VERDICTS.SOURCE_READY_TRUST_BOUNDARY_BLOCKED;
  if (!liveGateClosed) {
    verdict = TIER3_READINESS_VERDICTS.SECURITY_BLOCKED;
  } else if (requiredAdditionalPaths.length > 0) {
    verdict = TIER3_READINESS_VERDICTS.EXACT_SCOPE_INSUFFICIENT;
  } else if (fiveFileOfflineComplete && !ownerInvocationIndependentlyVerifiable) {
    verdict = TIER3_READINESS_VERDICTS.OFFLINE_INTEGRATION_COMPLETE_EXTERNAL_TRUST_BLOCKED;
  } else if (!ownerInvocationIndependentlyVerifiable) {
    verdict = TIER3_READINESS_VERDICTS.SOURCE_READY_TRUST_BOUNDARY_BLOCKED;
  } else {
    verdict = TIER3_READINESS_VERDICTS.READY_FOR_SEPARATE_OWNER_TIER3_EXECUTION_AUTHORIZATION;
  }

  return Object.freeze({
    ok: false,
    allowed: false,
    decision: OPS_PILOT_HARNESS_DECISIONS.DENY_FINAL_EXECUTION_NOT_READY,
    reasons: Object.freeze([
      `VERDICT=${verdict}`,
      ownerInvocationBoundary,
      liveGateClosed
        ? 'LIVE_DB_GATE_REMAINS_CLOSED'
        : 'LIVE_DB_GATE_UNEXPECTEDLY_OPEN',
      'EXECUTABLE_LAUNCH_COMMAND_NOT_PROPOSED',
      'NO_LIVE_POSTGRES_AUTHORIZED_BY_THIS_EVALUATION',
      ...(evidence.reasons || []),
      ...(independent.reasons || []),
    ]),
    verdict,
    ownerInvocationBoundary,
    ownerInvocationIndependentlyVerifiable: false,
    ownerAuthenticationProven: false,
    executionPrincipal: 'EXPLICITLY_UNVERIFIED_AS_OWNER',
    trustedExecutor: 'EXPLICITLY_UNVERIFIED_AS_OWNER_CUSTODY',
    sameUidLimitations: Object.freeze({
      acceptedForDisposableTestsOnly: input.affirmSameUidLimitationsAccepted === true,
      sealed: false,
      argvIsNotOwnerAuthentication: true,
      processGetuidIsNotOwnerAuthentication: true,
      weakSetWeakMapNotOwnerCustody: true,
    }),
    liveDbGate: Object.freeze({
      OPS_PILOT_DB_EXECUTION_AUTHORIZED,
      OPS_PILOT_TIER3_AUTHORIZED,
      closed: liveGateClosed,
    }),
    oneShotContract: Object.freeze({
      defaultTtlSeconds: OPS_PILOT_DEFAULT_ONESHOT_TTL_MS / 1000,
      maxTtlSeconds: OPS_PILOT_MAX_ONESHOT_TTL_MS / 1000,
      oneShotRequired: true,
      replay: 'DENY',
      cancelled: 'DENY',
      expired: 'DENY',
    }),
    exactTwoSuiteAllowlist: OPS_PILOT_APPROVED_TEST_ACTIONS,
    exactTwoSuiteIntegration: Object.freeze({
      fencingSuiteWiredForOfflineOrchestration: fiveFileOfflineComplete === true,
      dispatcherSuiteWiredForOfflineOrchestration: fiveFileOfflineComplete === true,
      liveSqlPassClaimed: false,
      blocker: ownerInvocationIndependentlyVerifiable
        ? null
        : 'EXTERNAL_OWNER_TRUST_BOUNDARY_REQUIRED_FOR_LIVE_PG',
    }),
    requiredAdditionalPaths,
    requiredExternalTrustComponents: TIER3_REQUIRED_EXTERNAL_TRUST_COMPONENTS,
    executionContract: TIER3_FINAL_EXECUTION_CONTRACT,
    ownerEvidenceDecision: evidence.decision,
    independentOwnerCapabilityDecision: independent.decision,
    ownerRunnerRelativePath: OPS_PILOT_OWNER_RUNNER_RELATIVE_PATH,
    postgresActions: 0,
    dbActions: 0,
  });
}

// Keep realpathSync referenced for future containment hardening without using it at import.
void realpathSync;
