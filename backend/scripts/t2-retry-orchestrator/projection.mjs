/**
 * Pure projected-dump construction for T2 v1.6.1.
 * Base = exact sanitized PRE dump clone.
 * ALREADY_PRESENT_EXACT: only engine status online→stopped; DB_* preserved.
 * Mapping modes: UNIQUE_SEMANTIC_IDENTITY | SYMMETRIC_EQUIVALENT_SLOTS.
 */

import {
  COLLECTOR_DB_KEYS,
  COLLECTOR_NAME,
  DUMP_ENGINE_MAPPING_MODE,
  ENGINE_NAME,
  EXPECTED_COLLECTOR_DB_USER,
  PM2_METADATA_KEYS,
  REQUIRED_PROJECTED_DUMP_MODE,
  STABLE_CONFIG_FIELDS,
} from './constants.mjs';
import {
  assertSymmetricProjectedDumpResurrectCompatibility,
  compareDumpEngineResurrectSemantics,
} from './resurrectSemantics.mjs';
import {
  compareProcessPm2Semantics,
  deriveLiveApplicationEnvKeyContext,
  resolveRawPm2Entry,
  readApplicationEnvValue,
  deepStructuralEqual,
} from './pm2SemanticModel.mjs';
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

function pathEqualDumpLive(dumpEntry, liveProc) {
  const liveRaw = resolveRawPm2Entry(liveProc);
  const a = readApplicationEnvValue(dumpEntry, 'PATH');
  const b = readApplicationEnvValue(liveRaw, 'PATH');
  if (!a.present && !b.present) return true;
  if (!a.present || !b.present) return false;
  return deepStructuralEqual(a.value, b.value);
}

/** Full PM2 semantic match dump↔live; PATH ignore via comparator option (all shapes). */
function dumpMatchesLiveFull(dumpEntry, liveProc, { ignorePath = false } = {}) {
  const liveRaw = resolveRawPm2Entry(liveProc);
  const ctx = deriveLiveApplicationEnvKeyContext(liveRaw);
  return compareProcessPm2Semantics(dumpEntry, liveRaw, {
    requireClassified: true,
    applicationEnvKeysContext: ctx,
    ignoreApplicationEnvKeys: ignorePath ? ['PATH'] : [],
  });
}

function liveEnvContextFromSelection(selection) {
  const retained = resolveRawPm2Entry(selection.retained);
  return deriveLiveApplicationEnvKeyContext(retained);
}

/**
 * Map dump engine records for projection.
 *
 * MODE A UNIQUE_SEMANTIC_IDENTITY
 * MODE B SYMMETRIC_EQUIVALENT_SLOTS
 * MODE C CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY — dump slots equal except PATH;
 *   exactly one dump PATH matches backend/processor consensus; no pm_id identity.
 */
export function resolveDumpEngineIdentities(preDump, selection, { canonicalPath = null } = {}) {
  if (!Array.isArray(preDump) || !selection?.retained || !selection?.extra) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const dumpEngines = preDump
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (entry.name || entry.pm2_env?.name) === ENGINE_NAME);

  if (dumpEngines.length !== 2) {
    return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
  }

  const envCtx = liveEnvContextFromSelection(selection);

  const livePair = [
    { role: 'retained', live: selection.retained, pmId: selection.retained.pm_id },
    { role: 'extra', live: selection.extra, pmId: selection.extra.pm_id },
  ];
  const candidateMap = new Map();
  for (const liveSpec of livePair) {
    const hits = dumpEngines.filter(({ entry }) => {
      const full = dumpMatchesLiveFull(entry, liveSpec.live, { ignorePath: true });
      return full.ok;
    });
    candidateMap.set(liveSpec.role, hits);
  }

  const retainedHits = candidateMap.get('retained') || [];
  const extraHits = candidateMap.get('extra') || [];

  /**
   * When LIVE engines are fully symmetric, dump↔pm_id unique binding is invalid.
   * Prefer MODE B (full dump equality) or MODE C (PATH-only dump asymmetry).
   */
  const preferSymmetricPersistedModes =
    selection.liveEnginePairMode === 'SYMMETRIC_RUNTIME_EQUIVALENT';

  /** MODE C: PATH-only dump asymmetry + canonical persisted slot. */
  const tryCanonicalPersistedSlot = () => {
    const bothOnline = dumpEngines.every(({ entry }) => String(entry.status) === 'online');
    if (!bothOnline) return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };

    // Non-PATH full equality between dump slots
    const pathOnly = compareDumpEngineResurrectSemantics(
      dumpEngines[0].entry,
      dumpEngines[1].entry,
      { applicationEnvKeysContext: envCtx, ignoreApplicationEnvKeys: ['PATH'] },
    );
    if (!pathOnly.ok) {
      return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED', mismatchCategories: pathOnly.mismatchCategories };
    }
    // Full equality including PATH would mean MODE B — not C
    const fullEq = compareDumpEngineResurrectSemantics(
      dumpEngines[0].entry,
      dumpEngines[1].entry,
      { applicationEnvKeysContext: envCtx },
    );
    if (fullEq.ok) {
      return { ok: false, error: 'CANONICAL_PERSISTED_SLOT_NOT_APPLICABLE_PATH_EQUAL' };
    }

    // Each slot matches LIVE class ignoring PATH
    const classLive = selection.retained;
    const slot0 = dumpMatchesLiveFull(dumpEngines[0].entry, classLive, { ignorePath: true });
    const slot1 = dumpMatchesLiveFull(dumpEngines[1].entry, classLive, { ignorePath: true });
    if (!slot0.ok || !slot1.ok) {
      return {
        ok: false,
        error: 'DUMP_ENGINE_LIVE_CLASS_SEMANTIC_MISMATCH',
        DUMP_SLOT_0_MATCHES_LIVE_ENGINE_CLASS: slot0.ok ? 'PASS' : 'FAIL',
        DUMP_SLOT_1_MATCHES_LIVE_ENGINE_CLASS: slot1.ok ? 'PASS' : 'FAIL',
      };
    }

    // Resolve canonical PATH from selection evidence / optional arg — never print value.
    // Compare dump PATH equality to retained/extra live via pathEqualDumpLive against
    // a synthetic consensus: prefer the live engine whose PATH matches backend consensus
    // (selection.retained is that engine in UNIQUE mode; in SYMMETRIC both match).
    // For MODE C under LIVE SYMMETRIC: selection.retained is lower pm_id; both live PATH equal.
    // We need external canonicalPathMatcher: pathEqualDumpLive vs a live process that holds
    // the consensus PATH. Use selection.evidence or compare each dump to both lives.
    // Simplest: count which dump slot PATH-equals the live engine that matches consensus.
    // In SYMMETRIC live, both lives share PATH — then MODE C is impossible (dump PATH would
    // also need to differ from live class when ignorePath=false). Owner: MODE C only when
    // LIVE is SYMMETRIC but dump PATH differs. Then both live share canonical PATH.
    // Match dump slots against retained live PATH (canonical).
    const slot0Canon = pathEqualDumpLive(dumpEngines[0].entry, selection.retained);
    const slot1Canon = pathEqualDumpLive(dumpEngines[1].entry, selection.retained);
    const matchCount = (slot0Canon ? 1 : 0) + (slot1Canon ? 1 : 0);
    if (matchCount !== 1) {
      return { ok: false, error: 'CANONICAL_PERSISTED_SLOT_PATH_AMBIGUOUS' };
    }
    const retainedDumpIndex = slot0Canon ? dumpEngines[0].index : dumpEngines[1].index;
    const extraDumpIndex = slot0Canon ? dumpEngines[1].index : dumpEngines[0].index;

    return {
      ok: true,
      mappingMode: DUMP_ENGINE_MAPPING_MODE.CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY,
      DUMP_ENGINE_MAPPING_MODE: DUMP_ENGINE_MAPPING_MODE.CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY,
      persistedIdentityClaim: 'NONE',
      PERSISTED_SLOT_IDENTITY_CLAIM: 'NONE',
      retainedDumpIndex,
      extraDumpIndex,
      retainedLivePmId: null,
      extraLivePmId: null,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'PASS_EXCEPT_PATH',
      DUMP_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS_EXCEPT_PATH',
      DUMP_SLOT_0_MATCHES_LIVE_ENGINE_CLASS: 'PASS',
      DUMP_SLOT_1_MATCHES_LIVE_ENGINE_CLASS: 'PASS',
      DUMP_ENGINE_LIVE_CLASS_SEMANTIC_MATCH: 'PASS',
      CANONICAL_PERSISTED_SLOT_SELECTION: 'PASS',
      SYMMETRIC_SLOT_SELECTION: 'NONCANONICAL_PATH_SLOT_STOPPED',
      PM_ID_USED_AS_PERSISTED_IDENTITY: 'NO',
    };
  };

  /** MODE B helper: mutual dump equality + each slot matches LIVE class. */
  const trySymmetricEquivalentSlots = () => {
    const bothOnline = dumpEngines.every(({ entry }) => String(entry.status) === 'online');
    if (!bothOnline) {
      return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
    }

    const resurrectCmp = compareDumpEngineResurrectSemantics(
      dumpEngines[0].entry,
      dumpEngines[1].entry,
      { applicationEnvKeysContext: envCtx },
    );
    if (!resurrectCmp.ok) {
      // PATH-only dump asymmetry under otherwise-equal slots → MODE C when LIVE is symmetric
      if (
        selection.liveEnginePairMode === 'SYMMETRIC_RUNTIME_EQUIVALENT' &&
        Array.isArray(resurrectCmp.mismatchCategories) &&
        resurrectCmp.mismatchCategories.length > 0 &&
        resurrectCmp.mismatchCategories.every((c) => c === 'ENV_PATH')
      ) {
        const modeC = tryCanonicalPersistedSlot();
        if (modeC.ok) return modeC;
      }
      if (resurrectCmp.error === 'DUMP_ENGINE_RESURRECT_FIELD_UNCLASSIFIED') {
        return {
          ok: false,
          error: 'DUMP_ENGINE_RESURRECT_FIELD_UNCLASSIFIED',
          unclassifiedFields: resurrectCmp.unclassifiedFields,
        };
      }
      return {
        ok: false,
        error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED',
        DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'FAIL',
        mismatchCategories: resurrectCmp.mismatchCategories,
      };
    }

    const classLive = selection.retained;
    const slot0 = dumpMatchesLiveFull(dumpEngines[0].entry, classLive, { ignorePath: false });
    const slot1 = dumpMatchesLiveFull(dumpEngines[1].entry, classLive, { ignorePath: false });
    if (!slot0.ok || !slot1.ok) {
      return {
        ok: false,
        error: 'DUMP_ENGINE_LIVE_CLASS_SEMANTIC_MISMATCH',
        DUMP_SLOT_0_MATCHES_LIVE_ENGINE_CLASS: slot0.ok ? 'PASS' : 'FAIL',
        DUMP_SLOT_1_MATCHES_LIVE_ENGINE_CLASS: slot1.ok ? 'PASS' : 'FAIL',
        mismatchCategories: [
          ...(slot0.mismatchCategories || []),
          ...(slot1.mismatchCategories || []),
        ],
      };
    }

    const indexes = dumpEngines.map((d) => d.index).sort((x, y) => x - y);
    return {
      ok: true,
      mappingMode: DUMP_ENGINE_MAPPING_MODE.SYMMETRIC_EQUIVALENT_SLOTS,
      DUMP_ENGINE_MAPPING_MODE: DUMP_ENGINE_MAPPING_MODE.SYMMETRIC_EQUIVALENT_SLOTS,
      persistedIdentityClaim: 'NONE',
      PERSISTED_SLOT_IDENTITY_CLAIM: 'NONE',
      retainedDumpIndex: indexes[0],
      extraDumpIndex: indexes[1],
      retainedLivePmId: null,
      extraLivePmId: null,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'PASS',
      DUMP_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
      DUMP_SLOT_0_MATCHES_LIVE_ENGINE_CLASS: 'PASS',
      DUMP_SLOT_1_MATCHES_LIVE_ENGINE_CLASS: 'PASS',
      DUMP_ENGINE_LIVE_CLASS_SEMANTIC_MATCH: 'PASS',
      CANONICAL_PERSISTED_SLOT_SELECTION: 'NOT_REQUIRED',
      SYMMETRIC_SLOT_SELECTION: 'HIGHER_ARRAY_INDEX_STOPPED',
      PM_ID_USED_AS_PERSISTED_IDENTITY: 'NO',
    };
  };

  if (preferSymmetricPersistedModes) {
    return trySymmetricEquivalentSlots();
  }

  if (retainedHits.length === 0 || extraHits.length === 0) {
    return trySymmetricEquivalentSlots();
  }

  const assignments = [];
  for (const retainedHit of retainedHits) {
    for (const extraHit of extraHits) {
      if (retainedHit.index === extraHit.index) continue;
      const retainedPath = pathEqualDumpLive(retainedHit.entry, selection.retained);
      const extraPath = pathEqualDumpLive(extraHit.entry, selection.extra);
      const strictScore = (retainedPath ? 1 : 0) + (extraPath ? 1 : 0);
      assignments.push({
        retainedDumpIndex: retainedHit.index,
        extraDumpIndex: extraHit.index,
        retainedPathEqual: retainedPath,
        extraPathEqual: extraPath,
        strictScore,
      });
    }
  }

  if (assignments.length === 0) {
    return trySymmetricEquivalentSlots();
  }
  const bestScore = Math.max(...assignments.map((a) => a.strictScore));
  const best = assignments.filter((a) => a.strictScore === bestScore);

  if (best.length === 1) {
    const retainedEntry = preDump[best[0].retainedDumpIndex];
    const extraEntry = preDump[best[0].extraDumpIndex];
    const retainedFull = dumpMatchesLiveFull(retainedEntry, selection.retained, {
      ignorePath: false,
    });
    const extraFull = dumpMatchesLiveFull(extraEntry, selection.extra, { ignorePath: false });
    if (!retainedFull.ok) {
      if (best[0].retainedPathEqual) {
        return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
      }
      const retainedSans = dumpMatchesLiveFull(retainedEntry, selection.retained, {
        ignorePath: true,
      });
      if (!retainedSans.ok) {
        return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
      }
    }
    if (!extraFull.ok) {
      if (best[0].extraPathEqual) {
        return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
      }
      const extraSans = dumpMatchesLiveFull(extraEntry, selection.extra, { ignorePath: true });
      if (!extraSans.ok) {
        return { ok: false, error: 'DUMP_ENGINE_IDENTITY_UNRESOLVED' };
      }
    }

    return {
      ok: true,
      mappingMode: DUMP_ENGINE_MAPPING_MODE.UNIQUE_SEMANTIC_IDENTITY,
      DUMP_ENGINE_MAPPING_MODE: DUMP_ENGINE_MAPPING_MODE.UNIQUE_SEMANTIC_IDENTITY,
      persistedIdentityClaim: 'UNIQUE_DUMP_LIVE_BINDING',
      PERSISTED_SLOT_IDENTITY_CLAIM: 'UNIQUE_DUMP_LIVE_BINDING',
      retainedDumpIndex: best[0].retainedDumpIndex,
      extraDumpIndex: best[0].extraDumpIndex,
      retainedLivePmId:
        typeof selection.retained.pm_id === 'number' ? selection.retained.pm_id : null,
      extraLivePmId: typeof selection.extra.pm_id === 'number' ? selection.extra.pm_id : null,
      DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE: 'N/A',
      DUMP_ENGINE_FULL_PM2_SEMANTIC_EQUIVALENCE: 'PASS',
      CANONICAL_PERSISTED_SLOT_SELECTION: 'NOT_REQUIRED',
    };
  }

  return trySymmetricEquivalentSlots();
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

function isAuthorizedProjectionDiffPath(diffPath, { extraDumpIndex }) {
  // Engine status only (v1.6 — DB_* must not change)
  if (diffPath === `[${extraDumpIndex}].status`) return true;
  return false;
}

/**
 * Build expected projected dump from sanitized PRE dump.
 * Collector five DB_* must already be present and are preserved unchanged.
 *
 * @param {object} args
 * @param {Array} args.preDump
 * @param {object} args.selection — selectEngineRetainExtra result (live)
 * @param {Record<string,string>} [args.collectorDbSnapshot] — optional; if provided must equal PRE dump DB_*
 */
export function buildExpectedProjectedDump({
  preDump,
  selection,
  collectorDbSnapshot,
}) {
  if (!Array.isArray(preDump)) {
    return { ok: false, error: 'PROJECTION_PRE_DUMP_INVALID' };
  }

  const engineMap = resolveDumpEngineIdentities(preDump, selection);
  if (!engineMap.ok) {
    return { ok: false, error: engineMap.error };
  }
  const collectorMap = resolveDumpCollectorIdentity(preDump);
  if (!collectorMap.ok) {
    return { ok: false, error: collectorMap.error };
  }

  const collectorEntryPre = preDump[collectorMap.dumpIndex];
  const mutPre = resolveDumpEnvMutationTarget(collectorEntryPre);
  if (!mutPre.ok) {
    return { ok: false, error: mutPre.error };
  }

  // Require all five already present on PRE dump
  for (const key of COLLECTOR_DB_KEYS) {
    const existing = scalarEnvValue(mutPre.container[key]);
    if (existing == null) {
      return { ok: false, error: 'PROJECTION_COLLECTOR_DB_ABSENT' };
    }
  }
  if (String(mutPre.container.DB_USER) !== EXPECTED_COLLECTOR_DB_USER) {
    return { ok: false, error: 'PROJECTION_COLLECTOR_DB_USER_UNEXPECTED' };
  }

  // If snapshot provided, must equal PRE dump values (preserve, do not rewrite from live drift)
  if (collectorDbSnapshot && typeof collectorDbSnapshot === 'object') {
    for (const key of COLLECTOR_DB_KEYS) {
      if (String(collectorDbSnapshot[key] ?? '') !== String(mutPre.container[key] ?? '')) {
        return { ok: false, error: 'PROJECTION_COLLECTOR_DB_SNAPSHOT_MISMATCH' };
      }
    }
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

  // Prove DB_* byte-identical to PRE (no delete/re-add)
  const mutPost = resolveDumpEnvMutationTarget(projected[collectorMap.dumpIndex]);
  if (!mutPost.ok) {
    return { ok: false, error: mutPost.error };
  }
  for (const key of COLLECTOR_DB_KEYS) {
    if (String(mutPost.container[key] ?? '') !== String(mutPre.container[key] ?? '')) {
      return { ok: false, error: 'PROJECTION_COLLECTOR_DB_REWRITE_FORBIDDEN' };
    }
  }

  const diffPaths = structuralDiffPaths(preDump, projected);
  const unexpected = diffPaths.filter(
    (p) =>
      !isAuthorizedProjectionDiffPath(p, {
        extraDumpIndex: engineMap.extraDumpIndex,
      }),
  );
  if (unexpected.length > 0) {
    return {
      ok: false,
      error: 'PROJECTION_CONSTRUCTION_UNEXPECTED_DIFF',
      unexpectedCount: unexpected.length,
    };
  }

  // Expect exactly 1 status change
  if (diffPaths.length !== 1) {
    return {
      ok: false,
      error: 'PROJECTION_CONSTRUCTION_UNEXPECTED_DIFF',
      unexpectedCount: diffPaths.length,
    };
  }

  const bytes = Buffer.from(JSON.stringify(projected), 'utf8');

  /** @type {Record<string, string|number>} */
  const manifest = {
    ENGINE_EXTRA_STATUS_CHANGED: 'YES',
    COLLECTOR_DB_KEYS_ADDED: 0,
    COLLECTOR_DB_KEYS_PRESERVED_EXACT: 5,
    COLLECTOR_DB_KEYS_REWRITTEN: 0,
    AUTHORIZED_SEMANTIC_DIFF_COUNT: 1,
    PROJECTED_MODE_REQUIRED: '0600',
    AUTHORIZED_DIFF_PATH_COUNT: 1,
    DUMP_ENGINE_MAPPING_MODE: engineMap.mappingMode || DUMP_ENGINE_MAPPING_MODE.UNIQUE_SEMANTIC_IDENTITY,
    PERSISTED_SLOT_IDENTITY_CLAIM: engineMap.PERSISTED_SLOT_IDENTITY_CLAIM || 'UNIQUE_DUMP_LIVE_BINDING',
  };

  if (engineMap.mappingMode === DUMP_ENGINE_MAPPING_MODE.SYMMETRIC_EQUIVALENT_SLOTS) {
    const compat = assertSymmetricProjectedDumpResurrectCompatibility({
      projected,
      engineIndexes: [engineMap.retainedDumpIndex, engineMap.extraDumpIndex],
    });
    if (!compat.ok) {
      return {
        ok: false,
        error: 'SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY_FAIL',
      };
    }
    manifest.SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY = 'PASS';
    manifest.DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE = 'PASS';
    manifest.PM_ID_USED_AS_PERSISTED_IDENTITY = 'NO';
  }

  return {
    ok: true,
    projected,
    bytes,
    engineMap,
    collectorMap,
    manifest,
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
