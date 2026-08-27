/**
 * Read-only production compatibility proof for T2 v1.6.1.
 * Never mutates PM2/dump; never prints PATH/env/secret values.
 *
 * Usage (host): node --input-type=module productionCompatibilityProof.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import {
  ENGINE_NAME,
  BACKEND_NAME,
  PROCESSOR_NAME,
  DUMP_ENGINE_MAPPING_MODE,
} from './constants.mjs';
import { semanticFingerprint, selectEngineRetainExtra } from './semantics.mjs';
import { resolveDumpEngineIdentities } from './projection.mjs';
import {
  compareProcessPm2Semantics,
  deriveLiveApplicationEnvKeyContext,
} from './pm2SemanticModel.mjs';

function pathEqualCategorical(aEntry, bEntry) {
  const cmp = compareProcessPm2Semantics(aEntry, bEntry, {
    requireClassified: true,
    applicationEnvKeysContext: deriveLiveApplicationEnvKeyContext(aEntry),
  });
  if (cmp.ok) return { pathEqual: true, nonPathEqual: true };
  const cats = cmp.mismatchCategories || [];
  const onlyPath = cats.length > 0 && cats.every((c) => c === 'ENV_PATH');
  const sans = compareProcessPm2Semantics(aEntry, bEntry, {
    requireClassified: true,
    applicationEnvKeysContext: deriveLiveApplicationEnvKeyContext(aEntry),
    ignoreApplicationEnvKeys: ['PATH'],
  });
  return {
    pathEqual: false,
    nonPathEqual: sans.ok === true,
    onlyPathDiff: onlyPath || (sans.ok && !cmp.ok),
  };
}

function readPathPresence(entry) {
  const env =
    entry?.pm2_env?.env && typeof entry.pm2_env.env === 'object'
      ? entry.pm2_env.env
      : entry?.env && typeof entry.env === 'object'
        ? entry.env
        : entry;
  return env && Object.prototype.hasOwnProperty.call(env, 'PATH');
}

/**
 * @returns {Record<string, string|boolean|null>}
 */
export function runProductionCompatibilityProof({
  dumpPath = process.env.PM2_DUMP_PATH || `${process.env.HOME || '/home/ubuntu'}/.pm2/dump.pm2`,
  jlistJson = null,
} = {}) {
  let live;
  if (jlistJson) {
    live = typeof jlistJson === 'string' ? JSON.parse(jlistJson) : jlistJson;
  } else {
    const r = spawnSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) {
      return {
        ok: false,
        error: 'PM2_JLIST_FAILED',
        CURRENT_PRODUCTION_V1_6_1_PRECHECK_COMPATIBLE: 'NO',
      };
    }
    live = JSON.parse(r.stdout || '[]');
  }

  let dump;
  try {
    dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  } catch {
    return {
      ok: false,
      error: 'DUMP_READ_FAILED',
      CURRENT_PRODUCTION_V1_6_1_PRECHECK_COMPATIBLE: 'NO',
    };
  }

  const fp = semanticFingerprint(live);
  const selection = selectEngineRetainExtra(fp);
  if (!selection.ok) {
    return {
      ok: false,
      error: selection.error || 'LIVE_SELECTION_FAIL',
      LIVE_ENGINE_PAIR_MODE: null,
      CURRENT_PRODUCTION_V1_6_1_PRECHECK_COMPATIBLE: 'NO',
    };
  }

  const dumpEngines = dump.filter((e) => (e.name || e.pm2_env?.name) === ENGINE_NAME);
  const dumpPathEq =
    dumpEngines.length === 2
      ? pathEqualCategorical(dumpEngines[0], dumpEngines[1])
      : { pathEqual: false, nonPathEqual: false };

  // Canonical PATH match: dump slot vs retained live (consensus owner in UNIQUE;
  // either in SYMMETRIC).
  const slot0PathMatch =
    dumpEngines[0] && selection.retained
      ? compareProcessPm2Semantics(dumpEngines[0], selection.retained._rawEntry || selection.retained, {
          requireClassified: true,
          applicationEnvKeysContext: deriveLiveApplicationEnvKeyContext(
            selection.retained._rawEntry || selection.retained,
          ),
          ignoreApplicationEnvKeys: [],
        }).ok &&
        // path-only check: equal including PATH vs retained
        true
      : false;

  // More precise PATH match categorical via full compare categories
  function dumpPathMatchesLive(dumpEntry, liveProc) {
    const full = compareProcessPm2Semantics(dumpEntry, liveProc._rawEntry || liveProc, {
      requireClassified: true,
      applicationEnvKeysContext: deriveLiveApplicationEnvKeyContext(liveProc._rawEntry || liveProc),
    });
    if (full.ok) return true;
    // If only non-path differs, PATH may still match — check ignore non-path by
    // inverting: compare with ignoring all but we only have PATH ignore.
    // Use extract via mismatch: if sans-PATH fails, config differs; if full fails
    // only on ENV_PATH, PATH differs.
    const cats = full.mismatchCategories || [];
    return !cats.includes('ENV_PATH') && !cats.includes('ENV_KEYSET');
  }

  // Better: compare PATH equality alone by ignoring all other env... we don't have that.
  // Use selection.retained as canonical live for UNIQUE; for path match check
  // dumpMatches via pathEqual from resolveDumpEngineIdentities side effects.
  const engines = resolveDumpEngineIdentities(dump, selection);
  const slot0Canon = dumpEngines[0]
    ? dumpPathMatchesLive(dumpEngines[0], selection.retained)
    : false;
  const slot1Canon = dumpEngines[1]
    ? dumpPathMatchesLive(dumpEngines[1], selection.retained)
    : false;

  // For UNIQUE mode, also check which dump matches which live — retained is canonical PATH.
  // DUMP_SLOT_i_PATH_MATCHES_CANONICAL means PATH equals consensus (retained in UNIQUE,
  // either in SYMMETRIC).
  let slot0PathCanon = 'NO';
  let slot1PathCanon = 'NO';
  if (selection.liveEnginePairMode === 'SYMMETRIC_RUNTIME_EQUIVALENT') {
    slot0PathCanon = slot0Canon ? 'YES' : 'NO';
    slot1PathCanon = slot1Canon ? 'YES' : 'NO';
  } else {
    // UNIQUE: retained has canonical PATH
    slot0PathCanon = slot0Canon ? 'YES' : 'NO';
    slot1PathCanon = slot1Canon ? 'YES' : 'NO';
  }

  const predicted = engines.ok ? engines.mappingMode : null;
  const compatible = engines.ok === true;

  return {
    ok: compatible,
    LIVE_ENGINE_PAIR_MODE: selection.liveEnginePairMode || null,
    DUMP_ENGINE_PATH_EQUAL: dumpPathEq.pathEqual ? 'YES' : 'NO',
    DUMP_ENGINE_NON_PATH_FULL_SEMANTIC_EQUAL: dumpPathEq.nonPathEqual ? 'YES' : 'NO',
    DUMP_SLOT_0_PATH_MATCHES_CANONICAL: slot0PathCanon,
    DUMP_SLOT_1_PATH_MATCHES_CANONICAL: slot1PathCanon,
    CURRENT_PRODUCTION_MAPPING_MODE_PREDICTED: predicted,
    CURRENT_PRODUCTION_V1_6_1_PRECHECK_COMPATIBLE: compatible ? 'YES' : 'NO',
    CANONICAL_PERSISTED_SLOT_SELECTION:
      predicted === DUMP_ENGINE_MAPPING_MODE.CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY
        ? 'PASS'
        : 'NOT_REQUIRED',
    dumpEngineCount: dumpEngines.length,
    liveEngineOnline: fp.engine_online_count,
    mappingError: engines.ok ? null : engines.error || null,
    // structural only
    dumpHasNestedEnv: dumpEngines[0] && dumpEngines[0].env && typeof dumpEngines[0].env === 'object',
    dumpHasPmId: dumpEngines.some((e) => 'pm_id' in e),
    dumpHasInstances: dumpEngines.some((e) => 'instances' in e),
    pathPresentLive: readPathPresence(selection.retained?._rawEntry || {}),
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('productionCompatibilityProof.mjs')) {
  const proof = runProductionCompatibilityProof();
  // Secret-safe JSON only
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
  process.exit(proof.ok ? 0 : 2);
}
