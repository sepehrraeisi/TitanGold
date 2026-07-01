import { logger } from './logger.js';

export const PIPELINE_BACKLOG_METRIC_TIMEOUT_MS = Number(
  process.env.PIPELINE_BACKLOG_METRIC_TIMEOUT_MS || 12_000,
);

export const DEFAULT_TRANSFER_THROUGHPUT = {
  processed24h: 0,
  messagesPerHour: 1,
  messagesPerDay: 0,
  observedWindowHours: 24,
};

export const DEFAULT_GLOBAL_TELEGRAM_BACKLOG = {
  unprocessedTotal: 0,
};

export const DEFAULT_INGEST_METRICS = {
  incoming24h: 0,
  transferredToCollectedData24h: 0,
};

/**
 * @template T
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @param {T} fallback
 * @param {number} [timeoutMs]
 * @returns {Promise<{ value: T, error?: string, timedOut?: boolean }>}
 */
export async function loadMetricSafely(label, fn, fallback, timeoutMs = PIPELINE_BACKLOG_METRIC_TIMEOUT_MS) {
  let timer;
  try {
    const value = await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
    return { value };
  } catch (error) {
    const timedOut = error?.message === `${label}_timeout`;
    logger.warn('PIPELINE_BACKLOG_METRIC_FAILED', {
      label,
      timedOut,
      error: error?.message || String(error),
    });
    return {
      value: fallback,
      error: timedOut ? `${label}_timeout` : error?.message || `${label}_failed`,
      timedOut,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {object} payload
 * @returns {object}
 */
export function normalizePipelineBacklogResponse(payload = {}) {
  const warnings = Array.isArray(payload.meta?.warnings) ? [...payload.meta.warnings] : [];
  const transferThroughput = payload.transferThroughput || DEFAULT_TRANSFER_THROUGHPUT;
  const globalTelegramBacklog = payload.globalTelegramBacklog || DEFAULT_GLOBAL_TELEGRAM_BACKLOG;
  const ingestMetrics = payload.ingestMetrics || DEFAULT_INGEST_METRICS;
  const backlogBySourceId =
    payload.backlogBySourceId && typeof payload.backlogBySourceId === 'object'
      ? payload.backlogBySourceId
      : {};

  if (!payload.transferThroughput) warnings.push('transfer_throughput_unavailable');
  if (!payload.globalTelegramBacklog) warnings.push('global_backlog_unavailable');
  if (!payload.ingestMetrics) warnings.push('ingest_metrics_unavailable');

  return {
    transferThroughput,
    globalTelegramBacklog,
    ingestMetrics,
    backlogBySourceId,
    meta: {
      partial: payload.meta?.partial === true || warnings.length > 0,
      warnings: [...new Set(warnings)],
      fetchedAt: payload.meta?.fetchedAt || new Date().toISOString(),
      error: payload.meta?.error || undefined,
    },
  };
}

export function buildEmptyPipelineBacklogResponse(errorMessage) {
  return normalizePipelineBacklogResponse({
    transferThroughput: DEFAULT_TRANSFER_THROUGHPUT,
    globalTelegramBacklog: DEFAULT_GLOBAL_TELEGRAM_BACKLOG,
    ingestMetrics: DEFAULT_INGEST_METRICS,
    backlogBySourceId: {},
    meta: {
      partial: true,
      warnings: ['backlog_enrichment_failed'],
      fetchedAt: new Date().toISOString(),
      error: errorMessage,
    },
  });
}
