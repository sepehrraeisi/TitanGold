/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockRunAgent = jest.fn();
const mockSchedulerStatus = jest.fn();
const mockRuntimeState = jest.fn();
const mockRedisAvailable = jest.fn();
const mockWriteExecutionAudit = jest.fn();
const mockGetHealthStatus = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/agents/registry.js', () => ({
  default: { runAgent: mockRunAgent },
}));

jest.unstable_mockModule('../../services/analyticalSchedulerStatus.js', () => ({
  readAnalyticalSchedulerStatus: mockSchedulerStatus,
}));

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getRuntimeExecutionState: mockRuntimeState,
}));

jest.unstable_mockModule('../../utils/redis.js', () => ({
  isRedisAvailable: mockRedisAvailable,
}));

jest.unstable_mockModule('../../services/agentExecutionService.js', () => ({
  writeExecutionAudit: mockWriteExecutionAudit,
}));

jest.unstable_mockModule('../../services/exchanges/ExchangeFactory.js', () => ({
  exchangeFactory: { getHealthStatus: mockGetHealthStatus },
}));

const { executeTrendAnalysis, getTrendIntegrations, updateTrendSettings } = await import(
  '../../services/trendRunService.js'
);

describe('trendRunService PR remediation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSchedulerStatus.mockResolvedValue({ status: { status: 'online', allowlist: ['arbitrage'] } });
    mockRuntimeState.mockResolvedValue({ globalMode: 'demo', killSwitchActive: true });
    mockRedisAvailable.mockResolvedValue(true);
  });

  it('persists null confidence when analyzer returns no confidence', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'agent-1', agent_key: 'trend_detection', name: 'Trend', config: {}, metadata: {} }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'run-1', created_at: '2026-08-06T00:00:00.000Z', execution_time_ms: 10 }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    mockRunAgent.mockResolvedValue({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      timestamp: '2026-08-06T00:00:00.000Z',
      last_candle_timestamp: '2026-08-06T00:00:00.000Z',
      trend: { direction: 'up', strength: 'moderate' },
      adx: { value: 26, di_plus: 20, di_minus: 10, strength: 'moderate' },
    });

    await executeTrendAnalysis({
      agentId: 'agent-1',
      user: { id: 'user-1' },
      symbol: 'BTC/USDT',
      timeframe: '1h',
      idempotencyKey: 'idem-1',
      compareTimeframes: [],
    });

    const insertArgs = mockQuery.mock.calls[2][1];
    expect(insertArgs[3]).toBeNull();
  });

  it('uses canonical MEXC health readiness for public provider status', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'agent-1', agent_key: 'trend_detection', name: 'Trend', config: {}, metadata: {} }],
    });
    mockGetHealthStatus.mockResolvedValue({ status: 'healthy' });

    const healthy = await getTrendIntegrations('agent-1');
    expect(healthy.publicMarketData.status).toBe('available');

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'agent-1', agent_key: 'trend_detection', name: 'Trend', config: {}, metadata: {} }],
    });
    mockGetHealthStatus.mockRejectedValue(new Error('provider unavailable'));

    const unknown = await getTrendIntegrations('agent-1');
    expect(unknown.publicMarketData.status).toBe('unknown');
  });

  it('updates settings atomically and returns VERSION_CONFLICT on zero affected rows', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'agent-1', agent_key: 'trend_detection', name: 'Trend', config: { version: 4 }, metadata: {} }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      updateTrendSettings('agent-1', { symbol: 'ETH/USDT', version: 4 }, 4),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });

    expect(mockQuery.mock.calls[1][0]).toMatch(/config->>'version'/);
    expect(mockQuery.mock.calls[1][1][2]).toBe(4);
  });
});
