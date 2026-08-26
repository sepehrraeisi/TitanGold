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
  STABLE_CONFIG_FIELDS,
} from './constants.mjs';
import { diffStableConfig, extractProcessEnvResult, normalizeProcess } from './semantics.mjs';

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
function appEnvIdentityCompare(aProc, bProc) {
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
  return { ok: true, pathEqual, aHasPath: aPath != null, bHasPath: bPath != null };
}

function stableConfigEqual(aProc, bProc) {
  const aNorm =
    aProc && Array.isArray(aProc.env_keys)
      ? {
          name: ENGINE_NAME,
          script: aProc.script || null,
          cwd: aProc.cwd || null,
          exec_mode: aProc.exec_mode || null,
          interpreter: aProc.interpreter || null,
          instances: aProc.instances ?? null,
          namespace: aProc.namespace || null,
          args: aProc.args ?? null,
          node_args: aProc.node_args ?? null,
          autorestart: aProc.autorestart ?? null,
          watch: aProc.watch ?? null,
        }
      : normalizeProcess(aProc);
  const bNorm =
    bProc && Array.isArray(bProc.env_keys)
      ? {
          name: ENGINE_NAME,
          script: bProc.script || null,
          cwd: bProc.cwd || null,
          exec_mode: bProc.exec_mode || null,
          interpreter: bProc.interpreter || null,
          instances: bProc.instances ?? null,
          namespace: bProc.namespace || null,
          args: bProc.args ?? null,
          node_args: bProc.node_args ?? null,
          autorestart: bProc.autorestart ?? null,
          watch: bProc.watch ?? null,
        }
      : normalizeProcess(bProc);
  const diffs = diffStableConfig(aNorm, bNorm, { scope: 'dump-live-engine-identity' });
  return {
    ok: diffs.length === 0,
    diffKinds: diffs.map((d) => d.kind),
    stableFieldCount: STABLE_CONFIG_FIELDS.length,
  };
}

/**
 * Redacted stable identity summary for tests/evidence only.
 * Never includes PATH or secret env values.
 */
export function dumpRecordStableKey(procLike) {
  if (procLike && Array.isArray(procLike.env_keys)) {
    return [
      procLike.script || '',
      procLike.cwd || '',
      procLike.exec_mode || '',
      procLike.interpreter || '',
      procLike.instances == null ? '' : String(procLike.instances),
      procLike.namespace || '',
      procLike.args || '',
      procLike.node_args || '',
      procLike.autorestart == null ? '' : String(procLike.autorestart),
      procLike.watch == null ? '' : String(procLike.watch),
      `env:${(procLike.env_keys || []).filter((k) => k !== 'PATH' && !META.has(k)).sort().join(',')}`,
    ].join('|');
  }
  const n = normalizeProcess(procLike);
  return [
    n.script || '',
    n.cwd || '',
    n.exec_mode || '',
    n.interpreter || '',
    n.instances == null ? '' : String(n.instances),
    n.namespace || '',
    n.args || '',
    n.node_args || '',
    n.autorestart == null ? '' : String(n.autorestart),
    n.watch == null ? '' : String(n.watch),
    `env:${(n.env_keys || []).filter((k) => k !== 'PATH' && !META.has(k)).sort().join(',')}`,
  ].join('|');
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
    { role: 'retained', live: selection.retained, pmId: selection.retained.pm_id },
    { role: 'extra', live: selection.extra, pmId: selection.extra.pm_id },
  ];
  const candidateMap = new Map();
  for (const liveSpec of livePair) {
    const hits = dumpEngines.filter(({ entry }) => {
      const cfg = stableConfigEqual(entry, liveSpec.live);
      if (!cfg.ok) return false;
      const envCmp = appEnvIdentityCompare(entry, liveSpec.live);
      return envCmp.ok;
    });
    candidateMap.set(liveSpec.role, hits);
  }

  const retainedHits = candidateMap.get('retained') || [];
  const extraHits = candidateMap.get('extra') || [];
  if (retainedHits.length === 0 || extraHits.length === 0) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const assignments = [];
  for (const retainedHit of retainedHits) {
    for (const extraHit of extraHits) {
      if (retainedHit.index === extraHit.index) continue;
      const retainedEnv = appEnvIdentityCompare(retainedHit.entry, selection.retained);
      const extraEnv = appEnvIdentityCompare(extraHit.entry, selection.extra);
      const strictScore =
        (retainedEnv.pathEqual === true ? 1 : 0) + (extraEnv.pathEqual === true ? 1 : 0);
      assignments.push({
        retainedDumpIndex: retainedHit.index,
        extraDumpIndex: extraHit.index,
        retainedPathEqual: retainedEnv.pathEqual === true,
        extraPathEqual: extraEnv.pathEqual === true,
        strictScore,
      });
    }
  }

  if (assignments.length === 0) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }
  const bestScore = Math.max(...assignments.map((a) => a.strictScore));
  const best = assignments.filter((a) => a.strictScore === bestScore);
  if (best.length !== 1) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const retainedMap = {
    dumpIndex: best[0].retainedDumpIndex,
    livePmId: typeof selection.retained.pm_id === 'number' ? selection.retained.pm_id : null,
  };
  const extraMap = {
    dumpIndex: best[0].extraDumpIndex,
    livePmId: typeof selection.extra.pm_id === 'number' ? selection.extra.pm_id : null,
  };

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
