/**
 * Pure projected-dump construction for T2 v1.5.0.
 * Base = exact PRE dump clone. Live supplies ONLY authorized collector DB_* values.
 * Never merges live God env / JWT / Cursor / shell / PM2 metadata.
 */

import {
  COLLECTOR_DB_KEYS,
  COLLECTOR_NAME,
  ENGINE_NAME,
  EXPECTED_COLLECTOR_DB_USER,
  PM2_METADATA_KEYS,
  REQUIRED_PROJECTED_DUMP_MODE,
} from './constants.mjs';
import { extractProcessEnvResult, normalizeProcess } from './semantics.mjs';

const META = new Set(PM2_METADATA_KEYS);

function deepCloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function scalarEnvValue(v) {
  if (v == null) return null;
  if (typeof v === 'object') return null;
  return String(v);
}

/**
 * Detect mutation-capable application-env container on a dump entry.
 * @returns {{ shape: string, container: Record<string, unknown>, parent: Record<string, unknown> }}
 */
export function resolveDumpEnvMutationTarget(entry) {
  if (!isPlainObject(entry)) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }

  if (isPlainObject(entry.pm2_env) && isPlainObject(entry.pm2_env.env)) {
    return {
      ok: true,
      shape: 'entry.pm2_env.env',
      container: entry.pm2_env.env,
      parent: entry,
    };
  }
  if (isPlainObject(entry.env) && !Array.isArray(entry.env)) {
    return {
      ok: true,
      shape: 'entry.env',
      container: entry.env,
      parent: entry,
    };
  }

  const looksFlatDump =
    !entry.pm2_env &&
    (entry.pm_exec_path != null || entry.pm_cwd != null) &&
    entry.name != null &&
    entry.status != null;

  if (looksFlatDump) {
    return {
      ok: true,
      shape: 'flat_dump_entry',
      container: entry,
      parent: entry,
    };
  }

  return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
}

/**
 * Stable identity key for dump↔live engine matching (no pm_id).
 * Accepts raw PM2 entries or already-normalized semantic procs.
 * Uses script/cwd/exec_mode/created_at — never PATH values in returned key.
 */
export function dumpRecordStableKey(procLike) {
  // Name omitted: fingerprint engines (mapFull) do not carry `name`, while dump
  // entries do. Identity is script|cwd|exec_mode|created_at within a name filter.
  if (
    procLike &&
    (Array.isArray(procLike.env_keys) ||
      (procLike.script != null && procLike.cwd != null && !procLike.pm_exec_path && !procLike.env))
  ) {
    return [
      procLike.script || '',
      procLike.cwd || '',
      procLike.exec_mode || '',
      procLike.created_at == null ? '' : String(procLike.created_at),
    ].join('|');
  }
  const n = normalizeProcess(procLike);
  return [
    n.script || '',
    n.cwd || '',
    n.exec_mode || '',
    n.created_at == null ? '' : String(n.created_at),
  ].join('|');
}

function readAppEnvMap(procLike) {
  if (procLike && procLike._envValues && typeof procLike._envValues === 'object') {
    return { ok: true, env: { ...procLike._envValues } };
  }
  return extractProcessEnvResult(procLike);
}

/**
 * Application env equality for identity (ignore PATH + proven PM2 metadata keys).
 * PATH compared only when both present for uniqueness — returned as boolean, never value.
 */
function appEnvIdentityEqual(aProc, bProc) {
  const a = readAppEnvMap(aProc);
  const b = readAppEnvMap(bProc);
  if (!a.ok || !b.ok) return { ok: false, pathEqual: null };
  const aKeys = Object.keys(a.env)
    .filter((k) => k !== 'PATH' && !META.has(k))
    .sort();
  const bKeys = Object.keys(b.env)
    .filter((k) => k !== 'PATH' && !META.has(k))
    .sort();
  if (aKeys.length !== bKeys.length) return { ok: false, pathEqual: null };
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return { ok: false, pathEqual: null };
    if (a.env[aKeys[i]] !== b.env[bKeys[i]]) return { ok: false, pathEqual: null };
  }
  const aPath = a.env.PATH;
  const bPath = b.env.PATH;
  const pathEqual =
    aPath == null && bPath == null
      ? true
      : aPath != null && bPath != null
        ? aPath === bPath
        : false;
  return { ok: true, pathEqual };
}

function stableFields(procLike) {
  if (procLike && Array.isArray(procLike.env_keys)) {
    return {
      script: procLike.script || null,
      cwd: procLike.cwd || null,
      exec_mode: procLike.exec_mode || null,
    };
  }
  const n = normalizeProcess(procLike);
  return { script: n.script, cwd: n.cwd, exec_mode: n.exec_mode };
}

/**
 * Map dump engine records to live retain/extra without relying on dump pm_id.
 * @param {Array} preDump
 * @param {{ retained: object, extra: object }} selection live-normalized processes
 */
export function resolveDumpEngineIdentities(preDump, selection) {
  if (!Array.isArray(preDump) || !selection?.retained || !selection?.extra) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const dumpEngines = preDump
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (entry.name || entry.pm2_env?.name) === ENGINE_NAME);

  if (dumpEngines.length !== 2) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const livePair = [
    { role: 'retained', live: selection.retained },
    { role: 'extra', live: selection.extra },
  ];

  /** @type {Array<{ role: string, dumpIndex: number, livePmId: number|null }>} */
  const mapped = [];

  for (const { role, live } of livePair) {
    const liveKey = dumpRecordStableKey(live);
    const candidates = dumpEngines.filter(({ entry }) => dumpRecordStableKey(entry) === liveKey);
    let chosen = candidates;

    if (chosen.length === 0) {
      // Fallback: stable config without created_at + app env (PATH exception allowed)
      chosen = dumpEngines.filter(({ entry }) => {
        const nDump = stableFields(entry);
        const nLive = stableFields(live);
        if (
          nDump.script !== nLive.script ||
          nDump.cwd !== nLive.cwd ||
          nDump.exec_mode !== nLive.exec_mode
        ) {
          return false;
        }
        const envId = appEnvIdentityEqual(entry, live);
        return envId.ok;
      });
    }

    if (chosen.length !== 1) {
      return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
    }
    mapped.push({
      role,
      dumpIndex: chosen[0].index,
      livePmId: typeof live.pm_id === 'number' ? live.pm_id : null,
    });
  }

  if (mapped[0].dumpIndex === mapped[1].dumpIndex) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const retainedMap = mapped.find((m) => m.role === 'retained');
  const extraMap = mapped.find((m) => m.role === 'extra');
  if (!retainedMap || !extraMap) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  return {
    ok: true,
    retainedDumpIndex: retainedMap.dumpIndex,
    extraDumpIndex: extraMap.dumpIndex,
    retainedLivePmId: retainedMap.livePmId,
    extraLivePmId: extraMap.livePmId,
  };
}

/**
 * Resolve unique collector dump record index.
 */
export function resolveDumpCollectorIdentity(preDump) {
  if (!Array.isArray(preDump)) {
    return { ok: false, error: 'DUMP_COLLECTOR_IDENTITY_UNRESOLVED' };
  }
  const hits = preDump
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (entry.name || entry.pm2_env?.name) === COLLECTOR_NAME);
  if (hits.length !== 1) {
    return { ok: false, error: 'DUMP_COLLECTOR_IDENTITY_UNRESOLVED' };
  }
  const shape = resolveDumpEnvMutationTarget(hits[0].entry);
  if (!shape.ok) {
    return { ok: false, error: shape.error || 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }
  return { ok: true, dumpIndex: hits[0].index, shape: shape.shape };
}

/**
 * Secret-safe structural leaf walk for unexpected-diff detection.
 * Compares JSON-serializable trees; reports path categories only (no values).
 */
export function structuralDiffPaths(pre, post, path = '') {
  /** @type {string[]} */
  const diffs = [];
  if (pre === post) return diffs;
  const tPre = pre === null ? 'null' : Array.isArray(pre) ? 'array' : typeof pre;
  const tPost = post === null ? 'null' : Array.isArray(post) ? 'array' : typeof post;
  if (tPre !== tPost) {
    diffs.push(path || '$');
    return diffs;
  }
  if (tPre !== 'object' && tPre !== 'array') {
    if (pre !== post) diffs.push(path || '$');
    return diffs;
  }
  if (Array.isArray(pre)) {
    if (pre.length !== post.length) {
      diffs.push(path || '$');
      return diffs;
    }
    for (let i = 0; i < pre.length; i++) {
      diffs.push(...structuralDiffPaths(pre[i], post[i], `${path}[${i}]`));
    }
    return diffs;
  }
  const keys = new Set([...Object.keys(pre), ...Object.keys(post)]);
  for (const k of keys) {
    const child = path ? `${path}.${k}` : k;
    if (!(k in pre) || !(k in post)) {
      diffs.push(child);
      continue;
    }
    diffs.push(...structuralDiffPaths(pre[k], post[k], child));
  }
  return diffs;
}

function isAuthorizedProjectionDiffPath(diffPath, { extraDumpIndex, collectorDumpIndex }) {
  // Engine status only
  if (diffPath === `[${extraDumpIndex}].status`) return true;
  // Collector DB_* under supported shapes
  for (const key of COLLECTOR_DB_KEYS) {
    if (diffPath === `[${collectorDumpIndex}].${key}`) return true;
    if (diffPath === `[${collectorDumpIndex}].env.${key}`) return true;
    if (diffPath === `[${collectorDumpIndex}].pm2_env.env.${key}`) return true;
  }
  return false;
}

/**
 * Build expected projected dump from PRE dump + authorized live DB snapshot only.
 *
 * @param {object} args
 * @param {Array} args.preDump
 * @param {object} args.selection — selectEngineRetainExtra result (live)
 * @param {Record<string,string>} args.collectorDbSnapshot — five DB_* from PRE LIVE
 */
export function buildExpectedProjectedDump({
  preDump,
  selection,
  collectorDbSnapshot,
}) {
  if (!Array.isArray(preDump)) {
    return { ok: false, error: 'PROJECTION_PRE_DUMP_INVALID' };
  }
  if (!collectorDbSnapshot || typeof collectorDbSnapshot !== 'object') {
    return { ok: false, error: 'PROJECTION_COLLECTOR_DB_SNAPSHOT_MISSING' };
  }
  for (const key of COLLECTOR_DB_KEYS) {
    if (
      collectorDbSnapshot[key] == null ||
      String(collectorDbSnapshot[key]).length === 0
    ) {
      return { ok: false, error: 'PROJECTION_COLLECTOR_DB_SNAPSHOT_INCOMPLETE' };
    }
  }
  if (String(collectorDbSnapshot.DB_USER) !== EXPECTED_COLLECTOR_DB_USER) {
    return { ok: false, error: 'PROJECTION_COLLECTOR_DB_USER_UNEXPECTED' };
  }

  const engineMap = resolveDumpEngineIdentities(preDump, selection);
  if (!engineMap.ok) {
    return { ok: false, error: engineMap.error };
  }
  const collectorMap = resolveDumpCollectorIdentity(preDump);
  if (!collectorMap.ok) {
    return { ok: false, error: collectorMap.error };
  }

  const projected = deepCloneJson(preDump);
  const extraEntry = projected[engineMap.extraDumpIndex];
  if (!extraEntry || (extraEntry.name || extraEntry.pm2_env?.name) !== ENGINE_NAME) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }
  if (String(extraEntry.status) !== 'online') {
    return { ok: false, error: 'DUMP_EXTRA_NOT_ONLINE_IN_PRE' };
  }
  extraEntry.status = 'stopped';

  const collectorEntry = projected[collectorMap.dumpIndex];
  const mut = resolveDumpEnvMutationTarget(collectorEntry);
  if (!mut.ok) {
    return { ok: false, error: mut.error };
  }

  // Ensure none of the five keys already exist with different values — PRE should lack them.
  for (const key of COLLECTOR_DB_KEYS) {
    const existing = scalarEnvValue(mut.container[key]);
    if (existing != null) {
      return { ok: false, error: 'PROJECTION_COLLECTOR_DB_ALREADY_PRESENT' };
    }
    mut.container[key] = String(collectorDbSnapshot[key]);
  }

  const diffPaths = structuralDiffPaths(preDump, projected);
  const unexpected = diffPaths.filter(
    (p) =>
      !isAuthorizedProjectionDiffPath(p, {
        extraDumpIndex: engineMap.extraDumpIndex,
        collectorDumpIndex: collectorMap.dumpIndex,
      }),
  );
  if (unexpected.length > 0) {
    return {
      ok: false,
      error: 'PROJECTION_CONSTRUCTION_UNEXPECTED_DIFF',
      unexpectedCount: unexpected.length,
    };
  }

  // Expect exactly 1 status + 5 DB keys = 6 paths
  if (diffPaths.length !== 6) {
    return {
      ok: false,
      error: 'PROJECTION_CONSTRUCTION_UNEXPECTED_DIFF',
      unexpectedCount: diffPaths.length,
    };
  }

  const bytes = Buffer.from(JSON.stringify(projected), 'utf8');

  return {
    ok: true,
    projected,
    bytes,
    engineMap,
    collectorMap,
    manifest: {
      ENGINE_EXTRA_STATUS_CHANGED: 'YES',
      COLLECTOR_DB_KEYS_ADDED: 5,
      PROJECTED_MODE_REQUIRED: '0600',
      AUTHORIZED_DIFF_PATH_COUNT: 6,
    },
  };
}

/**
 * Prove projected dump did not pick up live-only unauthorized keys.
 * Compares presence of selected keys in projected vs PRE — never values.
 */
export function assertUnauthorizedLiveEnvNotPersisted({
  preDump,
  projected,
  collectorDumpIndex,
  liveCollectorEnvKeys = [],
}) {
  const preCol = preDump[collectorDumpIndex];
  const postCol = projected[collectorDumpIndex];
  const preEnv = extractProcessEnvResult(preCol);
  const postEnv = extractProcessEnvResult(postCol);
  if (!preEnv.ok || !postEnv.ok) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }

  const forbiddenLiveOnly = [
    '__CURSOR_SANDBOX_ENV_RESTORE',
    'prev_restart_delay',
    'SSH_CLIENT',
    'SSH_CONNECTION',
    'OLDPWD',
    'PWD',
    'CURSOR_CONVERSATION_ID',
    'CURSOR_RIPGREP_PATH',
    'VSCODE_IPC_HOOK_CLI',
    'VSCODE_NLS_CONFIG',
    'AGENT_TRANSCRIPTS',
  ];

  for (const key of forbiddenLiveOnly) {
    const preHas = Object.prototype.hasOwnProperty.call(preEnv.env, key);
    const postHas = Object.prototype.hasOwnProperty.call(postEnv.env, key);
    if (!preHas && postHas) {
      return { ok: false, error: 'LIVE_ONLY_ENV_PERSISTED', keyClass: key };
    }
  }

  // JWT: if present in both, values must equal PRE (not live)
  if (
    Object.prototype.hasOwnProperty.call(preEnv.env, 'JWT_SECRET') &&
    Object.prototype.hasOwnProperty.call(postEnv.env, 'JWT_SECRET')
  ) {
    if (preEnv.env.JWT_SECRET !== postEnv.env.JWT_SECRET) {
      return { ok: false, error: 'JWT_SECRET_LIVE_DRIFT_PERSISTED' };
    }
  }

  // Any live-only key (except authorized DB_*) must not appear newly
  for (const key of liveCollectorEnvKeys) {
    if (COLLECTOR_DB_KEYS.includes(key)) continue;
    if (META.has(key)) continue;
    const preHas = Object.prototype.hasOwnProperty.call(preEnv.env, key);
    const postHas = Object.prototype.hasOwnProperty.call(postEnv.env, key);
    if (!preHas && postHas) {
      return { ok: false, error: 'UNAUTHORIZED_LIVE_ENV_PERSISTED' };
    }
  }

  return {
    ok: true,
    JWT_SECRET_LIVE_DRIFT_NOT_PERSISTED: 'PASS',
    LIVE_ONLY_CURSOR_ENV_NOT_PERSISTED: 'PASS',
    LIVE_ONLY_PM2_METADATA_NOT_PERSISTED: 'PASS',
    UNAUTHORIZED_LIVE_ENV_NOT_PERSISTED: 'PASS',
  };
}

export { REQUIRED_PROJECTED_DUMP_MODE };
