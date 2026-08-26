/**
 * PM2 6.0.13 dump resurrect semantic comparison (read-only analysis of God.prepare /
 * executeApp / CLI.resurrect). Pure functions — no production side effects.
 *
 * Proven consumed/material for prepare/resurrect of a flat dump entry:
 * - status (STOPPED → register only; else executeApp)
 * - instances (multi-instance fan-out; dumpProcessList deletes this key → usually absent)
 * - name, pm_exec_path/script, pm_cwd/cwd, exec_mode, exec_interpreter
 * - args, node_args, namespace, autorestart, watch, watch_delay, watch_options
 * - merge_logs, max_memory_restart, kill_timeout, listen_timeout, treekill
 * - instance_var, cron_restart, exp_backoff_restart_delay, source_map_support
 * - filter_env, autostart, wait_ready, shutdown_with_message
 * - complete application env INCLUDING PATH (Utility.extend(env_copy, env_copy.env))
 *
 * Proven regenerated / non-authoritative for slot equivalence:
 * - pm_id (deleted on dump save; reassigned in prepare)
 * - unique_id (always regenerated in God.prepare)
 * - created_at / restart_time / unstable_restarts / prev_restart_delay
 * - axm_* / vizion_running / pm_uptime / pid / monit
 * - pm_*_log_path / pm_pid_path (rewritten when pm_id undefined on first create)
 */

import { PM2_METADATA_KEYS } from './constants.mjs';

const META = new Set(PM2_METADATA_KEYS);

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Local env-target resolver — avoid circular import with projection.mjs. */
function resolveDumpEnvMutationTargetLocal(entry) {
  if (!isPlainObject(entry)) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }
  if (isPlainObject(entry.pm2_env) && isPlainObject(entry.pm2_env.env)) {
    return { ok: true, container: entry.pm2_env.env };
  }
  if (isPlainObject(entry.env) && !Array.isArray(entry.env)) {
    return { ok: true, container: entry.env };
  }
  const looksFlatDump =
    !entry.pm2_env &&
    (entry.pm_exec_path != null || entry.pm_cwd != null) &&
    entry.name != null &&
    entry.status != null;
  if (looksFlatDump) {
    return { ok: true, container: entry };
  }
  return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
}

/** Top-level dump keys compared for resurrect semantics (values normalized). */
export const RESURRECT_TOP_LEVEL_FIELDS = Object.freeze([
  'name',
  'pm_exec_path',
  'script',
  'pm_cwd',
  'cwd',
  'exec_mode',
  'exec_interpreter',
  'interpreter',
  'instances',
  'namespace',
  'args',
  'node_args',
  'autorestart',
  'watch',
  'watch_delay',
  'watch_options',
  'merge_logs',
  'max_memory_restart',
  'kill_timeout',
  'listen_timeout',
  'treekill',
  'instance_var',
  'cron_restart',
  'exp_backoff_restart_delay',
  'source_map_support',
  'filter_env',
  'autostart',
  'wait_ready',
  'shutdown_with_message',
  'vizion',
  'automation',
  'pmx',
  'time',
]);

/** Explicitly ignored for resurrect slot equivalence (PM2 regenerates or volatile). */
export const RESURRECT_IGNORED_FIELDS = Object.freeze([
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
  'status', // compared separately as online/online pre-gate
  'env', // handled via resolveDumpEnvMutationTargetLocal
  'pm2_env',
]);

function stableSerialize(v) {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function readTop(entry, key) {
  if (!isPlainObject(entry)) return undefined;
  if (Object.prototype.hasOwnProperty.call(entry, key)) return entry[key];
  if (isPlainObject(entry.pm2_env) && Object.prototype.hasOwnProperty.call(entry.pm2_env, key)) {
    return entry.pm2_env[key];
  }
  return undefined;
}

function normalizePathLike(scriptOrCwd) {
  if (scriptOrCwd == null) return null;
  return String(scriptOrCwd);
}

/**
 * Compare two dump engine records for PM2 6.0.13 resurrect semantic equivalence.
 * Never returns env/PATH values — only categorical PASS/FAIL + field categories.
 *
 * @returns {{ ok: boolean, DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'PASS'|'FAIL', mismatchCategories?: string[] }}
 */
export function compareDumpEngineResurrectSemantics(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) {
    return {
      ok: false,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      mismatchCategories: ['ENTRY_SHAPE'],
    };
  }

  /** @type {string[]} */
  const mismatchCategories = [];

  for (const key of RESURRECT_TOP_LEVEL_FIELDS) {
    let va = readTop(a, key);
    let vb = readTop(b, key);
    if (key === 'pm_exec_path' || key === 'script') {
      // Prefer pm_exec_path; fall back to script
      va = normalizePathLike(readTop(a, 'pm_exec_path') ?? readTop(a, 'script'));
      vb = normalizePathLike(readTop(b, 'pm_exec_path') ?? readTop(b, 'script'));
      if (stableSerialize(va) !== stableSerialize(vb)) {
        mismatchCategories.push('SCRIPT_OR_PM_EXEC_PATH');
      }
      continue;
    }
    if (key === 'pm_cwd' || key === 'cwd') {
      va = normalizePathLike(readTop(a, 'pm_cwd') ?? readTop(a, 'cwd'));
      vb = normalizePathLike(readTop(b, 'pm_cwd') ?? readTop(b, 'cwd'));
      if (stableSerialize(va) !== stableSerialize(vb)) {
        mismatchCategories.push('CWD_OR_PM_CWD');
      }
      continue;
    }
    if (key === 'exec_interpreter' || key === 'interpreter') {
      va = readTop(a, 'exec_interpreter') ?? readTop(a, 'interpreter');
      vb = readTop(b, 'exec_interpreter') ?? readTop(b, 'interpreter');
      if (stableSerialize(va) !== stableSerialize(vb)) {
        mismatchCategories.push('INTERPRETER');
      }
      continue;
    }
    if (key === 'script' || key === 'cwd' || key === 'interpreter') {
      // handled via aliases above
      continue;
    }
    if (stableSerialize(va) !== stableSerialize(vb)) {
      mismatchCategories.push(key.toUpperCase());
    }
  }

  const envA = resolveDumpEnvMutationTargetLocal(a);
  const envB = resolveDumpEnvMutationTargetLocal(b);
  if (!envA.ok || !envB.ok) {
    mismatchCategories.push('ENV_SHAPE');
  } else {
    // Full application env INCLUDING PATH — resurrect injects env into process.
    const keysA = Object.keys(envA.container)
      .filter((k) => !META.has(k) || k === 'PATH')
      .sort();
    // Include PATH even if also in META list
    const keySet = new Set([
      ...Object.keys(envA.container),
      ...Object.keys(envB.container),
    ]);
    for (const k of keySet) {
      if (META.has(k) && k !== 'PATH') continue;
      const hasA = Object.prototype.hasOwnProperty.call(envA.container, k);
      const hasB = Object.prototype.hasOwnProperty.call(envB.container, k);
      if (hasA !== hasB) {
        mismatchCategories.push(k === 'PATH' ? 'ENV_PATH' : 'ENV_KEYSET');
        continue;
      }
      if (!hasA) continue;
      if (String(envA.container[k]) !== String(envB.container[k])) {
        mismatchCategories.push(k === 'PATH' ? 'ENV_PATH' : 'ENV_VALUE');
      }
    }
    void keysA;
  }

  const unique = [...new Set(mismatchCategories)];
  if (unique.length > 0) {
    return {
      ok: false,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
      mismatchCategories: unique,
    };
  }
  return {
    ok: true,
    DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'PASS',
  };
}

/**
 * Fixture-level proof: online+stopped equivalent slots are compatible with
 * God.prepare status branching (no production resurrect).
 */
export function assertSymmetricProjectedDumpResurrectCompatibility({
  projected,
  engineIndexes,
}) {
  if (!Array.isArray(projected) || !Array.isArray(engineIndexes) || engineIndexes.length !== 2) {
    return { ok: false, SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'FAIL' };
  }
  const [i, j] = engineIndexes;
  const a = projected[i];
  const b = projected[j];
  if (!a || !b) {
    return { ok: false, SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'FAIL' };
  }
  const statuses = [String(a.status), String(b.status)].sort();
  if (statuses[0] !== 'online' || statuses[1] !== 'stopped') {
    return { ok: false, SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'FAIL' };
  }
  // Clone without status — resurrect-relevant fields must still match.
  const aSans = { ...a, status: 'online' };
  const bSans = { ...b, status: 'online' };
  const cmp = compareDumpEngineResurrectSemantics(aSans, bSans);
  if (!cmp.ok) {
    return {
      ok: false,
      SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'FAIL',
      mismatchCategories: cmp.mismatchCategories,
    };
  }
  // God.prepare: STOPPED registers without executeApp; non-stopped starts.
  // One online + one stopped ⇒ intended singleton topology after empty-daemon resurrect.
  return { ok: true, SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'PASS' };
}
