/**
 * Secret-safe PM2 semantic model for T2 retry.
 * Never returns secret values — only presence/absence and non-secret metadata.
 */

import {
  BACKEND_NAME,
  COLLECTOR_DB_KEYS,
  COLLECTOR_NAME,
  ENGINE_NAME,
  EXPECTED_COLLECTOR_DB_USER,
  MONITOR_NAME,
  PROCESSOR_NAME,
} from './constants.mjs';

/**
 * @param {Record<string, unknown>} entry dump or jlist-like process
 * @returns {Record<string, unknown>}
 */
export function resolveEnvBag(entry = {}) {
  const env = entry.env && typeof entry.env === 'object' ? entry.env : {};
  const pm2Env = entry.pm2_env && typeof entry.pm2_env === 'object' ? entry.pm2_env : {};
  const nested = pm2Env.env && typeof pm2Env.env === 'object' ? pm2Env.env : {};
  return { ...nested, ...env, ...pm2Env };
}

function hasNonEmpty(map, key) {
  const v = map[key];
  return v != null && String(v).length > 0;
}

/**
 * Normalize one process for secret-safe comparison.
 * @param {Record<string, unknown>} entry
 */
export function normalizeProcess(entry = {}) {
  const envMap = resolveEnvBag(entry);
  const status =
    entry.status ||
    entry.pm2_env?.status ||
    (typeof entry.pm2_env === 'object' ? entry.pm2_env.status : undefined) ||
    'unknown';
  const pmId = entry.pm_id ?? entry.pm_id_ ?? entry.pmId;
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
  const execMode =
    entry.exec_mode ||
    entry.pm2_env?.exec_mode ||
    null;
  const nodeEnv = envMap.NODE_ENV != null ? String(envMap.NODE_ENV) : null;
  const createdAt = entry.pm2_env?.created_at ?? entry.created_at ?? null;
  const restartTime = entry.pm2_env?.restart_time ?? entry.restart_time ?? null;

  const collectorDb = {};
  for (const key of COLLECTOR_DB_KEYS) {
    collectorDb[key] = {
      present: hasNonEmpty(envMap, key),
    };
  }
  const dbUserPresent = hasNonEmpty(envMap, 'DB_USER');
  const dbUserMatchesExpected =
    dbUserPresent && String(envMap.DB_USER) === EXPECTED_COLLECTOR_DB_USER;

  return {
    name: entry.name || null,
    pm_id: typeof pmId === 'number' ? pmId : pmId != null ? Number(pmId) : null,
    status: String(status),
    cwd: cwd != null ? String(cwd) : null,
    script: script != null ? String(script) : null,
    exec_mode: execMode != null ? String(execMode) : null,
    NODE_ENV: nodeEnv,
    created_at: createdAt,
    restart_time: restartTime,
    pid: typeof entry.pid === 'number' ? entry.pid : null,
    collector_db: collectorDb,
    collector_db_user_matches_expected: dbUserMatchesExpected,
    has_telegram_bot_token: hasNonEmpty(envMap, 'TELEGRAM_BOT_TOKEN'),
    // presence-only flags for forbidden provider-ish keys (no values)
    has_mexc_like: Object.keys(envMap).some((k) => /MEXC|API_KEY|API_SECRET/i.test(k) && hasNonEmpty(envMap, k)),
  };
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

  const engines = byName(ENGINE_NAME).map((p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
    cwd: p.cwd,
    script: p.script,
    exec_mode: p.exec_mode,
    created_at: p.created_at,
    restart_time: p.restart_time,
  }));

  const backends = byName(BACKEND_NAME).map((p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
  }));

  const processors = byName(PROCESSOR_NAME).map((p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
  }));

  const monitors = byName(MONITOR_NAME).map((p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
  }));

  const collectors = byName(COLLECTOR_NAME).map((p) => ({
    pm_id: p.pm_id,
    status: p.status,
    NODE_ENV: p.NODE_ENV,
    db_keys_present: Object.fromEntries(
      COLLECTOR_DB_KEYS.map((k) => [k, p.collector_db[k].present]),
    ),
    db_user_matches_expected: p.collector_db_user_matches_expected,
    has_telegram_bot_token: p.has_telegram_bot_token,
  }));

  return {
    engines,
    backends,
    processors,
    monitors,
    collectors,
    engine_online_count: engines.filter((e) => e.status === 'online').length,
    backend_count: backends.length,
    processor_count: processors.length,
    monitor_count: monitors.length,
    collector_count: collectors.length,
    other_names: [
      ...new Set(
        normalized
          .map((p) => p.name)
          .filter(
            (n) =>
              n &&
              ![ENGINE_NAME, BACKEND_NAME, PROCESSOR_NAME, COLLECTOR_NAME, MONITOR_NAME].includes(
                n,
              ),
          ),
      ),
    ].sort(),
  };
}

/**
 * Deterministic retain/extra selection among eligible online engines.
 * Prefer lowest pm_id after proving identical script/cwd/exec_mode/NODE_ENV.
 * @param {ReturnType<typeof semanticFingerprint>} fp
 */
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
 * @returns {{ diffs: Array<{kind:string, detail?: unknown}>, classified: Array<{kind:string, detail?: unknown}> }}
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
    if (a.NODE_ENV !== b.NODE_ENV) {
      diffs.push({ kind: 'NODE_ENV_CHANGE', detail: { scope: 'engine', pm_id: pmId } });
    }
  }

  if (
    pre.backend_count !== post.backend_count ||
    JSON.stringify(pre.backends) !== JSON.stringify(post.backends)
  ) {
    diffs.push({ kind: 'BACKEND_TOPOLOGY_CHANGE' });
  }
  if (
    pre.processor_count !== post.processor_count ||
    JSON.stringify(pre.processors) !== JSON.stringify(post.processors)
  ) {
    diffs.push({ kind: 'PROCESSOR_TOPOLOGY_CHANGE' });
  }
  if (
    pre.monitor_count !== post.monitor_count ||
    JSON.stringify(pre.monitors) !== JSON.stringify(post.monitors)
  ) {
    diffs.push({ kind: 'MONITOR_TOPOLOGY_CHANGE' });
  }

  const preCol = (pre.collectors || [])[0] || null;
  const postCol = (post.collectors || [])[0] || null;
  if (JSON.stringify(preCol) !== JSON.stringify(postCol)) {
    diffs.push({ kind: 'COLLECTOR_CHANGE', detail: { pre: preCol, post: postCol } });
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
    if (d.kind === 'COLLECTOR_CHANGE') {
      const pre = d.detail?.pre || {};
      const post = d.detail?.post || {};
      const preKeys = pre.db_keys_present || {};
      const postKeys = post.db_keys_present || {};
      const preHadAny = COLLECTOR_DB_KEYS.some((k) => preKeys[k]);
      const postHasAll = COLLECTOR_DB_KEYS.every((k) => postKeys[k]);
      const statusSame = pre.status === post.status;
      const nodeEnvSame = pre.NODE_ENV === post.NODE_ENV;
      const tokenNotRestored =
        pre.has_telegram_bot_token === true || post.has_telegram_bot_token !== true;
      if (
        !preHadAny &&
        postHasAll &&
        post.db_user_matches_expected === true &&
        statusSame &&
        nodeEnvSame &&
        tokenNotRestored
      ) {
        out.push({ kind: 'COLLECTOR_DB_KEYS_APPEAR' });
      } else if (post.has_telegram_bot_token === true && pre.has_telegram_bot_token !== true) {
        out.push({ kind: 'TELEGRAM_TOKEN_ENV_RESTORED' });
      } else {
        out.push({ kind: 'UNRELATED_ENV_CHANGE', detail: 'COLLECTOR_OTHER' });
      }
      continue;
    }
    if (
      [
        'NODE_ENV_CHANGE',
        'BACKEND_TOPOLOGY_CHANGE',
        'PROCESSOR_TOPOLOGY_CHANGE',
        'MONITOR_TOPOLOGY_CHANGE',
        'UNRELATED_PROCESS_CHANGE',
        'TELEGRAM_TOKEN_ENV_RESTORED',
        'PROVIDER_ENV_CHANGE',
        'UNRELATED_ENV_CHANGE',
      ].includes(d.kind)
    ) {
      out.push({ kind: d.kind, detail: d.detail });
      continue;
    }
    out.push({ kind: 'UNEXPECTED', detail: d });
  }
  return out;
}

/**
 * Assert live collector already has DB-B and dump does not (precondition for shared save).
 */
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
