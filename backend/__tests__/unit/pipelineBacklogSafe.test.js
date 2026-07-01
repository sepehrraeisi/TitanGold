/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildEmptyPipelineBacklogResponse,
  normalizePipelineBacklogResponse,
  DEFAULT_INGEST_METRICS,
  DEFAULT_TRANSFER_THROUGHPUT,
  DEFAULT_GLOBAL_TELEGRAM_BACKLOG,
} from '../../services/pipelineBacklogSafe.js';
import { dataPipelineBacklogResponseSchema } from '../../schemas/dataHubSchemas.js';

describe('pipelineBacklogSafe', () => {
  it('normalizePipelineBacklogResponse fills missing ingestMetrics', () => {
    const normalized = normalizePipelineBacklogResponse({
      transferThroughput: DEFAULT_TRANSFER_THROUGHPUT,
      globalTelegramBacklog: DEFAULT_GLOBAL_TELEGRAM_BACKLOG,
      backlogBySourceId: {},
    });
    expect(normalized.ingestMetrics).toEqual(DEFAULT_INGEST_METRICS);
    expect(normalized.meta.partial).toBe(true);
    expect(normalized.meta.warnings).toContain('ingest_metrics_unavailable');
    const parsed = dataPipelineBacklogResponseSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
  });

  it('buildEmptyPipelineBacklogResponse always validates', () => {
    const payload = buildEmptyPipelineBacklogResponse('cache_failed');
    expect(payload.transferThroughput).toBeDefined();
    expect(payload.ingestMetrics).toBeDefined();
    expect(payload.meta.error).toBe('cache_failed');
    const parsed = dataPipelineBacklogResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
