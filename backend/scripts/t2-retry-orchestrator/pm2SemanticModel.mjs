/**
 * Canonical PM2 6.0.13 Engine semantic model for T2 v1.6.1.
 *
 * Classification authority (read-only PM2 source review):
 * - God.prepare / God.executeApp / God.injectVariables
 * - God/ForkMode.js spawn options
 * - God/Methods.js kill_timeout / kill_retry_time
 * - Common.prepareAppKeys / mergeEnvironment / filter_env / username
 * - Worker.js max_memory_restart / exp_backoff
 * - Watcher.js watch_options
 * - God.dumpProcessList (deletes pm_id + instances; regenerates unique_id on prepare)
 *
 * Every persisted field is either COMPARE or PROVEN_REGENERATED_OR_VOLATILE.
 * Unclassified fields fail closed.
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
  // Rewritten on online ready / process report
  'version', // Utility.findPackageVersion in executeApp readyCb
  'node_version', // ProcessContainerFork reports after spawn
  // Nested containers handled separately
  'env',
  'pm2_env',
  STATUS_FIELD,
]);

/**
 * Explicit alias → canonical field (normalized before compare).
 */
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

/**
 * Canonical COMPARE fields (PM2-consumed or uncertain→COMPARE).
 * Evidence/table only — exhaustive dump scan still fail-closes unknowns.
 */
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
]);

/** Values-free classification table for Rule02 / audit evidence. */
export const PM2_FIELD_CLASSIFICATION = Object.freeze([
  { field: 'name', class: 'COMPARE', component: 'God.executeApp/Common.prepareAppKeys' },
  { field: 'script|pm_exec_path', class: 'COMPARE', component: 'ForkMode/Common' },
  { field: 'cwd|pm_cwd', class: 'COMPARE', component: 'ForkMode.options.cwd' },
  { field: 'exec_mode', class: 'COMPARE', component: 'God.executeApp cluster|fork' },
  { field: 'interpreter|exec_interpreter', class: 'COMPARE', component: 'ForkMode/Common' },
  { field: 'instances', class: 'COMPARE', component: 'God.prepare timesLimit (deleted on dump)' },
  { field: 'namespace', class: 'COMPARE', component: 'Common.prepareAppKeys' },
  { field: 'args|node_args', class: 'COMPARE', component: 'ForkMode spawn argv' },
  { field: 'autorestart|autostart', class: 'COMPARE', component: 'God.executeApp status/autostart' },
  { field: 'watch|watch_delay|watch_options', class: 'COMPARE', component: 'Watcher.js' },
  { field: 'cron_restart', class: 'COMPARE', component: 'God.registerCron/Worker' },
  { field: 'exp_backoff_restart_delay', class: 'COMPARE', component: 'God.handleExit' },
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
  { field: 'PM2_HOME|PM2_JSON_PROCESSING|PM2_USAGE', class: 'COMPARE', component: 'uncertain→COMPARE (app/runtime env)' },
  { field: 'application_env_INCLUDING_PATH', class: 'COMPARE', component: 'Utility.extend(env_copy, env_copy.env)' },
  { field: 'pm_id|unique_id|created_at|restart_time|unstable_restarts|prev_restart_delay', class: 'REGENERATED_VOLATILE', component: 'God.prepare/executeApp/dumpProcessList' },
  { field: 'axm_*|vizion_running|pm_uptime|pid|monit|exit_code', class: 'REGENERATED_VOLATILE', component: 'God.executeApp runtime' },
  { field: 'pm_*_log_path|pm_pid_path', class: 'REGENERATED_VOLATILE', component: 'God.executeApp first-create rewrite' },
  { field: 'version|node_version', class: 'REGENERATED_VOLATILE', component: 'readyCb/ProcessContainerFork report' },
  { field: 'status', class: 'REGENERATED_VOLATILE', component: 'gated separately (projection status leaf)' },
]);

const VOLATILE = new Set(PROVEN_REGENERATED_OR_VOLATILE);
const COMPARE = new Set(CANONICAL_COMPARE_FIELDS);
const ALIAS_KEYS = new Set(Object.keys(FIELD_ALIASES));

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deterministic deep structural serialization — never String(object).
 */
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
  // Fail closed on exotic types rather than collapsing to "[object Object]"
  return JSON.stringify(String(Object.prototype.toString.call(v)));
}

export function deepStructuralEqual(a, b) {
  return deepStableSerialize(a) === deepStableSerialize(b);
}

function flattenPm2Entry(entry) {
  if (!isPlainObject(entry)) return { ok: false, error: 'ENTRY_SHAPE' };
  // Prefer flat dump pm2_env shape already flattened; live may nest pm2_env.
  if (isPlainObject(entry.pm2_env) && !entry.pm_exec_path && !entry.pm_cwd && entry.name == null) {
    return { ok: true, flat: { ...entry.pm2_env, name: entry.pm2_env.name || entry.name } };
  }
  if (isPlainObject(entry.pm2_env)) {
    // Live God process: merge pm2_env under entry, entry-level wins for pm_id/status/pid
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

function resolveAppEnvContainer(flat) {
  if (isPlainObject(flat.env) && !Array.isArray(flat.env)) {
    return { ok: true, container: flat.env, shape: 'nested_env' };
  }
  // Flat dump: application keys live on the entry itself
  return { ok: true, container: flat, shape: 'flat_dump_entry' };
}

function isApplicationEnvKey(key) {
  if (VOLATILE.has(key)) return false;
  if (key === STATUS_FIELD) return false;
  if (ALIAS_KEYS.has(key)) return false;
  if (COMPARE.has(key)) return false;
  if (key === 'env' || key === 'pm2_env') return false;
  // Remaining keys on a flat dump container are application env (incl PATH)
  return true;
}

/**
 * Classify one top-level persisted key.
 * @returns {'VOLATILE'|'STATUS'|'ALIAS'|'COMPARE'|'ENV_CONTAINER'|'UNCLASSIFIED'}
 */
export function classifyPersistedPm2Field(key) {
  if (key === 'env' || key === 'pm2_env') return 'ENV_CONTAINER';
  if (key === STATUS_FIELD) return 'STATUS';
  if (VOLATILE.has(key)) return 'VOLATILE';
  if (ALIAS_KEYS.has(key) || COMPARE.has(key)) {
    return ALIAS_KEYS.has(key) ? 'ALIAS' : 'COMPARE';
  }
  return 'UNCLASSIFIED';
}

function readCanonicalField(flat, canonical) {
  if (canonical === 'script') {
    return flat.pm_exec_path ?? flat.script ?? flat.command;
  }
  if (canonical === 'cwd') {
    return flat.pm_cwd ?? flat.cwd;
  }
  if (canonical === 'interpreter') {
    return flat.exec_interpreter ?? flat.interpreter;
  }
  if (canonical === 'node_args') {
    return flat.node_args ?? flat.interpreter_args;
  }
  return flat[canonical];
}

function collectCanonicalKeysFromFlat(flat) {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const k of Object.keys(flat)) {
    const cls = classifyPersistedPm2Field(k);
    if (cls === 'VOLATILE' || cls === 'STATUS' || cls === 'ENV_CONTAINER') continue;
    if (cls === 'UNCLASSIFIED') {
      // application env keys on flat dump are not top-level COMPARE
      if (flat.env && isPlainObject(flat.env)) {
        // nested env shape: top-level unknown is unclassified config
        keys.add(`__UNCLASSIFIED__:${k}`);
      } else if (isApplicationEnvKey(k)) {
        // flat dump application env — handled in env compare
        continue;
      } else {
        keys.add(`__UNCLASSIFIED__:${k}`);
      }
      continue;
    }
    const canonical = FIELD_ALIASES[k] || k;
    keys.add(canonical);
  }
  // Always include declared compare fields that may be absent (undefined==undefined OK)
  for (const c of CANONICAL_COMPARE_FIELDS) {
    if (c === 'vizion_running') continue;
    keys.add(c);
  }
  return keys;
}

/**
 * Build secret-safe categorical signature (no env values).
 */
export function buildEnginePm2SemanticSignature(entry, { source = 'DUMP' } = {}) {
  const flatRes = flattenPm2Entry(entry);
  if (!flatRes.ok) {
    return { ok: false, error: flatRes.error || 'ENTRY_SHAPE', source };
  }
  const { flat } = flatRes;
  const unclassified = [];
  const compareKeys = [];

  for (const k of Object.keys(flat)) {
    const cls = classifyPersistedPm2Field(k);
    if (cls === 'UNCLASSIFIED') {
      if (isPlainObject(flat.env)) {
        unclassified.push(k);
      } else if (!isApplicationEnvKey(k)) {
        unclassified.push(k);
      }
      // else: flat application env key — OK
    } else if (cls === 'COMPARE' || cls === 'ALIAS') {
      compareKeys.push(FIELD_ALIASES[k] || k);
    }
  }

  const envRes = resolveAppEnvContainer(flat);
  const envKeys = envRes.ok
    ? Object.keys(envRes.container)
        .filter((k) => {
          if (isPlainObject(flat.env)) {
            // nested: all env keys are application (except we still compare PATH)
            return true;
          }
          return isApplicationEnvKey(k) || k === 'PATH' || k === 'NODE_ENV';
        })
        .sort()
    : [];

  return {
    ok: unclassified.length === 0,
    source,
    UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: unclassified.length,
    unclassifiedFields: unclassified,
    compareFieldCount: new Set(compareKeys).size,
    applicationEnvKeyCount: envKeys.length,
    // categorical only — never values
    hasPath: envKeys.includes('PATH'),
    PM2_RESURRECT_FIELD_CLASSIFICATION_COMPLETE: unclassified.length === 0 ? 'PASS' : 'FAIL',
  };
}

/**
 * Exhaustive Engine PM2 semantic compare (LIVE or DUMP entries).
 * Never returns secret/env values — only categories / field names.
 */
export function compareEnginePm2Semantics(a, b, { requireClassified = true } = {}) {
  const fa = flattenPm2Entry(a);
  const fb = flattenPm2Entry(b);
  if (!fa.ok || !fb.ok) {
    return {
      ok: false,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'FAIL',
      mismatchCategories: ['ENTRY_SHAPE'],
    };
  }

  /** @type {string[]} */
  const mismatchCategories = [];
  /** @type {string[]} */
  const unclassifiedFields = [];

  const keySet = new Set([...Object.keys(fa.flat), ...Object.keys(fb.flat)]);
  for (const k of keySet) {
    const cls = classifyPersistedPm2Field(k);
    if (cls === 'VOLATILE' || cls === 'STATUS' || cls === 'ENV_CONTAINER') continue;

    if (cls === 'UNCLASSIFIED') {
      const nestedEnv = isPlainObject(fa.flat.env) || isPlainObject(fb.flat.env);
      if (!nestedEnv && isApplicationEnvKey(k)) {
        continue; // flat dump application env
      }
      unclassifiedFields.push(k);
      continue;
    }
  }

  if (requireClassified && unclassifiedFields.length > 0) {
    return {
      ok: false,
      error: 'DUMP_ENGINE_RESURRECT_FIELD_UNCLASSIFIED',
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'FAIL',
      UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: unclassifiedFields.length,
      unclassifiedFields: [...new Set(unclassifiedFields)].sort(),
      mismatchCategories: ['UNCLASSIFIED_FIELD'],
    };
  }

  const canonicalKeys = new Set([
    ...collectCanonicalKeysFromFlat(fa.flat),
    ...collectCanonicalKeysFromFlat(fb.flat),
  ]);

  for (const key of canonicalKeys) {
    if (String(key).startsWith('__UNCLASSIFIED__:')) {
      const name = key.slice('__UNCLASSIFIED__:'.length);
      unclassifiedFields.push(name);
      continue;
    }
    const va = readCanonicalField(fa.flat, key);
    const vb = readCanonicalField(fb.flat, key);
    if (!deepStructuralEqual(va, vb)) {
      mismatchCategories.push(key.toUpperCase());
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
    };
  }

  // Full application env INCLUDING PATH
  const envA = resolveAppEnvContainer(fa.flat);
  const envB = resolveAppEnvContainer(fb.flat);
  if (!envA.ok || !envB.ok) {
    mismatchCategories.push('ENV_SHAPE');
  } else {
    const pickAppKeys = (container, flat) => {
      if (isPlainObject(flat.env)) {
        return Object.keys(container);
      }
      return Object.keys(container).filter((k) => isApplicationEnvKey(k) || k === 'PATH');
    };
    const keys = new Set([
      ...pickAppKeys(envA.container, fa.flat),
      ...pickAppKeys(envB.container, fb.flat),
    ]);
    for (const k of keys) {
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
    };
  }

  return {
    ok: true,
    DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'PASS',
    LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
    UNCLASSIFIED_PERSISTED_PM2_FIELD_COUNT: 0,
    DEEP_OBJECT_PM2_CONFIG_COMPARISON: 'PASS',
    PM2_RESURRECT_FIELD_CLASSIFICATION_COMPLETE: 'PASS',
  };
}

/** Resolve raw entry from fingerprint proc or raw PM2 object. */
export function resolveRawPm2Entry(procOrEntry) {
  if (procOrEntry && procOrEntry._rawEntry) return procOrEntry._rawEntry;
  return procOrEntry;
}

export function assertZeroUnclassifiedPersistedFields(entry) {
  const sig = buildEnginePm2SemanticSignature(entry, { source: 'DUMP' });
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

// Back-compat export names used by resurrectSemantics
export const RESURRECT_IGNORED_FIELDS = PROVEN_REGENERATED_OR_VOLATILE;
export const RESURRECT_TOP_LEVEL_FIELDS = CANONICAL_COMPARE_FIELDS;
