import { query } from '../database/db.js';

function mapDbStatusToUi(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success' || s === 'ok') return 'success';
  if (s === 'cached') return 'cached';
  if (s === 'failure' || s === 'failed' || s === 'error') return 'failed';
  if (s === 'pending' || s === 'timeout' || s === 'warning') return 'timeout';
  return 'success';
}

function uiStatusToDbFilter(status) {
  switch (status) {
    case 'success':
      return ["LOWER(status) IN ('success', 'ok')"];
    case 'cached':
      return ["LOWER(status) = 'cached'"];
    case 'failed':
      return ["LOWER(status) IN ('failure', 'failed', 'error')"];
    case 'timeout':
      return ["LOWER(status) IN ('pending', 'timeout')"];
    default:
      return null;
  }
}

function mapRowToAccessLog(row) {
  const meta =
    typeof row.metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(row.metadata);
          } catch {
            return {};
          }
        })()
      : row.metadata || {};

  const uiStatus = mapDbStatusToUi(row.status);
  const action = row.action || meta.data_type || meta.dataType || 'unknown';

  return {
    id: row.id,
    timestamp: new Date(row.created_at).toISOString(),
    agentId: meta.agent_id || meta.agentId || 'system',
    sourceId: row.source_id || '',
    sourceName: row.source_name || meta.source_name || undefined,
    action,
    dataType: action,
    status: uiStatus,
    message: row.message || undefined,
    metadata: meta,
    responseTime:
      row.execution_time_ms != null ? Number(row.execution_time_ms) : undefined,
    error: uiStatus === 'failed' ? row.message || undefined : undefined,
    dataSize: row.data_size != null ? Number(row.data_size) : undefined,
  };
}

/**
 * List DataHub access logs for Logs tab (GAP-013).
 */
export async function listDataHubAccessLogs({
  limit = 100,
  offset = 0,
  source_id,
  status,
}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (source_id) {
    conditions.push(`l.source_id = $${paramIndex++}`);
    params.push(source_id);
  }

  if (status) {
    const dbFilter = uiStatusToDbFilter(status);
    if (dbFilter) {
      conditions.push(dbFilter[0].replace(/\bstatus\b/g, 'l.status'));
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countWhereClause = whereClause.replace(/\bl\./g, '');

  const [countResult, dataResult, countsResult] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM data_hub_logs ${countWhereClause}`, params),
    query(
      `SELECT l.id, l.source_id, ds.name AS source_name, l.action, l.status, l.message,
              l.data_size, l.execution_time_ms, l.created_at, l.metadata
       FROM data_hub_logs l
       LEFT JOIN data_sources ds ON ds.id = l.source_id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    ),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(status) IN ('success', 'ok'))::int AS success,
        COUNT(*) FILTER (WHERE LOWER(status) = 'cached')::int AS cached,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('failure', 'failed', 'error'))::int AS failed,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('pending', 'timeout', 'warning'))::int AS timeout
      FROM data_hub_logs l
      ${whereClause}`,
      params,
    ),
  ]);

  const total = countResult.rows[0]?.total ?? 0;
  const counts = countsResult.rows[0] || {};

  return {
    data: dataResult.rows.map(mapRowToAccessLog),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    statusCounts: {
      success: parseInt(counts.success, 10) || 0,
      cached: parseInt(counts.cached, 10) || 0,
      failed: parseInt(counts.failed, 10) || 0,
      timeout: parseInt(counts.timeout, 10) || 0,
      /** @deprecated use failed */
      error: parseInt(counts.failed, 10) || 0,
      /** @deprecated use timeout */
      warning: parseInt(counts.timeout, 10) || 0,
    },
  };
}
