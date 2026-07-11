import { query } from '../database/db.js';
import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const TRANSFER_HEARTBEAT_KEY = 'pipeline:scheduler:heartbeat:transfer';
export const NORMALIZATION_HEARTBEAT_KEY = 'pipeline:scheduler:heartbeat:normalization';
const HEARTBEAT_TTL_SEC = 7200;
/** Allow scheduler ticks to slip ~2.5× before treating as stopped. */
export const SCHEDULER_FRESHNESS_GRACE = 2.5;

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
  const [heartbeats, dbActivity] = await Promise.all([
    readPipelineJobHeartbeats(),
    queryPipelineActivityEvidence(),
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
  };
}
