import { query } from '../database/db.js';
import { logger } from './logger.js';
import { getOrLoadCached } from './pipelineSnapshotCache.js';
import { getDuplicateUrlSummaryForHealth } from './dataSourceUrlDuplicateService.js';

const CACHE_KEY = 'datahub:health:monitoring:v1';
const CACHE_TTL_MS = 45_000;
const COLLECTOR_HEALTH_TIMEOUT_MS = 2500;

function collectorBaseUrl() {
  return (
    process.env.TELEGRAM_COLLECTOR_INTERNAL_URL ||
    process.env.TELEGRAM_COLLECTOR_URL ||
    'http://127.0.0.1:5003'
  ).replace(/\/$/, '');
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
export async function queryPipelineActivity1h() {
  const unavailableMetrics = [];
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM collected_data
          WHERE collected_at > NOW() - INTERVAL '1 hour') AS ingested,
        (SELECT COUNT(*)::int FROM collected_data
          WHERE processed_at > NOW() - INTERVAL '1 hour'
            AND status IN ('processed', 'error')) AS normalized,
        (SELECT COUNT(*)::int FROM telegram_messages
          WHERE created_at > NOW() - INTERVAL '1 hour') AS telegram_intake,
        (SELECT COUNT(*)::int FROM data_hub_logs
          WHERE created_at > NOW() - INTERVAL '1 hour') AS access_log_events
    `);
    const row = result.rows[0] || {};
    return {
      ingested: row.ingested ?? null,
      normalized: row.normalized ?? null,
      telegramIntake: row.telegram_intake ?? null,
      accessLogEvents: row.access_log_events ?? null,
      unavailableMetrics,
    };
  } catch (error) {
    logger.warn('HEALTH_MONITORING_PIPELINE_ACTIVITY_FAILED', { error: error.message });
    unavailableMetrics.push(
      'ingested',
      'normalized',
      'telegramIntake',
      'accessLogEvents',
    );
    return {
      ingested: null,
      normalized: null,
      telegramIntake: null,
      accessLogEvents: null,
      unavailableMetrics,
    };
  }
}

/**
 * @returns {Promise<{ avgResponseMs: number|null, cacheHitRate: number|null, cacheHitRateTracked: boolean }>}
 */
export async function queryPerformanceMetrics() {
  try {
    const result = await query(`
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
    `);
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

/**
 * @returns {Promise<object|null>}
 */
async function fetchCollectorHealthSnapshot() {
  if (process.env.NODE_ENV === 'test') return null;
  const url = `${collectorBaseUrl()}/api/telegram-collector/health`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COLLECTOR_HEALTH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.warn('HEALTH_MONITORING_COLLECTOR_FETCH_SKIPPED', {
      url,
      error: error.message,
    });
    return null;
  }
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

async function buildHealthMonitoringUncached() {
  const healthLastCheckedAt = new Date().toISOString();

  const [
    dbPing,
    sourceCounts,
    pipelineActivity,
    performance,
    duplicateSummary,
    collectorRaw,
  ] = await Promise.all([
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
    getDuplicateUrlSummaryForHealth().catch(() => ({
      duplicateUrlGroups: null,
      highRiskDuplicateGroups: null,
      ignoredDuplicateGroups: null,
    })),
    fetchCollectorHealthSnapshot(),
  ]);

  const sourceRow = sourceCounts.rows[0] || {};
  const activeCount = Number(sourceRow.active_sources) || 0;
  const telegramCollector = mapTelegramCollectorHealth(collectorRaw);

  const dataQualityUnavailable =
    duplicateSummary.duplicateUrlGroups == null ? ['duplicateUrlGroups'] : [];

  return {
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
    dataQuality: {
      duplicateUrlGroups: duplicateSummary.duplicateUrlGroups,
      highRiskDuplicateGroups: duplicateSummary.highRiskDuplicateGroups ?? null,
      ignoredDuplicateGroups: duplicateSummary.ignoredDuplicateGroups ?? null,
      meta: {
        partial: dataQualityUnavailable.length > 0,
        unavailableMetrics: dataQualityUnavailable,
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
    telegramCollector,
    /** Backward-compatible flat fields for legacy /health consumers */
    activeSources: activeCount,
    accessLogEvents1h: pipelineActivity.accessLogEvents,
    pipelineIngested1h: pipelineActivity.ingested,
    pipelineNormalized1h: pipelineActivity.normalized,
    telegramCreated1h: pipelineActivity.telegramIntake,
    healthLastCheckedAt,
    timestamp: healthLastCheckedAt,
  };
}

export async function buildHealthMonitoringView() {
  if (process.env.NODE_ENV === 'test') {
    return buildHealthMonitoringUncached();
  }
  return getOrLoadCached(CACHE_KEY, buildHealthMonitoringUncached, CACHE_TTL_MS);
}

/** Activity slice reused by legacy GET /health */
export async function queryHealthActivityMetrics() {
  return queryPipelineActivity1h();
}
