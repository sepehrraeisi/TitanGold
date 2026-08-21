import { query } from '../database/db.js';
import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const TRANSFER_HEARTBEAT_KEY = 'pipeline:scheduler:heartbeat:transfer';
export const NORMALIZATION_HEARTBEAT_KEY = 'pipeline:scheduler:heartbeat:normalization';
/** Layer A — diagnostic only; never execution entitlement. */
export const TELEGRAM_LIFECYCLE_KEY = 'pipeline:scheduler:lifecycle:telegram';
const HEARTBEAT_TTL_SEC = 7200;
const LIFECYCLE_TTL_SEC = 7200;
/** Allow scheduler ticks to slip ~2.5× before treating as stopped. */
export const SCHEDULER_FRESHNESS_GRACE = 2.5;

export const TELEGRAM_LIFECYCLE_OUTCOMES = Object.freeze({
  ARMED: 'ARMED',
  TICK_SUCCESS: 'TICK_SUCCESS',
  TICK_NOOP_SELECTED_ZERO: 'TICK_NOOP_SELECTED_ZERO',
  TICK_SKIP_IN_MEMORY: 'TICK_SKIP_IN_MEMORY',
  TICK_SKIP_ADVISORY_LOCK: 'TICK_SKIP_ADVISORY_LOCK',
  TICK_ERROR: 'TICK_ERROR',
  DISABLED: 'DISABLED',
  STOPPED: 'STOPPED',
  OBSERVABILITY_DEGRADED: 'OBSERVABILITY_DEGRADED',
});

/**
 * @typedef {'transfer' | 'normalization'} PipelineJobKind
 */

/**
 * @param {PipelineJobKind} kind
 * @param {Record<string, unknown>} summary
 */
export async function recordPipelineJobHeartbeat(kind, summary) {
  if (process.env.NODE_ENV === 'test') return;
  const payload = {
    at: new Date().toISOString(),
    kind,
    processed: summary.processed ?? null,
    inserted: summary.inserted ?? null,
    selected: summary.selected ?? null,
    errors: summary.errors ?? null,
    durationMs: summary.durationMs ?? null,
    skipped_run: Boolean(summary.skipped_run),
  };
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    const key =
      kind === 'transfer' ? TRANSFER_HEARTBEAT_KEY : NORMALIZATION_HEARTBEAT_KEY;
    await client.set(key, JSON.stringify(payload), { EX: HEARTBEAT_TTL_SEC });
  } catch (error) {
    logger.warn('PIPELINE_SCHEDULER_HEARTBEAT_WRITE_SKIPPED', {
      kind,
      error: error.message,
    });
  }
}

/**
 * @returns {Promise<{ transfer: object|null, normalization: object|null }>}
 */
export async function readPipelineJobHeartbeats() {
  if (process.env.NODE_ENV === 'test' || !isRedisAvailable()) {
    return { transfer: null, normalization: null };
  }
  try {
    const client = await getRedisClient();
    const [transferRaw, normalizationRaw] = await Promise.all([
      client.get(TRANSFER_HEARTBEAT_KEY),
      client.get(NORMALIZATION_HEARTBEAT_KEY),
    ]);
    return {
      transfer: transferRaw ? JSON.parse(transferRaw) : null,
      normalization: normalizationRaw ? JSON.parse(normalizationRaw) : null,
    };
  } catch (error) {
    logger.warn('PIPELINE_SCHEDULER_HEARTBEAT_READ_SKIPPED', { error: error.message });
    return { transfer: null, normalization: null };
  }
}

/**
 * DB evidence of recent worker output — survives API/engine process split.
 * @returns {Promise<{ lastNormalizationAt: string|null, lastTransferAt: string|null }>}
 */
export async function queryPipelineActivityEvidence() {
  try {
    const [normResult, transferResult] = await Promise.all([
      query(`
        SELECT MAX(processed_at) AS last_at
        FROM collected_data
        WHERE status IN ('processed', 'error')
          AND processed_at > NOW() - INTERVAL '3 hours'
      `),
      query(`
        SELECT MAX(processed_at) AS last_at
        FROM telegram_messages
        WHERE is_processed = true
          AND processed_at > NOW() - INTERVAL '3 hours'
      `),
    ]);
    const normAt = normResult.rows[0]?.last_at;
    const transferAt = transferResult.rows[0]?.last_at;
    return {
      lastNormalizationAt: normAt ? new Date(normAt).toISOString() : null,
      lastTransferAt: transferAt ? new Date(transferAt).toISOString() : null,
    };
  } catch (error) {
    logger.warn('PIPELINE_ACTIVITY_EVIDENCE_QUERY_FAILED', { error: error.message });
    return { lastNormalizationAt: null, lastTransferAt: null };
  }
}

/**
 * @param {string|null|undefined} isoTimestamp
 * @param {number} intervalMs
 * @param {number} [nowMs]
 */
export function isJobExecutionFresh(isoTimestamp, intervalMs, nowMs = Date.now()) {
  if (!isoTimestamp || !Number.isFinite(intervalMs) || intervalMs <= 0) return false;
  const ageMs = nowMs - new Date(isoTimestamp).getTime();
  return ageMs >= 0 && ageMs <= intervalMs * SCHEDULER_FRESHNESS_GRACE;
}

/**
 * Classify transfer summary into Layer A lifecycle outcome (no Redis authority).
 * @param {{ skipped_run?: boolean, skip_reason?: string|null, selected?: number|null }} summary
 * @returns {string}
 */
export function classifyTelegramTransferLifecycleOutcome(summary) {
  if (!summary || typeof summary !== 'object') {
    return TELEGRAM_LIFECYCLE_OUTCOMES.TICK_ERROR;
  }
  if (summary.skipped_run === true) {
    if (summary.skip_reason === 'in_memory_lock') {
      return TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SKIP_IN_MEMORY;
    }
    if (summary.skip_reason === 'advisory_lock') {
      return TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SKIP_ADVISORY_LOCK;
    }
    return TELEGRAM_LIFECYCLE_OUTCOMES.TICK_ERROR;
  }
  if (Number(summary.selected) === 0) {
    return TELEGRAM_LIFECYCLE_OUTCOMES.TICK_NOOP_SELECTED_ZERO;
  }
  return TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SUCCESS;
}

/**
 * Best-effort Layer A lifecycle write. Never throws; never gates execution.
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ written: boolean, degraded: boolean }>}
 */
export async function recordTelegramLifecycleEvidence(payload) {
  if (process.env.NODE_ENV === 'test') {
    return { written: false, degraded: false };
  }
  const body = {
    at: new Date().toISOString(),
    runtimeOwner: 'titan-engine-worker',
    pid: process.pid,
    ...payload,
  };
  if (!isRedisAvailable()) {
    logger.warn('PIPELINE_TELEGRAM_LIFECYCLE_WRITE_SKIPPED', {
      state: TELEGRAM_LIFECYCLE_OUTCOMES.OBSERVABILITY_DEGRADED,
      reason: 'redis_unavailable',
    });
    return { written: false, degraded: true };
  }
  try {
    const client = await getRedisClient();
    await client.set(TELEGRAM_LIFECYCLE_KEY, JSON.stringify(body), {
      EX: LIFECYCLE_TTL_SEC,
    });
    if (payload?.pid != null) {
      const perProc = `${TELEGRAM_LIFECYCLE_KEY}:proc:${payload.pid}`;
      await client.set(perProc, JSON.stringify(body), { EX: LIFECYCLE_TTL_SEC });
    }
    return { written: true, degraded: false };
  } catch (error) {
    logger.warn('PIPELINE_TELEGRAM_LIFECYCLE_WRITE_SKIPPED', {
      state: TELEGRAM_LIFECYCLE_OUTCOMES.OBSERVABILITY_DEGRADED,
      error: error.message,
    });
    return { written: false, degraded: true };
  }
}

/**
 * @returns {Promise<object|null>}
 */
export async function readTelegramLifecycleEvidence() {
  if (process.env.NODE_ENV === 'test' || !isRedisAvailable()) {
    return null;
  }
  try {
    const client = await getRedisClient();
    const raw = await client.get(TELEGRAM_LIFECYCLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logger.warn('PIPELINE_TELEGRAM_LIFECYCLE_READ_SKIPPED', { error: error.message });
    return null;
  }
}

/**
 * Diagnostic freshness for Telegram lifecycle (not execution entitlement).
 * @param {{ lifecycle: object|null, intervalMs: number, nowMs?: number }} input
 * @returns {'NOT_INITIALIZED'|'ARMED_WAITING_FIRST_TICK'|'FRESH'|'STALE_STOPPED'|'OBSERVABILITY_DEGRADED'}
 */
export function deriveTelegramLifecycleFreshness({
  lifecycle,
  intervalMs,
  nowMs = Date.now(),
}) {
  if (!lifecycle || typeof lifecycle !== 'object') {
    return 'NOT_INITIALIZED';
  }
  if (lifecycle.state === TELEGRAM_LIFECYCLE_OUTCOMES.OBSERVABILITY_DEGRADED) {
    return 'OBSERVABILITY_DEGRADED';
  }
  if (
    lifecycle.state === TELEGRAM_LIFECYCLE_OUTCOMES.DISABLED ||
    lifecycle.state === TELEGRAM_LIFECYCLE_OUTCOMES.STOPPED
  ) {
    return 'STALE_STOPPED';
  }
  if (lifecycle.state === TELEGRAM_LIFECYCLE_OUTCOMES.ARMED) {
    return 'ARMED_WAITING_FIRST_TICK';
  }
  if (isJobExecutionFresh(lifecycle.at, intervalMs, nowMs)) {
    return 'FRESH';
  }
  return 'STALE_STOPPED';
}

/**
 * Derive scheduler status from heartbeats + DB activity — never from in-process isRunning.
 * @param {{
 *   transferIntervalMs: number,
 *   normalizationIntervalMs: number,
 *   heartbeats: { transfer: object|null, normalization: object|null },
 *   dbActivity: { lastNormalizationAt: string|null, lastTransferAt: string|null },
 * }} input
 * @returns {'running' | 'stopped' | 'unknown'}
 */
export function deriveSchedulerStatus({
  transferIntervalMs,
  normalizationIntervalMs,
  heartbeats,
  dbActivity,
}) {
  const transferTickAt = heartbeats.transfer?.at ?? null;
  const normalizationTickAt = heartbeats.normalization?.at ?? null;

  const transferFresh =
    isJobExecutionFresh(transferTickAt, transferIntervalMs) ||
    isJobExecutionFresh(dbActivity.lastTransferAt, transferIntervalMs);
  const normalizationFresh =
    isJobExecutionFresh(normalizationTickAt, normalizationIntervalMs) ||
    isJobExecutionFresh(dbActivity.lastNormalizationAt, normalizationIntervalMs);

  if (transferFresh || normalizationFresh) {
    return 'running';
  }

  const hasAnySignal =
    transferTickAt ||
    normalizationTickAt ||
    dbActivity.lastTransferAt ||
    dbActivity.lastNormalizationAt;

  if (hasAnySignal) {
    return 'stopped';
  }

  return 'unknown';
}

/**
 * @param {{ transferIntervalMs: number, normalizationIntervalMs: number }} intervals
 */
export async function resolveSchedulerRuntimeStatus(intervals) {
  const [heartbeats, dbActivity, telegramLifecycle] = await Promise.all([
    readPipelineJobHeartbeats(),
    queryPipelineActivityEvidence(),
    readTelegramLifecycleEvidence(),
  ]);

  const status = deriveSchedulerStatus({
    transferIntervalMs: intervals.transferIntervalMs,
    normalizationIntervalMs: intervals.normalizationIntervalMs,
    heartbeats,
    dbActivity,
  });

  const normHeartbeat = heartbeats.normalization;
  const lastNormalizationRun =
    normHeartbeat?.at ?? dbActivity.lastNormalizationAt ?? null;

  const telegramLifecycleFreshness = deriveTelegramLifecycleFreshness({
    lifecycle: telegramLifecycle,
    intervalMs: intervals.transferIntervalMs,
  });

  return {
    status,
    heartbeats,
    dbActivity,
    lastNormalizationRun,
    lastNormalizationStats: normHeartbeat
      ? {
          processed:
            typeof normHeartbeat.processed === 'number' ? normHeartbeat.processed : null,
          errors: typeof normHeartbeat.errors === 'number' ? normHeartbeat.errors : null,
          durationMs:
            typeof normHeartbeat.durationMs === 'number' ? normHeartbeat.durationMs : null,
        }
      : null,
    // Diagnostic only — never treat ARMED as full-scheduler "running"
    telegramLifecycle,
    telegramLifecycleFreshness,
  };
}
