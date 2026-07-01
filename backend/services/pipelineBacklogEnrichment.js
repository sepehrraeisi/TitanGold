import {
  batchCollectorBacklogIntelligence,
  fetchGlobalTelegramBacklogSummary,
  fetchTelegramIngestMetrics24h,
  fetchTransferThroughput24h,
} from './telegramBacklogIntelligence.js';
import { batchTelegramCollectorEnrichment } from './telegramCollectorSourceStatus.js';
import {
  DEFAULT_GLOBAL_TELEGRAM_BACKLOG,
  DEFAULT_INGEST_METRICS,
  DEFAULT_TRANSFER_THROUGHPUT,
  loadMetricSafely,
  normalizePipelineBacklogResponse,
} from './pipelineBacklogSafe.js';

/**
 * Heavy Telegram backlog enrichment for pipeline board (lazy-loaded).
 * Never throws — returns safe defaults + meta.warnings on partial failure.
 * @param {Array<{ source_id: string }>} sourcesRows
 */
export async function buildPipelineBacklogEnrichment(sourcesRows) {
  const telegramSourceIds = sourcesRows.map((row) => row.source_id);
  const warnings = [];

  const [throughputResult, backlogResult, ingestResult] = await Promise.all([
    loadMetricSafely('transfer_throughput', fetchTransferThroughput24h, DEFAULT_TRANSFER_THROUGHPUT),
    loadMetricSafely(
      'global_telegram_backlog',
      fetchGlobalTelegramBacklogSummary,
      DEFAULT_GLOBAL_TELEGRAM_BACKLOG,
    ),
    loadMetricSafely(
      'ingest_metrics',
      () => fetchTelegramIngestMetrics24h(telegramSourceIds),
      DEFAULT_INGEST_METRICS,
    ),
  ]);

  for (const result of [throughputResult, backlogResult, ingestResult]) {
    if (result.error) warnings.push(result.error);
  }

  const transferThroughput = throughputResult.value;
  let backlogBySourceId = {};

  const collectorResult = await loadMetricSafely(
    'collector_backlog',
    async () => {
      const collectorEnrichment = await batchTelegramCollectorEnrichment(
        sourcesRows.map((row) => ({ ...row, id: row.source_id })),
        { includeMessageStats: true },
      );

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

      const bySource = {};
      for (const row of sourcesRows) {
        const enrichment = collectorEnrichment.get(row.source_id);
        if (enrichment?.ingestion_mode === 'collector' && enrichment.collector_channel_id) {
          const intel = backlogByChannel.get(enrichment.collector_channel_id);
          if (intel) bySource[row.source_id] = intel;
        }
      }
      return bySource;
    },
    {},
  );

  if (collectorResult.error) warnings.push(collectorResult.error);
  backlogBySourceId = collectorResult.value;

  return normalizePipelineBacklogResponse({
    transferThroughput,
    globalTelegramBacklog: backlogResult.value,
    ingestMetrics: ingestResult.value,
    backlogBySourceId,
    meta: {
      partial: warnings.length > 0,
      warnings,
      fetchedAt: new Date().toISOString(),
    },
  });
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
