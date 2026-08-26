/**
 * Dump resurrect semantic comparison — thin adapter over canonical pm2SemanticModel.
 * Exhaustive fail-closed field classification is enforced in compareEnginePm2Semantics.
 */

import {
  RESURRECT_IGNORED_FIELDS,
  RESURRECT_TOP_LEVEL_FIELDS,
  compareEnginePm2Semantics,
  assertZeroUnclassifiedPersistedFields,
} from './pm2SemanticModel.mjs';

export {
  RESURRECT_IGNORED_FIELDS,
  RESURRECT_TOP_LEVEL_FIELDS,
  assertZeroUnclassifiedPersistedFields,
};

/**
 * Compare two dump engine records for PM2 6.0.13 resurrect semantic equivalence.
 * Never returns env/PATH values — only categorical PASS/FAIL + field categories.
 */
export function compareDumpEngineResurrectSemantics(a, b) {
  return compareEnginePm2Semantics(a, b, { requireClassified: true });
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
  const aSans = { ...a, status: 'online' };
  const bSans = { ...b, status: 'online' };
  const cmp = compareDumpEngineResurrectSemantics(aSans, bSans);
  if (!cmp.ok) {
    return {
      ok: false,
      SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'FAIL',
      mismatchCategories: cmp.mismatchCategories,
      error: cmp.error,
    };
  }
  return { ok: true, SYMMETRIC_PROJECTED_DUMP_RESURRECT_COMPATIBILITY: 'PASS' };
}
