/**
 * Sanitized PRE baseline proof for T2 v1.6.0.
 * PRE dump must equal CLEAN_PRE + exact five collector DB_* only.
 */

import { COLLECTOR_DB_KEYS, SESSION_IDE_ENV_KEYS } from './constants.mjs';
import {
  resolveDumpCollectorIdentity,
  resolveDumpEnvMutationTarget,
  structuralDiffPaths,
} from './projection.mjs';

function scalarPresent(v) {
  return v != null && String(v).length > 0;
}

/**
 * Prove PRE dump == CLEAN_PRE + exact five DB_* only (secret-safe; no values returned).
 * Does NOT claim CLEAN_PRE JWT equals live JWT.
 */
export function assertSanitizedPreBaselineProof({
  cleanPreDump,
  activePreDump,
  expectedCleanPreSha,
  actualCleanPreSha,
  expectedActiveDumpSha,
  actualActiveDumpSha,
}) {
  if (!expectedCleanPreSha || !actualCleanPreSha || expectedCleanPreSha !== actualCleanPreSha) {
    return { ok: false, error: 'CLEAN_PRE_SHA_MISMATCH' };
  }
  if (!expectedActiveDumpSha) {
    return { ok: false, error: 'EXPECTED_ACTIVE_DUMP_SHA_REQUIRED' };
  }
  if (!actualActiveDumpSha || expectedActiveDumpSha !== actualActiveDumpSha) {
    return { ok: false, error: 'ACTIVE_DUMP_SHA_MISMATCH' };
  }
  if (!Array.isArray(cleanPreDump) || !Array.isArray(activePreDump)) {
    return { ok: false, error: 'SANITIZED_PRE_DUMP_INVALID' };
  }

  const collectorClean = resolveDumpCollectorIdentity(cleanPreDump);
  const collectorActive = resolveDumpCollectorIdentity(activePreDump);
  if (!collectorClean.ok || !collectorActive.ok) {
    return { ok: false, error: 'DUMP_COLLECTOR_IDENTITY_UNRESOLVED' };
  }
  if (collectorClean.dumpIndex !== collectorActive.dumpIndex) {
    return { ok: false, error: 'SANITIZED_PRE_COLLECTOR_INDEX_DRIFT' };
  }

  const diffs = structuralDiffPaths(cleanPreDump, activePreDump);
  const idx = collectorActive.dumpIndex;
  const allowed = new Set();
  for (const key of COLLECTOR_DB_KEYS) {
    allowed.add(`[${idx}].${key}`);
    allowed.add(`[${idx}].env.${key}`);
    allowed.add(`[${idx}].pm2_env.env.${key}`);
  }
  const unexpected = diffs.filter((p) => !allowed.has(p));
  if (unexpected.length > 0) {
    return {
      ok: false,
      error: 'SANITIZED_PRE_UNAUTHORIZED_DRIFT',
      unexpectedCount: unexpected.length,
    };
  }
  if (diffs.length !== COLLECTOR_DB_KEYS.length) {
    return {
      ok: false,
      error: 'SANITIZED_PRE_DB_DIFF_COUNT_UNEXPECTED',
      unexpectedCount: diffs.length,
    };
  }

  const cleanMut = resolveDumpEnvMutationTarget(cleanPreDump[idx]);
  const activeMut = resolveDumpEnvMutationTarget(activePreDump[idx]);
  if (!cleanMut.ok || !activeMut.ok) {
    return { ok: false, error: 'DUMP_ENV_SHAPE_UNSUPPORTED' };
  }

  for (const key of COLLECTOR_DB_KEYS) {
    if (scalarPresent(cleanMut.container[key])) {
      return { ok: false, error: 'CLEAN_PRE_ALREADY_HAS_COLLECTOR_DB' };
    }
    if (!scalarPresent(activeMut.container[key])) {
      return { ok: false, error: 'SANITIZED_PRE_DB_INCOMPLETE' };
    }
  }

  const jwtClean = cleanMut.container.JWT_SECRET;
  const jwtActive = activeMut.container.JWT_SECRET;
  const jwtRestored =
    (!scalarPresent(jwtClean) && !scalarPresent(jwtActive)) ||
    (scalarPresent(jwtClean) && scalarPresent(jwtActive) && jwtClean === jwtActive);
  if (!jwtRestored) {
    return { ok: false, error: 'JWT_SECRET_NOT_RESTORED_TO_CLEAN_PRE' };
  }

  for (const key of [...SESSION_IDE_ENV_KEYS, 'PATH', 'prev_restart_delay']) {
    const a = cleanMut.container[key];
    const b = activeMut.container[key];
    const aHas = scalarPresent(a);
    const bHas = scalarPresent(b);
    if (aHas !== bHas || (aHas && a !== b)) {
      return { ok: false, error: 'SESSION_OR_IDE_ENV_NOT_RESTORED_TO_CLEAN_PRE', keyClass: key };
    }
  }

  return {
    ok: true,
    SANITIZED_PRE_BASELINE_PROOF: 'PASS',
    JWT_SECRET_RESTORED_TO_CLEAN_PRE: 'PASS',
    SESSION_ENV_RESTORED_TO_CLEAN_PRE: 'PASS',
    IDE_ENV_RESTORED_TO_CLEAN_PRE: 'PASS',
    PM2_LIVE_ONLY_METADATA_REMOVED: 'PASS',
    COLLECTOR_DB_B_PRESERVED_EXACT: 'PASS',
    UNRELATED_LIVE_DUMP_DRIFT_INTENTIONALLY_NOT_RECONCILED: 'YES',
  };
}
