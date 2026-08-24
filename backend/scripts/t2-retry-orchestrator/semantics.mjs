/**
 * Secret-safe PM2 semantic model for T2 retry.
 * Compares env key sets and value equality internally without logging values/hashes.
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
} from './constants.mjs';

const META = new Set(PM2_METADATA_KEYS);

/**
 * Extract the real application env container from a PM2 dump/jlist entry.
 * Does NOT flatten pm2_env metadata into env.
 * @param {Record<string, unknown>} entry
 * @returns {Record<string, string>}
 */
export function extractProcessEnv(entry = {}) {
  let raw = null;
  if (entry.pm2_env && typeof entry.pm2_env === 'object' && entry.pm2_env.env && typeof entry.pm2_env.env === 'object') {
    raw = entry.pm2_env.env;
  } else if (entry.env && typeof entry.env === 'object' && !Array.isArray(entry.env)) {
    raw = entry.env;
  } else {
    raw = {};
  }

  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (META.has(k)) continue;
    if (v == null) continue;
    // skip nested objects
    if (typeof v === 'object') continue;
    out[k] = String(v);
  }
  return out;
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

/**
 * Normalize one process. Env values kept only on `_envValues` (non-enumerable) for internal diffs.
 * @param {Record<string, unknown>} entry
 */
export function normalizeProcess(entry = {}) {
  const envMap = extractProcessEnv(entry);
  const pmId = entry.pm_id ?? entry.pmId;
  const cwd =
    entry.pm_cwd ||
    entry.pm2_env?.pm_cwd ||
    entry.cwd ||
    null;
  const script =
    entry.pm_exec_path ||
    entry.pm2_env?.pm_exec_path ||
    entry.script ||
    entry.pm2_env?.script ||
    null;
  const execMode = entry.exec_mode || entry.pm2_env?.exec_mode || null;
  const nodeEnv = envMap.NODE_ENV != null ? String(envMap.NODE_ENV) : null;
  const createdAt = entry.pm2_env?.created_at ?? entry.created_at ?? null;
  const restartTime = entry.pm2_env?.restart_time ?? entry.restart_time ?? null;

  const envKeys = Object.keys(envMap).sort();
  const collectorDb = {};
  for (const key of COLLECTOR_DB_KEYS) {
    collectorDb[key] = { present: hasNonEmpty(envMap, key) };
  }

  const proc = {
    name: entry.name || null,
    pm_id: typeof pmId === 'number' ? pmId : pmId != null ? Number(pmId) : null,
    status: String(statusOf(entry)),
    cwd: cwd != null ? String(cwd) : null,
    script: script != null ? String(script) : null,
    exec_mode: execMode != null ? String(execMode) : null,
    NODE_ENV: nodeEnv,
    created_at: createdAt,
    restart_time: restartTime,
    pid: typeof entry.pid === 'number' ? entry.pid : null,
    env_keys: envKeys,
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

  return proc;
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

  const mapEngine = (p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
    cwd: p.cwd,
    script: p.script,
    exec_mode: p.exec_mode,
    created_at: p.created_at,
    restart_time: p.restart_time,
    env_keys: p.env_keys,
    _envValues: p._envValues,
    has_telegram_bot_token: p.has_telegram_bot_token,
    has_provider_env: p.has_provider_env,
  });

  const mapSimple = (p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
    env_keys: p.env_keys,
    _envValues: p._envValues,
    has_telegram_bot_token: p.has_telegram_bot_token,
    has_provider_env: p.has_provider_env,
  });

  const engines = byName(ENGINE_NAME).map(mapEngine);
  const backends = byName(BACKEND_NAME).map(mapSimple);
  const processors = byName(PROCESSOR_NAME).map(mapSimple);
  const monitors = byName(MONITOR_NAME).map(mapSimple);
  const collectors = byName(COLLECTOR_NAME).map((p) => ({
    ...mapSimple(p),
    db_keys_present: Object.fromEntries(
      COLLECTOR_DB_KEYS.map((k) => [k, p.collector_db[k].present]),
    ),
    db_user_matches_expected: p.collector_db_user_matches_expected,
  }));

  const known = new Set([ENGINE_NAME, BACKEND_NAME, PROCESSOR_NAME, COLLECTOR_NAME, MONITOR_NAME]);
  const others = normalized
    .filter((p) => p.name && !known.has(p.name))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)) || (a.pm_id ?? 0) - (b.pm_id ?? 0))
    .map((p) => ({
      name: p.name,
      ...mapSimple(p),
    }));

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
      continue; // handled as collector DB appear bundle
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
    } else if (allowCollectorDbAppear && COLLECTOR_DB_KEYS.includes(k)) {
      // DB_* value change after appear is unexpected (should be identical to live persist)
      diffs.push({ kind: 'ENV_VALUE_CHANGED', detail: { scope, key: k, category: 'value-changed', equality: 'CHANGED' } });
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
 * Build secret-safe evidence summary for env equality without values.
 */
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

export function selectEngineRetainExtra(fp) {
  const online = (fp.engines || []).filter((e) => e.status === 'online');
  if (online.length !== 2) {
    return {
      ok: false,
      error: `ENGINE_ONLINE_COUNT_EXPECTED_2_GOT_${online.length}`,
    };
  }
  const [a, b] = [...online].sort((x, y) => x.pm_id - y.pm_id);
  const sameIdentity =
    a.script === b.script &&
    a.cwd === b.cwd &&
    a.exec_mode === b.exec_mode &&
    a.NODE_ENV === b.NODE_ENV;
  if (!sameIdentity) {
    return { ok: false, error: 'ENGINE_RUNTIME_IDENTITY_MISMATCH' };
  }
  return {
    ok: true,
    retained: a,
    extra: b,
    selection_rule: 'lowest_pm_id_among_identical_online_workers',
    unique_responsibility_proven: false,
  };
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
    // For stopped extra, env may remain — still compare env (should be unchanged)
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
      if (!a || !b || a.status !== b.status) {
        diffs.push({ kind: 'BACKEND_TOPOLOGY_CHANGE', detail: { pm_id: pmId } });
        continue;
      }
      diffs.push(...diffProcessEnv(a, b, { scope: `backend:${pmId}` }));
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
      diffs.push(...diffProcessEnv(a, b, { scope: `processor:${pmId}` }));
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
      diffs.push(...diffProcessEnv(a, b, { scope: `monitor:${pmId}` }));
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

    // Non-DB env diffs remain
    for (const d of envDiffs) {
      diffs.push(d);
    }
  }

  // other processes
  const preO = new Map((pre.others || []).map((e) => [`${e.name}:${e.pm_id}`, e]));
  const postO = new Map((post.others || []).map((e) => [`${e.name}:${e.pm_id}`, e]));
  for (const key of new Set([...preO.keys(), ...postO.keys()])) {
    const a = preO.get(key);
    const b = postO.get(key);
    if (!a || !b || a.status !== b.status) {
      diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { other: key } });
      continue;
    }
    diffs.push(...diffProcessEnv(a, b, { scope: `other:${key}` }));
  }

  if (JSON.stringify(pre.other_names || []) !== JSON.stringify(post.other_names || [])) {
    diffs.push({ kind: 'UNRELATED_PROCESS_CHANGE', detail: { other_names: true } });
  }

  const classified = classifyDiffs(diffs, { extraPmId });
  return { diffs, classified };
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

export function assertCollectorPersistencePreconditions(liveFp, dumpFp) {
  const live = (liveFp.collectors || [])[0];
  const dump = (dumpFp.collectors || [])[0];
  if (!live) return { ok: false, error: 'LIVE_COLLECTOR_MISSING' };
  if (!dump) return { ok: false, error: 'DUMP_COLLECTOR_MISSING' };
  const liveKeys = live.db_keys_present || {};
  const dumpKeys = dump.db_keys_present || {};
  if (!COLLECTOR_DB_KEYS.every((k) => liveKeys[k])) {
    return { ok: false, error: 'LIVE_COLLECTOR_DB_B_INCOMPLETE' };
  }
  if (live.db_user_matches_expected !== true) {
    return { ok: false, error: 'LIVE_COLLECTOR_DB_USER_UNEXPECTED' };
  }
  if (COLLECTOR_DB_KEYS.some((k) => dumpKeys[k])) {
    return { ok: false, error: 'DUMP_ALREADY_HAS_COLLECTOR_DB' };
  }
  return { ok: true };
}
