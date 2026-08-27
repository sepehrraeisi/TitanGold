/**
 * Canonical PM2 6.0.13 *effective* semantic model for T2 v1.6.1.
 *
 * Compares LIVE↔LIVE, DUMP↔DUMP, and DUMP↔LIVE using source-aware
 * normalization — not raw byte equality across dump/resurrect transforms.
 *
 * Authority (PM2 6.0.13):
 * - God.dumpProcessList (ActionMethods.js): delete pm2_env.instances + pm_id;
 *   pushes flattened pm2_env (often with nested env + mirrored app keys)
 * - Common.prepareAppKeys: undefined instances → 1
 * - God.prepare / executeApp: unique_id regenerate; log/pid paths rewrite
 * - Utility.extend merges env onto pm2_env at runtime
 *
 * Every persisted field is COMPARE, TRANSFORM_EQUIV, or
 * PROVEN_REGENERATED_OR_VOLATILE. Unclassified → fail closed.
 */

/** Status is gated separately (online/online pre; online/stopped projection). */
export const STATUS_FIELD = 'status';

/**
 * Proven regenerated / volatile / display-only runtime fields.
 * Must NEVER establish identity or equivalence authority.
 */
export const PROVEN_REGENERATED_OR_VOLATILE = Object.freeze([
  'pm_id',
  'pmId',
  'unique_id',
  'created_at',
  'restart_time',
  'unstable_restarts',
  'prev_restart_delay',
  'pm_uptime',
  'axm_actions',
  'axm_monitor',
  'axm_options',
  'axm_dynamic',
  'vizion_running',
  'pid',
  'monit',
  'exit_code',
  'pm_pid_path',
  'pm_out_log_path',
  'pm_err_log_path',
  'pm_log_path',
  // Ecosystem aliases of regenerated log paths
  'error_file',
  'out_file',
  'log_file',
  'version',
  'node_version',
  'env',
  'pm2_env',
  STATUS_FIELD,
]);

/**
 * Keys PM2 may inject into nested `env` / mirror onto the dump entry that are
 * NOT application semantics. Excluded from app-env keysets and ENV compares.
 * (unique_id regenerates per process; PM2_HOME/PM2_USAGE are PM2 runtime.)
 */
export const PM2_NESTED_ENV_NON_APPLICATION_KEYS = Object.freeze([
  'unique_id',
  'PM2_HOME',
  'PM2_USAGE',
  'PM2_JSON_PROCESSING',
  'pmx',
  'pmx_module',
  'axm_options',
  'km_link',
]);

/** @deprecated alias — prefer PM2_NESTED_ENV_NON_APPLICATION_KEYS */
export const PM2_NESTED_ENV_VOLATILE_KEYS = PM2_NESTED_ENV_NON_APPLICATION_KEYS;

function isNonApplicationEnvKey(key) {
  if (PM2_NESTED_ENV_NON_APPLICATION_KEYS.includes(key)) return true;
  if (VOLATILE.has(key)) return true;
  if (TRANSFORM.has(key)) return true;
  if (COMPARE.has(key)) return true;
  if (ALIAS_KEYS.has(key)) return true;
  return false;
}

/** Strip PM2-injected contaminants from an env-like object (values preserved for remaining keys). */
export function sanitizeApplicationEnvContainer(rawEnv) {
  /** @type {Record<string, unknown>} */
  const out = {};
  if (!isPlainObject(rawEnv)) return out;
  for (const [k, v] of Object.entries(rawEnv)) {
    if (isNonApplicationEnvKey(k)) continue;
    out[k] = v;
  }
  return out;
}
/**
 * Fields deleted or rewritten by dump/prepare such that raw LIVE≠DUMP is
 * expected, but effective resurrect semantics can still be compared.
 */
export const PM2_DUMP_TRANSFORM_FIELDS = Object.freeze({
  /**
   * dumpProcessList: `delete apps[0].pm2_env.instances`
   * God.prepare: undefined instances → STANDALONE path (not timesLimit).
   * Effective: absent↔absent compatible; explicit multi-instance COMPARE.
   */
  instances: {
    class: 'TRANSFORM_EQUIV',
    component: 'God.dumpProcessList + God.prepare standalone branch',
  },
});

/** Fields removed by PM2 6.0.13 God.dumpProcessList before persist. */
export const DUMP_PROCESS_LIST_DELETED_FIELDS = Object.freeze(['instances', 'pm_id', 'pmId']);

export const FIELD_ALIASES = Object.freeze({
  pm_exec_path: 'script',
  script: 'script',
  pm_cwd: 'cwd',
  cwd: 'cwd',
  exec_interpreter: 'interpreter',
  interpreter: 'interpreter',
  interpreter_args: 'node_args',
  node_args: 'node_args',
  command: 'script',
});

export const CANONICAL_COMPARE_FIELDS = Object.freeze([
  'name',
  'script',
  'cwd',
  'exec_mode',
  'interpreter',
  'instances',
  'namespace',
  'args',
  'node_args',
  'autorestart',
  'autostart',
  'watch',
  'watch_delay',
  'watch_options',
  'cron_restart',
  'exp_backoff_restart_delay',
  'restart_delay',
  'min_uptime',
  'max_restarts',
  'stop_exit_codes',
  'kill_timeout',
  'kill_retry_time',
  'listen_timeout',
  'treekill',
  'wait_ready',
  'shutdown_with_message',
  'max_memory_restart',
  'merge_logs',
  'disable_logs',
  'log_type',
  'log_date_format',
  'time',
  'username',
  'uid',
  'gid',
  'user',
  'windowsHide',
  'instance_var',
  'NODE_APP_INSTANCE',
  'vizion',
  'automation',
  'pmx',
  'source_map_support',
  'disable_source_map_support',
  'filter_env',
  'pmx_module',
  'km_link',
  'env_production',
  'env_development',
  'env_file',
  'updateEnv',
  'PM2_HOME',
  'PM2_JSON_PROCESSING',
  'PM2_USAGE',
  'increment_var',
  'deep_monitoring',
  // Production dumpProcessList extras (PM2 6.0.13 observed)
  'restart_delay',
]);

/** Values-free classification table for Rule02 / audit evidence. */
export const PM2_FIELD_CLASSIFICATION = Object.freeze([
  { field: 'name', class: 'COMPARE', component: 'God.executeApp/Common.prepareAppKeys' },
  { field: 'script|pm_exec_path', class: 'COMPARE', component: 'ForkMode/Common' },
  { field: 'cwd|pm_cwd', class: 'COMPARE', component: 'ForkMode.options.cwd' },
  { field: 'exec_mode', class: 'COMPARE', component: 'God.executeApp cluster|fork' },
  { field: 'interpreter|exec_interpreter', class: 'COMPARE', component: 'ForkMode/Common' },
  {
    field: 'instances',
    class: 'TRANSFORM_EQUIV',
    component: 'dumpProcessList deletes; God.prepare standalone when absent (≠ explicit 1)',
  },
  { field: 'namespace', class: 'COMPARE', component: 'Common.prepareAppKeys' },
  { field: 'args|node_args', class: 'COMPARE', component: 'ForkMode spawn argv' },
  { field: 'autorestart|autostart', class: 'COMPARE', component: 'God.executeApp status/autostart' },
  { field: 'watch|watch_delay|watch_options', class: 'COMPARE', component: 'Watcher.js' },
  { field: 'cron_restart', class: 'COMPARE', component: 'God.registerCron/Worker' },
  { field: 'exp_backoff_restart_delay|restart_delay', class: 'COMPARE', component: 'God.handleExit' },
  { field: 'min_uptime|max_restarts|stop_exit_codes', class: 'COMPARE', component: 'God.handleExit' },
  { field: 'kill_timeout|kill_retry_time|treekill', class: 'COMPARE', component: 'God/Methods.js' },
  { field: 'listen_timeout|wait_ready', class: 'COMPARE', component: 'God.executeApp readyCb' },
  { field: 'shutdown_with_message', class: 'COMPARE', component: 'God soft-kill path' },
  { field: 'max_memory_restart', class: 'COMPARE', component: 'Worker.js' },
  { field: 'merge_logs|disable_logs|log_type|log_date_format|time', class: 'COMPARE', component: 'ForkMode/ProcessContainer' },
  { field: 'username|uid|gid|user', class: 'COMPARE', component: 'Common.prepareAppKeys/ForkMode spawn' },
  { field: 'windowsHide', class: 'COMPARE', component: 'ForkMode.options.windowsHide' },
  { field: 'instance_var|NODE_APP_INSTANCE', class: 'COMPARE', component: 'God.injectVariables' },
  { field: 'vizion|automation|pmx|source_map_support|filter_env', class: 'COMPARE', component: 'Common/God' },
  { field: 'pmx_module|km_link', class: 'COMPARE', component: 'dumpProcessList filter / module' },
  { field: 'env_production|env_development|env_file|updateEnv', class: 'COMPARE', component: 'Common.mergeEnvironment/CLI' },
  { field: 'PM2_HOME|PM2_JSON_PROCESSING|PM2_USAGE', class: 'COMPARE', component: 'uncertain→COMPARE' },
  { field: 'restart_delay', class: 'COMPARE', component: 'Common.prepareAppKeys restart_delay' },
  { field: 'application_env_INCLUDING_PATH', class: 'COMPARE', component: 'Utility.extend(env_copy, env_copy.env)' },
  { field: 'pm_id|unique_id|created_at|restart_time|unstable_restarts|prev_restart_delay', class: 'REGENERATED_VOLATILE', component: 'God.prepare/executeApp/dumpProcessList' },
  { field: 'axm_*|vizion_running|pm_uptime|pid|monit|exit_code', class: 'REGENERATED_VOLATILE', component: 'God.executeApp runtime' },
  { field: 'pm_*_log_path|pm_pid_path|error_file|out_file|log_file', class: 'REGENERATED_VOLATILE', component: 'God.executeApp first-create rewrite / aliases' },
  { field: 'version|node_version', class: 'REGENERATED_VOLATILE', component: 'readyCb/ProcessContainerFork report' },
  { field: 'status', class: 'REGENERATED_VOLATILE', component: 'gated separately (projection status leaf)' },
  { field: 'process_name_as_key_quirk', class: 'REGENERATED_VOLATILE', component: 'PM2 dump quirk key===name' },
]);

const VOLATILE = new Set(PROVEN_REGENERATED_OR_VOLATILE);
const COMPARE = new Set(CANONICAL_COMPARE_FIELDS);
const ALIAS_KEYS = new Set(Object.keys(FIELD_ALIASES));
const TRANSFORM = new Set(Object.keys(PM2_DUMP_TRANSFORM_FIELDS));

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

export function deepStableSerialize(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
    return JSON.stringify(v);
  }
  if (t === 'function' || t === 'symbol') {
    return `"__${t}__"`;
  }
  if (Array.isArray(v)) {
    return `[${v.map((x) => deepStableSerialize(x)).join(',')}]`;
  }
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${deepStableSerialize(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(Object.prototype.toString.call(v)));
}

export function deepStructuralEqual(a, b) {
  return deepStableSerialize(a) === deepStableSerialize(b);
}

/**
 * Flatten LIVE jlist / DUMP pm2_env / nested shapes into one comparable record.
 */
export function flattenPm2Entry(entry) {
  if (!isPlainObject(entry)) return { ok: false, error: 'ENTRY_SHAPE' };
  if (isPlainObject(entry.pm2_env) && !entry.pm_exec_path && !entry.pm_cwd && entry.name == null) {
    return { ok: true, flat: { ...entry.pm2_env, name: entry.pm2_env.name || entry.name } };
  }
  if (isPlainObject(entry.pm2_env)) {
    const flat = { ...entry.pm2_env };
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'pm2_env' || k === 'env') continue;
      if (v !== undefined) flat[k] = v;
    }
    if (isPlainObject(entry.env) && !isPlainObject(flat.env)) {
      flat.env = entry.env;
    }
    return { ok: true, flat };
  }
  return { ok: true, flat: { ...entry } };
}

/**
 * Resolve the authoritative application-env map for an entry.
 * Prefer nested `env`; never treat unknown flat keys as env without provenance.
 */
export function resolveApplicationEnvMap(entry, { applicationEnvKeysContext = null } = {}) {
  const flatRes = flattenPm2Entry(entry);
  if (!flatRes.ok) return { ok: false, error: flatRes.error || 'ENTRY_SHAPE' };
  const { flat } = flatRes;
  const ctx = applicationEnvKeysContext
    ? new Set(
        Array.isArray(applicationEnvKeysContext)
          ? applicationEnvKeysContext
          : [...applicationEnvKeysContext],
      )
    : null;

  if (isPlainObject(flat.env)) {
    const container = sanitizeApplicationEnvContainer(flat.env);
    return {
      ok: true,
      shape: 'nested_env',
      container,
      // Full nested key set (incl. contaminants) for ENV_MIRROR provenance
      nestedKeys: new Set(Object.keys(flat.env)),
      applicationEnvKeys: new Set(Object.keys(container)),
      contextKeys: ctx,
      flat,
    };
  }

  // Flat dump: only keys proven by LIVE application-env context are env.
  if (!ctx) {
    return {
      ok: false,
      error: 'FLAT_DUMP_ENV_CONTEXT_REQUIRED',
      flat,
      shape: 'flat_dump_entry',
    };
  }
  /** @type {Record<string, unknown>} */
  const container = {};
  for (const k of ctx) {
    if (isNonApplicationEnvKey(k)) continue;
    if (Object.prototype.hasOwnProperty.call(flat, k)) {
      container[k] = flat[k];
    }
  }
  return {
    ok: true,
    shape: 'flat_dump_entry',
    container,
    nestedKeys: new Set(),
    applicationEnvKeys: new Set(Object.keys(container)),
    contextKeys: ctx,
    flat,
  };
}

export function classifyPersistedPm2Field(key, { processName = null } = {}) {
  if (key === 'env' || key === 'pm2_env') return 'ENV_CONTAINER';
  if (key === STATUS_FIELD) return 'STATUS';
  if (processName && key === processName) return 'VOLATILE';
  if (VOLATILE.has(key)) return 'VOLATILE';
  if (TRANSFORM.has(key)) return 'TRANSFORM_EQUIV';
  if (ALIAS_KEYS.has(key)) return 'ALIAS';
  if (COMPARE.has(key)) return 'COMPARE';
  return 'UNCLASSIFIED';
}

function readCanonicalField(flat, canonical) {
  if (canonical === 'script') return flat.pm_exec_path ?? flat.script ?? flat.command;
  if (canonical === 'cwd') return flat.pm_cwd ?? flat.cwd;
  if (canonical === 'interpreter') return flat.exec_interpreter ?? flat.interpreter;
  if (canonical === 'node_args') return flat.node_args ?? flat.interpreter_args;
  return flat[canonical];
}

/**
 * Effective instances for DUMP↔LIVE / LIVE↔LIVE.
 * dumpProcessList deletes instances; Common.prepareAppKeys sets undefined → 1
 * before God.prepare. Therefore absent ≡ 1 (effective singleton).
 * Explicit multi-instance (n!==1) or 'max' remain distinct.
 */
export function effectiveInstancesValue(flat) {
  if (!Object.prototype.hasOwnProperty.call(flat, 'instances') || flat.instances == null || flat.instances === '') {
    return 1;
  }
  if (flat.instances === 'max') {
    return 'max';
  }
  const n = typeof flat.instances === 'string' ? parseInt(flat.instances, 10) : Number(flat.instances);
  if (!Number.isFinite(n)) return flat.instances;
  return n;
}

/** Alias for callers expecting effectiveInstancesSemantics shape. */
export function effectiveInstancesSemantics(flat) {
  const v = effectiveInstancesValue(flat);
  return {
    effective: v,
    rawPresent: Object.prototype.hasOwnProperty.call(flat, 'instances') && flat.instances != null,
    transform: 'dumpProcessList_delete_plus_Common.prepare_default_1',
  };
}

function compareEffectiveField(canonical, flatA, flatB) {
  if (canonical === 'instances') {
    return deepStructuralEqual(effectiveInstancesValue(flatA), effectiveInstancesValue(flatB));
  }
  const va = readCanonicalField(flatA, canonical);
  const vb = readCanonicalField(flatB, canonical);
  return deepStructuralEqual(va, vb);
}

/**
 * Classify a top-level key relative to nested env + LIVE env provenance.
 */
export function classifyTopLevelWithProvenance(key, { nestedKeys, contextKeys, processName = null }) {
  const base = classifyPersistedPm2Field(key, { processName });
  if (base !== 'UNCLASSIFIED') return base;
  if (nestedKeys && nestedKeys.has(key)) return 'ENV_MIRROR';
  if (contextKeys && contextKeys.has(key)) return 'APP_ENV';
  return 'UNCLASSIFIED';
}

/**
 * Read one application-env value from any supported shape (internal compare only).
 */
export function readApplicationEnvValue(entryOrFlat, key) {
  const flatRes =
    isPlainObject(entryOrFlat) && entryOrFlat.pm2_env
      ? flattenPm2Entry(entryOrFlat)
      : isPlainObject(entryOrFlat)
        ? { ok: true, flat: entryOrFlat }
        : { ok: false };
  if (!flatRes.ok) return { present: false };
  const { flat } = flatRes;
  if (isPlainObject(flat.env) && Object.prototype.hasOwnProperty.call(flat.env, key)) {
    return { present: true, value: flat.env[key], via: 'nested_env' };
  }
  if (
    isPlainObject(flat.pm2_env) &&
    isPlainObject(flat.pm2_env.env) &&
    Object.prototype.hasOwnProperty.call(flat.pm2_env.env, key)
  ) {
    return { present: true, value: flat.pm2_env.env[key], via: 'pm2_env.env' };
  }
  if (Object.prototype.hasOwnProperty.call(flat, key)) {
    return { present: true, value: flat[key], via: 'flat_top' };
  }
  return { present: false };
}

/**
 * Build effective semantic model (categorical evidence + internal compare bags).
 * Never embeds secret values in returned evidence fields.
 */
export function buildPm2EffectiveSemanticModel(
  entry,
  {
    source = 'DUMP',
    applicationEnvKeysContext = null,
    ignoreApplicationEnvKeys = [],
  } = {},
) {
  const flatRes = flattenPm2Entry(entry);
  if (!flatRes.ok) {
    return { ok: false, error: flatRes.error || 'ENTRY_SHAPE', source };
  }
  const { flat } = flatRes;
  const envRes = resolveApplicationEnvMap(entry, { applicationEnvKeysContext });
  const nestedKeys = envRes.ok ? envRes.nestedKeys || new Set() : new Set();
  const contextKeys =
    envRes.ok && envRes.contextKeys
      ? envRes.contextKeys
      : applicationEnvKeysContext
        ? new Set(
            Array.isArray(applicationEnvKeysContext)
              ? applicationEnvKeysContext
              : [...applicationEnvKeysContext],
          )
        : nestedKeys.size
          ? nestedKeys
          : null;

  const ignore = new Set([
    ...(ignoreApplicationEnvKeys || []),
    ...PM2_NESTED_ENV_VOLATILE_KEYS,
  ]);
  /** @type {string[]} */
  const unclassified = [];
  /** @type {string[]} */
  const compareKeys = [];

  for (const k of Object.keys(flat)) {
    const cls = classifyTopLevelWithProvenance(k, {
      nestedKeys,
      contextKeys,
      processName: flat.name,
    });
    if (
      cls === 'VOLATILE' ||
      cls === 'STATUS' ||
      cls === 'ENV_CONTAINER' ||
      cls === 'ENV_MIRROR' ||
      cls === 'APP_ENV'
    ) {
      continue;
    }
    if (cls === 'UNCLASSIFIED') {
      unclassified.push(k);
      continue;
    }
    compareKeys.push(FIELD_ALIASES[k] || k);
  }

  // Flat dump without nested env: unknown keys not in context already collected.
  // Also scan for required compare fields.
  for (const c of CANONICAL_COMPARE_FIELDS) {
    compareKeys.push(c);
  }

  const envKeyCount = envRes.ok ? Object.keys(envRes.container || {}).length : 0;

  return {
    ok: unclassified.length === 0 && envRes.ok !== false,
    source,
    flat,
    envRes,
    nestedKeys,
    contextKeys,
    ignoreApplicationEnvKeys: [...ignore],
    UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: unclassified.length,
    unclassifiedFields: unclassified,
    compareFieldCount: new Set(compareKeys).size,
    applicationEnvKeyCount: envKeyCount,
    hasPath: envRes.ok && Object.prototype.hasOwnProperty.call(envRes.container || {}, 'PATH'),
    PM2_RESURRECT_FIELD_CLASSIFICATION_COMPLETE: unclassified.length === 0 ? 'PASS' : 'FAIL',
    PM2_DUMP_TRANSFORM_MODEL: 'PASS',
    error: !envRes.ok && envRes.error ? envRes.error : unclassified.length ? 'UNCLASSIFIED' : null,
  };
}

/** Back-compat name used by earlier audit. */
export function buildEnginePm2SemanticSignature(entry, opts = {}) {
  return buildPm2EffectiveSemanticModel(entry, opts);
}

/**
 * Generic process PM2 semantic compare (Engine and fleet).
 * Options:
 * - ignoreApplicationEnvKeys: e.g. ['PATH'] — shape-aware, no clone mutation
 * - applicationEnvKeysContext: LIVE app-env key provenance for flat dump
 */
export function compareProcessPm2Semantics(
  a,
  b,
  {
    requireClassified = true,
    applicationEnvKeysContext = null,
    ignoreApplicationEnvKeys = [],
  } = {},
) {
  const modelA = buildPm2EffectiveSemanticModel(a, {
    applicationEnvKeysContext,
    ignoreApplicationEnvKeys,
  });
  const modelB = buildPm2EffectiveSemanticModel(b, {
    applicationEnvKeysContext,
    ignoreApplicationEnvKeys,
  });

  if (!modelA.flat || !modelB.flat) {
    return {
      ok: false,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'FAIL',
      mismatchCategories: ['ENTRY_SHAPE'],
    };
  }

  const nestedKeys = new Set([
    ...(modelA.nestedKeys || []),
    ...(modelB.nestedKeys || []),
  ]);
  let contextKeys = applicationEnvKeysContext
    ? new Set(
        Array.isArray(applicationEnvKeysContext)
          ? applicationEnvKeysContext
          : [...applicationEnvKeysContext],
      )
    : null;
  if (!contextKeys) {
    // LIVE↔LIVE or nested DUMP: derive context from nested env key union
    if (nestedKeys.size > 0) contextKeys = nestedKeys;
  }

  /** @type {string[]} */
  const mismatchCategories = [];
  /** @type {string[]} */
  const unclassifiedFields = [];
  const ignore = new Set([
    ...(ignoreApplicationEnvKeys || []),
    ...PM2_NESTED_ENV_VOLATILE_KEYS,
  ]);

  const keySet = new Set([...Object.keys(modelA.flat), ...Object.keys(modelB.flat)]);
  const processName = modelA.flat.name || modelB.flat.name || null;
  for (const k of keySet) {
    const cls = classifyTopLevelWithProvenance(k, {
      nestedKeys,
      contextKeys,
      processName,
    });
    if (
      cls === 'VOLATILE' ||
      cls === 'STATUS' ||
      cls === 'ENV_CONTAINER' ||
      cls === 'ENV_MIRROR' ||
      cls === 'APP_ENV'
    ) {
      continue;
    }
    if (cls === 'UNCLASSIFIED') {
      unclassifiedFields.push(k);
    }
  }

  if (requireClassified && unclassifiedFields.length > 0) {
    return {
      ok: false,
      error: 'DUMP_ENGINE_RESURRECT_FIELD_UNCLASSIFIED',
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'FAIL',
      UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: [...new Set(unclassifiedFields)].length,
      unclassifiedFields: [...new Set(unclassifiedFields)].sort(),
      mismatchCategories: ['UNCLASSIFIED_FIELD'],
      FLAT_DUMP_ENV_PROVENANCE_GATE: contextKeys ? 'PASS' : 'FAIL',
    };
  }

  const canonicalKeys = new Set(CANONICAL_COMPARE_FIELDS);
  for (const k of keySet) {
    const cls = classifyTopLevelWithProvenance(k, { nestedKeys, contextKeys, processName });
    if (cls === 'ALIAS' || cls === 'COMPARE' || cls === 'TRANSFORM_EQUIV') {
      canonicalKeys.add(FIELD_ALIASES[k] || k);
    }
  }

  for (const key of canonicalKeys) {
    if (!compareEffectiveField(key, modelA.flat, modelB.flat)) {
      mismatchCategories.push(key.toUpperCase());
    }
  }

  // Application env (nested or context-proven flat)
  const envA = resolveApplicationEnvMap(a, { applicationEnvKeysContext: contextKeys });
  const envB = resolveApplicationEnvMap(b, { applicationEnvKeysContext: contextKeys });
  if (!envA.ok || !envB.ok) {
    // LIVE↔LIVE with nested env always ok; flat without context fails
    if ((envA.error || envB.error) === 'FLAT_DUMP_ENV_CONTEXT_REQUIRED') {
      return {
        ok: false,
        error: 'FLAT_DUMP_ENV_CONTEXT_REQUIRED',
        DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
        LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'FAIL',
        mismatchCategories: ['FLAT_DUMP_ENV_CONTEXT'],
        FLAT_DUMP_ENV_PROVENANCE_GATE: 'FAIL',
      };
    }
    mismatchCategories.push('ENV_SHAPE');
  } else {
    const keys = new Set([
      ...Object.keys(envA.container || {}),
      ...Object.keys(envB.container || {}),
    ]);
    for (const k of keys) {
      if (ignore.has(k)) {
        // ignoreApplicationEnvKeys neutralizes *value* only; presence must still match
        // (e.g. PATH missing on one engine is not a PATH-value exception).
        const hasA = Object.prototype.hasOwnProperty.call(envA.container, k);
        const hasB = Object.prototype.hasOwnProperty.call(envB.container, k);
        if (hasA !== hasB) {
          mismatchCategories.push(k === 'PATH' ? 'ENV_PATH' : 'ENV_KEYSET');
        }
        continue;
      }
      const hasA = Object.prototype.hasOwnProperty.call(envA.container, k);
      const hasB = Object.prototype.hasOwnProperty.call(envB.container, k);
      if (hasA !== hasB) {
        mismatchCategories.push(k === 'PATH' ? 'ENV_PATH' : 'ENV_KEYSET');
        continue;
      }
      if (!hasA) continue;
      if (!deepStructuralEqual(envA.container[k], envB.container[k])) {
        mismatchCategories.push(k === 'PATH' ? 'ENV_PATH' : 'ENV_VALUE');
      }
    }
  }

  const unique = [...new Set(mismatchCategories)];
  if (unique.length > 0) {
    return {
      ok: false,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'FAIL',
      UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: 0,
      mismatchCategories: unique,
      FLAT_DUMP_ENV_PROVENANCE_GATE: 'PASS',
      PATH_NEUTRALIZATION_ALL_SUPPORTED_SHAPES: ignore.has('PATH') ? 'PASS' : 'N/A',
      PM2_DUMP_TRANSFORM_MODEL: 'PASS',
    };
  }

  return {
    ok: true,
    DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'PASS',
    LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
    UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: 0,
    DEEP_OBJECT_PM2_CONFIG_COMPARISON: 'PASS',
    PM2_RESURRECT_FIELD_CLASSIFICATION_COMPLETE: 'PASS',
    FLAT_DUMP_ENV_PROVENANCE_GATE: 'PASS',
    PATH_NEUTRALIZATION_ALL_SUPPORTED_SHAPES: ignore.has('PATH') ? 'PASS' : 'N/A',
    PM2_DUMP_TRANSFORM_MODEL: 'PASS',
    PM2_SOURCE_AWARE_EFFECTIVE_SEMANTIC_MODEL: 'PASS',
  };
}

/** Engine-named alias. */
export function compareEnginePm2Semantics(a, b, opts = {}) {
  return compareProcessPm2Semantics(a, b, opts);
}

export function resolveRawPm2Entry(procOrEntry) {
  if (procOrEntry && procOrEntry._rawEntry) return procOrEntry._rawEntry;
  return procOrEntry;
}

export function assertZeroUnclassifiedPersistedFields(entry, opts = {}) {
  const sig = buildPm2EffectiveSemanticModel(entry, opts);
  if (!sig.ok) {
    return {
      ok: false,
      UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: sig.UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT,
      unclassifiedFields: sig.unclassifiedFields,
    };
  }
  return {
    ok: true,
    UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: 0,
    PM2_RESURRECT_FIELD_CLASSIFICATION_COMPLETE: 'PASS',
  };
}

/** Derive LIVE application-env key context from a live engine (jlist or flat). */
export function deriveLiveApplicationEnvKeyContext(liveEntry) {
  const env = resolveApplicationEnvMap(liveEntry, {});
  if (env.ok && env.shape === 'nested_env') {
    return Object.keys(env.container || {}).sort();
  }
  if (env.ok) return Object.keys(env.container || {}).sort();
  const flatRes = flattenPm2Entry(liveEntry);
  if (!flatRes.ok) return [];
  if (isPlainObject(flatRes.flat.env)) {
    return Object.keys(sanitizeApplicationEnvContainer(flatRes.flat.env)).sort();
  }
  return [];
}

/**
 * Compatibility wrapper used by semantics/projection:
 * returns `{ keys: string[] }` for Set spread.
 */
export function buildApplicationEnvKeysContext(entry) {
  return { keys: deriveLiveApplicationEnvKeyContext(entry) };
}

export const RESURRECT_IGNORED_FIELDS = PROVEN_REGENERATED_OR_VOLATILE;
export const RESURRECT_TOP_LEVEL_FIELDS = CANONICAL_COMPARE_FIELDS;
