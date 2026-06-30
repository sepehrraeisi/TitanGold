import {
  batchCollectorBacklogIntelligence,
  fetchGlobalTelegramBacklogSummary,
  fetchTelegramIngestMetrics24h,
  fetchTransferThroughput24h,
} from './telegramBacklogIntelligence.js';
import { batchTelegramCollectorEnrichment } from './telegramCollectorSourceStatus.js';

/**
 * Heavy Telegram backlog enrichment for pipeline board (lazy-loaded).
 * @param {Array<{ source_id: string }>} sourcesRows
 */
export async function buildPipelineBacklogEnrichment(sourcesRows) {
  const collectorEnrichment = await batchTelegramCollectorEnrichment(
    sourcesRows.map((row) => ({ ...row, id: row.source_id })),
    { includeMessageStats: true },
  );

  const [transferThroughput, globalTelegramBacklog, ingestMetrics] = await Promise.all([
    fetchTransferThroughput24h(),
    fetchGlobalTelegramBacklogSummary(),
    fetchTelegramIngestMetrics24h(),
  ]);

  const collectorChannelIds = [
    ...new Set(
      [...collectorEnrichment.values()]
        .filter((e) => e.ingestion_mode === 'collector' && e.collector_channel_id)
        .map((e) => e.collector_channel_id),
    ),
  ];

  const backlogByChannel = await batchCollectorBacklogIntelligence(
    collectorChannelIds,
    transferThroughput,
  );

  const backlogBySourceId = {};
  for (const row of sourcesRows) {
    const enrichment = collectorEnrichment.get(row.source_id);
    if (enrichment?.ingestion_mode === 'collector' && enrichment.collector_channel_id) {
      const intel = backlogByChannel.get(enrichment.collector_channel_id);
      if (intel) backlogBySourceId[row.source_id] = intel;
    }
  }

  return {
    transferThroughput,
    globalTelegramBacklog,
    ingestMetrics,
    backlogBySourceId,
  };
}

/**
 * @param {object} snapshot
 * @param {Awaited<ReturnType<typeof buildPipelineBacklogEnrichment>>} enrichment
 */
export function applyBacklogEnrichmentToSnapshot(snapshot, enrichment) {
  return {
    ...snapshot,
    transferThroughput: enrichment.transferThroughput,
    globalTelegramBacklog: enrichment.globalTelegramBacklog,
    sources: snapshot.sources.map((src) => ({
      ...src,
      collectorBacklog: enrichment.backlogBySourceId[src.sourceId] || src.collectorBacklog,
    })),
  };
}
