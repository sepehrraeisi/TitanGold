#!/usr/bin/env node
/**
 * Read-only Telegram vs Pipeline count reconciliation (DH-DATA-PIPELINE-PX).
 */
import { query } from '../database/db.js';
import { buildDataPipelineView } from '../services/dataPipelineSnapshot.js';
import { ingestedAtSql } from '../services/collectedDataTimestamps.js';

async function q(label, sql, params = []) {
  const start = Date.now();
  const result = await query(sql, params);
  const ms = Date.now() - start;
  return { label, ms, rows: result.rows, row: result.rows[0] || {} };
}

async function main() {
  const results = {};

  results.telegram_messages_created_at = await q('tm_created_at_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_messages
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  results.telegram_messages_telegram_date = await q('tm_telegram_created_at_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_messages
    WHERE telegram_created_at > NOW() - INTERVAL '24 hours'
  `);

  results.telegram_messages_processed_at = await q('tm_processed_at_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_messages
    WHERE processed_at > NOW() - INTERVAL '24 hours'
  `);

  results.telegram_messages_is_processed_24h = await q('tm_marked_processed_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_messages
    WHERE is_processed = true AND processed_at > NOW() - INTERVAL '24 hours'
  `);

  results.processed_telegram_messages = await q('ptm_created_at_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM processed_telegram_messages
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  results.telegram_news_events = await q('tne_created_at_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_news_events
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  results.collected_data_telegram = await q('cd_telegram_collected_at', `
    SELECT COUNT(*)::bigint AS cnt FROM collected_data cd
    INNER JOIN data_sources ds ON ds.id = cd.source_id
    WHERE ds.type = 'telegram' AND cd.collected_at > NOW() - INTERVAL '24 hours'
  `);

  results.collected_data_telegram_ingested = await q('cd_telegram_ingested_at', `
    SELECT COUNT(*)::bigint AS cnt FROM collected_data cd
    INNER JOIN data_sources ds ON ds.id = cd.source_id
    WHERE ds.type = 'telegram' AND ${ingestedAtSql('cd')} > NOW() - INTERVAL '24 hours'
  `);

  results.data_hub_logs = await q('dhl_created_at_24h', `
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status IN ('success','cached'))::bigint AS passed,
      COUNT(*) FILTER (WHERE status IN ('failed','timeout'))::bigint AS failed
    FROM data_hub_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  results.data_hub_logs_by_action = await q('dhl_by_action_24h', `
    SELECT action, COUNT(*)::int AS cnt
    FROM data_hub_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY action ORDER BY cnt DESC LIMIT 20
  `);

  results.data_hub_logs_telegram_sources = await q('dhl_telegram_sources_24h', `
    SELECT COUNT(*)::bigint AS cnt
    FROM data_hub_logs dhl
    INNER JOIN data_sources ds ON ds.id = dhl.source_id
    WHERE ds.type = 'telegram' AND dhl.created_at > NOW() - INTERVAL '24 hours'
  `);

  results.agent_impacts = await q('agent_impacts_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_agent_impacts
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  results.actionable = await q('actionable_24h', `
    SELECT COUNT(*)::bigint AS cnt FROM telegram_agent_impacts
    WHERE created_at > NOW() - INTERVAL '24 hours' AND requires_action = true
  `);

  results.tm_unprocessed = await q('tm_unprocessed_backlog', `
    SELECT
      COUNT(*) FILTER (WHERE is_processed = false)::bigint AS unprocessed_total,
      COUNT(*) FILTER (WHERE is_processed = false AND created_at > NOW() - INTERVAL '24 hours')::bigint AS unprocessed_created_24h
    FROM telegram_messages
  `);

  results.channels_linked = await q('channel_linkage', `
    SELECT
      (SELECT COUNT(*)::int FROM telegram_channels WHERE is_active = true) AS active_collector_channels,
      (SELECT COUNT(*)::int FROM data_sources WHERE type = 'telegram' AND is_active = true) AS active_telegram_sources,
      (SELECT COUNT(*)::int FROM data_sources WHERE type = 'telegram' AND is_active = true AND config->>'channelId' IS NOT NULL) AS sources_with_channel_id
  `);

  results.transfer_gap = await q('messages_not_in_collected_data', `
    SELECT COUNT(*)::bigint AS cnt
    FROM telegram_messages tm
    WHERE tm.is_processed = true
      AND tm.processed_at > NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM collected_data cd
        WHERE cd.raw_data->>'telegram_message_id' = tm.message_id::text
      )
  `);

  results.collected_data_status = await q('cd_telegram_status_24h', `
    SELECT cd.status, COUNT(*)::int AS cnt
    FROM collected_data cd
    INNER JOIN data_sources ds ON ds.id = cd.source_id
    WHERE ds.type = 'telegram' AND cd.collected_at > NOW() - INTERVAL '24 hours'
    GROUP BY cd.status ORDER BY cnt DESC
  `);

  results.pipeline_api = await buildDataPipelineView({
    includeCategoryScreening: true,
    includeTelegramBacklog: true,
    useCache: false,
  });

  const out = {
    capturedAt: new Date().toISOString(),
    counts: {
      telegram_messages_by_created_at: Number(results.telegram_messages_created_at.row.cnt),
      telegram_messages_by_telegram_date: Number(results.telegram_messages_telegram_date.row.cnt),
      telegram_messages_by_processed_at: Number(results.telegram_messages_processed_at.row.cnt),
      telegram_messages_marked_processed_24h: Number(results.telegram_messages_is_processed_24h.row.cnt),
      processed_telegram_messages_24h: Number(results.processed_telegram_messages.row.cnt),
      telegram_news_events_24h: Number(results.telegram_news_events.row.cnt),
      collected_data_telegram_collected_at_24h: Number(results.collected_data_telegram.row.cnt),
      collected_data_telegram_ingested_at_24h: Number(results.collected_data_telegram_ingested.row.cnt),
      data_hub_logs_total_24h: Number(results.data_hub_logs.row.total),
      data_hub_logs_passed_24h: Number(results.data_hub_logs.row.passed),
      data_hub_logs_failed_24h: Number(results.data_hub_logs.row.failed),
      data_hub_logs_telegram_sources_24h: Number(results.data_hub_logs_telegram_sources.row.cnt),
      agent_impacts_24h: Number(results.agent_impacts.row.cnt),
      actionable_24h: Number(results.actionable.row.cnt),
      unprocessed_backlog: Number(results.tm_unprocessed.row.unprocessed_total),
      unprocessed_created_24h: Number(results.tm_unprocessed.row.unprocessed_created_24h),
      processed_not_in_collected_data_24h: Number(results.transfer_gap.row.cnt),
      pipeline_totalRequests24h: results.pipeline_api.snapshot?.totalRequests24h,
      pipeline_categories_with_inflow: (results.pipeline_api.snapshot?.categories || []).filter(c => c.inflow > 0).length,
    },
    data_hub_logs_by_action: results.data_hub_logs_by_action.rows,
    collected_data_telegram_status: results.collected_data_status.rows,
    channel_linkage: results.channel_linkage.row,
    category_screening: results.pipeline_api.snapshot?.categories || [],
    transfer_throughput: results.pipeline_api.snapshot?.transferThroughput,
    global_backlog: results.pipeline_api.snapshot?.globalTelegramBacklog,
    query_ms: Object.fromEntries(Object.entries(results).filter(([k]) => k !== 'pipeline_api').map(([k, v]) => [k, v.ms])),
  };

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
