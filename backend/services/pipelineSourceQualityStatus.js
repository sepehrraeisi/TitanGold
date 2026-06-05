import {
  mapCollectorOperationalToPipelineStatus,
  resolveCollectorOperationalStatus,
} from './telegramCollectorSourceStatus.js';

/**
 * Source Quality Board status model (DH-PIPELINE-FIX-3).
 * @typedef {'success'|'pending_normalization'|'no_data'|'fetch_error'|'fetch_timeout'|'inactive'|'collector_active'|'collector_pending'|'collector_linked'|'collector_error'} PipelineSourceQualityStatus
 */

/** i18n keys for optional status tooltips in Pipeline UI. */
export const PIPELINE_SOURCE_STATUS_HINTS = {
  no_data: 'pipeline_source_hint_no_data',
  pending_normalization: 'pipeline_source_hint_pending_normalization',
  fetch_timeout: 'pipeline_source_hint_fetch_timeout',
  fetch_error: 'pipeline_source_hint_fetch_error',
  collector_pending: 'pipeline_source_hint_collector_pending',
  collector_linked: 'pipeline_source_hint_collector_linked',
  collector_error: 'pipeline_source_hint_collector_error',
  inactive: 'pipeline_source_hint_inactive',
};

/**
 * @param {{ lastStatus?: string|null, logMessage?: string|null }} input
 * @returns {boolean}
 */
export function isFetchTimeoutIndicator({ lastStatus, logMessage }) {
  const status = String(lastStatus || '').toLowerCase();
  if (status.includes('timeout')) return true;

  const msg = String(logMessage || '').toLowerCase();
  return (
    /timed?\s*out/.test(msg) ||
    msg.includes('etimedout') ||
    msg.includes('econnaborted') ||
    /timeout\s*\(\d+s/.test(msg) ||
    msg.includes('connection timed out')
  );
}

/**
 * RSS/API/bot-pull status when collector operational path does not apply.
 * @param {object} row
 * @returns {PipelineSourceQualityStatus}
 */
export function resolveFetchPathPipelineStatus(row) {
  if (row.is_active === false) {
    return 'inactive';
  }

  const cdStatus = row.status ? String(row.status).toLowerCase() : null;

  if (cdStatus === 'processed') return 'success';
  if (cdStatus === 'pending') return 'pending_normalization';
  if (cdStatus === 'error') return 'fetch_error';

  const dsLastStatus = String(row.ds_last_status || '').toLowerCase();
  const logMessage = row.log_message || '';
  const logStatus = String(row.log_status || '').toLowerCase();

  const fetchFailed =
    dsLastStatus === 'error' ||
    dsLastStatus === 'failed' ||
    logStatus === 'failure' ||
    logStatus === 'failed' ||
    logStatus === 'error';

  if (fetchFailed) {
    if (isFetchTimeoutIndicator({ lastStatus: dsLastStatus, logMessage })) {
      return 'fetch_timeout';
    }
    return 'fetch_error';
  }

  return 'no_data';
}

/**
 * @param {object} row - source row with latest collected_data + fetch fields
 * @param {object|null|undefined} enrichment - telegram collector enrichment
 * @returns {{ lastStatus: PipelineSourceQualityStatus, operationalStatus: string|null, statusHint?: string }}
 */
export function resolvePipelineSourceQualityStatus(row, enrichment) {
  const operationalStatus = resolveCollectorOperationalStatus(
    {
      type: row.type,
      config: row.config,
      credentials: row.credentials,
    },
    enrichment,
  );

  if (operationalStatus) {
    const lastStatus = mapCollectorOperationalToPipelineStatus(operationalStatus);
    return {
      lastStatus,
      operationalStatus,
      statusHint: PIPELINE_SOURCE_STATUS_HINTS[lastStatus],
    };
  }

  const lastStatus = resolveFetchPathPipelineStatus(row);
  return {
    lastStatus,
    operationalStatus: null,
    statusHint: PIPELINE_SOURCE_STATUS_HINTS[lastStatus],
  };
}
