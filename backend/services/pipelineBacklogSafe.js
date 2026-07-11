import { logger } from './logger.js';

export const PIPELINE_BACKLOG_METRIC_TIMEOUT_MS = Number(
  process.env.PIPELINE_BACKLOG_METRIC_TIMEOUT_MS || 12_000,
);

/** Canonical metric keys surfaced in meta.unavailableMetrics */
export const TRANSFER_HEALTH_METRIC_KEYS = [
  'incoming24h',
  'transferred24h',
  'processed24h',
  'backlogTotal',
  'oldestUnprocessedAge',
  'processingRate',
  'drainRatio',
  'catchUp',
];

/**
 * @template T
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @param {number} [timeoutMs]
 * @returns {Promise<{ value?: T, error?: string, timedOut?: boolean, available: boolean }>}
 */
export async function loadMetricSafely(label, fn, timeoutMs = PIPELINE_BACKLOG_METRIC_TIMEOUT_MS) {
  let timer;
  try {
    const value = await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
    return { value, available: true };
  } catch (error) {
    const timedOut = error?.message === `${label}_timeout`;
    logger.warn('PIPELINE_BACKLOG_METRIC_FAILED', {
      label,
      timedOut,
      error: error?.message || String(error),
    });
    return {
      error: timedOut ? `${label}_timeout` : error?.message || `${label}_failed`,
      timedOut,
      available: false,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean))];
}

/**
 * @param {object} payload
 * @returns {object}
 */
export function normalizePipelineBacklogResponse(payload = {}) {
  const warnings = uniqueWarnings([
    ...(Array.isArray(payload.meta?.warnings) ? payload.meta.warnings : []),
    ...(Array.isArray(payload.meta?.unavailableMetrics) ? payload.meta.unavailableMetrics : []),
  ]);

  const unavailableMetrics = uniqueWarnings([
    ...(Array.isArray(payload.meta?.unavailableMetrics) ? payload.meta.unavailableMetrics : []),
  ]);

  const transferThroughput = payload.transferThroughput ?? null;
  const globalTelegramBacklog = payload.globalTelegramBacklog ?? null;
  const ingestMetrics = payload.ingestMetrics ?? null;
  const backlogBySourceId =
    payload.backlogBySourceId && typeof payload.backlogBySourceId === 'object'
      ? payload.backlogBySourceId
      : {};

  if (!transferThroughput) {
    unavailableMetrics.push('processed24h', 'processingRate', 'drainRatio', 'catchUp');
  }
  if (!globalTelegramBacklog) {
    unavailableMetrics.push('backlogTotal', 'oldestUnprocessedAge', 'catchUp');
  }
  if (!ingestMetrics) {
    unavailableMetrics.push('incoming24h', 'transferred24h', 'drainRatio');
  } else {
    if (ingestMetrics.incoming24h == null) {
      unavailableMetrics.push('incoming24h', 'drainRatio');
    }
    if (ingestMetrics.transferredToCollectedData24h == null) {
      unavailableMetrics.push('transferred24h');
    }
  }

  const mergedUnavailable = uniqueWarnings(unavailableMetrics);
  const mergedWarnings = uniqueWarnings([...warnings, ...mergedUnavailable]);

  return {
    transferThroughput,
    globalTelegramBacklog,
    ingestMetrics,
    backlogBySourceId,
    meta: {
      partial: payload.meta?.partial === true || mergedWarnings.length > 0,
      warnings: mergedWarnings,
      unavailableMetrics: mergedUnavailable,
      fetchedAt: payload.meta?.fetchedAt || new Date().toISOString(),
      error: payload.meta?.error || undefined,
    },
  };
}

export function buildEmptyPipelineBacklogResponse(errorMessage) {
  return normalizePipelineBacklogResponse({
    transferThroughput: null,
    globalTelegramBacklog: null,
    ingestMetrics: null,
    backlogBySourceId: {},
    meta: {
      partial: true,
      warnings: ['backlog_enrichment_failed'],
      unavailableMetrics: [...TRANSFER_HEALTH_METRIC_KEYS],
      fetchedAt: new Date().toISOString(),
      error: errorMessage,
    },
  });
}
