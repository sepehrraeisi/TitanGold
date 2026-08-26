/**
 * Pure sanitized dump target construction for T2 dump sanitizer.
 * Base = exact CLEAN_PRE clone + only five collector DB_* from CURRENT dump.
 */

import {
  COLLECTOR_DB_KEYS,
  EXPECTED_COLLECTOR_DB_USER,
  PROVIDER_ENV_KEY_RE,
  SESSION_IDE_ENV_KEYS,
} from './constants.mjs';
import {
  resolveDumpCollectorIdentity,
  resolveDumpEnvMutationTarget,
  structuralDiffPaths,
} from '../t2-retry-orchestrator/projection.mjs';
import { extractProcessEnvResult } from '../t2-retry-orchestrator/semantics.mjs';

function deepCloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function scalarPresent(v) {
  return v != null && String(v).length > 0;
}

function scalarEnvValue(v) {
  if (v == null) return null;
  if (typeof v === 'object') return null;
  return String(v);
}

/**
 * Build sanitized target dump from CLEAN_PRE + CURRENT five DB_* only.
 *
 * @param {object} args
 * @param {Array} args.cleanPreDump
 * @param {Array} args.currentDump
 * @param {Record<string,string>} args.liveCollectorDb
 */
export function buildSanitizedTarget({ cleanPreDump, currentDump, liveCollectorDb }) {
  if (!Array.isArray(cleanPreDump) || !Array.isArray(currentDump)) {
    return { ok: false, error: 'SANITIZE_DUMP_INVALID' };
  }
  if (!liveCollectorDb || typeof liveCollectorDb !== 'object') {
    return { ok: false, error: 'LIVE_COLLECTOR_DB_MISSING' };
  }

  const collectorClean = resolveDumpCollectorIdentity(cleanPreDump);
  const collectorCurrent = resolveDumpCollectorIdentity(currentDump);
  if (!collectorClean.ok || !collectorCurrent.ok) {
    return { ok: false, error: 'DUMP_COLLECTOR_IDENTITY_UNRESOLVED' };
  }
  if (collectorClean.dumpIndex !== collectorCurrent.dumpIndex) {
    return { ok: false, error: 'SANITIZE_COLLECTOR_INDEX_DRIFT' };
  }

  const idx = collectorCurrent.dumpIndex;
  const currentMut = resolveDumpEnvMutationTarget(currentDump[idx]);
  const cleanMut = resolveDumpEnvMutationTarget(cleanPreDump[idx]);
  if (!currentMut.ok || !cleanMut.ok) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }

  /** @type {Record<string, 'YES'|'NO'>} */
  const dbMatches = {};
  for (const key of COLLECTOR_DB_KEYS) {
    const liveVal = liveCollectorDb[key];
    const dumpVal = scalarEnvValue(currentMut.container[key]);
    const equal =
      scalarPresent(liveVal) && scalarPresent(dumpVal) && String(liveVal) === String(dumpVal);
    dbMatches[`${key}_DUMP_LIVE_MATCH`] = equal ? 'YES' : 'NO';
    if (!equal) {
      return {
        ok: false,
        error: 'COLLECTOR_DB_DUMP_LIVE_MISMATCH',
        matches: dbMatches,
      };
    }
  }
  if (String(liveCollectorDb.DB_USER) !== EXPECTED_COLLECTOR_DB_USER) {
    dbMatches.DB_USER_MATCH = 'NO';
    return { ok: false, error: 'COLLECTOR_DB_USER_UNEXPECTED', matches: dbMatches };
  }
  dbMatches.DB_USER_MATCH = 'YES';

  const sanitized = deepCloneJson(cleanPreDump);
  const targetMut = resolveDumpEnvMutationTarget(sanitized[idx]);
  if (!targetMut.ok) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }

  for (const key of COLLECTOR_DB_KEYS) {
    targetMut.container[key] = currentMut.container[key];
  }

  const diffPaths = structuralDiffPaths(cleanPreDump, sanitized);
  const allowed = new Set();
  for (const key of COLLECTOR_DB_KEYS) {
    allowed.add(`[${idx}].${key}`);
    allowed.add(`[${idx}].env.${key}`);
    allowed.add(`[${idx}].pm2_env.env.${key}`);
  }
  const unexpected = diffPaths.filter((p) => !allowed.has(p));
  if (unexpected.length > 0) {
    return {
      ok: false,
      error: 'SANITIZE_UNEXPECTED_DIFF',
      unexpectedCount: unexpected.length,
    };
  }
  if (diffPaths.length !== COLLECTOR_DB_KEYS.length) {
    return {
      ok: false,
      error: 'SANITIZE_DB_DIFF_COUNT_UNEXPECTED',
      diffCount: diffPaths.length,
    };
  }

  const currentEnv = extractProcessEnvResult(currentDump[idx]);
  const targetEnv = extractProcessEnvResult(sanitized[idx]);
  const cleanEnv = extractProcessEnvResult(cleanPreDump[idx]);
  if (!currentEnv.ok || !targetEnv.ok || !cleanEnv.ok) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }

  const jwtClean = cleanEnv.env.JWT_SECRET;
  const jwtTarget = targetEnv.env.JWT_SECRET;
  const jwtCurrent = currentEnv.env.JWT_SECRET;
  const jwtRestored =
    (!scalarPresent(jwtClean) && !scalarPresent(jwtTarget)) ||
    (scalarPresent(jwtClean) && scalarPresent(jwtTarget) && jwtClean === jwtTarget);
  if (!jwtRestored) {
    return { ok: false, error: 'JWT_SECRET_NOT_RESTORED_TO_CLEAN_PRE' };
  }
  if (scalarPresent(jwtCurrent) && scalarPresent(jwtTarget) && jwtCurrent !== jwtTarget) {
    // Proves LIVE/current JWT drift is NOT copied into target.
  } else if (scalarPresent(jwtCurrent) && jwtCurrent === jwtTarget && jwtCurrent !== jwtClean) {
    return { ok: false, error: 'JWT_SECRET_LIVE_DRIFT_COPIED' };
  }

  for (const key of [...SESSION_IDE_ENV_KEYS, 'PATH', 'prev_restart_delay']) {
    const a = cleanEnv.env[key];
    const b = targetEnv.env[key];
    const c = currentEnv.env[key];
    const aHas = scalarPresent(a);
    const bHas = scalarPresent(b);
    if (aHas !== bHas || (aHas && a !== b)) {
      return { ok: false, error: 'SESSION_OR_IDE_ENV_NOT_RESTORED_TO_CLEAN_PRE', keyClass: key };
    }
    if (!aHas && scalarPresent(c)) {
      // current had live-only key; target must not have it
      if (bHas) {
        return { ok: false, error: 'LIVE_ONLY_ENV_COPIED', keyClass: key };
      }
    }
  }

  for (const key of Object.keys(currentEnv.env)) {
    if (COLLECTOR_DB_KEYS.includes(key)) continue;
    if (key === 'JWT_SECRET') continue;
    if (SESSION_IDE_ENV_KEYS.includes(key) || key === 'PATH' || key === 'prev_restart_delay') {
      continue;
    }
    const cleanHas = scalarPresent(cleanEnv.env[key]);
    const targetHas = scalarPresent(targetEnv.env[key]);
    const currentHas = scalarPresent(currentEnv.env[key]);
    if (!cleanHas && currentHas && targetHas) {
      if (PROVIDER_ENV_KEY_RE.test(key) || key.includes('TOKEN') || key.includes('SECRET')) {
        return { ok: false, error: 'UNAUTHORIZED_ENV_COPIED', keyClass: key };
      }
      return { ok: false, error: 'UNAUTHORIZED_ENV_COPIED', keyClass: key };
    }
  }

  const bytes = Buffer.from(JSON.stringify(sanitized), 'utf8');

  return {
    ok: true,
    sanitized,
    bytes,
    collectorDumpIndex: idx,
    manifest: {
      SANITIZE_TARGET_PROOF: 'PASS',
      COLLECTOR_DB_KEYS_COPIED: COLLECTOR_DB_KEYS.length,
      JWT_SECRET_RESTORED_TO_CLEAN_PRE: 'PASS',
      SESSION_ENV_RESTORED_TO_CLEAN_PRE: 'PASS',
      IDE_ENV_RESTORED_TO_CLEAN_PRE: 'PASS',
      PM2_LIVE_ONLY_METADATA_REMOVED: 'PASS',
      PROVIDER_ENV_NOT_COPIED: 'PASS',
      AUTHORIZED_DIFF_PATH_COUNT: COLLECTOR_DB_KEYS.length,
      TARGET_DUMP_MODE_REQUIRED: '0600',
      ...dbMatches,
    },
  };
}
