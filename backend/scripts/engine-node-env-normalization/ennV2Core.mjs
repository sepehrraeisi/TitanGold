/**
 * ENGINE_NODE_ENV_NORMALIZATION V2 — pure/testable core (no live PM2 in unit tests).
 * Numeric pm_id only · EXTRA_ISOLATION_GATE · retained dump row binding.
 */

import { ENGINE_NAME } from '../t2-retry-orchestrator/constants.mjs';
import {
  readApplicationEnvValue,
  resolveRawPm2Entry,
} from '../t2-retry-orchestrator/pm2SemanticModel.mjs';

export const AUTHORIZED_TRANSACTION_V2 = 'ENGINE_NODE_ENV_NORMALIZATION_V2';

/** Allowed keys for sanitized numeric pm2 restart shell (env -i). */
export const SANITIZED_PM2_RESTART_ENV_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'PM2_HOME',
  'PATH',
  'NODE_ENV',
];

export const FORBIDDEN_PM2_FORWARD_PATTERNS = [
  'startOrRestart',
  '--only',
  ENGINE_NAME,
];

const DEFAULT_PATH =
  '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

/**
 * @param {object[]} pm2List
 */
export function listEngineProcesses(pm2List) {
  return (pm2List || []).filter((p) => p.name === ENGINE_NAME);
}

/**
 * Fresh-resolve retained (online) and extra (stopped) by numeric pm_id — never by app name for commands.
 * @param {object[]} pm2List
 */
export function resolveEngineTopology(pm2List) {
  const engines = listEngineProcesses(pm2List);
  if (engines.length !== 2) {
    return { ok: false, error: `ENGINE_ENTRY_COUNT_EXPECTED_2_GOT_${engines.length}` };
  }

  const online = engines.filter((e) => e.pm2_env?.status === 'online');
  const stopped = engines.filter((e) => e.pm2_env?.status === 'stopped');

  if (online.length !== 1) {
    return { ok: false, error: `ENGINE_ONLINE_COUNT_EXPECTED_1_GOT_${online.length}` };
  }
  if (stopped.length !== 1) {
    return { ok: false, error: `ENGINE_STOPPED_COUNT_EXPECTED_1_GOT_${stopped.length}` };
  }

  const retained = online[0];
  const extra = stopped[0];

  if (retained.pm_id == null || extra.pm_id == null) {
    return { ok: false, error: 'ENGINE_PM_ID_MISSING' };
  }

  const retainedPmId = Number(retained.pm_id);
  const extraPmId = Number(extra.pm_id);

  if (!Number.isFinite(retainedPmId) || !Number.isFinite(extraPmId)) {
    return { ok: false, error: 'ENGINE_PM_ID_INVALID' };
  }
  if (retainedPmId === extraPmId) {
    return { ok: false, error: 'ENGINE_PM_ID_COLLISION' };
  }

  return {
    ok: true,
    retained,
    extra,
    retainedPmId,
    extraPmId,
    engines,
  };
}

/**
 * EXTRA_ISOLATION_GATE — extra must stay stopped; retained must stay online.
 * @param {'PRE'|'MID_FORWARD'|'PRE_DUMP'|'POST'} phase
 */
export function assertExtraIsolationGate(pm2List, { extraPmId, retainedPmId }, phase = 'PRE') {
  const engines = listEngineProcesses(pm2List);
  const extra = engines.find((e) => Number(e.pm_id) === Number(extraPmId));
  const retained = engines.find((e) => Number(e.pm_id) === Number(retainedPmId));

  if (!extra || !retained) {
    return { ok: false, error: 'EXTRA_ISOLATION_GATE_IDENTITY_MISSING', phase };
  }
  if (retained.pm2_env?.status !== 'online') {
    return { ok: false, error: 'EXTRA_ISOLATION_GATE_RETAINED_NOT_ONLINE', phase };
  }
  if (extra.pm2_env?.status === 'online') {
    return { ok: false, error: 'EXTRA_ISOLATION_GATE_EXTRA_BECAME_ONLINE', phase };
  }
  if (extra.pm2_env?.status !== 'stopped') {
    return { ok: false, error: 'EXTRA_ISOLATION_GATE_EXTRA_NOT_STOPPED', phase };
  }

  const onlineCount = engines.filter((e) => e.pm2_env?.status === 'online').length;
  if (onlineCount !== 1) {
    return { ok: false, error: `EXTRA_ISOLATION_GATE_ENGINE_ONLINE_COUNT_${onlineCount}`, phase };
  }

  return { ok: true, phase };
}

/**
 * Build env -i shell environment for numeric pm2 restart (bounded keys only).
 */
export function buildSanitizedPm2RestartEnv({
  nodeEnv,
  home,
  user,
  logname,
  pm2Home = '/home/ubuntu/.pm2',
  path = DEFAULT_PATH,
}) {
  return {
    HOME: home,
    USER: user,
    LOGNAME: logname ?? user,
    PM2_HOME: pm2Home,
    PATH: path,
    NODE_ENV: nodeEnv,
  };
}

export function assertSanitizedRestartEnvKeys(env) {
  const keys = Object.keys(env || {}).sort();
  const expected = [...SANITIZED_PM2_RESTART_ENV_KEYS].sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    return { ok: false, error: 'SANITIZED_RESTART_ENV_KEYSET_INVALID', keys };
  }
  return { ok: true };
}

/**
 * Describe numeric-only restart (tests + executor guard). Never uses app name.
 */
export function buildNumericPm2RestartSpec(pmId, nodeEnv) {
  const id = Number(pmId);
  if (!Number.isFinite(id)) {
    return { ok: false, error: 'PM_ID_NUMERIC_REQUIRED' };
  }
  const args = ['restart', String(id), '--update-env'];
  const joined = `pm2 ${args.join(' ')}`;
  for (const forbidden of FORBIDDEN_PM2_FORWARD_PATTERNS) {
    if (joined.includes(forbidden)) {
      return { ok: false, error: 'FORBIDDEN_PM2_PATTERN_IN_RESTART_SPEC' };
    }
  }
  return {
    ok: true,
    command: 'pm2',
    args,
    pmIdNumeric: id,
    nodeEnv,
    usesNameTargeting: false,
  };
}

export function pathEqualDumpLiveEntry(dumpEntry, liveProc) {
  const liveRaw = resolveRawPm2Entry(liveProc);
  const a = readApplicationEnvValue(dumpEntry, 'PATH');
  const b = readApplicationEnvValue(liveRaw, 'PATH');
  if (!a.present && !b.present) return true;
  if (!a.present || !b.present) return false;
  return String(a.value) === String(b.value);
}

function getDumpEngineEntries(dump) {
  const entries = Array.isArray(dump) ? dump : dump.apps || [];
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (entry.name || entry.pm2_env?.name) === ENGINE_NAME);
}

/**
 * Bind NODE_ENV projection to retained online dump row with PATH semantic match to live retained.
 * Never selects stopped extra row.
 */
export function resolveRetainedDumpRowBinding(dump, retainedLiveProc, { canonicalPath = null } = {}) {
  const dumpEngines = getDumpEngineEntries(dump);
  if (dumpEngines.length !== 2) {
    return { ok: false, error: 'DUMP_ENGINE_ROW_COUNT_MISMATCH' };
  }

  const onlineRows = dumpEngines.filter(
    ({ entry }) => (entry.status || entry.pm2_env?.status) === 'online',
  );
  const stoppedRows = dumpEngines.filter(
    ({ entry }) => (entry.status || entry.pm2_env?.status) === 'stopped',
  );

  if (onlineRows.length !== 1) {
    return { ok: false, error: 'DUMP_ONLINE_ROW_COUNT_MISMATCH' };
  }

  const pathMatches = dumpEngines.filter(({ entry }) => {
    const status = entry.status || entry.pm2_env?.status;
    if (status !== 'online') return false;
    return pathEqualDumpLiveEntry(entry, retainedLiveProc);
  });

  if (pathMatches.length !== 1) {
    return { ok: false, error: 'DUMP_RETAINED_ROW_PATH_BINDING_AMBIGUOUS' };
  }

  const retainedDumpIndex = pathMatches[0].index;
  const extraCandidates = dumpEngines.filter(({ index }) => index !== retainedDumpIndex);
  if (extraCandidates.length !== 1) {
    return { ok: false, error: 'DUMP_EXTRA_ROW_BINDING_AMBIGUOUS' };
  }

  const extraDumpIndex = extraCandidates[0].index;
  const extraStatus =
    extraCandidates[0].entry.status || extraCandidates[0].entry.pm2_env?.status;

  if (canonicalPath != null) {
    const rowPath = readApplicationEnvValue(pathMatches[0].entry, 'PATH');
    if (!rowPath.present || String(rowPath.value) !== String(canonicalPath)) {
      return { ok: false, error: 'DUMP_RETAINED_ROW_CANONICAL_PATH_MISMATCH' };
    }
  }

  return {
    ok: true,
    retainedDumpIndex,
    extraDumpIndex,
    onlineRowCount: onlineRows.length,
    stoppedRowCount: stoppedRows.length,
    extraDumpStatus: extraStatus,
  };
}

function setNodeEnvLeaves(entry, targetValue, counters) {
  const touch = (container) => {
    if (!container || typeof container !== 'object') return;
    if (container.NODE_ENV !== undefined && container.NODE_ENV !== targetValue) {
      container.NODE_ENV = targetValue;
      counters.leaves += 1;
    } else if (container.NODE_ENV === undefined) {
      container.NODE_ENV = targetValue;
      counters.leaves += 1;
    }
  };

  touch(entry);
  if (entry.pm2_env?.env) touch(entry.pm2_env.env);
  if (entry.env && !Array.isArray(entry.env)) touch(entry.env);
}

/**
 * Project NODE_ENV to retained online row only; extra/stopped row bytes must remain unchanged.
 */
export function projectDumpNodeEnvRetainedOnly(dump, binding, targetValue = 'production') {
  if (!binding?.ok) {
    throw new Error('PROJECT_DUMP_BINDING_INVALID');
  }

  const clone = JSON.parse(JSON.stringify(dump));
  const entries = Array.isArray(clone) ? clone : clone.apps || [];
  const { retainedDumpIndex, extraDumpIndex } = binding;

  const retainedEntry = entries[retainedDumpIndex];
  const status = retainedEntry.status || retainedEntry.pm2_env?.status;
  if (status !== 'online') {
    throw new Error('PROJECT_DUMP_RETAINED_NOT_ONLINE');
  }

  const extraBefore = JSON.stringify(entries[extraDumpIndex]);
  const counters = { leaves: 0 };
  setNodeEnvLeaves(retainedEntry, targetValue, counters);

  const extraAfter = JSON.stringify(entries[extraDumpIndex]);
  if (extraBefore !== extraAfter) {
    throw new Error('PROJECT_DUMP_EXTRA_ROW_TOUCHED');
  }

  if (counters.leaves === 0) throw new Error('PROJECTED_DIFF_ZERO');
  if (counters.leaves > 3) throw new Error('PROJECTED_DIFF_TOO_WIDE');

  return {
    bytes: Buffer.from(JSON.stringify(clone), 'utf8'),
    changedLeafCount: counters.leaves,
    retainedDumpIndex,
    extraDumpIndex,
    extraRowUntouched: true,
  };
}
