/**
 * TECP-OPS-PILOT-001 S2 — disposable ops-pilot DB harness (disabled in Gate B).
 *
 * Additive NEW module. Does NOT modify frozen nonProdDbHarness.js.
 * Gate B authorizes safety-gate denial tests only.
 * No initdb / pg_ctl / postgres / psql / client / schema execution.
 */

export const OPS_PILOT_HARNESS_MODE = 'DISPOSABLE_OPS_PILOT_SOURCE_ONLY';
export const OPS_PILOT_HARNESS_CHECKPOINT = 'S2_GATE_B';
export const OPS_PILOT_REQUIRED_PG_VERSION = '14.24';
export const OPS_PILOT_DB_EXECUTION_AUTHORIZED = false;
export const OPS_PILOT_TIER3_AUTHORIZED = false;

export const OPS_PILOT_HARNESS_DECISIONS = Object.freeze({
  ALLOW_SOURCE_CONTRACT: 'ALLOW_SOURCE_CONTRACT',
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
});

const PRODUCTION_MARKERS = Object.freeze(['production', 'prod', 'live']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deny(decision, reasons = []) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    dbExecutionAuthorized: false,
    tier3Authorized: false,
    postgresActions: 0,
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
    TITANGOLD_TECP_OPS_NONPROD: env.TITANGOLD_TECP_OPS_NONPROD,
    TITANGOLD_TECP_OPS_CP2_DB: env.TITANGOLD_TECP_OPS_CP2_DB,
    TITANGOLD_TECP_OPS_S2_TIER3: env.TITANGOLD_TECP_OPS_S2_TIER3,
  };
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
  for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
    if (snap[key] != null && String(snap[key]).length > 0 && config.allowEnvPgVars === true) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, [
        `ENV_${key}_FALLBACK_FORBIDDEN`,
      ]);
    }
  }
  if (
    (snap.PGHOST || snap.PGPORT || snap.PGDATABASE || snap.PGUSER || snap.PGPASSWORD)
    && config.rejectExternalPgEnv !== false
  ) {
    // Default: reject externally supplied PostgreSQL connection variables.
    if (snap.PGHOST || snap.PGPORT || snap.PGDATABASE || snap.PGUSER || snap.PGPASSWORD) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, [
        'EXTERNAL_PG_ENV_VARS_FORBIDDEN',
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

  if (config.explicitNonProd !== true && snap.TITANGOLD_TECP_OPS_NONPROD !== '1') {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG, [
      'EXPLICIT_NONPROD_REQUIRED',
    ]);
  }

  if (
    config.dataDir != null
    && typeof config.dataDir === 'string'
    && !config.dataDir.includes('disposable')
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

  // Gate B / S2: Tier-3 and DB execution remain unauthorized even if env flipped.
  if (
    config.authorizeTier3 === true
    || config.authorizeDbExecution === true
    || snap.TITANGOLD_TECP_OPS_CP2_DB === '1'
    || snap.TITANGOLD_TECP_OPS_S2_TIER3 === '1'
    || OPS_PILOT_DB_EXECUTION_AUTHORIZED === true
    || OPS_PILOT_TIER3_AUTHORIZED === true
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TIER3_NOT_AUTHORIZED, [
      'S2_GATE_B_FORBIDS_TIER3_AND_DB_EXECUTION',
      'SEPARATE_OWNER_TIER3_GATE_REQUIRED',
    ]);
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

function denyLifecycle(opName) {
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    `${opName}_FORBIDDEN_IN_S2_GATE_B`,
    'NO_INITDB',
    'NO_PG_CTL',
    'NO_POSTGRES',
    'NO_PSQL',
    'NO_CLIENT',
    'SEPARATE_TIER3_OWNER_GATE_REQUIRED',
  ]);
}

export async function detectPostgresVersion(_config = {}, env = process.env) {
  void evaluateOpsPilotHarnessSafety(_config, env);
  return denyLifecycle('DETECT_POSTGRES_VERSION');
}

export async function startDisposableOpsPilotCluster(_config = {}, env = process.env) {
  void evaluateOpsPilotHarnessSafety(_config, env);
  return denyLifecycle('START_CLUSTER');
}

export async function stopDisposableOpsPilotCluster(_config = {}, env = process.env) {
  void evaluateOpsPilotHarnessSafety(_config, env);
  return denyLifecycle('STOP_CLUSTER');
}

export async function createDisposableOpsPilotClient(_config = {}, env = process.env) {
  void evaluateOpsPilotHarnessSafety(
    { ..._config, authorizeDbExecution: true, authorizeTier3: true },
    env,
  );
  return denyLifecycle('CREATE_CLIENT');
}

export async function cleanupDisposableOpsPilotCluster(_config = {}, env = process.env) {
  void evaluateOpsPilotHarnessSafety(_config, env);
  return Object.freeze({
    ok: false,
    allowed: false,
    decision: OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED,
    reasons: Object.freeze([
      'CLEANUP_FORBIDDEN_WITHOUT_PRIOR_OWNED_LIFECYCLE',
      'STOP_BEFORE_DELETE_NOT_EXECUTED',
      'S2_GATE_B_NO_POSTGRES_ACTIONS',
    ]),
    dbExecutionAuthorized: false,
    tier3Authorized: false,
    postgresActions: 0,
    cleanupEvidence: Object.freeze({
      stopBeforeDelete: 'NOT_APPLICABLE_NO_CLUSTER',
      residualDataDir: 'NONE_CREATED',
    }),
  });
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
