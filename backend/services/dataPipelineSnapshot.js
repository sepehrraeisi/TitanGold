import { query } from '../database/db.js';

function mapCollectedStatusToAccessStatus(status) {
  if (status === 'processed') return 'success';
  if (status === 'error') return 'failed';
  if (status === 'pending') return 'timeout';
  return 'success';
}

function mapToNormalizedRecord(row, categoryName) {
  const normalized = row.normalized_data || {};
  const metadata = normalized.metadata || row.metadata || {};
  const statusRaw = row.status;
  let status = 'ready';
  if (statusRaw === 'error') status = 'rejected';
  else if (statusRaw === 'pending' || !row.normalized_data) status = 'warning';

  const issues = [];
  if (row.error_message) issues.push(String(row.error_message).slice(0, 200));

  return {
    id: row.id,
    sourceId: row.source_id,
    category: categoryName || 'uncategorized',
    dataType: metadata.data_type || row.source_type || 'unknown',
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    payload: {
      title: normalized.title || normalized.content?.slice?.(0, 120),
      content: typeof normalized.content === 'string' ? normalized.content : undefined,
      value: normalized.value,
      metadata,
    },
    qualityScore: Number(metadata.quality_score ?? (status === 'ready' ? 90 : 60)),
    issues,
    status,
    receivedAt: new Date(row.collected_at).toISOString(),
    normalizedAt: new Date(row.processed_at || row.collected_at).toISOString(),
  };
}

/**
 * Build pipeline view for DataHub Pipeline tab (GAP-012).
 */
export async function buildDataPipelineView() {
  const now = new Date();

  const [stats24h, totals, sourcesRows, categoriesRows, historyRows, summaryRow, recentRows] =
    await Promise.all([
      query(`
        SELECT
          COUNT(*)::int AS total_requests_24h,
          COUNT(*) FILTER (WHERE status = 'processed' AND normalized_data IS NOT NULL)::int AS passed_24h,
          COUNT(*) FILTER (WHERE status = 'error')::int AS failed_24h,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_24h
        FROM collected_data
        WHERE collected_at > NOW() - INTERVAL '24 hours'
      `),
      query(`
        SELECT
          COUNT(*)::int AS total_records,
          COUNT(*) FILTER (WHERE normalized_data IS NOT NULL)::int AS normalized_count
        FROM collected_data
      `),
      query(`
        SELECT
          ds.id AS source_id,
          cd.status,
          cd.collected_at,
          cd.normalized_data,
          cd.metadata,
          ds.name,
          ds.type,
          ds.category,
          ds.is_active,
          ds.last_fetch_at,
          dc.name AS category_name
        FROM data_sources ds
        LEFT JOIN data_categories dc ON dc.name = ds.category
        LEFT JOIN LATERAL (
          SELECT status, collected_at, normalized_data, metadata
          FROM collected_data
          WHERE source_id = ds.id
          ORDER BY collected_at DESC
          LIMIT 1
        ) cd ON true
        ORDER BY ds.name
      `),
      query(`
        SELECT
          dc.id AS category_id,
          dc.name,
          COUNT(cd.id) FILTER (WHERE cd.collected_at > NOW() - INTERVAL '24 hours')::int AS inflow,
          COUNT(cd.id) FILTER (
            WHERE cd.collected_at > NOW() - INTERVAL '24 hours'
              AND cd.normalized_data IS NOT NULL
          )::int AS passed_count
        FROM data_categories dc
        LEFT JOIN data_sources ds ON ds.category = dc.name
        LEFT JOIN collected_data cd ON cd.source_id = ds.id
        GROUP BY dc.id, dc.name
        ORDER BY dc.name
      `),
      query(`
        SELECT
          date_trunc('hour', collected_at) AS bucket,
          COUNT(*)::int AS total_records,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE normalized_data IS NOT NULL) / NULLIF(COUNT(*), 0),
            1
          ) AS normalized_percent
        FROM collected_data
        WHERE collected_at > NOW() - INTERVAL '24 hours'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      `),
      query(`
        SELECT
          COUNT(*)::int AS total_processed,
          COUNT(*) FILTER (WHERE status = 'processed' AND normalized_data IS NOT NULL)::int AS passed,
          COUNT(*) FILTER (WHERE status = 'processed' AND normalized_data IS NULL)::int AS warnings,
          COUNT(*) FILTER (WHERE status = 'error')::int AS rejected,
          MAX(COALESCE(processed_at, collected_at)) AS last_processed_at
        FROM collected_data
      `),
      query(`
        SELECT
          cd.*,
          ds.name AS source_name,
          ds.type AS source_type,
          COALESCE(ds.category, dc.name, 'uncategorized') AS category_name
        FROM collected_data cd
        LEFT JOIN data_sources ds ON ds.id = cd.source_id
        LEFT JOIN data_categories dc ON dc.name = ds.category
        WHERE cd.normalized_data IS NOT NULL
        ORDER BY cd.processed_at DESC NULLS LAST, cd.collected_at DESC
        LIMIT 6
      `),
    ]);

  const s24 = stats24h.rows[0] || {};
  const tot = totals.rows[0] || {};
  const totalRecords = parseInt(tot.total_records, 10) || 0;
  const normalizedCount = parseInt(tot.normalized_count, 10) || 0;
  const normalizedPercent =
    totalRecords === 0 ? 0 : Number(((normalizedCount / totalRecords) * 100).toFixed(1));

  const sources = sourcesRows.rows.map(row => {
    const issues = [];
    if (row.is_active === false) issues.push('inactive');
    if (row.status === 'error') issues.push('last_request_failed');
    if (!row.collected_at) issues.push('no_data');

    const metadata = row.metadata || {};

    return {
      sourceId: row.source_id,
      name: row.name,
      category: row.category_name || row.category || 'uncategorized',
      lastDataType: metadata.data_type || row.type || 'unknown',
      lastStatus: row.status
        ? mapCollectedStatusToAccessStatus(row.status)
        : 'timeout',
      lastResponseTime: metadata.response_time_ms
        ? Number(metadata.response_time_ms)
        : undefined,
      lastChecked: row.collected_at
        ? new Date(row.collected_at).toISOString()
        : row.last_fetch_at
          ? new Date(row.last_fetch_at).toISOString()
          : undefined,
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
  const normalizationSummary = {
    totalProcessed: parseInt(sum.total_processed, 10) || 0,
    passed: parseInt(sum.passed, 10) || 0,
    warnings: parseInt(sum.warnings, 10) || 0,
    rejected: parseInt(sum.rejected, 10) || 0,
    lastProcessedAt: sum.last_processed_at
      ? new Date(sum.last_processed_at).toISOString()
      : undefined,
  };

  const normalizedData = recentRows.rows.map(row =>
    mapToNormalizedRecord(row, row.category_name),
  );

  return {
    snapshot,
    history,
    normalizationSummary,
    normalizedData,
  };
}
