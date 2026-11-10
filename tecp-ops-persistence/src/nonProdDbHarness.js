/**
 * TECP-OPS-PILOT-001 CP2-I — guarded non-production DB harness SOURCE ONLY.
 *
 * Authoring this module does NOT authorize starting PostgreSQL, connecting to
 * a database, executing SQL, reading credentials or performing CP2-DB work.
 *
 * Offline CP2-I may import safety validators from this module. Any function that
 * would load `pg` or open a connection must remain uncalled until a separate
 * Owner CP2-DB authorization.
 */

export const HARNESS_MODE = 'NON_PROD_SOURCE_ONLY';
export const HARNESS_CHECKPOINT = 'CP2-I';
export const HARNESS_DB_EXECUTION_AUTHORIZED = false;

export const HARNESS_DECISIONS = Object.freeze({
  ALLOW_SOURCE_CONTRACT: 'ALLOW_SOURCE_CONTRACT',
  DENY_PRODUCTION_ENV: 'DENY_PRODUCTION_ENV',
  DENY_REMOTE_ENDPOINT: 'DENY_REMOTE_ENDPOINT',
  DENY_ENV_DATABASE_URL: 'DENY_ENV_DATABASE_URL',
  DENY_TCP_HOST: 'DENY_TCP_HOST',
  DENY_UNSAFE_FALLBACK: 'DENY_UNSAFE_FALLBACK',
  DENY_DB_EXECUTION_NOT_AUTHORIZED: 'DENY_DB_EXECUTION_NOT_AUTHORIZED',
  DENY_MISSING_EXPLICIT_NONPROD_FLAG: 'DENY_MISSING_EXPLICIT_NONPROD_FLAG',
  DENY_INVALID_CONFIG: 'DENY_INVALID_CONFIG',
});

const PRODUCTION_MARKERS = Object.freeze([
  'production',
  'prod',
  'live',
]);

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
  });
}

function allow(extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: HARNESS_DECISIONS.ALLOW_SOURCE_CONTRACT,
    reasons: Object.freeze(['NON_PROD_SOURCE_CONTRACT_ONLY']),
    dbExecutionAuthorized: false,
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
    TITANGOLD_TECP_OPS_NONPROD: env.TITANGOLD_TECP_OPS_NONPROD,
    TITANGOLD_TECP_OPS_CP2_DB: env.TITANGOLD_TECP_OPS_CP2_DB,
  };
}

/**
 * Pure offline safety evaluation. Never opens sockets or loads `pg`.
 */
export function evaluateNonProdHarnessSafety(config = {}, env = process.env) {
  if (!isPlainObject(config)) {
    return deny(HARNESS_DECISIONS.DENY_INVALID_CONFIG, ['CONFIG_OBJECT_REQUIRED']);
  }

  const snap = envSnapshot(env);
  const nodeEnv = String(snap.NODE_ENV || '').toLowerCase();
  if (PRODUCTION_MARKERS.includes(nodeEnv) || config.forceProduction === true) {
    return deny(HARNESS_DECISIONS.DENY_PRODUCTION_ENV, [`NODE_ENV=${snap.NODE_ENV || ''}`]);
  }

  if (snap.DATABASE_URL != null && String(snap.DATABASE_URL).length > 0) {
    return deny(HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, ['DATABASE_URL_FORBIDDEN']);
  }
  if (config.databaseUrl != null || config.connectionString != null) {
    return deny(HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, ['CONFIG_DATABASE_URL_FORBIDDEN']);
  }

  if (config.host != null || config.hostname != null || snap.PGHOST) {
    const host = String(config.host || config.hostname || snap.PGHOST || '');
    if (host && host !== '/tmp' && !host.startsWith('/')) {
      return deny(HARNESS_DECISIONS.DENY_TCP_HOST, [`HOST=${host}`]);
    }
    if (/amazonaws\.com|azure|googleapis|neon\.tech|supabase|remote/i.test(host)) {
      return deny(HARNESS_DECISIONS.DENY_REMOTE_ENDPOINT, [`HOST=${host}`]);
    }
  }

  if (config.remote === true || config.allowRemote === true || config.fallbackToRemote === true) {
    return deny(HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, ['REMOTE_FALLBACK_FORBIDDEN']);
  }
  if (config.allowEnvDatabaseUrl === true || config.useProcessEnvCredentials === true) {
    return deny(HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, ['ENV_CREDENTIAL_FALLBACK_FORBIDDEN']);
  }

  if (config.explicitNonProd !== true && snap.TITANGOLD_TECP_OPS_NONPROD !== '1') {
    return deny(HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG, [
      'EXPLICIT_NONPROD_REQUIRED',
    ]);
  }

  // CP2-I source authoring never enables DB execution.
  if (config.authorizeDbExecution === true
    || snap.TITANGOLD_TECP_OPS_CP2_DB === '1'
    || HARNESS_DB_EXECUTION_AUTHORIZED === true) {
    return deny(HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
      'CP2_I_OFFLINE_FORBIDS_DB_EXECUTION',
    ]);
  }

  return allow({
    mode: HARNESS_MODE,
    checkpoint: HARNESS_CHECKPOINT,
    socketOnly: true,
    tcpDisabled: true,
    envDatabaseUrlForbidden: true,
  });
}

/**
 * Refuses to create a live client in CP2-I. Dynamic `pg` import is intentionally
 * behind this hard DENY so offline tests never load the dependency.
 */
export async function createNonProdClient(_config = {}, env = process.env) {
  const safety = evaluateNonProdHarnessSafety(
    { ..._config, authorizeDbExecution: true },
    env,
  );
  if (!safety.ok) {
    return safety;
  }
  // Unreachable under CP2-I constants; retained as fail-closed belt.
  return deny(HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    'CREATE_CLIENT_FORBIDDEN_IN_CP2_I',
  ]);
}

/**
 * Refuses cluster start. No initdb/pg_ctl invocation is present in this module.
 */
export async function startNonProdCluster(_config = {}, env = process.env) {
  void evaluateNonProdHarnessSafety(_config, env);
  return deny(HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    'START_CLUSTER_FORBIDDEN_IN_CP2_I',
    'SEPARATE_CP2_DB_OWNER_GATE_REQUIRED',
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
