/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/pipelineSnapshotCache.js', () => ({
  getOrLoadCached: (_key, loader) => loader(),
}));

jest.unstable_mockModule('../../services/dataSourceUrlDuplicateService.js', () => ({
  getDuplicateUrlSummaryForHealth: jest.fn(async () => ({
    duplicateUrlGroups: 2,
    highRiskDuplicateGroups: 1,
    ignoredDuplicateGroups: 0,
  })),
}));

const {
  queryPipelineActivity1h,
  queryPerformanceMetrics,
  mapTelegramCollectorHealth,
  buildHealthMonitoringView,
} = await import('../../services/healthMonitoring.js');

describe('healthMonitoring service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('queryPipelineActivity1h returns real counts', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        ingested: 1200,
        normalized: 1150,
        telegram_intake: 800,
        access_log_events: 45,
      }],
    });
    const activity = await queryPipelineActivity1h();
    expect(activity.ingested).toBe(1200);
    expect(activity.normalized).toBe(1150);
    expect(activity.telegramIntake).toBe(800);
    expect(activity.accessLogEvents).toBe(45);
    expect(activity.unavailableMetrics).toEqual([]);
  });

  it('queryPipelineActivity1h returns nulls on query failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const activity = await queryPipelineActivity1h();
    expect(activity.ingested).toBeNull();
    expect(activity.normalized).toBeNull();
    expect(activity.unavailableMetrics.length).toBeGreaterThan(0);
  });

  it('queryPerformanceMetrics marks cache untracked when no outcomes', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ avg_response_ms: 120, cached_24h: 0, outcomes_24h: 0 }],
    });
    const perf = await queryPerformanceMetrics();
    expect(perf.avgResponseMs).toBe(120);
    expect(perf.cacheHitRateTracked).toBe(false);
    expect(perf.cacheHitRate).toBeNull();
  });

  it('queryPerformanceMetrics computes cache hit rate when tracked', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ avg_response_ms: null, cached_24h: 25, outcomes_24h: 100 }],
    });
    const perf = await queryPerformanceMetrics();
    expect(perf.cacheHitRateTracked).toBe(true);
    expect(perf.cacheHitRate).toBe(0.25);
  });

  it('mapTelegramCollectorHealth maps averageLatencyMs', () => {
    const mapped = mapTelegramCollectorHealth({
      status: 'healthy',
      averageLatencyMs: 142,
      activeChannels: 5,
      totalChannels: 8,
      loggedErrors: 1,
      lastProcessedAt: '2026-07-04T08:00:00.000Z',
    });
    expect(mapped.avgLatencyMs).toBe(142);
    expect(mapped.status).toBe('healthy');
    expect(mapped.loaded).toBe(true);
  });

  it('buildHealthMonitoringView shapes monitoring payload', async () => {
    mockQuery.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('SELECT 1')) return { rows: [{}] };
      if (text.includes('FROM data_sources') && text.includes('total_sources')) {
        return {
          rows: [{
            total_sources: 10,
            active_sources: 8,
            telegram_sources: 3,
            rss_sources: 4,
            api_sources: 3,
          }],
        };
      }
      if (text.includes('pipeline_ingested') || text.includes('collected_at > NOW()')) {
        return {
          rows: [{
            ingested: 500,
            normalized: 480,
            telegram_intake: 200,
            access_log_events: 12,
          }],
        };
      }
      if (text.includes('execution_time_ms')) {
        return { rows: [{ avg_response_ms: 95, cached_24h: 5, outcomes_24h: 20 }] };
      }
      return { rows: [{}] };
    });

    const view = await buildHealthMonitoringView();
    expect(view.pipelineActivity1h.ingested).toBe(500);
    expect(view.pipelineActivity1h.normalized).toBe(480);
    expect(view.performance.avgResponseMs).toBe(95);
    expect(view.dataQuality.duplicateUrlGroups).toBe(2);
    expect(view.sources.active).toBe(8);
  });
});
