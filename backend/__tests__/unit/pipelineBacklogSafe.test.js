/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildEmptyPipelineBacklogResponse,
  normalizePipelineBacklogResponse,
  TRANSFER_HEALTH_METRIC_KEYS,
} from '../../services/pipelineBacklogSafe.js';
import { dataPipelineBacklogResponseSchema } from '../../schemas/dataHubSchemas.js';

describe('pipelineBacklogSafe', () => {
  it('normalizePipelineBacklogResponse marks missing ingestMetrics unavailable without fake zeros', () => {
    const normalized = normalizePipelineBacklogResponse({
      transferThroughput: {
        processed24h: 139700,
        messagesPerHour: 5800,
        messagesPerDay: 139700,
        observedWindowHours: 24,
      },
      globalTelegramBacklog: { unprocessedTotal: 720000 },
      backlogBySourceId: {},
    });
    expect(normalized.ingestMetrics).toBeNull();
    expect(normalized.meta.partial).toBe(true);
    expect(normalized.meta.unavailableMetrics).toEqual(
      expect.arrayContaining(['incoming24h', 'transferred24h', 'drainRatio']),
    );
    const parsed = dataPipelineBacklogResponseSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
  });

  it('normalizePipelineBacklogResponse marks null ingest fields unavailable', () => {
    const normalized = normalizePipelineBacklogResponse({
      transferThroughput: {
        processed24h: 100,
        messagesPerHour: 4,
        messagesPerDay: 100,
        observedWindowHours: 24,
      },
      globalTelegramBacklog: { unprocessedTotal: 0 },
      ingestMetrics: { incoming24h: null, transferredToCollectedData24h: 50 },
      backlogBySourceId: {},
    });
    expect(normalized.meta.unavailableMetrics).toEqual(
      expect.arrayContaining(['incoming24h', 'drainRatio']),
    );
    expect(normalized.meta.unavailableMetrics).not.toContain('transferred24h');
  });

  it('buildEmptyPipelineBacklogResponse always validates and marks all metrics unavailable', () => {
    const payload = buildEmptyPipelineBacklogResponse('cache_failed');
    expect(payload.transferThroughput).toBeNull();
    expect(payload.ingestMetrics).toBeNull();
    expect(payload.meta.error).toBe('cache_failed');
    expect(payload.meta.unavailableMetrics).toEqual([...TRANSFER_HEALTH_METRIC_KEYS]);
    const parsed = dataPipelineBacklogResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
