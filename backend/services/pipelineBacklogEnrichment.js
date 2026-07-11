import {
  batchCollectorBacklogIntelligence,
  fetchGlobalTelegramBacklogSummary,
  fetchTelegramIncoming24h,
  fetchTelegramTransferred24h,
  fetchTransferThroughput24h,
} from './telegramBacklogIntelligence.js';
import { batchTelegramCollectorEnrichment } from './telegramCollectorSourceStatus.js';
import { loadMetricSafely, normalizePipelineBacklogResponse } from './pipelineBacklogSafe.js';
import { buildBacklogTrend, recordBacklogSnapshot } from './pipelineBacklogTrend.js';

/**
 * Heavy Telegram backlog enrichment for pipeline board (lazy-loaded).
 * Never throws — returns null metric groups + meta.unavailableMetrics on partial failure.
 * @param {Array<{ source_id: string }>} sourcesRows
 */
export async function buildPipelineBacklogEnrichment(sourcesRows) {
  const telegramSourceIds = sourcesRows.map((row) => row.source_id);
  const unavailableMetrics = [];
  const warnings = [];

  const [throughputResult, backlogResult, incomingResult, transferredResult] = await Promise.all([
    loadMetricSafely('transfer_throughput', fetchTransferThroughput24h),
    loadMetricSafely('global_telegram_backlog', fetchGlobalTelegramBacklogSummary),
    loadMetricSafely('incoming24h', fetchTelegramIncoming24h),
    loadMetricSafely('transferred24h', () => fetchTelegramTransferred24h(telegramSourceIds)),
  ]);

  if (throughputResult.error) {
    warnings.push(throughputResult.error);
    unavailableMetrics.push('processed24h', 'processingRate', 'drainRatio', 'catchUp');
  }
  if (backlogResult.error) {
    warnings.push(backlogResult.error);
    unavailableMetrics.push('backlogTotal', 'oldestUnprocessedAge', 'catchUp');
  }
  if (incomingResult.error) {
    warnings.push(incomingResult.error);
    unavailableMetrics.push('incoming24h', 'drainRatio');
  }
  if (transferredResult.error) {
    warnings.push(transferredResult.error);
    unavailableMetrics.push('transferred24h');
  }

  const transferThroughput = throughputResult.available ? throughputResult.value : null;
  let backlogBySourceId = {};

  const collectorResult = await loadMetricSafely('collector_backlog', async () => {
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
      transferThroughput || { messagesPerHour: 1, processed24h: 0 },
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
  });

  if (collectorResult.error) warnings.push(collectorResult.error);
  backlogBySourceId = collectorResult.available ? collectorResult.value : {};

  const ingestMetrics =
    incomingResult.available || transferredResult.available
      ? {
          incoming24h: incomingResult.available ? incomingResult.value : null,
          transferredToCollectedData24h: transferredResult.available
            ? transferredResult.value
            : null,
        }
      : null;

  const currentBacklog = backlogResult.available
    ? backlogResult.value?.unprocessedTotal ?? null
    : null;
  if (currentBacklog != null) {
    void recordBacklogSnapshot(currentBacklog);
  }

  const backlogTrend = await buildBacklogTrend({
    currentBacklog,
    incoming24h: ingestMetrics?.incoming24h ?? null,
    processed24h: transferThroughput?.processed24h ?? null,
  });

  return normalizePipelineBacklogResponse({
    transferThroughput,
    globalTelegramBacklog: backlogResult.available ? backlogResult.value : null,
    ingestMetrics,
    backlogBySourceId,
    meta: {
      partial: warnings.length > 0,
      warnings,
      unavailableMetrics,
      fetchedAt: new Date().toISOString(),
      backlogTrend,
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
