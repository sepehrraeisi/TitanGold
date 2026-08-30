import { query } from '../database/db.js';
import {
  ingestedAtSql,
  resolveIngestedAtIso,
  resolvePublishedAtIso,
} from './collectedDataTimestamps.js';
import { coerceReadModel } from './normalizers/normalizedDataContract.js';
import { batchTelegramCollectorEnrichment } from './telegramCollectorSourceStatus.js';
import {
  PIPELINE_SOURCE_STATUS_HINTS,
  resolvePipelineSourceQualityStatus,
} from './pipelineSourceQualityStatus.js';
import {
  batchCollectorBacklogIntelligence,
  fetchGlobalTelegramBacklogSummary,
  fetchTransferThroughput24h,
} from './telegramBacklogIntelligence.js';
import { getOrLoadCached } from './pipelineSnapshotCache.js';
import { getDuplicateUrlDashboard } from './dataSourceUrlDuplicateService.js';
import { buildPipelineNormalizationSummary } from './pipelineNormalizationSummary.js';
import { logger } from './logger.js';

/**
 * Map canonical 24h normalization summary → health-card percent.
 * REAL_ZERO: loaded + finite passRate 0 → 0
 * REAL_VALUE: loaded + finite passRate → passRate * 100
 * UNAVAILABLE: not loaded / non-finite → null (never silent 0)
 * @param {object|null|undefined} summary
 * @returns {{
 *   normalizedPercent: number|null,
 *   metricsAvailability: { normalizedPercent: 'available'|'unavailable' },
 *   normalizedPercentUnavailableReason: string|null
 * }}
 */
export function resolveNormalizedPercentFromSummary(summary) {
  const loaded = summary?.meta?.loaded === true;
  const passRate = summary?.passRate;
  if (loaded && Number.isFinite(passRate)) {
    return {
      normalizedPercent: Number((passRate * 100).toFixed(1)),
      metricsAvailability: { normalizedPercent: 'available' },
      normalizedPercentUnavailableReason: null,
    };
  }
  return {
    normalizedPercent: null,
    metricsAvailability: { normalizedPercent: 'unavailable' },
    normalizedPercentUnavailableReason:
      summary?.meta?.unavailableReason || 'not_loaded',
  };
}

/** @deprecated import from normalizedDataContract — kept for tests */
export function normalizeReadModel(normalized) {
  return coerceReadModel(normalized);
}

export { PIPELINE_SOURCE_STATUS_HINTS } from './pipelineSourceQualityStatus.js';
export {
  isFetchTimeoutIndicator,
  resolveFetchPathPipelineStatus,
  resolvePipelineSourceQualityStatus,
} from './pipelineSourceQualityStatus.js';

function resolvePipelineSourceStatus(row, enrichment) {
  return resolvePipelineSourceQualityStatus(row, enrichment);
}

function extractResponseTimeMs({ logExecutionMs, collectedMetadata, logMetadata }) {
  if (logExecutionMs != null && Number.isFinite(Number(logExecutionMs))) {
    return Number(logExecutionMs);
  }

  const sources = [collectedMetadata, logMetadata].filter(Boolean);
  for (const meta of sources) {
    for (const key of ['response_time_ms', 'execution_time_ms', 'duration_ms']) {
      const val = meta[key];
      if (val != null && Number.isFinite(Number(val))) {
        return Number(val);
      }
    }
  }

  return undefined;
}

function resolveNormalizedPreviewStatus(row) {
  const statusRaw = String(row.status || '').toLowerCase();
  const hasNormalized =
    row.normalized_data != null &&
    typeof row.normalized_data === 'object' &&
    Object.keys(row.normalized_data).length > 0;
  const hasRaw =
    row.raw_data != null &&
    typeof row.raw_data === 'object' &&
    Object.keys(row.raw_data).length > 0;
  const hasError = statusRaw === 'error' || Boolean(row.error_message);
  const metadata = row.normalized_data?.metadata || row.metadata || {};
  const hasQualityIssue =
    metadata.quality_warning === true ||
    metadata.validation_failed === true ||
    (Array.isArray(metadata.quality_issues) && metadata.quality_issues.length > 0);

  if (hasError) return 'rejected';
  if (hasNormalized && !hasQualityIssue) return 'ready';
  if (hasQualityIssue) return 'warning';
  if (statusRaw === 'pending' || (hasRaw && !hasNormalized)) return 'pending_normalization';
  if (hasRaw) return 'ingested';
  return 'pending_normalization';
}

function resolveQualityDisplay(row, status) {
  const readMeta = row.normalized_data?.metadata;
  const metadata =
    readMeta && typeof readMeta === 'object'
      ? readMeta
      : row.metadata && typeof row.metadata === 'object'
        ? row.metadata
        : {};
  if (metadata.quality_score_v2 != null && Number.isFinite(Number(metadata.quality_score_v2))) {
    return {
      qualityScore: Number(metadata.quality_score_v2),
      qualityPending: false,
      qualityReasonCodes: Array.isArray(metadata.quality_reason_codes)
        ? metadata.quality_reason_codes
        : undefined,
    };
  }
  if (metadata.quality_score != null && Number.isFinite(Number(metadata.quality_score))) {
    return { qualityScore: Number(metadata.quality_score), qualityPending: false };
  }
  if (status === 'ready') {
    return { qualityScore: undefined, qualityPending: false };
  }
  if (status === 'pending_normalization' || status === 'ingested') {
    return { qualityScore: undefined, qualityPending: true };
  }
  return { qualityScore: undefined, qualityPending: false };
}

function mapToNormalizedRecord(row, categoryName) {
  const read = coerceReadModel(row.normalized_data);
  const normalized = row.normalized_data || {};
  const metadata = read?.metadata || normalized.metadata || row.metadata || {};
  const status = resolveNormalizedPreviewStatus(row);
  const { qualityScore, qualityPending, qualityReasonCodes } = resolveQualityDisplay(row, status);

  const issues = [];
  if (row.error_message) issues.push(String(row.error_message).slice(0, 200));

  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name || read?.sourceName || undefined,
    category: categoryName || read?.category || 'uncategorized',
    dataType: metadata.data_type || read?.sourceType || row.source_type || 'unknown',
    tags: read?.tags?.length ? read.tags : Array.isArray(metadata.tags) ? metadata.tags : [],
    payload: {
      title: read?.title || normalized.title || normalized.content?.slice?.(0, 120),
      content:
        typeof read?.content === 'string'
          ? read.content
          : typeof normalized.content === 'string'
            ? normalized.content
            : undefined,
      value: normalized.value,
      metadata,
    },
    qualityScore,
    qualityPending: qualityPending || undefined,
    qualityReasonCodes: qualityReasonCodes?.length ? qualityReasonCodes : undefined,
    issues,
    status,
    ingestedAt: resolveIngestedAtIso(row),
    publishedAt: resolvePublishedAtIso(row),
    receivedAt: resolveIngestedAtIso(row) || new Date(row.collected_at).toISOString(),
    normalizedAt: new Date(row.processed_at || row.collected_at).toISOString(),
  };
}

/**
 * Build pipeline view for DataHub Pipeline tab (GAP-012).
 * Heavy sections are opt-in so summary endpoints and list pages stay responsive.
 * @param {{
 *   includeBacklog?: boolean,
 *   includeTelegramBacklog?: boolean,
 *   includeCategoryScreening?: boolean,
 *   includeNormalizationSummary?: boolean,
 *   includeDuplicateAnalysis?: boolean,
 *   includeRecentPreview?: boolean,
 *   useCache?: boolean
 * }} [options]
 */
export async function buildDataPipelineView(options = {}) {
  const {
    includeBacklog = false,
    includeTelegramBacklog = includeBacklog,
    includeCategoryScreening = false,
    includeNormalizationSummary = false,
    includeDuplicateAnalysis = false,
    includeRecentPreview = false,
    useCache = true,
  } = options;
  const flags = {
    includeTelegramBacklog,
    includeCategoryScreening,
    includeNormalizationSummary,
    includeDuplicateAnalysis,
    includeRecentPreview,
  };
  const cacheKey = `pipeline:view:${Object.entries(flags).map(([k, v]) => `${k}:${v ? 1 : 0}`).join('|')}`;

  const loader = () => buildDataPipelineViewUncached(flags);
  if (useCache) {
    return getOrLoadCached(cacheKey, loader);
  }
  return loader();
}

async function timedSection(section, fn) {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    logger.info('PIPELINE_TIMING', { section, duration_ms: Date.now() - start });
  }
}

function emptyNormalizationSummary() {
  return {
    totalProcessed: 0,
    passed: 0,
    warnings: 0,
    rejected: 0,
    lastProcessedAt: undefined,
  };
}

function estimateTotalRecords(row) {
  const estimated = Number(row?.estimated_total_records || 0);
  return Number.isFinite(estimated) && estimated > 0 ? Math.round(estimated) : 0;
}

async function loadHealthCards() {
  const [stats24h, totals, pendingResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS total_requests_24h,
        COUNT(*) FILTER (WHERE status IN ('success', 'cached'))::int AS passed_24h,
        COUNT(*) FILTER (
          WHERE LOWER(status) IN ('failure', 'failed', 'error')
        )::int AS failed_24h
      FROM data_hub_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `),
    query(`
      SELECT GREATEST(reltuples::bigint, 0)::bigint AS estimated_total_records
      FROM pg_class
      WHERE oid = 'collected_data'::regclass
    `),
    query(`
      SELECT COUNT(*)::int AS pending_24h
      FROM collected_data
      WHERE status = 'pending'
        AND collected_at > NOW() - INTERVAL '24 hours'
    `),
  ]);
  const row = stats24h.rows[0] || {};
  row.pending_24h = pendingResult.rows[0]?.pending_24h ?? 0;
  stats24h.rows[0] = row;
  return { stats24h, totals };
}

async function loadSourceQualityRows() {
  return query(`
    SELECT
      ds.id AS source_id,
      NULL::text AS status,
      NULL::timestamptz AS collected_at,
      NULL::jsonb AS normalized_data,
      '{}'::jsonb AS metadata,
      ds.name,
      ds.type,
      ds.category,
      ds.config,
      ds.credentials,
      ds.is_active,
      ds.last_fetch_at,
      ds.last_status AS ds_last_status,
      dc.name AS category_name,
      dhl.execution_time_ms AS log_execution_time_ms,
      dhl.log_metadata,
      dhl.message AS log_message,
      dhl.status AS log_status
    FROM data_sources ds
    LEFT JOIN data_categories dc ON dc.name = ds.category
    LEFT JOIN LATERAL (
      SELECT
        execution_time_ms,
        metadata AS log_metadata,
        message,
        status
      FROM data_hub_logs
      WHERE source_id = ds.id
      ORDER BY created_at DESC
      LIMIT 1
    ) dhl ON true
    ORDER BY ds.name
  `);
}

async function loadCategoryScreening() {
  return query(`
    WITH category_counts AS (
      SELECT
        ds.category,
        COUNT(*)::int AS inflow,
        COUNT(*) FILTER (
          WHERE cd.status = 'processed'
            AND cd.normalized_data IS NOT NULL
        )::int AS passed_count
      FROM collected_data cd
      INNER JOIN data_sources ds ON ds.id = cd.source_id
      WHERE ${ingestedAtSql('cd')} > NOW() - INTERVAL '24 hours'
      GROUP BY ds.category
    )
    SELECT
      dc.id AS category_id,
      dc.name,
      COALESCE(cc.inflow, 0)::int AS inflow,
      COALESCE(cc.passed_count, 0)::int AS passed_count
    FROM data_categories dc
    LEFT JOIN category_counts cc ON cc.category = dc.name
    ORDER BY dc.name
  `);
}

async function loadHistoryRows() {
  return { rows: [] };
}

async function loadNormalizationSummary() {
  return query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('processed', 'error'))::int AS total_processed,
      COUNT(*) FILTER (WHERE status = 'processed' AND normalized_data IS NOT NULL)::int AS passed,
      COUNT(*) FILTER (
        WHERE status = 'processed'
          AND normalized_data IS NOT NULL
          AND (
            normalized_data->'metadata'->>'quality_warning' = 'true'
            OR normalized_data->'metadata'->>'quality_band' IN ('weak', 'poor')
          )
      )::int AS warnings,
      COUNT(*) FILTER (WHERE status = 'error')::int AS rejected,
      MAX(processed_at) FILTER (WHERE status = 'processed') AS last_processed_at
    FROM collected_data
    WHERE processed_at > NOW() - INTERVAL '7 days'
       OR ${ingestedAtSql()} > NOW() - INTERVAL '7 days'
  `);
}

async function loadRecentPreview() {
  return query(`
    SELECT
      cd.*,
      ds.name AS source_name,
      ds.type AS source_type,
      COALESCE(ds.category, dc.name, 'uncategorized') AS category_name
    FROM collected_data cd
    LEFT JOIN data_sources ds ON ds.id = cd.source_id
    LEFT JOIN data_categories dc ON dc.name = ds.category
    WHERE cd.processed_at > NOW() - INTERVAL '7 days'
       OR ${ingestedAtSql('cd')} > NOW() - INTERVAL '7 days'
    ORDER BY cd.processed_at DESC NULLS LAST, ${ingestedAtSql('cd')} DESC
    LIMIT 8
  `);
}

async function buildDataPipelineViewUncached({
  includeTelegramBacklog,
  includeCategoryScreening,
  includeNormalizationSummary,
  includeDuplicateAnalysis,
  includeRecentPreview,
}) {
  const now = new Date();

  const [
    healthCards,
    sourcesRows,
    categoriesRows,
    historyRows,
    summaryRow,
    recentRows,
    duplicateAnalysis,
    pipelineNormSummary,
  ] = await Promise.all([
    timedSection('health_cards', loadHealthCards),
    timedSection('source_quality_board', loadSourceQualityRows),
    includeCategoryScreening
      ? timedSection('category_screening', loadCategoryScreening)
      : Promise.resolve({ rows: [] }),
    timedSection('history', loadHistoryRows),
    includeNormalizationSummary
      ? timedSection('normalization_summary', loadNormalizationSummary)
      : Promise.resolve({ rows: [] }),
    includeRecentPreview
      ? timedSection('recent_preview', loadRecentPreview)
      : Promise.resolve({ rows: [] }),
    includeDuplicateAnalysis
      ? timedSection('duplicate_analysis', getDuplicateUrlDashboard)
      : Promise.resolve(null),
    timedSection('pipeline_norm_percent', buildPipelineNormalizationSummary),
  ]);
  const { stats24h, totals } = healthCards;

  const s24 = stats24h.rows[0] || {};
  const tot = totals.rows[0] || {};
  const totalRecords = estimateTotalRecords(tot);
  const {
    normalizedPercent,
    metricsAvailability,
    normalizedPercentUnavailableReason,
  } = resolveNormalizedPercentFromSummary(pipelineNormSummary);

  const collectorEnrichment = await timedSection(
    'collector_enrichment',
    () => batchTelegramCollectorEnrichment(
      sourcesRows.rows.map((row) => ({ ...row, id: row.source_id })),
      {
        includeMessageStats: includeTelegramBacklog,
        includeCollectedStats: includeTelegramBacklog,
      },
    ),
  );

  let transferThroughput;
  let globalTelegramBacklog;
  let backlogByChannel = new Map();

  if (includeTelegramBacklog) {
    [transferThroughput, globalTelegramBacklog] = await timedSection(
      'telegram_backlog',
      () => Promise.all([
        fetchTransferThroughput24h(),
        fetchGlobalTelegramBacklogSummary(),
      ]),
    );

    const collectorChannelIds = [
      ...new Set(
        [...collectorEnrichment.values()]
          .filter((e) => e.ingestion_mode === 'collector' && e.collector_channel_id)
          .map((e) => e.collector_channel_id),
      ),
    ];
    backlogByChannel = await batchCollectorBacklogIntelligence(
      collectorChannelIds,
      transferThroughput,
    );
  }

  const sources = sourcesRows.rows.map(row => {
    const enrichment = collectorEnrichment.get(row.source_id);
    const { lastStatus, operationalStatus, statusHint } = resolvePipelineSourceStatus(row, enrichment);

    const collectorBacklog =
      enrichment?.ingestion_mode === 'collector' && enrichment.collector_channel_id
        ? backlogByChannel.get(enrichment.collector_channel_id)
        : undefined;

    const issues = [];
    if (row.is_active === false) issues.push('inactive');
    if (
      lastStatus === 'fetch_error' ||
      lastStatus === 'fetch_timeout' ||
      lastStatus === 'collector_error'
    ) {
      issues.push('last_request_failed');
    }
    if (
      !row.collected_at &&
      operationalStatus !== 'active' &&
      operationalStatus !== 'pending' &&
      operationalStatus !== 'linked'
    ) {
      issues.push('no_data');
    }
    if (operationalStatus === 'error') issues.push('collector_unavailable');

    const metadata = row.metadata || {};
    const collectorActivity =
      enrichment?.latest_message_at || enrichment?.latest_collected_at || null;
    const lastResponseTime = extractResponseTimeMs({
      logExecutionMs: row.log_execution_time_ms,
      collectedMetadata: metadata,
      logMetadata: row.log_metadata,
    });

    return {
      sourceId: row.source_id,
      name: row.name,
      category: row.category_name || row.category || 'uncategorized',
      lastDataType: metadata.data_type || row.type || 'unknown',
      lastStatus,
      operationalStatus: operationalStatus || undefined,
      statusHint: statusHint || undefined,
      collectorBacklog: collectorBacklog || undefined,
      lastResponseTime,
      lastChecked:
        resolveIngestedAtIso(row) ||
        (row.collected_at ? new Date(row.collected_at).toISOString() : undefined) ||
        (collectorActivity ? new Date(collectorActivity).toISOString() : undefined) ||
        (row.last_fetch_at ? new Date(row.last_fetch_at).toISOString() : undefined),
      issues,
    };
  });

  const categories = categoriesRows.rows.map(row => {
    const inflow = parseInt(row.inflow, 10) || 0;
    const passedCount = parseInt(row.passed_count, 10) || 0;
    const passRate = inflow === 0 ? 100 : Number(((passedCount / inflow) * 100).toFixed(1));
    return {
      categoryId: row.category_id,
      name: row.name,
      inflow,
      passRate,
    };
  });

  const snapshot = {
    lastRefreshed: now.toISOString(),
    totalRequests24h: parseInt(s24.total_requests_24h, 10) || 0,
    passed24h: parseInt(s24.passed_24h, 10) || 0,
    failed24h: parseInt(s24.failed_24h, 10) || 0,
    pending24h: parseInt(s24.pending_24h, 10) || 0,
    totalRecords,
    normalizedPercent,
    metricsAvailability,
    normalizedPercentUnavailableReason:
      metricsAvailability.normalizedPercent === 'unavailable'
        ? normalizedPercentUnavailableReason
        : undefined,
    transferThroughput: transferThroughput || undefined,
    globalTelegramBacklog: globalTelegramBacklog || undefined,
    sources,
    categories,
  };

  const history = historyRows.rows.map(row => {
    const generatedAt = new Date(row.bucket).toISOString();
    const hourTotal = parseInt(row.total_records, 10) || 0;
    const hourNorm = parseFloat(row.normalized_percent) || 0;
    return {
      id: `pipeline-hour-${generatedAt}`,
      generatedAt,
      snapshot: {
        lastRefreshed: generatedAt,
        totalRequests24h: hourTotal,
        passed24h: Math.round(hourTotal * (hourNorm / 100)),
        failed24h: 0,
        pending24h: 0,
        totalRecords: hourTotal,
        normalizedPercent: hourNorm,
        sources: [],
        categories: [],
      },
    };
  });

  const sum = summaryRow.rows[0] || {};
  const normalizationSummary = includeNormalizationSummary
    ? {
        totalProcessed: parseInt(sum.total_processed, 10) || 0,
        passed: parseInt(sum.passed, 10) || 0,
        warnings: parseInt(sum.warnings, 10) || 0,
        rejected: parseInt(sum.rejected, 10) || 0,
        lastProcessedAt: sum.last_processed_at
          ? new Date(sum.last_processed_at).toISOString()
          : undefined,
      }
    : emptyNormalizationSummary();

  const normalizedData = recentRows.rows.map(row =>
    mapToNormalizedRecord(row, row.category_name),
  );

  return {
    snapshot,
    history,
    normalizationSummary,
    normalizedData,
    duplicateAnalysis: duplicateAnalysis || undefined,
  };
}
