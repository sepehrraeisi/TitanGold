/**
 * Shared runtime execution state — restart-safe, multi-process SSOT.
 *
 * Authoritative: PostgreSQL system_settings.global_execution_runtime
 * Cache/propagation: Redis key + pub/sub channel (NOT authoritative)
 */

import { query } from '../database/db.js';
import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const RUNTIME_SETTING_KEY = 'global_execution_runtime';
export const REDIS_RUNTIME_KEY = 'titan:runtime:execution_state';
export const REDIS_RUNTIME_CHANNEL = 'titan:runtime:events';
const REDIS_TTL_SECONDS = 60;

const DEFAULT_STATE = Object.freeze({
  globalMode: 'demo',
  killSwitchActive: true,
  killSwitchReason: 'safety_freeze_default',
  killSwitchAt: null,
  killSwitchByUserId: null,
  version: 1,
  workerAckRevision: null,
  workerAckAt: null,
  workerAckPid: null,
  workerAckHost: null,
  updatedAt: null,
  updatedByUserId: null,
});

function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase();
  return m === 'live' ? 'live' : 'demo';
}

function mapState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE };
  }
  return {
    globalMode: normalizeMode(raw.globalMode ?? raw.mode),
    killSwitchActive: raw.killSwitchActive === true,
    killSwitchReason: raw.killSwitchReason ?? null,
    killSwitchAt: raw.killSwitchAt ?? null,
    killSwitchByUserId: raw.killSwitchByUserId ?? null,
    version: Number(raw.version) || 1,
    workerAckRevision: raw.workerAckRevision ?? null,
    workerAckAt: raw.workerAckAt ?? null,
    workerAckPid: raw.workerAckPid ?? null,
    workerAckHost: raw.workerAckHost ?? null,
    updatedAt: raw.updatedAt ?? null,
    updatedByUserId: raw.updatedByUserId ?? null,
  };
}

function serializeState(state) {
  return {
    globalMode: normalizeMode(state.globalMode),
    killSwitchActive: state.killSwitchActive === true,
    killSwitchReason: state.killSwitchReason ?? null,
    killSwitchAt: state.killSwitchAt ?? null,
    killSwitchByUserId: state.killSwitchByUserId ?? null,
    version: Number(state.version) || 1,
    workerAckRevision: state.workerAckRevision ?? null,
    workerAckAt: state.workerAckAt ?? null,
    workerAckPid: state.workerAckPid ?? null,
    workerAckHost: state.workerAckHost ?? null,
    updatedAt: state.updatedAt || new Date().toISOString(),
    updatedByUserId: state.updatedByUserId ?? null,
  };
}

async function readFromDb() {
  const result = await query(
    'SELECT value, updated_at FROM system_settings WHERE key = $1 LIMIT 1',
    [RUNTIME_SETTING_KEY],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const value = result.rows[0].value;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const state = mapState(parsed);
  state.updatedAt = state.updatedAt || result.rows[0].updated_at?.toISOString?.() || null;
  return state;
}

async function writeToDb(state) {
  const payload = serializeState(state);
  await query(
    `INSERT INTO system_settings (key, value, description, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [
      RUNTIME_SETTING_KEY,
      JSON.stringify(payload),
      'Shared global execution runtime mode and kill switch (multi-process SSOT)',
    ],
  );
  return payload;
}

async function publishRuntimeEvent(eventType, state) {
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    const message = JSON.stringify({ type: eventType, state, at: new Date().toISOString() });
    await client.publish(REDIS_RUNTIME_CHANNEL, message);
  } catch (err) {
    logger.warn('Runtime pub/sub publish failed:', err.message);
  }
}

async function cacheState(state) {
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    await client.setEx(REDIS_RUNTIME_KEY, REDIS_TTL_SECONDS, JSON.stringify(state));
  } catch (err) {
    logger.warn('Runtime state Redis cache write failed:', err.message);
  }
}

async function readCachedState() {
  if (!isRedisAvailable()) return null;
  try {
    const client = await getRedisClient();
    const raw = await client.get(REDIS_RUNTIME_KEY);
    if (!raw) return null;
    return mapState(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persist safe default if missing — global demo + kill switch active */
export async function ensureDefaultRuntimeState() {
  const existing = await readFromDb();
  if (existing) {
    await cacheState(existing);
    return existing;
  }
  const initial = serializeState({
    ...DEFAULT_STATE,
    killSwitchActive: true,
    killSwitchReason: 'initial_safety_default',
    killSwitchAt: new Date().toISOString(),
    version: 1,
  });
  const saved = await writeToDb(initial);
  await cacheState(saved);
  await publishRuntimeEvent('runtime.initialized', saved);
  logger.info('✅ Initialized global_execution_runtime with safe defaults (demo + kill switch)');
  return saved;
}

export async function getRuntimeExecutionState({ preferCache = false } = {}) {
  const dbState = await readFromDb();
  if (!dbState) {
    return ensureDefaultRuntimeState();
  }

  if (preferCache) {
    const cached = await readCachedState();
    if (cached && cached.version === dbState.version) {
      if (
        cached.killSwitchActive !== dbState.killSwitchActive
        || normalizeMode(cached.globalMode) !== normalizeMode(dbState.globalMode)
      ) {
        await cacheState(dbState);
        return dbState;
      }
      return cached;
    }
  }

  await cacheState(dbState);
  return dbState;
}

async function mutateState(mutator, eventType) {
  const current = await getRuntimeExecutionState({ preferCache: false });
  const next = mutator({ ...current, version: (current.version || 1) + 1 });
  const saved = await writeToDb(next);
  await cacheState(saved);
  await publishRuntimeEvent(eventType, saved);
  return saved;
}

export async function setGlobalRuntimeMode(mode, { userId = null } = {}) {
  if (normalizeMode(mode) === 'live') {
    const err = new Error('Global live mode requires explicit admin confirmation via dedicated endpoint');
    err.status = 403;
    err.code = 'GLOBAL_LIVE_REQUIRES_CONFIRMATION';
    throw err;
  }
  return mutateState(
    (current) => ({
      ...current,
      globalMode: normalizeMode(mode),
      updatedByUserId: userId,
      workerAckRevision: null,
      workerAckAt: null,
    }),
    'runtime.mode_changed',
  );
}

export async function activateKillSwitch(reason, { userId = null } = {}) {
  const saved = await mutateState(
    (current) => ({
      ...current,
      killSwitchActive: true,
      killSwitchReason: reason || 'manual',
      killSwitchAt: new Date().toISOString(),
      killSwitchByUserId: userId,
      updatedByUserId: userId,
      workerAckRevision: null,
      workerAckAt: null,
    }),
    'runtime.kill_switch_activated',
  );
  logger.warn(`🛑 Kill switch activated: ${saved.killSwitchReason}`);
  return saved;
}

export async function clearKillSwitch({ userId = null, confirm = false } = {}) {
  if (!confirm) {
    const err = new Error('confirm_clear_kill_switch must be true');
    err.status = 400;
    err.code = 'CONFIRMATION_REQUIRED';
    throw err;
  }
  return mutateState(
    (current) => ({
      ...current,
      killSwitchActive: false,
      killSwitchReason: null,
      killSwitchAt: null,
      killSwitchByUserId: null,
      updatedByUserId: userId,
      globalMode: 'demo',
      workerAckRevision: null,
      workerAckAt: null,
    }),
    'runtime.kill_switch_cleared',
  );
}

export async function acknowledgeWorkerState({ revision, pid = process.pid, host = process.env.HOSTNAME || 'worker' } = {}) {
  const current = await getRuntimeExecutionState({ preferCache: false });
  if (revision != null && current.version !== revision) {
    return { acknowledged: false, reason: 'revision_mismatch', currentVersion: current.version };
  }
  const saved = await writeToDb({
    ...current,
    workerAckRevision: current.version,
    workerAckAt: new Date().toISOString(),
    workerAckPid: pid,
    workerAckHost: host,
  });
  await cacheState(saved);
  return { acknowledged: true, state: saved };
}

export function isDeploymentEngineEnabled() {
  return String(process.env.TRADING_ENGINE_ENABLED || '').toLowerCase() === 'true';
}

export function isSchedulerDeploymentEnabled() {
  return String(process.env.SCHEDULER_ENABLED || '').toLowerCase() === 'true';
}

export async function isKillSwitchActive() {
  const state = await getRuntimeExecutionState({ preferCache: false });
  return state.killSwitchActive === true;
}

export async function getEffectiveGlobalMode() {
  const state = await getRuntimeExecutionState({ preferCache: false });
  if (state.killSwitchActive) return 'demo';
  return normalizeMode(state.globalMode);
}

export async function subscribeRuntimeEvents(handler) {
  if (!isRedisAvailable()) {
    try {
      await getRedisClient();
    } catch {
      return null;
    }
  }
  try {
    const client = await getRedisClient();
    const subscriber = client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(REDIS_RUNTIME_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message);
        handler(parsed);
      } catch (err) {
        logger.warn('Invalid runtime pub/sub message:', err.message);
      }
    });
    return subscriber;
  } catch (err) {
    logger.warn('Runtime pub/sub subscribe failed:', err.message);
    return null;
  }
}

export function buildRuntimeView(state, { requestedMode = 'demo', providerConnected = false } = {}) {
  const effectiveMode = state.killSwitchActive ? 'demo' : normalizeMode(state.globalMode);
  const workerAcknowledged =
    state.workerAckRevision != null &&
    state.workerAckRevision === state.version &&
    state.workerAckAt != null;

  return {
    requestedMode,
    effectiveMode,
    globalRuntimeMode: normalizeMode(state.globalMode),
    killSwitchActive: state.killSwitchActive === true,
    killSwitchReason: state.killSwitchReason,
    deploymentEngineEnabled: isDeploymentEngineEnabled(),
    providerConnected,
    workerAcknowledged,
    workerAckAt: state.workerAckAt,
    workerAckRevision: state.workerAckRevision,
    stateVersion: state.version,
    updatedAt: state.updatedAt,
  };
}
