/** Profile fast pipeline path query timings (DH-PIPELINE-P2) */
import { query } from '../database/db.js';
import { ingestedAtSql } from '../services/collectedDataTimestamps.js';
import { batchTelegramCollectorEnrichment } from '../services/telegramCollectorSourceStatus.js';

async function timed(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  return { label, ms: Date.now() - t0, rows: result?.rows?.length ?? result?.size ?? null };
}

const sourcesSql = `SELECT ds.id AS source_id, cd.status, cd.collected_at, cd.normalized_data, cd.metadata,
  ds.name, ds.type, ds.category, ds.config, ds.credentials, ds.is_active, ds.last_fetch_at,
  ds.last_status AS ds_last_status, dc.name AS category_name,
  dhl.execution_time_ms AS log_execution_time_ms, dhl.log_metadata, dhl.message AS log_message, dhl.status AS log_status
FROM data_sources ds
LEFT JOIN data_categories dc ON dc.name = ds.category
LEFT JOIN (
  SELECT DISTINCT ON (source_id) source_id, status, collected_at, normalized_data, metadata
  FROM collected_data ORDER BY source_id, collected_at DESC
) cd ON cd.source_id = ds.id
LEFT JOIN (
  SELECT DISTINCT ON (source_id) source_id, execution_time_ms, metadata AS log_metadata, message, status
  FROM data_hub_logs ORDER BY source_id, created_at DESC
) dhl ON dhl.source_id = ds.id
ORDER BY ds.name`;

async function main() {
  const results = [];
  results.push(await timed('stats24h', () => query(`SELECT COUNT(*)::int FROM collected_data WHERE ${ingestedAtSql()} > NOW() - INTERVAL '24 hours'`)));
  results.push(await timed('totals', () => query(`SELECT COUNT(*)::int FROM collected_data`)));
  results.push(await timed('sources_lateral', () => query(sourcesSql)));
  results.push(await timed('categories_subquery', () => query(`SELECT dc.id, dc.name FROM data_categories dc ORDER BY dc.name`)));
  results.push(await timed('history', () => query(`SELECT date_trunc('hour', ${ingestedAtSql()}) AS bucket, COUNT(*)::int FROM collected_data WHERE ${ingestedAtSql()} > NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1 DESC LIMIT 12`)));
  results.push(await timed('summary', () => query(`SELECT COUNT(*) FILTER (WHERE status IN ('processed', 'error'))::int FROM collected_data`)));
  results.push(await timed('recent_preview', () => query(`SELECT cd.*, ds.name AS source_name FROM collected_data cd LEFT JOIN data_sources ds ON ds.id = cd.source_id ORDER BY cd.processed_at DESC NULLS LAST LIMIT 8`)));
  const sourcesRows = await query(sourcesSql);
  results.push(await timed('telegram_enrichment_fast', () => batchTelegramCollectorEnrichment(sourcesRows.rows.map(r => ({ ...r, id: r.source_id })), { includeMessageStats: false })));
  results.sort((a, b) => b.ms - a.ms);
  console.log('\n=== FAST PATH QUERY PROFILE ===');
  for (const r of results) console.log(`${String(r.ms).padStart(6)}ms  ${r.label}`);
  console.log(`sum: ${results.reduce((s, r) => s + r.ms, 0)}ms`);
}
main().catch(e => { console.error(e); process.exit(1); });
