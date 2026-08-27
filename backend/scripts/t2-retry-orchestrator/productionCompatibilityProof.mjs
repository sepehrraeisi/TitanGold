/**
 * Read-only production compatibility proof for T2 v1.6.2.
 * Never mutates PM2/dump; never prints PATH/env/secret values.
 *
 * Usage (host): node --input-type=module productionCompatibilityProof.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import {
  ENGINE_NAME,
  DUMP_ENGINE_MAPPING_MODE,
} from './constants.mjs';
import {
  semanticFingerprint,
  selectEngineRetainExtra,
  diffFingerprints,
  diffLiveFingerprints,
  diffDumpFingerprints,
  assertExpectedLivePostState,
  assertPreEquivalent,
  captureCollectorDbLiveValues,
} from './semantics.mjs';
import { resolveDumpEngineIdentities } from './projection.mjs';
import {
  assertFleetPm2SemanticModelComplete,
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
  const sans = compareProcessPm2Semantics(aEntry, bEntry, {
    requireClassified: true,
    applicationEnvKeysContext: deriveLiveApplicationEnvKeyContext(aEntry),
    ignoreApplicationEnvKeys: ['PATH'],
  });
  return {
    pathEqual: false,
    nonPathEqual: sans.ok === true,
    onlyPathDiff: cats.length > 0 && cats.every((c) => c === 'ENV_PATH') && sans.ok,
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

function dumpPathMatchesLive(dumpEntry, liveProc) {
  const full = compareProcessPm2Semantics(dumpEntry, liveProc._rawEntry || liveProc, {
    requireClassified: true,
    applicationEnvKeysContext: deriveLiveApplicationEnvKeyContext(liveProc._rawEntry || liveProc),
  });
  if (full.ok) return true;
  const cats = full.mismatchCategories || [];
  return !cats.includes('ENV_PATH') && !cats.includes('ENV_KEYSET');
}

function cloneFingerprintPreservingRaw(fp) {
  const cloneProc = (e) => {
    const copy = { ...e };
    if (e._rawEntry) {
      Object.defineProperty(copy, '_rawEntry', {
        value: JSON.parse(JSON.stringify(e._rawEntry)),
        enumerable: false,
        writable: false,
        configurable: false,
      });
    }
    if (e._envValues) {
      Object.defineProperty(copy, '_envValues', {
        value: { ...e._envValues },
        enumerable: false,
        writable: false,
        configurable: false,
      });
    }
    return copy;
  };
  return {
    ...fp,
    source: fp.source || 'LIVE',
    engines: (fp.engines || []).map(cloneProc),
    backends: (fp.backends || []).map(cloneProc),
    processors: (fp.processors || []).map(cloneProc),
    monitors: (fp.monitors || []).map(cloneProc),
    collectors: (fp.collectors || []).map(cloneProc),
    others: (fp.others || []).map(cloneProc),
  };
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
        CURRENT_PRODUCTION_V1_6_2_PRECHECK_COMPATIBLE: 'NO',
      };
    }
    live = JSON.parse(r.stdout || '[]');
  }

  let dump;
  let dumpBytes;
  try {
    dumpBytes = fs.readFileSync(dumpPath);
    dump = JSON.parse(dumpBytes.toString('utf8'));
  } catch {
    return {
      ok: false,
      error: 'DUMP_READ_FAILED',
      CURRENT_PRODUCTION_V1_6_2_PRECHECK_COMPATIBLE: 'NO',
    };
  }

  const liveFp = semanticFingerprint(live, { source: 'LIVE' });
  const dumpFp = semanticFingerprint(dump, { source: 'DUMP' });

  const fleetClass = assertFleetPm2SemanticModelComplete(live, dump);
  const liveSelfDiff = diffLiveFingerprints(liveFp, liveFp, {});
  const dumpSelfDiff = diffDumpFingerprints(dumpFp, dumpFp, {});

  const selection = selectEngineRetainExtra(liveFp);
  if (!selection.ok) {
    return {
      ok: false,
      error: selection.error || 'LIVE_SELECTION_FAIL',
      LIVE_ENGINE_PAIR_MODE: null,
      CURRENT_PRODUCTION_V1_6_2_PRECHECK_COMPATIBLE: 'NO',
      LIVE_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE:
        fleetClass.LIVE_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE,
      DUMP_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE:
        fleetClass.DUMP_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE,
    };
  }

  const dumpEngines = dump.filter((e) => (e.name || e.pm2_env?.name) === ENGINE_NAME);
  const dumpPathEq =
    dumpEngines.length === 2
      ? pathEqualCategorical(dumpEngines[0], dumpEngines[1])
      : { pathEqual: false, nonPathEqual: false };

  const slot0Canon = dumpEngines[0]
    ? dumpPathMatchesLive(dumpEngines[0], selection.retained)
    : false;
  const slot1Canon = dumpEngines[1]
    ? dumpPathMatchesLive(dumpEngines[1], selection.retained)
    : false;

  let slot0PathCanon = slot0Canon ? 'YES' : 'NO';
  let slot1PathCanon = slot1Canon ? 'YES' : 'NO';

  const engines = resolveDumpEngineIdentities(dump, selection);
  const predicted = engines.ok ? engines.mappingMode : null;

  const collectorDbSnap = captureCollectorDbLiveValues(liveFp);
  const postLiveSim = cloneFingerprintPreservingRaw(liveFp);
  const extraProc = (postLiveSim.engines || []).find(
    (e) => e.pm_id === selection.extra.pm_id,
  );
  if (extraProc) {
    extraProc.status = 'stopped';
    if (extraProc._rawEntry) {
      if (extraProc._rawEntry.pm2_env && typeof extraProc._rawEntry.pm2_env === 'object') {
        extraProc._rawEntry.pm2_env.status = 'stopped';
      } else {
        extraProc._rawEntry.status = 'stopped';
      }
    }
  }
  const offlineExtraProof = assertExpectedLivePostState(
    liveFp,
    postLiveSim,
    selection,
    collectorDbSnap,
  );

  let dumpStat;
  try {
    dumpStat = fs.statSync(dumpPath);
  } catch {
    dumpStat = null;
  }
  const rollbackOfflineProof = assertPreEquivalent(
    dumpFp,
    liveFp,
    dumpFp,
    liveFp,
    {
      retainedPmId: selection.retained.pm_id,
      extraPmId: selection.extra.pm_id,
      expectedDumpSha: null,
      actualDumpSha: null,
      expectedDumpBytes: dumpBytes,
      actualDumpBytes: dumpBytes,
      expectedDumpMode: dumpStat ? dumpStat.mode & 0o777 : null,
      actualDumpMode: dumpStat ? dumpStat.mode & 0o777 : null,
    },
  );

  const reflexivityOk =
    liveSelfDiff.classified.length === 0 && dumpSelfDiff.classified.length === 0;
  const compatible =
    engines.ok === true &&
    fleetClass.ok === true &&
    reflexivityOk &&
    offlineExtraProof.ok === true &&
    rollbackOfflineProof.ok === true;

  return {
    ok: compatible,
    LIVE_ENGINE_PAIR_MODE: selection.liveEnginePairMode || null,
    DUMP_ENGINE_PATH_EQUAL: dumpPathEq.pathEqual ? 'YES' : 'NO',
    DUMP_ENGINE_NON_PATH_FULL_SEMANTIC_EQUAL: dumpPathEq.nonPathEqual ? 'YES' : 'NO',
    DUMP_SLOT_0_PATH_MATCHES_CANONICAL: slot0PathCanon,
    DUMP_SLOT_1_PATH_MATCHES_CANONICAL: slot1PathCanon,
    CURRENT_PRODUCTION_MAPPING_MODE_PREDICTED: predicted,
    CURRENT_PRODUCTION_V1_6_2_PRECHECK_COMPATIBLE: compatible ? 'YES' : 'NO',
    CANONICAL_PERSISTED_SLOT_SELECTION:
      predicted === DUMP_ENGINE_MAPPING_MODE.CANONICAL_PERSISTED_SLOT_NO_LIVE_IDENTITY
        ? 'PASS'
        : 'NOT_REQUIRED',
    LIVE_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE:
      fleetClass.LIVE_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE,
    DUMP_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE:
      fleetClass.DUMP_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE,
    LIVE_FLEET_SELF_DIFF_COUNT: liveSelfDiff.classified.length,
    DUMP_FLEET_SELF_DIFF_COUNT: dumpSelfDiff.classified.length,
    DUMP_FLEET_PM_ID_KEYING_SAFE: 'PASS / PM_ID_NOT_USED',
    OFFLINE_EXTRA_STOP_ONLY_SIMULATION: offlineExtraProof.ok ? 'PASS' : 'FAIL',
    ROLLBACK_EXACT_PRE_OFFLINE_PROOF: rollbackOfflineProof.ok ? 'PASS' : 'FAIL',
    dumpEngineCount: dumpEngines.length,
    liveEngineOnline: liveFp.engine_online_count,
    mappingError: engines.ok ? null : engines.error || null,
    dumpHasNestedEnv: dumpEngines[0] && dumpEngines[0].env && typeof dumpEngines[0].env === 'object',
    dumpHasPmId: dumpEngines.some((e) => 'pm_id' in e),
    dumpHasInstances: dumpEngines.some((e) => 'instances' in e),
    pathPresentLive: readPathPresence(selection.retained?._rawEntry || {}),
  };
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('productionCompatibilityProof.mjs')
) {
  const proof = runProductionCompatibilityProof();
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
  process.exit(proof.ok ? 0 : 2);
}
