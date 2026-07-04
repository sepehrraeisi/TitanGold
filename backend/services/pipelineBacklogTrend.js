import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';

export const BACKLOG_HISTORY_REDIS_KEY = 'pipeline:backlog-history:v1';
export const BACKLOG_TREND_STABLE_THRESHOLD_PCT = 2;
export const BACKLOG_SEVERITY_NORMAL_MAX = 100_000;
export const BACKLOG_SEVERITY_WARNING_MAX = 500_000;

const HISTORY_MAX_ENTRIES = 48;
const HISTORY_MIN_INTERVAL_MS = 50 * 60 * 1000;
const HISTORY_TARGET_AGE_MS = 24 * 60 * 60 * 1000;
const HISTORY_AGE_TOLERANCE_MS = 6 * 60 * 60 * 1000;

/**
 * @param {number | null | undefined} backlog
 * @returns {'normal' | 'warning' | 'critical' | null}
 */
export function classifyBacklogSeverity(backlog) {
  if (backlog == null || !Number.isFinite(backlog)) return null;
  if (backlog < BACKLOG_SEVERITY_NORMAL_MAX) return 'normal';
  if (backlog <= BACKLOG_SEVERITY_WARNING_MAX) return 'warning';
  return 'critical';
}

/**
 * Live catch-up estimate — never cached independently.
 * @param {number | null} backlogTotal
 * @param {number | null} processingRatePerHour
 * @returns {number | null} hours
 */
export function computeCatchUpHoursLive(backlogTotal, processingRatePerHour) {
  if (backlogTotal == null || processingRatePerHour == null || processingRatePerHour <= 0) {
    return null;
  }
  if (backlogTotal <= 0) return 0;
  return Number((backlogTotal / processingRatePerHour).toFixed(1));
}

/**
 * Flow-balance estimate of backlog ~24h ago from observed counters.
 * @param {{ currentBacklog: number, incoming24h: number, processed24h: number }} input
 * @returns {number | null}
 */
export function estimateBacklog24hAgo(input) {
  const { currentBacklog, incoming24h, processed24h } = input;
  if (
    currentBacklog == null ||
    incoming24h == null ||
    processed24h == null ||
    !Number.isFinite(currentBacklog) ||
    !Number.isFinite(incoming24h) ||
    !Number.isFinite(processed24h)
  ) {
    return null;
  }
  return currentBacklog - incoming24h + processed24h;
}

/**
 * @param {number} currentBacklog
 * @param {number} previousBacklog
 * @returns {{ direction: 'up' | 'down' | 'stable', percentChange: number }}
 */
export function computeTrendDirection(currentBacklog, previousBacklog) {
  if (previousBacklog <= 0) {
    if (currentBacklog <= 0) {
      return { direction: 'stable', percentChange: 0 };
    }
    return { direction: 'up', percentChange: 100 };
  }
  const percentChange = Number(
    (((currentBacklog - previousBacklog) / previousBacklog) * 100).toFixed(1),
  );
  if (Math.abs(percentChange) < BACKLOG_TREND_STABLE_THRESHOLD_PCT) {
    return { direction: 'stable', percentChange: 0 };
  }
  return {
    direction: percentChange > 0 ? 'up' : 'down',
    percentChange: Math.abs(percentChange),
  };
}

async function readHistory() {
  if (process.env.NODE_ENV === 'test') return [];
  if (!isRedisAvailable()) return [];
  try {
    const client = await getRedisClient();
    const raw = await client.get(BACKLOG_HISTORY_REDIS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn('BACKLOG_HISTORY_READ_SKIPPED', { error: error.message });
    return [];
  }
}

async function writeHistory(entries) {
  if (process.env.NODE_ENV === 'test') return;
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    await client.set(BACKLOG_HISTORY_REDIS_KEY, JSON.stringify(entries), { EX: 7 * 24 * 3600 });
  } catch (error) {
    logger.warn('BACKLOG_HISTORY_WRITE_SKIPPED', { error: error.message });
  }
}

/**
 * Append hourly backlog snapshot for trend (non-blocking).
 * @param {number | null | undefined} backlogTotal
 */
export async function recordBacklogSnapshot(backlogTotal) {
  if (backlogTotal == null || !Number.isFinite(backlogTotal)) return;
  const history = await readHistory();
  const now = Date.now();
  const last = history[history.length - 1];
  if (last && now - new Date(last.capturedAt).getTime() < HISTORY_MIN_INTERVAL_MS) {
    return;
  }
  history.push({ capturedAt: new Date(now).toISOString(), backlogTotal });
  const trimmed = history.slice(-HISTORY_MAX_ENTRIES);
  await writeHistory(trimmed);
}

/**
 * Find historical snapshot closest to 24h ago.
 * @param {Array<{ capturedAt: string, backlogTotal: number }>} history
 * @param {number} [nowMs]
 * @returns {{ capturedAt: string, backlogTotal: number } | null}
 */
export function findBacklogSnapshot24hAgo(history, nowMs = Date.now()) {
  if (!history?.length) return null;
  const target = nowMs - HISTORY_TARGET_AGE_MS;
  let best = null;
  let bestDelta = Infinity;
  for (const entry of history) {
    const ts = new Date(entry.capturedAt).getTime();
    const delta = Math.abs(ts - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = entry;
    }
  }
  if (!best || bestDelta > HISTORY_AGE_TOLERANCE_MS) return null;
  return best;
}

/**
 * @param {{ currentBacklog: number | null, incoming24h: number | null, processed24h: number | null }} input
 * @returns {Promise<object>}
 */
export async function buildBacklogTrend(input) {
  const { currentBacklog, incoming24h, processed24h } = input;

  if (currentBacklog == null) {
    return {
      loaded: false,
      direction: null,
      percentChange: null,
      display: null,
      previousBacklog: null,
      source: null,
      unavailableReason: 'backlog_unavailable',
    };
  }

  const history = await readHistory();
  const historical = findBacklogSnapshot24hAgo(history);
  let previousBacklog = historical?.backlogTotal ?? null;
  let source = historical ? 'redis_history' : null;

  if (previousBacklog == null) {
    previousBacklog = estimateBacklog24hAgo({ currentBacklog, incoming24h, processed24h });
    source = previousBacklog != null && previousBacklog > 0 ? 'flow_balance_estimate' : null;
  }

  if (previousBacklog == null || previousBacklog <= 0) {
    return {
      loaded: false,
      direction: null,
      percentChange: null,
      display: null,
      previousBacklog: null,
      source: null,
      unavailableReason: 'insufficient_history',
    };
  }

  const { direction, percentChange } = computeTrendDirection(currentBacklog, previousBacklog);

  return {
    loaded: true,
    direction,
    percentChange,
    display:
      direction === 'stable'
        ? 'stable'
        : `${direction === 'up' ? 'up' : 'down'}_${percentChange}`,
    previousBacklog,
    source,
    unavailableReason: null,
  };
}
