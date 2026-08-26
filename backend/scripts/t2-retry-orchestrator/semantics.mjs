/**
 * Secret-safe PM2 semantic model for T2 retry.
 * Compares env key sets, value equality, and stable launch config
 * without logging values/hashes of secrets.
 */

import {
  BACKEND_NAME,
  COLLECTOR_DB_KEYS,
  COLLECTOR_NAME,
  ENGINE_NAME,
  EXPECTED_COLLECTOR_DB_USER,
  MONITOR_NAME,
  PM2_METADATA_KEYS,
  PROCESSOR_NAME,
  PROVIDER_ENV_KEY_RE,
  STABLE_CONFIG_FIELDS,
  SUPPORTED_ENV_SHAPES,
} from './constants.mjs';
import {
  compareEnginePm2Semantics,
  resolveRawPm2Entry,
} from './pm2SemanticModel.mjs';

const META = new Set(PM2_METADATA_KEYS);

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function scalarEnvValue(v) {
  if (v == null) return null;
  if (typeof v === 'object') return null;
  return String(v);
}

function stableSerialize(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => String(x)));
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Extract non-metadata scalar keys from a flat PM2 dump entry (God env shape).
 * @param {Record<string, unknown>} entry
 */
function extractFlatDumpScalars(entry) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(entry)) {
    if (META.has(k)) continue;
    const s = scalarEnvValue(v);
    if (s == null) continue;
    out[k] = s;
  }
  return out;
}

/**
 * Detect and extract application env from supported PM2 structural forms.
 * Never returns secret values to callers via logging — only the map for internal use.
 *
 * @param {Record<string, unknown>} entry
 * @returns {{ ok: true, env: Record<string,string>, shape: string } | { ok: false, error: string, shape: null }}
 */
export function extractProcessEnvResult(entry = {}) {
  const shapes = [];

  if (isPlainObject(entry.pm2_env) && isPlainObject(entry.pm2_env.env)) {
    shapes.push('entry.pm2_env.env');
  }
  if (isPlainObject(entry.env) && !Array.isArray(entry.env)) {
    shapes.push('entry.env');
  }

  const looksFlatDump =
    !entry.pm2_env &&
    (entry.pm_exec_path != null || entry.pm_cwd != null) &&
    entry.name != null &&
    entry.status != null;

  if (looksFlatDump) {
    shapes.push('flat_dump_entry');
  }

  if (shapes.length === 0) {
    return { ok: false, error: 'ENV_SHAPE_UNRECOGNIZED', shape: null };
  }

  /** @type {Record<string, string>} */
  let env = {};

  if (shapes.includes('flat_dump_entry')) {
    env = { ...env, ...extractFlatDumpScalars(entry) };
  }
  if (shapes.includes('entry.env')) {
    for (const [k, v] of Object.entries(entry.env)) {
      if (META.has(k)) continue;
      const s = scalarEnvValue(v);
      if (s == null) continue;
      env[k] = s;
    }
  }
  if (shapes.includes('entry.pm2_env.env')) {
    for (const [k, v] of Object.entries(entry.pm2_env.env)) {
      if (META.has(k)) continue;
      const s = scalarEnvValue(v);
      if (s == null) continue;
      env[k] = s;
    }
  }

  // Prefer the most specific supported shape label for evidence.
  const shape = shapes.includes('entry.pm2_env.env')
    ? 'entry.pm2_env.env'
    : shapes.includes('entry.env')
      ? 'entry.env'
      : 'flat_dump_entry';

  if (!SUPPORTED_ENV_SHAPES.includes(shape)) {
    return { ok: false, error: 'ENV_SHAPE_UNSUPPORTED', shape: null };
  }

  return { ok: true, env, shape };
}

/**
 * Extract the real application env container from a PM2 dump/jlist entry.
 * @param {Record<string, unknown>} entry
 * @returns {Record<string, string>}
 */
export function extractProcessEnv(entry = {}) {
  const r = extractProcessEnvResult(entry);
  return r.ok ? r.env : {};
}

/**
 * Fail-closed batch check that every entry has a parseable env shape.
 * @param {Array<Record<string, unknown>>} entries
 */
export function assertEntriesEnvShapes(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: 'ENV_SHAPE_EMPTY_PROCESS_LIST' };
  }
  const shapes = new Set();
  for (const entry of entries) {
    const r = extractProcessEnvResult(entry);
    if (!r.ok) {
      return { ok: false, error: r.error || 'ENV_SHAPE_UNRECOGNIZED' };
    }
    shapes.add(r.shape);
  }
  return { ok: true, shapes: [...shapes].sort() };
}

function hasNonEmpty(map, key) {
  const v = map[key];
  return v != null && String(v).length > 0;
}

function statusOf(entry) {
  return (
    entry.status ||
    entry.pm2_env?.status ||
    (typeof entry.pm2_env === 'object' ? entry.pm2_env.status : undefined) ||
    'unknown'
  );
}

function pickStableConfig(entry = {}) {
  const pm = isPlainObject(entry.pm2_env) ? entry.pm2_env : {};
  const cwd = entry.pm_cwd || pm.pm_cwd || entry.cwd || pm.cwd || null;
  const script =
    entry.pm_exec_path || pm.pm_exec_path || entry.script || pm.script || null;
  const execMode = entry.exec_mode || pm.exec_mode || null;
  const interpreter = entry.exec_interpreter || pm.exec_interpreter || null;
  const instances = entry.instances ?? pm.instances ?? null;
  const namespace = entry.namespace || pm.namespace || null;
  const args = entry.args ?? pm.args ?? null;
  const nodeArgs = entry.node_args ?? pm.node_args ?? null;
  const autorestart = entry.autorestart ?? pm.autorestart ?? null;
  const watch = entry.watch ?? pm.watch ?? null;

  return {
    name: entry.name || pm.name || null,
    script: script != null ? String(script) : null,
    cwd: cwd != null ? String(cwd) : null,
    exec_mode: execMode != null ? String(execMode) : null,
    interpreter: interpreter != null ? String(interpreter) : null,
    instances: instances != null ? Number(instances) : null,
    namespace: namespace != null ? String(namespace) : null,
    args: stableSerialize(args),
    node_args: stableSerialize(nodeArgs),
    autorestart: autorestart == null ? null : Boolean(autorestart),
    watch: watch == null ? null : Boolean(watch),
  };
}

/**
 * Normalize one process. Env values kept only on `_envValues` (non-enumerable).
 * @param {Record<string, unknown>} entry
 */
export function normalizeProcess(entry = {}) {
  const envResult = extractProcessEnvResult(entry);
  const envMap = envResult.ok ? envResult.env : {};
  const pmId = entry.pm_id ?? entry.pmId ?? entry.pm2_env?.pm_id;
  const stable = pickStableConfig(entry);
  const createdAt = entry.pm2_env?.created_at ?? entry.created_at ?? null;
  const restartTime = entry.pm2_env?.restart_time ?? entry.restart_time ?? null;
  const nodeEnv = envMap.NODE_ENV != null ? String(envMap.NODE_ENV) : null;

  const envKeys = Object.keys(envMap).sort();
  const collectorDb = {};
  for (const key of COLLECTOR_DB_KEYS) {
    collectorDb[key] = { present: hasNonEmpty(envMap, key) };
  }

  const proc = {
    name: stable.name,
    pm_id: typeof pmId === 'number' ? pmId : pmId != null ? Number(pmId) : null,
    status: String(statusOf(entry)),
    cwd: stable.cwd,
    script: stable.script,
    exec_mode: stable.exec_mode,
    interpreter: stable.interpreter,
    instances: stable.instances,
    namespace: stable.namespace,
    args: stable.args,
    node_args: stable.node_args,
    autorestart: stable.autorestart,
    watch: stable.watch,
    NODE_ENV: nodeEnv,
    created_at: createdAt,
    restart_time: restartTime,
    pid: typeof entry.pid === 'number' ? entry.pid : null,
    env_keys: envKeys,
    env_shape: envResult.ok ? envResult.shape : null,
    env_shape_ok: envResult.ok === true,
    collector_db: collectorDb,
    collector_db_user_matches_expected:
      hasNonEmpty(envMap, 'DB_USER') && String(envMap.DB_USER) === EXPECTED_COLLECTOR_DB_USER,
    has_telegram_bot_token: hasNonEmpty(envMap, 'TELEGRAM_BOT_TOKEN'),
    has_provider_env: envKeys.some((k) => PROVIDER_ENV_KEY_RE.test(k) && hasNonEmpty(envMap, k)),
  };

  Object.defineProperty(proc, '_envValues', {
    value: envMap,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(proc, '_rawEntry', {
    value: entry,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return proc;
}

function attachEnv(target, src) {
  Object.defineProperty(target, '_envValues', {
    value: src._envValues || {},
    enumerable: false,
    writable: false,
    configurable: false,
  });
  if (src._rawEntry) {
    Object.defineProperty(target, '_rawEntry', {
      value: src._rawEntry,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
  return target;
}

/**
 * @param {Array<Record<string, unknown>>} entries
 */
export function semanticFingerprint(entries = []) {
  const normalized = entries.map(normalizeProcess);
  const byName = (name) =>
    normalized
      .filter((p) => p.name === name)
      .sort((a, b) => (a.pm_id ?? 0) - (b.pm_id ?? 0));

  const mapFull = (p) =>
    attachEnv(
      {
        pm_id: p.pm_id,
        status: p.status,
        NODE_ENV: p.NODE_ENV,
        cwd: p.cwd,
        script: p.script,
        exec_mode: p.exec_mode,
        interpreter: p.interpreter,
        instances: p.instances,
        namespace: p.namespace,
        args: p.args,
        node_args: p.node_args,
        autorestart: p.autorestart,
        watch: p.watch,
        created_at: p.created_at,
        restart_time: p.restart_time,
        env_keys: p.env_keys,
        env_shape: p.env_shape,
        has_telegram_bot_token: p.has_telegram_bot_token,
        has_provider_env: p.has_provider_env,
      },
      p,
    );

  const engines = byName(ENGINE_NAME).map(mapFull);
  const backends = byName(BACKEND_NAME).map(mapFull);
  const processors = byName(PROCESSOR_NAME).map(mapFull);
  const monitors = byName(MONITOR_NAME).map(mapFull);
  const collectors = byName(COLLECTOR_NAME).map((p) =>
    attachEnv(
      {
        ...mapFull(p),
        db_keys_present: Object.fromEntries(
          COLLECTOR_DB_KEYS.map((k) => [k, p.collector_db[k].present]),
        ),
        db_user_matches_expected: p.collector_db_user_matches_expected,
      },
      p,
    ),
  );

  const known = new Set([ENGINE_NAME, BACKEND_NAME, PROCESSOR_NAME, COLLECTOR_NAME, MONITOR_NAME]);
  const others = normalized
    .filter((p) => p.name && !known.has(p.name))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)) || (a.pm_id ?? 0) - (b.pm_id ?? 0))
    .map((p) => attachEnv({ name: p.name, ...mapFull(p) }, p));

  return {
    engines,
    backends,
    processors,
    monitors,
    collectors,
    others,
    engine_online_count: engines.filter((e) => e.status === 'online').length,
    backend_count: backends.length,
    processor_count: processors.length,
    monitor_count: monitors.length,
    collector_count: collectors.length,
    other_names: [...new Set(others.map((o) => o.name))].sort(),
  };
}

/**
 * Secret-safe stable launch/config comparison.
 * @returns {Array<{kind:string, detail?: object}>}
 */
export function diffStableConfig(preProc, postProc, { scope } = {}) {
  const diffs = [];
  if (!preProc || !postProc) {
    diffs.push({ kind: 'PROCESS_CONFIG_CHANGED', detail: { scope, category: 'missing' } });
    return diffs;
  }
  for (const field of STABLE_CONFIG_FIELDS) {
    if (preProc[field] === postProc[field]) continue;
    if (field === 'script') {
      diffs.push({ kind: 'SCRIPT_CHANGED', detail: { scope } });
    } else if (field === 'cwd') {
      diffs.push({ kind: 'CWD_CHANGED', detail: { scope } });
    } else if (field === 'args' || field === 'node_args') {
      diffs.push({ kind: 'ARGS_CHANGED', detail: { scope, field } });
    } else if (field === 'exec_mode') {
      diffs.push({ kind: 'EXEC_MODE_CHANGED', detail: { scope } });
    } else {
      diffs.push({ kind: 'PROCESS_CONFIG_CHANGED', detail: { scope, field } });
    }
  }
  return diffs;
}

/**
 * Secret-safe env structural/value comparison for one process pair.
 * @returns {Array<{kind:string, detail?: object}>}
 */
export function diffProcessEnv(preProc, postProc, { scope, allowCollectorDbAppear = false } = {}) {
  const diffs = [];
  const preKeys = new Set(preProc?.env_keys || []);
  const postKeys = new Set(postProc?.env_keys || []);
  const preVals = preProc?._envValues || {};
  const postVals = postProc?._envValues || {};

  const added = [...postKeys].filter((k) => !preKeys.has(k)).sort();
  const removed = [...preKeys].filter((k) => !postKeys.has(k)).sort();
  const shared = [...preKeys].filter((k) => postKeys.has(k)).sort();

  for (const k of added) {
    if (allowCollectorDbAppear && COLLECTOR_DB_KEYS.includes(k)) {
      continue;
    }
    if (k === 'TELEGRAM_BOT_TOKEN') {
      diffs.push({ kind: 'TELEGRAM_TOKEN_ENV_RESTORED', detail: { scope, key: k, category: 'key-added' } });
    } else if (PROVIDER_ENV_KEY_RE.test(k)) {
      diffs.push({ kind: 'PROVIDER_ENV_CHANGE', detail: { scope, key: k, category: 'key-added' } });
    } else if (k === 'NODE_ENV') {
      diffs.push({ kind: 'NODE_ENV_CHANGE', detail: { scope, category: 'key-added' } });
    } else {
      diffs.push({ kind: 'ENV_KEY_ADDED', detail: { scope, key: k, category: 'key-added' } });
    }
  }

  for (const k of removed) {
    if (PROVIDER_ENV_KEY_RE.test(k)) {
      diffs.push({ kind: 'PROVIDER_ENV_CHANGE', detail: { scope, key: k, category: 'key-removed' } });
    } else if (k === 'NODE_ENV') {
      diffs.push({ kind: 'NODE_ENV_CHANGE', detail: { scope, category: 'key-removed' } });
    } else {
      diffs.push({ kind: 'ENV_KEY_REMOVED', detail: { scope, key: k, category: 'key-removed' } });
    }
  }

  for (const k of shared) {
    const same = preVals[k] === postVals[k];
    if (same) continue;
    if (k === 'NODE_ENV') {
      diffs.push({ kind: 'NODE_ENV_CHANGE', detail: { scope, category: 'value-changed', equality: 'CHANGED' } });
    } else if (k === 'TELEGRAM_BOT_TOKEN') {
      diffs.push({
        kind: 'TELEGRAM_TOKEN_ENV_RESTORED',
        detail: { scope, key: k, category: 'value-changed', equality: 'CHANGED' },
      });
    } else if (PROVIDER_ENV_KEY_RE.test(k)) {
      diffs.push({
        kind: 'PROVIDER_ENV_CHANGE',
        detail: { scope, key: k, category: 'value-changed', equality: 'CHANGED' },
      });
    } else {
      diffs.push({
        kind: 'ENV_VALUE_CHANGED',
        detail: { scope, key: k, category: 'value-changed', equality: 'CHANGED' },
      });
    }
  }

  return diffs;
}

/**
 * Compare persisted collector DB_* to live values (internal equality only).
 * Evidence-safe match bits — never values/hashes.
 *
 * @param {object} liveCollectorProc
 * @param {object} persistedCollectorProc
 * @returns {{ ok: boolean, matches: Record<string, 'YES'|'NO'>, error?: string }}
 */
export function compareCollectorDbLiveToPersist(liveCollectorProc, persistedCollectorProc) {
  /** @type {Record<string, 'YES'|'NO'>} */
  const matches = {};
  const liveVals = liveCollectorProc?._envValues || {};
  const persistVals = persistedCollectorProc?._envValues || {};

  let ok = true;
  for (const key of COLLECTOR_DB_KEYS) {
    const livePresent = hasNonEmpty(liveVals, key);
    const persistPresent = hasNonEmpty(persistVals, key);
    const equal = livePresent && persistPresent && liveVals[key] === persistVals[key];
    matches[`${key}_MATCH`] = equal ? 'YES' : 'NO';
    if (!equal) ok = false;
  }

  if (!ok) {
    return { ok: false, matches, error: 'COLLECTOR_DB_LIVE_PERSIST_MISMATCH' };
  }
  if (persistVals.DB_USER !== EXPECTED_COLLECTOR_DB_USER) {
    matches.DB_USER_MATCH = 'NO';
    return { ok: false, matches, error: 'COLLECTOR_DB_USER_UNEXPECTED' };
  }
  return { ok: true, matches };
}

/**
 * Capture live collector DB values for later exact persist match (non-enumerable).
 */
export function captureCollectorDbLiveValues(liveFp) {
  const live = (liveFp.collectors || [])[0];
  if (!live) return null;
  const vals = live._envValues || {};
  /** @type {Record<string, string>} */
  const captured = {};
  for (const key of COLLECTOR_DB_KEYS) {
    if (!hasNonEmpty(vals, key)) return null;
    captured[key] = vals[key];
  }
  return captured;
}

export function summarizeEnvEquality(preProc, postProc) {
  const preKeys = new Set(preProc?.env_keys || []);
  const postKeys = new Set(postProc?.env_keys || []);
  const preVals = preProc?._envValues || {};
  const postVals = postProc?._envValues || {};
  const shared = [...preKeys].filter((k) => postKeys.has(k));
  let same = 0;
  let changed = 0;
  for (const k of shared) {
    if (preVals[k] === postVals[k]) same += 1;
    else changed += 1;
  }
  return {
    keys_added: [...postKeys].filter((k) => !preKeys.has(k)).length,
    keys_removed: [...preKeys].filter((k) => !postKeys.has(k)).length,
    values_same: same,
    values_changed: changed,
  };
}

/**
 * Read PATH presence/equality bits without exposing values to evidence.
 * @param {object} proc
 * @returns {{ present: boolean, value: string|null }}
 */
function readPathInternal(proc) {
  const vals = proc?._envValues || {};
  const keys = new Set(proc?.env_keys || Object.keys(vals));
  if (!keys.has('PATH')) {
    return { present: false, value: null };
  }
  const v = vals.PATH;
  if (v == null) {
    return { present: false, value: null };
  }
  return { present: true, value: String(v) };
}

/**
 * Backend+processor PATH consensus for engine retain selection only.
 * Never returns PATH into caller evidence — value stays internal.
 * @param {ReturnType<typeof semanticFingerprint>} fp
 */
export function resolveCanonicalPathConsensus(fp) {
  const backends = fp.backends || [];
  if (backends.length === 0) {
    return { ok: false, error: 'ENGINE_CANONICAL_PATH_UNRESOLVED' };
  }
  const backendPaths = backends.map((b) => readPathInternal(b));
  if (backendPaths.some((p) => !p.present)) {
    return { ok: false, error: 'ENGINE_CANONICAL_PATH_UNRESOLVED' };
  }
  const canonical = backendPaths[0].value;
  if (backendPaths.some((p) => p.value !== canonical)) {
    return { ok: false, error: 'ENGINE_CANONICAL_PATH_UNRESOLVED' };
  }

  const processors = (fp.processors || []).filter((p) => p.status === 'online');
  if (processors.length === 0) {
    return { ok: false, error: 'ENGINE_CANONICAL_PATH_UNRESOLVED' };
  }
  for (const proc of processors) {
    const pp = readPathInternal(proc);
    if (!pp.present || pp.value !== canonical) {
      return { ok: false, error: 'ENGINE_CANONICAL_PATH_UNRESOLVED' };
    }
  }

  return {
    ok: true,
    /** @private internal only — never log */
    _canonicalPath: canonical,
    reference: 'BACKEND_PROCESSOR_CONSENSUS',
  };
}

/**
 * Engine-pair selection:
 * - UNIQUE_CANONICAL_PATH when PATH differs and exactly one matches backend/processor consensus
 * - SYMMETRIC_RUNTIME_EQUIVALENT when both PATH-equal to consensus + full semantic equality
 *   (pm_id tie-break is LIVE runtime targeting only — never persisted identity)
 * PRE→POST / rollback / non-engine env gates remain full-strict via diffProcessEnv.
 */
export function selectEngineRetainExtra(fp) {
  const online = (fp.engines || []).filter((e) => e.status === 'online');
  if (online.length !== 2) {
    return {
      ok: false,
      error: `ENGINE_ONLINE_COUNT_EXPECTED_2_GOT_${online.length}`,
    };
  }

  const pmIds = online.map((e) => e.pm_id);
  if (pmIds.some((id) => id == null || id === '')) {
    return { ok: false, error: 'ENGINE_PM_ID_INVALID' };
  }
  const numericIds = pmIds.map((id) =>
    typeof id === 'number' ? id : Number(id),
  );
  if (numericIds.some((id) => !Number.isFinite(id))) {
    return { ok: false, error: 'ENGINE_PM_ID_INVALID' };
  }
  if (new Set(numericIds).size !== 2) {
    return { ok: false, error: 'ENGINE_PM_ID_DUPLICATE' };
  }

  const [a, b] = [...online].sort((x, y) => Number(x.pm_id) - Number(y.pm_id));

  const pathA = readPathInternal(a);
  const pathB = readPathInternal(b);
  const pathEqual = pathA.present && pathB.present && pathA.value === pathB.value;

  /** @type {Record<string, string|boolean>} */
  const evidence = {
    ENGINE_PATH_EQUAL: pathEqual ? 'YES' : 'NO',
    ENGINE_PATH_EXCEPTION_USED: 'NO',
    PM_ID_USED_FOR_RUNTIME_STOP_TARGET_ONLY: 'NO',
    PM_ID_USED_AS_PERSISTED_IDENTITY: 'NO',
  };

  const envDiffs = diffProcessEnv(a, b, { scope: 'engine-pair' });
  const pathOnlyValueDiff =
    envDiffs.length > 0 &&
    envDiffs.every(
      (d) =>
        d.kind === 'ENV_VALUE_CHANGED' &&
        d.detail?.key === 'PATH' &&
        d.detail?.category === 'value-changed',
    );

  const rawA = resolveRawPm2Entry(a);
  const rawB = resolveRawPm2Entry(b);

  /** Full PM2 semantic compare; optionally neutralize PATH for unique-PATH exception. */
  const fullCompare = (ignorePath) => {
    if (!ignorePath) {
      return compareEnginePm2Semantics(rawA, rawB, { requireClassified: true });
    }
    const a2 = JSON.parse(JSON.stringify(rawA));
    const b2 = JSON.parse(JSON.stringify(rawB));
    const neutralize = (entry) => {
      if (entry && entry.env && typeof entry.env === 'object') {
        entry.env.PATH = '__PATH_NEUTRAL__';
      } else if (entry) {
        entry.PATH = '__PATH_NEUTRAL__';
      }
    };
    neutralize(a2);
    neutralize(b2);
    return compareEnginePm2Semantics(a2, b2, { requireClassified: true });
  };

  // Equal PATH path — require complete PM2 semantic signature equality.
  if (!pathOnlyValueDiff) {
    if (!pathEqual) {
      // Non-PATH inequality without path-only classification
      const full = fullCompare(false);
      return {
        ok: false,
        error: 'ENGINE_RUNTIME_IDENTITY_MISMATCH',
        detailKinds: full.mismatchCategories || envDiffs.map((d) => d.kind),
        evidence,
      };
    }

    const full = fullCompare(false);
    if (!full.ok) {
      return {
        ok: false,
        error: 'ENGINE_EQUAL_PATH_SEMANTIC_EQUIVALENCE_FAIL',
        detailKinds: full.mismatchCategories || [full.error],
        evidence,
      };
    }

    const consensus = resolveCanonicalPathConsensus(fp);
    if (!consensus.ok) {
      return {
        ok: false,
        error: consensus.error || 'ENGINE_CANONICAL_PATH_UNRESOLVED',
        evidence,
      };
    }
    const aMatches = pathA.value === consensus._canonicalPath;
    const bMatches = pathB.value === consensus._canonicalPath;
    if (!aMatches || !bMatches) {
      return {
        ok: false,
        error: 'ENGINE_CANONICAL_PATH_UNRESOLVED',
        evidence: {
          ...evidence,
          ENGINE_PATH_EQUAL: 'YES',
          CANONICAL_PATH_REFERENCE: consensus.reference,
        },
      };
    }

    return {
      ok: true,
      retained: a,
      extra: b,
      liveEnginePairMode: 'SYMMETRIC_RUNTIME_EQUIVALENT',
      selection_rule: 'symmetric_runtime_equivalent_lower_pm_id_retain',
      unique_responsibility_proven: false,
      evidence: {
        ...evidence,
        ENGINE_PATH_EQUAL: 'YES',
        ENGINE_PATH_EXCEPTION_USED: 'NO',
        LIVE_ENGINE_PAIR_MODE: 'SYMMETRIC_RUNTIME_EQUIVALENT',
        LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
        PM_ID_USED_FOR_RUNTIME_STOP_TARGET_ONLY: 'YES',
        PM_ID_USED_AS_PERSISTED_IDENTITY: 'NO',
        CANONICAL_PATH_REFERENCE: consensus.reference,
        RETAINED_PATH_MATCH_CANONICAL: 'YES',
        EXTRA_PATH_MATCH_CANONICAL: 'YES',
      },
    };
  }

  // PATH is the only permitted engine-to-engine inequality — full semantics otherwise equal.
  const fullSansPath = fullCompare(true);
  if (!fullSansPath.ok) {
    return {
      ok: false,
      error: 'ENGINE_RUNTIME_IDENTITY_MISMATCH',
      detailKinds: fullSansPath.mismatchCategories || [fullSansPath.error],
      evidence: {
        ...evidence,
        ENGINE_PATH_EXCEPTION_USED: 'YES',
      },
    };
  }

  const consensus = resolveCanonicalPathConsensus(fp);
  if (!consensus.ok) {
    return {
      ok: false,
      error: consensus.error || 'ENGINE_CANONICAL_PATH_UNRESOLVED',
      evidence: {
        ...evidence,
        ENGINE_PATH_EXCEPTION_USED: 'YES',
      },
    };
  }

  const aMatches = pathA.present && pathA.value === consensus._canonicalPath;
  const bMatches = pathB.present && pathB.value === consensus._canonicalPath;
  const matchCount = (aMatches ? 1 : 0) + (bMatches ? 1 : 0);
  if (matchCount !== 1) {
    return {
      ok: false,
      error: 'ENGINE_CANONICAL_PATH_UNRESOLVED',
      evidence: {
        ENGINE_PATH_EQUAL: 'NO',
        ENGINE_PATH_EXCEPTION_USED: 'YES',
        CANONICAL_PATH_REFERENCE: consensus.reference,
        PM_ID_USED_FOR_RUNTIME_STOP_TARGET_ONLY: 'NO',
        PM_ID_USED_AS_PERSISTED_IDENTITY: 'NO',
      },
    };
  }

  const retained = aMatches ? a : b;
  const extra = aMatches ? b : a;

  return {
    ok: true,
    retained,
    extra,
    liveEnginePairMode: 'UNIQUE_CANONICAL_PATH',
    selection_rule: 'canonical_path_match_among_path_exception_equivalent_workers',
    unique_responsibility_proven: false,
    evidence: {
      ENGINE_PATH_EQUAL: 'NO',
      ENGINE_PATH_EXCEPTION_USED: 'YES',
      LIVE_ENGINE_PAIR_MODE: 'UNIQUE_CANONICAL_PATH',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
      CANONICAL_PATH_REFERENCE: consensus.reference,
      RETAINED_PATH_MATCH_CANONICAL: 'YES',
      EXTRA_PATH_MATCH_CANONICAL: 'NO',
      PM_ID_USED_FOR_RUNTIME_STOP_TARGET_ONLY: 'NO',
      PM_ID_USED_AS_PERSISTED_IDENTITY: 'NO',
    },
  };
}

function diffProcessPair(pre, post, { scope, allowCollectorDbAppear = false, skipStatus = false }) {
  const diffs = [];
  if (!pre || !post) {
    diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { scope } });
    return diffs;
  }
  if (!skipStatus && pre.status !== post.status) {
    diffs.push({ kind: 'STATUS_CHANGE', detail: { scope, pre: pre.status, post: post.status } });
  }

  const rawPre = resolveRawPm2Entry(pre);
  const rawPost = resolveRawPm2Entry(post);
  if (rawPre && rawPost && (pre.name === ENGINE_NAME || scope?.includes('engine'))) {
    // Status-only drift is already recorded; compare full PM2 semantics with status neutralized.
    const a = JSON.parse(JSON.stringify(rawPre));
    const b = JSON.parse(JSON.stringify(rawPost));
    a.status = 'online';
    b.status = 'online';
    const full = compareEnginePm2Semantics(a, b, { requireClassified: true });
    if (!full.ok) {
      for (const cat of full.mismatchCategories || [full.error || 'FULL_PM2_SEMANTIC_DRIFT']) {
        diffs.push({
          kind: 'PROCESS_CONFIG_CHANGED',
          detail: { scope, category: cat },
        });
      }
      return diffs;
    }
    return diffs;
  }

  diffs.push(...diffStableConfig(pre, post, { scope }));
  diffs.push(...diffProcessEnv(pre, post, { scope, allowCollectorDbAppear }));
  return diffs;
}

/**
 * Diff pre-dump fingerprint vs post-dump fingerprint (secret-safe).
 */
export function diffFingerprints(pre, post, { extraPmId }) {
  const diffs = [];

  const preEng = new Map((pre.engines || []).map((e) => [e.pm_id, e]));
  const postEng = new Map((post.engines || []).map((e) => [e.pm_id, e]));
  for (const pmId of new Set([...preEng.keys(), ...postEng.keys()])) {
    const a = preEng.get(pmId);
    const b = postEng.get(pmId);
    if (!a || !b) {
      diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { engine_pm_id: pmId } });
      continue;
    }
    if (a.status !== b.status) {
      diffs.push({
        kind: 'ENGINE_STATUS',
        detail: { pm_id: pmId, pre: a.status, post: b.status },
      });
    }
    diffs.push(...diffStableConfig(a, b, { scope: `engine:${pmId}` }));
    diffs.push(...diffProcessEnv(a, b, { scope: `engine:${pmId}` }));
  }

  if (pre.backend_count !== post.backend_count) {
    diffs.push({ kind: 'BACKEND_TOPOLOGY_CHANGE' });
  } else {
    const preB = new Map((pre.backends || []).map((e) => [e.pm_id, e]));
    const postB = new Map((post.backends || []).map((e) => [e.pm_id, e]));
    for (const pmId of new Set([...preB.keys(), ...postB.keys()])) {
      const a = preB.get(pmId);
      const b = postB.get(pmId);
      if (!a || !b) {
        diffs.push({ kind: 'BACKEND_TOPOLOGY_CHANGE', detail: { pm_id: pmId } });
        continue;
      }
      if (a.status !== b.status) {
        diffs.push({ kind: 'BACKEND_TOPOLOGY_CHANGE', detail: { pm_id: pmId } });
      }
      diffs.push(...diffProcessPair(a, b, { scope: `backend:${pmId}`, skipStatus: true }));
    }
  }

  if (pre.processor_count !== post.processor_count) {
    diffs.push({ kind: 'PROCESSOR_TOPOLOGY_CHANGE' });
  } else {
    const preP = new Map((pre.processors || []).map((e) => [e.pm_id, e]));
    const postP = new Map((post.processors || []).map((e) => [e.pm_id, e]));
    for (const pmId of new Set([...preP.keys(), ...postP.keys()])) {
      const a = preP.get(pmId);
      const b = postP.get(pmId);
      if (!a || !b || a.status !== b.status) {
        diffs.push({ kind: 'PROCESSOR_TOPOLOGY_CHANGE', detail: { pm_id: pmId } });
        continue;
      }
      diffs.push(...diffProcessPair(a, b, { scope: `processor:${pmId}`, skipStatus: true }));
    }
  }

  if (pre.monitor_count !== post.monitor_count) {
    diffs.push({ kind: 'MONITOR_TOPOLOGY_CHANGE' });
  } else {
    const preM = new Map((pre.monitors || []).map((e) => [e.pm_id, e]));
    const postM = new Map((post.monitors || []).map((e) => [e.pm_id, e]));
    for (const pmId of new Set([...preM.keys(), ...postM.keys()])) {
      const a = preM.get(pmId);
      const b = postM.get(pmId);
      if (!a || !b || a.status !== b.status) {
        diffs.push({ kind: 'MONITOR_TOPOLOGY_CHANGE', detail: { pm_id: pmId } });
        continue;
      }
      diffs.push(...diffProcessPair(a, b, { scope: `monitor:${pmId}`, skipStatus: true }));
    }
  }

  const preCol = (pre.collectors || [])[0] || null;
  const postCol = (post.collectors || [])[0] || null;
  if (!preCol || !postCol || preCol.pm_id !== postCol.pm_id || preCol.status !== postCol.status) {
    diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { collector: true } });
  } else {
    const envDiffs = diffProcessEnv(preCol, postCol, {
      scope: `collector:${preCol.pm_id}`,
      allowCollectorDbAppear: true,
    });
    diffs.push(...diffStableConfig(preCol, postCol, { scope: `collector:${preCol.pm_id}` }));

    const preKeys = preCol.db_keys_present || {};
    const postKeys = postCol.db_keys_present || {};
    const preHadAny = COLLECTOR_DB_KEYS.some((k) => preKeys[k]);
    const postHasAll = COLLECTOR_DB_KEYS.every((k) => postKeys[k]);
    const dbAppear =
      !preHadAny &&
      postHasAll &&
      postCol.db_user_matches_expected === true &&
      preCol.NODE_ENV === postCol.NODE_ENV;

    if (dbAppear) {
      diffs.push({ kind: 'COLLECTOR_DB_KEYS_APPEAR' });
    } else if (JSON.stringify(preKeys) !== JSON.stringify(postKeys) || preCol.NODE_ENV !== postCol.NODE_ENV) {
      diffs.push({ kind: 'UNRELATED_ENV_CHANGE', detail: 'COLLECTOR_DB_UNEXPECTED' });
    }

    for (const d of envDiffs) {
      diffs.push(d);
    }
  }

  const preO = new Map((pre.others || []).map((e) => [`${e.name}:${e.pm_id}`, e]));
  const postO = new Map((post.others || []).map((e) => [`${e.name}:${e.pm_id}`, e]));
  for (const key of new Set([...preO.keys(), ...postO.keys()])) {
    const a = preO.get(key);
    const b = postO.get(key);
    if (!a || !b || a.status !== b.status) {
      diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { other: key } });
      continue;
    }
    diffs.push(...diffProcessPair(a, b, { scope: `other:${key}`, skipStatus: true }));
  }

  if (JSON.stringify(pre.other_names || []) !== JSON.stringify(post.other_names || [])) {
    diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { other_names: true } });
  }

  const classified = classifyDiffs(diffs, { extraPmId });
  return { diffs, classified };
}

/**
 * Prove POST live state matches PRE live state exactly, except the selected EXTRA
 * engine may transition online -> stopped. No other stable-config or env drift.
 * Collector live DB_* must still match the PRE-captured live snapshot exactly.
 *
 * @param {ReturnType<typeof semanticFingerprint>} preLiveFp
 * @param {ReturnType<typeof semanticFingerprint>} postLiveFp
 * @param {{ retained?: { pm_id?: number }, extra?: { pm_id?: number } }} selection
 * @param {Record<string,string>} collectorDbSnapshot
 * @returns {{ ok: boolean, error?: string, details?: Record<string,string> }}
 */
export function assertExpectedLivePostState(
  preLiveFp,
  postLiveFp,
  selection,
  collectorDbSnapshot,
) {
  const extraPmId = selection?.extra?.pm_id;
  const retainedPmId = selection?.retained?.pm_id;
  if (extraPmId == null || retainedPmId == null) {
    return { ok: false, error: 'LIVE_POST_STATE_SELECTION_MISSING' };
  }

  const diff = diffFingerprints(preLiveFp, postLiveFp, { extraPmId });
  const allowedKinds = diff.classified.filter(
    (d) => d.kind === 'ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED',
  );
  const unexpected = diff.classified.filter((d) => d.kind !== 'ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED');
  if (allowedKinds.length !== 1 || unexpected.length > 0) {
    return {
      ok: false,
      error: 'LIVE_POST_STATE_UNEXPECTED_DRIFT',
      details: {
        ALLOWED_EXTRA_STOP_ONLY: allowedKinds.length === 1 ? 'YES' : 'NO',
        UNEXPECTED_DRIFT_PRESENT: unexpected.length > 0 ? 'YES' : 'NO',
      },
    };
  }

  const retainedPre = (preLiveFp.engines || []).find((e) => e.pm_id === retainedPmId);
  const retainedPost = (postLiveFp.engines || []).find((e) => e.pm_id === retainedPmId);
  const extraPost = (postLiveFp.engines || []).find((e) => e.pm_id === extraPmId);
  const extraPre = (preLiveFp.engines || []).find((e) => e.pm_id === extraPmId);
  if (!retainedPre || !retainedPost || !extraPost || !extraPre) {
    return { ok: false, error: 'LIVE_POST_STATE_ENGINE_IDENTITY_MISSING' };
  }
  if (retainedPost.status !== 'online') {
    return { ok: false, error: 'RETAINED_NOT_ONLINE_POSTWRITE' };
  }
  if (extraPost.status !== 'stopped') {
    return { ok: false, error: 'EXTRA_NOT_STOPPED_POSTWRITE' };
  }

  // Full PM2 semantic PRE→POST for retained (no change) and extra (status-only).
  const retainedFull = compareEnginePm2Semantics(
    resolveRawPm2Entry(retainedPre),
    resolveRawPm2Entry(retainedPost),
    { requireClassified: true },
  );
  if (!retainedFull.ok) {
    return {
      ok: false,
      error: 'LIVE_POST_STATE_UNEXPECTED_DRIFT',
      details: {
        RETAINED_ENGINE_FULL_EQUIVALENCE: 'FAIL',
        mismatchCategories: retainedFull.mismatchCategories,
      },
    };
  }
  const extraA = JSON.parse(JSON.stringify(resolveRawPm2Entry(extraPre)));
  const extraB = JSON.parse(JSON.stringify(resolveRawPm2Entry(extraPost)));
  extraA.status = 'online';
  extraB.status = 'online';
  const extraFull = compareEnginePm2Semantics(extraA, extraB, { requireClassified: true });
  if (!extraFull.ok) {
    return {
      ok: false,
      error: 'LIVE_POST_STATE_UNEXPECTED_DRIFT',
      details: {
        EXTRA_ENGINE_STOP_ONLY: 'FAIL',
        mismatchCategories: extraFull.mismatchCategories,
      },
    };
  }

  const liveCollector = (postLiveFp.collectors || [])[0];
  if (!liveCollector) {
    return { ok: false, error: 'LIVE_COLLECTOR_MISSING_POSTWRITE' };
  }

  const expectedCollector = { env_keys: [...COLLECTOR_DB_KEYS] };
  Object.defineProperty(expectedCollector, '_envValues', {
    value: collectorDbSnapshot || {},
    enumerable: false,
    writable: false,
    configurable: false,
  });
  const dbMatch = compareCollectorDbLiveToPersist(expectedCollector, liveCollector);
  if (!dbMatch.ok) {
    return { ok: false, error: dbMatch.error || 'COLLECTOR_DB_LIVE_DRIFT', details: dbMatch.matches };
  }

  return {
    ok: true,
    details: {
      RETAINED_ENGINE_FULL_EQUIVALENCE: 'PASS',
      EXTRA_ENGINE_STOP_ONLY: 'PASS',
      LIVE_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
      BACKEND_FULL_EQUIVALENCE: 'PASS',
      PROCESSOR_FULL_EQUIVALENCE: 'PASS',
      COLLECTOR_FULL_EQUIVALENCE: 'PASS',
      MONITOR_FULL_EQUIVALENCE: 'PASS',
      OTHER_PROCESS_FULL_EQUIVALENCE: 'PASS',
      NODE_ENV_FULL_EQUIVALENCE: 'PASS',
      PATH_MUTATION: '0',
      ...dbMatch.matches,
    },
  };
}

function classifyDiffs(diffs, { extraPmId }) {
  const out = [];
  for (const d of diffs) {
    if (
      d.kind === 'ENGINE_STATUS' &&
      d.detail?.pre === 'online' &&
      d.detail?.post === 'stopped' &&
      d.detail?.pm_id === extraPmId
    ) {
      out.push({ kind: 'ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED' });
      continue;
    }
    if (d.kind === 'COLLECTOR_DB_KEYS_APPEAR') {
      out.push({ kind: 'COLLECTOR_DB_KEYS_APPEAR' });
      continue;
    }
    if (
      [
        'NODE_ENV_CHANGE',
        'BACKEND_TOPOLOGY_CHANGE',
        'PROCESSOR_TOPOLOGY_CHANGE',
        'MONITOR_TOPOLOGY_CHANGE',
        'ENV_KEY_ADDED',
        'ENV_KEY_REMOVED',
        'ENV_VALUE_CHANGED',
        'UNRELATED_PROCESS_CHANGE',
        'TELEGRAM_TOKEN_ENV_RESTORED',
        'PROVIDER_ENV_CHANGE',
        'UNRELATED_ENV_CHANGE',
        'SCRIPT_CHANGED',
        'CWD_CHANGED',
        'ARGS_CHANGED',
        'EXEC_MODE_CHANGED',
        'PROCESS_CONFIG_CHANGED',
        'COLLECTOR_DB_LIVE_PERSIST_MISMATCH',
        'STATUS_CHANGE',
      ].includes(d.kind)
    ) {
      out.push({ kind: d.kind, detail: d.detail });
      continue;
    }
    if (d.kind === 'ENGINE_STATUS') {
      out.push({ kind: 'UNEXPECTED', detail: d });
      continue;
    }
    out.push({ kind: 'UNEXPECTED', detail: d });
  }
  return out;
}

/**
 * Prove live+persisted state is PRE-equivalent after rollback.
 * @returns {{ ok: boolean, error?: string, details?: object }}
 */
export function assertPreEquivalent(preDumpFp, preLiveFp, postDumpFp, postLiveFp, {
  retainedPmId,
  extraPmId,
  expectedDumpSha,
  actualDumpSha,
  expectedDumpMode,
  actualDumpMode,
  expectedDumpUid,
  actualDumpUid,
  expectedDumpGid,
  actualDumpGid,
}) {
  if (expectedDumpSha !== actualDumpSha) {
    return { ok: false, error: 'ROLLBACK_DUMP_SHA_MISMATCH' };
  }

  if (
    expectedDumpMode != null &&
    actualDumpMode != null &&
    (expectedDumpMode & 0o777) !== (actualDumpMode & 0o777)
  ) {
    return {
      ok: false,
      error: 'ROLLBACK_DUMP_MODE_MISMATCH',
      details: {
        expected_mode: expectedDumpMode & 0o777,
        actual_mode: actualDumpMode & 0o777,
      },
    };
  }
  if (expectedDumpUid != null && actualDumpUid != null && expectedDumpUid !== actualDumpUid) {
    return { ok: false, error: 'ROLLBACK_DUMP_UID_MISMATCH' };
  }
  if (expectedDumpGid != null && actualDumpGid != null && expectedDumpGid !== actualDumpGid) {
    return { ok: false, error: 'ROLLBACK_DUMP_GID_MISMATCH' };
  }

  if ((postLiveFp.engine_online_count || 0) !== 2) {
    return { ok: false, error: 'ROLLBACK_ENGINE_COUNT_NOT_RESTORED' };
  }

  const preRetained = (preLiveFp.engines || []).find((e) => e.pm_id === retainedPmId);
  const preExtra = (preLiveFp.engines || []).find((e) => e.pm_id === extraPmId);
  const postRetained = (postLiveFp.engines || []).find((e) => e.pm_id === retainedPmId);
  const postExtra = (postLiveFp.engines || []).find((e) => e.pm_id === extraPmId);

  if (!preRetained || !preExtra || !postRetained || !postExtra) {
    return { ok: false, error: 'ROLLBACK_ENGINE_IDENTITY_MISSING' };
  }
  if (postRetained.status !== 'online' || postExtra.status !== 'online') {
    return { ok: false, error: 'ROLLBACK_ENGINE_NOT_BOTH_ONLINE' };
  }

  // Full engine config+env equivalence vs PRE (volatile pm_id/pid/timestamps already excluded).
  for (const [preE, postE, label] of [
    [preRetained, postRetained, 'retained'],
    [preExtra, postExtra, 'extra'],
  ]) {
    const full = compareEnginePm2Semantics(resolveRawPm2Entry(preE), resolveRawPm2Entry(postE), {
      requireClassified: true,
    });
    if (!full.ok) {
      return {
        ok: false,
        error: 'ROLLBACK_ENGINE_CONFIG_DRIFT',
        details: { kinds: full.mismatchCategories || [full.error], label },
      };
    }
  }

  // Persisted dump must match PRE dump semantics exactly (no forward allowlist diffs).
  const dumpDiff = diffFingerprints(preDumpFp, postDumpFp, { extraPmId });
  if (dumpDiff.classified.length > 0) {
    return {
      ok: false,
      error: 'ROLLBACK_DUMP_SEMANTIC_DRIFT',
      details: { kinds: dumpDiff.classified.map((c) => c.kind) },
    };
  }

  // CURRENT LIVE must be semantically PRE-equivalent for ALL process groups.
  const liveDiff = diffFingerprints(preLiveFp, postLiveFp, { extraPmId });
  if (liveDiff.classified.length > 0) {
    return {
      ok: false,
      error: 'ROLLBACK_LIVE_SEMANTIC_DRIFT',
      details: { kinds: liveDiff.classified.map((c) => c.kind) },
    };
  }

  const postColLive = (postLiveFp.collectors || [])[0];
  const preColLive = (preLiveFp.collectors || [])[0];
  if (!postColLive || !preColLive) {
    return { ok: false, error: 'ROLLBACK_COLLECTOR_MISSING' };
  }
  const liveDb = compareCollectorDbLiveToPersist(preColLive, postColLive);
  if (!liveDb.ok) {
    return { ok: false, error: 'ROLLBACK_COLLECTOR_LIVE_DB_B_LOST' };
  }

  const postColDump = (postDumpFp.collectors || [])[0];
  const preColDump = (preDumpFp.collectors || [])[0];
  if (!postColDump || !preColDump) {
    return { ok: false, error: 'ROLLBACK_COLLECTOR_DUMP_MISSING' };
  }
  // v1.6: PRE dump already has DB_*; rollback must preserve exact dump DB_* vs PRE dump.
  const dumpDb = compareCollectorDbLiveToPersist(preColDump, postColDump);
  if (!dumpDb.ok) {
    return { ok: false, error: 'ROLLBACK_COLLECTOR_DB_NOT_PRESERVED', details: dumpDb.matches };
  }

  if (
    postDumpFp.backend_count !== preDumpFp.backend_count ||
    postDumpFp.processor_count !== preDumpFp.processor_count ||
    postDumpFp.monitor_count !== preDumpFp.monitor_count
  ) {
    return { ok: false, error: 'ROLLBACK_UNRELATED_TOPOLOGY_DRIFT' };
  }

  return {
    ok: true,
    details: {
      PRE_EQUIVALENT: 'YES',
      dump_mode: expectedDumpMode != null ? expectedDumpMode & 0o777 : null,
    },
  };
}

/**
 * Classify collector DB_* relationship between PRE dump and PRE live.
 * Never returns values.
 */
export function classifyCollectorDbPrestate(liveFp, dumpFp) {
  const live = (liveFp.collectors || [])[0];
  const dump = (dumpFp.collectors || [])[0];
  if (!live || !dump) {
    return {
      state: 'UNSUPPORTED',
      ok: false,
      error: !live ? 'LIVE_COLLECTOR_MISSING' : 'DUMP_COLLECTOR_MISSING',
      matches: {},
    };
  }
  const liveKeys = live.db_keys_present || {};
  const dumpKeys = dump.db_keys_present || {};
  const livePresentCount = COLLECTOR_DB_KEYS.filter((k) => liveKeys[k]).length;
  const dumpPresentCount = COLLECTOR_DB_KEYS.filter((k) => dumpKeys[k]).length;

  if (livePresentCount < COLLECTOR_DB_KEYS.length) {
    return {
      state: 'UNSUPPORTED',
      ok: false,
      error: 'LIVE_COLLECTOR_DB_B_INCOMPLETE',
      matches: {},
    };
  }
  if (live.db_user_matches_expected !== true) {
    return {
      state: 'UNSUPPORTED',
      ok: false,
      error: 'LIVE_COLLECTOR_DB_USER_UNEXPECTED',
      matches: {},
    };
  }

  if (dumpPresentCount === 0) {
    return { state: 'ABSENT', ok: false, error: 'COLLECTOR_DB_PRESTATE_ABSENT', matches: {} };
  }
  if (dumpPresentCount < COLLECTOR_DB_KEYS.length) {
    return { state: 'PARTIAL', ok: false, error: 'COLLECTOR_DB_PRESTATE_PARTIAL', matches: {} };
  }

  const match = compareCollectorDbLiveToPersist(live, dump);
  /** @type {Record<string, 'YES'|'NO'>} */
  const evidence = {};
  for (const key of COLLECTOR_DB_KEYS) {
    evidence[`${key}_PRE_MATCH`] = match.matches[`${key}_MATCH`] || 'NO';
  }
  if (!match.ok) {
    return {
      state: 'PRESENT_MISMATCHED',
      ok: false,
      error: match.error || 'COLLECTOR_DB_PRESTATE_MISMATCHED',
      matches: evidence,
    };
  }
  return {
    state: 'ALREADY_PRESENT_EXACT',
    ok: true,
    matches: evidence,
  };
}

/**
 * v1.6 production T2 accepts ONLY ALREADY_PRESENT_EXACT.
 */
export function assertCollectorPersistencePreconditions(liveFp, dumpFp) {
  const classified = classifyCollectorDbPrestate(liveFp, dumpFp);
  if (!classified.ok || classified.state !== 'ALREADY_PRESENT_EXACT') {
    return {
      ok: false,
      error: classified.error || 'COLLECTOR_DB_PRESTATE_NOT_ALREADY_PRESENT_EXACT',
      state: classified.state,
      matches: classified.matches,
    };
  }
  return {
    ok: true,
    state: classified.state,
    matches: classified.matches,
  };
}
