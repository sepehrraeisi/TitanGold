import { query } from '../database/db.js';
import { logger } from './logger.js';
import { getOrLoadCached } from './pipelineSnapshotCache.js';
import { getDuplicateUrlSummaryForHealthMonitoring } from './dataSourceUrlDuplicateService.js';

const CORE_CACHE_KEY = 'datahub:health:monitoring:v3';
const CORE_CACHE_TTL_MS = 45_000;
const PIPELINE_ACTIVITY_CACHE_KEY = 'datahub:health:pipeline-activity-1h:v1';
const PIPELINE_ACTIVITY_CACHE_TTL_MS = 60_000;
const PERFORMANCE_CACHE_KEY = 'datahub:health:performance:v1';
const PERFORMANCE_CACHE_TTL_MS = 60_000;
const DATA_QUALITY_CACHE_KEY = 'datahub:health:data-quality:v1';
const DATA_QUALITY_CACHE_TTL_MS = 10 * 60 * 1000;
const DATA_QUALITY_COMPUTE_TIMEOUT_MS = 2000;
const METRIC_QUERY_TIMEOUT_MS = 2000;
const PERFORMANCE_QUERY_TIMEOUT_MS = 1500;

/** @type {Promise<unknown>|null} */
let dataQualityBackgroundRefresh = null;

function raceWithTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
    }),
  ]);
}

/**
 * @returns {Promise<{
 *   ingested: number|null,
 *   normalized: number|null,
 *   telegramIntake: number|null,
 *   accessLogEvents: number|null,
 *   unavailableMetrics: string[]
 * }>}
 */
async function queryScalarCountWithTimeout(sql, label) {
  try {
    const result = await raceWithTimeout(query(sql), METRIC_QUERY_TIMEOUT_MS, label);
    const row = result.rows[0] || {};
    const value = Object.values(row)[0];
    return { value: value ?? null, unavailable: false };
  } catch (error) {
    logger.warn('HEALTH_MONITORING_METRIC_TIMEOUT', { label, error: error.message });
    return { value: null, unavailable: true };
  }
}

async function queryPipelineActivity1hUncached() {
  const unavailableMetrics = [];
  const [ingested, normalized, telegramIntake, accessLogEvents] = await Promise.all([
    queryScalarCountWithTimeout(
      `SELECT COUNT(*)::int AS v FROM collected_data
        WHERE collected_at > NOW() - INTERVAL '1 hour'`,
      'ingested_1h',
    ),
    queryScalarCountWithTimeout(
      `SELECT COUNT(*)::int AS v FROM collected_data
        WHERE processed_at > NOW() - INTERVAL '1 hour'
          AND status IN ('processed', 'error')`,
      'normalized_1h',
    ),
    queryScalarCountWithTimeout(
      `SELECT COUNT(*)::int AS v FROM telegram_messages
        WHERE created_at > NOW() - INTERVAL '1 hour'`,
      'telegram_intake_1h',
    ),
    queryScalarCountWithTimeout(
      `SELECT COUNT(*)::int AS v FROM data_hub_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'`,
      'access_log_1h',
    ),
  ]);

  if (ingested.unavailable) unavailableMetrics.push('ingested');
  if (normalized.unavailable) unavailableMetrics.push('normalized');
  if (telegramIntake.unavailable) unavailableMetrics.push('telegramIntake');
  if (accessLogEvents.unavailable) unavailableMetrics.push('accessLogEvents');

  return {
    ingested: ingested.value,
    normalized: normalized.value,
    telegramIntake: telegramIntake.value,
    accessLogEvents: accessLogEvents.value,
    unavailableMetrics,
  };
}

export async function queryPipelineActivity1h() {
  if (process.env.NODE_ENV === 'test') {
    return queryPipelineActivity1hUncached();
  }
  return getOrLoadCached(
    PIPELINE_ACTIVITY_CACHE_KEY,
    queryPipelineActivity1hUncached,
    PIPELINE_ACTIVITY_CACHE_TTL_MS,
  );
}

/**
 * @returns {Promise<{ avgResponseMs: number|null, cacheHitRate: number|null, cacheHitRateTracked: boolean }>}
 */
async function queryPerformanceMetricsUncached() {
  try {
    const result = await raceWithTimeout(
      query(`
        SELECT
          ROUND(AVG(execution_time_ms) FILTER (
            WHERE execution_time_ms IS NOT NULL
              AND created_at > NOW() - INTERVAL '1 hour'
          ))::int AS avg_response_ms,
          COUNT(*) FILTER (
            WHERE LOWER(status) = 'cached'
              AND created_at > NOW() - INTERVAL '24 hours'
          )::int AS cached_24h,
          COUNT(*) FILTER (
            WHERE LOWER(status) IN ('success', 'ok', 'cached')
              AND created_at > NOW() - INTERVAL '24 hours'
          )::int AS outcomes_24h
        FROM data_hub_logs
      `),
      PERFORMANCE_QUERY_TIMEOUT_MS,
      'performance_metrics',
    );
    const row = result.rows[0] || {};
    const avgResponseMs =
      row.avg_response_ms != null ? Number(row.avg_response_ms) : null;
    const cached = Number(row.cached_24h) || 0;
    const outcomes = Number(row.outcomes_24h) || 0;
    const cacheHitRateTracked = outcomes > 0;
    const cacheHitRate = cacheHitRateTracked
      ? Number((cached / outcomes).toFixed(4))
      : null;
    return { avgResponseMs, cacheHitRate, cacheHitRateTracked };
  } catch (error) {
    logger.warn('HEALTH_MONITORING_PERFORMANCE_FAILED', { error: error.message });
    return { avgResponseMs: null, cacheHitRate: null, cacheHitRateTracked: false };
  }
}

export async function queryPerformanceMetrics() {
  if (process.env.NODE_ENV === 'test') {
    return queryPerformanceMetricsUncached();
  }
  return getOrLoadCached(
    PERFORMANCE_CACHE_KEY,
    queryPerformanceMetricsUncached,
    PERFORMANCE_CACHE_TTL_MS,
  );
}

function mapCollectorStatus(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'healthy' || s === 'ok') return 'healthy';
  if (s === 'degraded' || s === 'warning') return 'degraded';
  if (s === 'unhealthy' || s === 'error' || s === 'offline') return 'unhealthy';
  return 'unknown';
}

/**
 * @param {Record<string, unknown>|null} health
 * @returns {object}
 */
export function mapTelegramCollectorHealth(health) {
  if (!health) {
    return {
      status: 'unknown',
      activeChannels: null,
      totalChannels: null,
      avgLatencyMs: null,
      loggedErrors: null,
      lastProcessedAt: null,
      loaded: false,
    };
  }
  const channels = health.channels;
  const activeChannels =
    typeof health.activeChannels === 'number'
      ? health.activeChannels
      : typeof channels === 'object' &&
          channels !== null &&
          typeof channels.active === 'number'
        ? channels.active
        : null;
  const totalChannels =
    typeof health.totalChannels === 'number'
      ? health.totalChannels
      : typeof channels === 'object' &&
          channels !== null &&
          typeof channels.total === 'number'
        ? channels.total
        : null;
  return {
    status: mapCollectorStatus(health.status),
    activeChannels,
    totalChannels,
    avgLatencyMs:
      typeof health.averageLatencyMs === 'number'
        ? health.averageLatencyMs
        : typeof health.avgLatencyMs === 'number'
          ? health.avgLatencyMs
          : null,
    loggedErrors:
      typeof health.loggedErrors === 'number'
        ? health.loggedErrors
        : typeof health.errorCount === 'number'
          ? health.errorCount
          : null,
    lastProcessedAt:
      typeof health.lastProcessedAt === 'string' ? health.lastProcessedAt : null,
    loaded: true,
  };
}

function emptyTelegramCollectorPlaceholder() {
  return mapTelegramCollectorHealth(null);
}

/** Core health view — fast path only; no duplicate URL analysis or collector HTTP. */
async function buildHealthMonitoringUncached() {
  const healthLastCheckedAt = new Date().toISOString();
  const started = Date.now();

  const [dbPing, sourceCounts, pipelineActivity, performance] = await Promise.all([
    query('SELECT 1').then(() => true).catch(() => false),
    query(`
      SELECT
        COUNT(*)::int AS total_sources,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_sources,
        COUNT(*) FILTER (WHERE type = 'telegram')::int AS telegram_sources,
        COUNT(*) FILTER (WHERE type = 'rss')::int AS rss_sources,
        COUNT(*) FILTER (WHERE type = 'api')::int AS api_sources
      FROM data_sources
    `),
    queryPipelineActivity1h(),
    queryPerformanceMetrics(),
  ]);

  const sourceRow = sourceCounts.rows[0] || {};
  const activeCount = Number(sourceRow.active_sources) || 0;

  const view = {
    status: dbPing && activeCount > 0 ? 'healthy' : dbPing ? 'degraded' : 'unhealthy',
    lastCheckAt: healthLastCheckedAt,
    database: dbPing ? 'connected' : 'disconnected',
    sources: {
      total: Number(sourceRow.total_sources) || 0,
      active: activeCount,
      byType: {
        telegram: Number(sourceRow.telegram_sources) || 0,
        rss: Number(sourceRow.rss_sources) || 0,
        api: Number(sourceRow.api_sources) || 0,
      },
    },
    pipelineActivity1h: {
      ingested: pipelineActivity.ingested,
      normalized: pipelineActivity.normalized,
      telegramIntake: pipelineActivity.telegramIntake,
      accessLogEvents: pipelineActivity.accessLogEvents,
      meta: {
        partial: pipelineActivity.unavailableMetrics.length > 0,
        unavailableMetrics: pipelineActivity.unavailableMetrics,
        window: '1h',
      },
    },
    performance: {
      avgResponseMs: performance.avgResponseMs,
      cacheHitRate: performance.cacheHitRate,
      cacheHitRateTracked: performance.cacheHitRateTracked,
      meta: {
        avgResponseWindow: '1h',
        cacheHitRateWindow: '24h',
      },
    },
    /** Placeholder — live collector metrics load via frontend useCollectorHealthQuery */
    telegramCollector: emptyTelegramCollectorPlaceholder(),
    meta: {
      queryMs: Date.now() - started,
      dataQualityDeferred: true,
    },
    activeSources: activeCount,
    accessLogEvents1h: pipelineActivity.accessLogEvents,
    pipelineIngested1h: pipelineActivity.ingested,
    pipelineNormalized1h: pipelineActivity.normalized,
    telegramCreated1h: pipelineActivity.telegramIntake,
    healthLastCheckedAt,
    timestamp: healthLastCheckedAt,
  };

  logger.info('HEALTH_MONITORING_CORE_BUILT', { queryMs: view.meta.queryMs });
  return view;
}

export async function buildHealthMonitoringView() {
  if (process.env.NODE_ENV === 'test') {
    return buildHealthMonitoringUncached();
  }
  return getOrLoadCached(CORE_CACHE_KEY, buildHealthMonitoringUncached, CORE_CACHE_TTL_MS);
}

function scheduleDataQualityBackgroundRefresh() {
  if (process.env.NODE_ENV === 'test') return;
  if (dataQualityBackgroundRefresh) return;
  dataQualityBackgroundRefresh = getDuplicateUrlSummaryForHealthMonitoring()
    .then((summary) => {
      const payload = {
        lastCheckAt: new Date().toISOString(),
        loaded: true,
        duplicateUrlGroups: summary.duplicateUrlGroups,
        highRiskDuplicateGroups: summary.highRiskDuplicateGroups ?? null,
        ignoredDuplicateGroups: summary.ignoredDuplicateGroups ?? null,
        meta: {
          partial: false,
          unavailableMetrics: [],
          reason: null,
          source: 'background_refresh',
        },
      };
      return getOrLoadCached(
        DATA_QUALITY_CACHE_KEY,
        async () => payload,
        DATA_QUALITY_CACHE_TTL_MS,
      );
    })
    .catch((error) => {
      logger.warn('HEALTH_DATA_QUALITY_BACKGROUND_FAILED', { error: error.message });
    })
    .finally(() => {
      dataQualityBackgroundRefresh = null;
    });
}

async function buildHealthDataQualityUncached() {
  const lastCheckAt = new Date().toISOString();
  const started = Date.now();
  try {
    const summary = await raceWithTimeout(
      getDuplicateUrlSummaryForHealthMonitoring(),
      DATA_QUALITY_COMPUTE_TIMEOUT_MS,
      'duplicate_url_analysis',
    );
    const payload = {
      lastCheckAt,
      loaded: true,
      duplicateUrlGroups: summary.duplicateUrlGroups,
      highRiskDuplicateGroups: summary.highRiskDuplicateGroups ?? null,
      ignoredDuplicateGroups: summary.ignoredDuplicateGroups ?? null,
      meta: {
        partial: false,
        unavailableMetrics: [],
        reason: null,
        queryMs: Date.now() - started,
        source: 'duplicate_analysis',
      },
    };
    logger.info('HEALTH_DATA_QUALITY_BUILT', { queryMs: payload.meta.queryMs });
    return payload;
  } catch (error) {
    scheduleDataQualityBackgroundRefresh();
    logger.warn('HEALTH_DATA_QUALITY_TIMEOUT_OR_ERROR', {
      error: error.message,
      queryMs: Date.now() - started,
    });
    return {
      lastCheckAt,
      loaded: false,
      duplicateUrlGroups: null,
      highRiskDuplicateGroups: null,
      ignoredDuplicateGroups: null,
      meta: {
        partial: true,
        unavailableMetrics: ['duplicateUrlGroups', 'highRiskDuplicateGroups', 'ignoredDuplicateGroups'],
        reason: String(error.message).includes('timeout') ? 'timeout' : 'error',
        queryMs: Date.now() - started,
        source: 'unavailable',
      },
    };
  }
}

export async function buildHealthDataQualityView() {
  if (process.env.NODE_ENV === 'test') {
    return buildHealthDataQualityUncached();
  }
  return getOrLoadCached(
    DATA_QUALITY_CACHE_KEY,
    buildHealthDataQualityUncached,
    DATA_QUALITY_CACHE_TTL_MS,
  );
}

/** Activity slice reused by legacy GET /health */
export async function queryHealthActivityMetrics() {
  return queryPipelineActivity1h();
}

/** Lightweight duplicate skip for legacy GET /health — never blocks on analysis. */
export function emptyDuplicateSummaryForLegacyHealth() {
  return {
    duplicateUrlGroups: null,
    highRiskDuplicateGroups: null,
    ignoredDuplicateGroups: null,
    skipped: true,
  };
}
