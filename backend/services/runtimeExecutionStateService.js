/**
 * Shared runtime execution state — restart-safe, multi-process SSOT.
 *
 * Persistent store: system_settings key `global_execution_runtime`
 * Fast cross-process read: Redis key `titan:runtime:execution_state` (DB is authoritative)
 *
 * Concerns separated:
 * - deploymentEnabled: env TRADING_ENGINE_ENABLED / SCHEDULER_ENABLED (not stored here)
 * - globalRuntimeMode: demo | live (worker/API shared)
 * - killSwitchActive: emergency stop across processes
 */

import { query } from '../database/db.js';
import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const RUNTIME_SETTING_KEY = 'global_execution_runtime';
export const REDIS_RUNTIME_KEY = 'titan:runtime:execution_state';
const REDIS_TTL_SECONDS = 30;

const DEFAULT_STATE = Object.freeze({
  globalMode: 'demo',
  killSwitchActive: false,
  killSwitchReason: null,
  killSwitchAt: null,
  killSwitchByUserId: null,
  updatedAt: null,
  updatedByUserId: null,
});

function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'live') return 'live';
  return 'demo';
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
    updatedAt: raw.updatedAt ?? null,
    updatedByUserId: raw.updatedByUserId ?? null,
  };
}

async function readFromDb() {
  const result = await query(
    'SELECT value, updated_at FROM system_settings WHERE key = $1 LIMIT 1',
    [RUNTIME_SETTING_KEY],
  );
  if (result.rows.length === 0) {
    return { ...DEFAULT_STATE };
  }
  const value = result.rows[0].value;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const state = mapState(parsed);
  state.updatedAt = state.updatedAt || result.rows[0].updated_at?.toISOString?.() || null;
  return state;
}

async function writeToDb(state) {
  const payload = {
    globalMode: normalizeMode(state.globalMode),
    killSwitchActive: state.killSwitchActive === true,
    killSwitchReason: state.killSwitchReason ?? null,
    killSwitchAt: state.killSwitchAt ?? null,
    killSwitchByUserId: state.killSwitchByUserId ?? null,
    updatedAt: new Date().toISOString(),
    updatedByUserId: state.updatedByUserId ?? null,
  };
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

export async function getRuntimeExecutionState({ preferCache = true } = {}) {
  if (preferCache) {
    const cached = await readCachedState();
    if (cached) return cached;
  }
  const state = await readFromDb();
  await cacheState(state);
  return state;
}

export async function setGlobalRuntimeMode(mode, { userId = null } = {}) {
  const current = await readFromDb();
  const next = {
    ...current,
    globalMode: normalizeMode(mode),
    updatedByUserId: userId,
  };
  const saved = await writeToDb(next);
  await cacheState(saved);
  return saved;
}

export async function activateKillSwitch(reason, { userId = null } = {}) {
  const current = await readFromDb();
  const next = {
    ...current,
    killSwitchActive: true,
    killSwitchReason: reason || 'manual',
    killSwitchAt: new Date().toISOString(),
    killSwitchByUserId: userId,
    updatedByUserId: userId,
  };
  const saved = await writeToDb(next);
  await cacheState(saved);
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
  const current = await readFromDb();
  const next = {
    ...current,
    killSwitchActive: false,
    killSwitchReason: null,
    killSwitchAt: null,
    killSwitchByUserId: null,
    updatedByUserId: userId,
  };
  const saved = await writeToDb(next);
  await cacheState(saved);
  logger.info('✅ Kill switch cleared');
  return saved;
}

export function isDeploymentEngineEnabled() {
  return String(process.env.TRADING_ENGINE_ENABLED || '').toLowerCase() === 'true';
}

export function isSchedulerDeploymentEnabled() {
  return String(process.env.SCHEDULER_ENABLED || '').toLowerCase() === 'true';
}

export async function isKillSwitchActive() {
  const state = await getRuntimeExecutionState();
  return state.killSwitchActive === true;
}

export async function getEffectiveGlobalMode() {
  const state = await getRuntimeExecutionState();
  if (state.killSwitchActive) return 'demo';
  return normalizeMode(state.globalMode);
}
