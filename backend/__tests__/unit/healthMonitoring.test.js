/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();
const mockDuplicateSummary = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/pipelineSnapshotCache.js', () => ({
  getOrLoadCached: (_key, loader) => loader(),
}));

jest.unstable_mockModule('../../services/dataSourceUrlDuplicateService.js', () => ({
  getDuplicateUrlSummaryForHealthMonitoring: mockDuplicateSummary,
}));

const {
  queryPipelineActivity1h,
  queryPerformanceMetrics,
  buildHealthMonitoringView,
  buildHealthDataQualityView,
} = await import('../../services/healthMonitoring.js');

describe('healthMonitoring core (fast path)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDuplicateSummary.mockReset();
  });

  it('queryPipelineActivity1h returns real counts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ v: 1200 }] })
      .mockResolvedValueOnce({ rows: [{ v: 1150 }] })
      .mockResolvedValueOnce({ rows: [{ v: 800 }] })
      .mockResolvedValueOnce({ rows: [{ v: 45 }] });
    const activity = await queryPipelineActivity1h();
    expect(activity.ingested).toBe(1200);
    expect(activity.normalized).toBe(1150);
    expect(activity.telegramIntake).toBe(800);
    expect(activity.unavailableMetrics).toEqual([]);
  });

  it('queryPipelineActivity1h marks unavailable metrics on query failure', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const activity = await queryPipelineActivity1h();
    expect(activity.ingested).toBeNull();
    expect(activity.unavailableMetrics.length).toBe(4);
  });

  it('buildHealthMonitoringView does not include duplicate URL analysis', async () => {
    mockQuery.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('SELECT 1')) return { rows: [{}] };
      if (text.includes('FROM data_sources') && text.includes('total_sources')) {
        return { rows: [{ total_sources: 10, active_sources: 8, telegram_sources: 3, rss_sources: 4, api_sources: 3 }] };
      }
      if (text.includes('collected_at > NOW()') && text.includes('processed_at')) {
        return { rows: [{ v: 480 }] };
      }
      if (text.includes('collected_at > NOW()')) {
        return { rows: [{ v: 500 }] };
      }
      if (text.includes('telegram_messages')) {
        return { rows: [{ v: 200 }] };
      }
      if (text.includes('data_hub_logs') && text.includes('COUNT(*)')) {
        return { rows: [{ v: 12 }] };
      }
      if (text.includes('execution_time_ms')) {
        return { rows: [{ avg_response_ms: 95, cached_24h: 5, outcomes_24h: 20 }] };
      }
      return { rows: [{}] };
    });

    const view = await buildHealthMonitoringView();
    expect(view.pipelineActivity1h.ingested).toBe(500);
    expect(view.meta.dataQualityDeferred).toBe(true);
    expect(view).not.toHaveProperty('dataQuality');
    expect(mockDuplicateSummary).not.toHaveBeenCalled();
    expect(view.meta.queryMs).toBeLessThan(5000);
  });
});

describe('healthMonitoring data quality (lazy path)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDuplicateSummary.mockReset();
  });

  it('buildHealthDataQualityView returns duplicate counts when fast', async () => {
    mockDuplicateSummary.mockResolvedValue({
      duplicateUrlGroups: 2,
      highRiskDuplicateGroups: 1,
      ignoredDuplicateGroups: 0,
    });
    const dq = await buildHealthDataQualityView();
    expect(dq.loaded).toBe(true);
    expect(dq.duplicateUrlGroups).toBe(2);
    expect(dq.meta.unavailableMetrics).toEqual([]);
  });

  it('buildHealthDataQualityView returns null on timeout without throwing', async () => {
    mockDuplicateSummary.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ duplicateUrlGroups: 99 }), 5000)),
    );
    const dq = await buildHealthDataQualityView();
    expect(dq.loaded).toBe(false);
    expect(dq.duplicateUrlGroups).toBeNull();
    expect(dq.meta.reason).toBe('timeout');
    expect(dq.meta.unavailableMetrics).toContain('duplicateUrlGroups');
  }, 10_000);
});

describe('performance metrics', () => {
  beforeEach(() => mockQuery.mockReset());

  it('queryPerformanceMetrics marks cache untracked when no outcomes', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ avg_response_ms: 120, cached_24h: 0, outcomes_24h: 0 }],
    });
    const perf = await queryPerformanceMetrics();
    expect(perf.cacheHitRateTracked).toBe(false);
    expect(perf.cacheHitRate).toBeNull();
  });
});
