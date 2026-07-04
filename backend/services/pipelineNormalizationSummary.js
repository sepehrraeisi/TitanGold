import { query } from '../database/db.js';
import { logger } from './logger.js';
import { getOrLoadCached } from './pipelineSnapshotCache.js';

export const PIPELINE_NORM_SUMMARY_CACHE_KEY = 'pipeline:normalization-summary:v1';
export const PIPELINE_NORM_SUMMARY_TTL_MS = 60_000;
export const PIPELINE_NORM_SUMMARY_TIMEOUT_MS = Number(
  process.env.PIPELINE_NORM_SUMMARY_TIMEOUT_MS || 120_000,
);
export const PIPELINE_NORM_SUMMARY_WARNINGS_TIMEOUT_MS = Number(
  process.env.PIPELINE_NORM_SUMMARY_WARNINGS_TIMEOUT_MS || 20_000,
);
export const PIPELINE_NORM_SUMMARY_WINDOW_HOURS = 24;

function unloadedResponse(reason) {
  return {
    windowHours: PIPELINE_NORM_SUMMARY_WINDOW_HOURS,
    totalProcessed: null,
    passed: null,
    warnings: null,
    rejected: null,
    passRate: null,
    lastProcessedAt: null,
    meta: {
      loaded: false,
      cachedAt: null,
      queryMs: null,
      partial: true,
      unavailableReason: reason || 'not_loaded',
    },
  };
}

function loadedResponse(row, queryMs, options = {}) {
  const { partial = false } = options;
  const rejected = parseInt(row.rejected, 10);
  const passed = parseInt(row.passed, 10);
  const warningsRaw = row.warnings;
  const warnings =
    warningsRaw == null ? null : parseInt(warningsRaw, 10);
  const safeRejected = Number.isFinite(rejected) ? rejected : 0;
  const safePassed = Number.isFinite(passed) ? passed : 0;
  const totalProcessed = safeRejected + safePassed;
  const passRate =
    totalProcessed > 0 ? Number((safePassed / totalProcessed).toFixed(4)) : 0;

  return {
    windowHours: PIPELINE_NORM_SUMMARY_WINDOW_HOURS,
    totalProcessed,
    passed: safePassed,
    warnings: Number.isFinite(warnings) ? warnings : null,
    rejected: safeRejected,
    passRate,
    lastProcessedAt: row.last_processed_at
      ? new Date(row.last_processed_at).toISOString()
      : null,
    meta: {
      loaded: true,
      cachedAt: new Date().toISOString(),
      queryMs,
      partial: partial || warnings == null,
      unavailableReason: null,
    },
  };
}

async function raceQuery(sql, params, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      query(sql, params),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('query_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadNormalizationSummary24h() {
  const started = Date.now();
  try {
    const corePromise = Promise.all([
      raceQuery(
        `SELECT COUNT(*)::int AS rejected
         FROM collected_data
         WHERE processed_at > NOW() - INTERVAL '24 hours'
           AND status = 'error'`,
        [],
        PIPELINE_NORM_SUMMARY_TIMEOUT_MS,
      ),
      raceQuery(
        `SELECT COUNT(*)::int AS passed
         FROM collected_data
         WHERE processed_at > NOW() - INTERVAL '24 hours'
           AND status = 'processed'
           AND normalized_data IS NOT NULL`,
        [],
        PIPELINE_NORM_SUMMARY_TIMEOUT_MS,
      ),
      raceQuery(
        `SELECT MAX(processed_at) AS last_processed_at
         FROM collected_data
         WHERE processed_at > NOW() - INTERVAL '24 hours'
           AND status = 'processed'`,
        [],
        PIPELINE_NORM_SUMMARY_TIMEOUT_MS,
      ),
    ]);

    const warningsPromise = raceQuery(
      `SELECT COUNT(*)::int AS warnings
       FROM collected_data
       WHERE processed_at > NOW() - INTERVAL '24 hours'
         AND status = 'processed'
         AND normalized_data IS NOT NULL
         AND (
           normalized_data->'metadata'->>'quality_warning' = 'true'
           OR normalized_data->'metadata'->>'quality_band' IN ('weak', 'poor')
         )`,
      [],
      PIPELINE_NORM_SUMMARY_WARNINGS_TIMEOUT_MS,
    ).catch(() => null);

    const [[rejectedResult, passedResult, lastResult], warningsResult] = await Promise.all([
      corePromise,
      warningsPromise,
    ]);

    const row = {
      rejected: rejectedResult.rows[0]?.rejected ?? 0,
      passed: passedResult.rows[0]?.passed ?? 0,
      warnings: warningsResult?.rows[0]?.warnings ?? null,
      last_processed_at: lastResult.rows[0]?.last_processed_at ?? null,
    };

    return loadedResponse(row, Date.now() - started, {
      partial: warningsResult == null,
    });
  } catch (error) {
    logger.warn('PIPELINE_NORM_SUMMARY_FAILED', {
      error: error?.message || String(error),
      durationMs: Date.now() - started,
    });
    return unloadedResponse(
      error?.message === 'query_timeout' ? 'query_timeout' : error?.message || 'query_failed',
    );
  }
}

/**
 * Cached 24h normalization summary for lazy pipeline UI.
 * Failed/unavailable summaries are not written to cache.
 * @returns {Promise<object>}
 */
export async function buildPipelineNormalizationSummary() {
  try {
    const summary = await getOrLoadCached(
      PIPELINE_NORM_SUMMARY_CACHE_KEY,
      async () => {
        const result = await loadNormalizationSummary24h();
        if (!result.meta.loaded) {
          throw result;
        }
        return result;
      },
      PIPELINE_NORM_SUMMARY_TTL_MS,
    );
    if (summary.meta.loaded && !summary.meta.cachedAt) {
      summary.meta.cachedAt = new Date().toISOString();
    }
    return summary;
  } catch (summary) {
    if (summary?.meta?.loaded === false) {
      return summary;
    }
    throw summary;
  }
}

export { unloadedResponse, loadedResponse, loadNormalizationSummary24h };
