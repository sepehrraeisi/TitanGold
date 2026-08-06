/**
 * @jest-environment node
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockExecuteTrendAnalysis = jest.fn();
const mockGetTrendSettings = jest.fn();
const mockLoadTrendAgent = jest.fn();
const mockLoggerError = jest.fn();

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateStrict: (req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  },
}));

jest.unstable_mockModule('../../middleware/requireCapability.js', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../middleware/rateLimit.js', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/capabilities.js', () => ({
  CAP: { AI_AGENT_READ: 'read', AI_AGENT_EXECUTE_SAFE: 'execute_safe' },
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { error: mockLoggerError },
}));

jest.unstable_mockModule('../../services/trendRunService.js', () => ({
  executeTrendAnalysis: mockExecuteTrendAnalysis,
  getTrendIntegrations: jest.fn(),
  getTrendOverview: jest.fn(),
  getTrendRunDetail: jest.fn(),
  getTrendRuns: jest.fn(),
  getTrendSettings: mockGetTrendSettings,
  loadTrendAgent: mockLoadTrendAgent,
  updateTrendSettings: jest.fn(),
}));

jest.unstable_mockModule('../../services/analyticalSchedulerStatus.js', () => ({
  readAnalyticalSchedulerStatus: jest.fn(),
}));

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getRuntimeExecutionState: jest.fn(),
}));

const { default: trendRouter } = await import('../../routes/trendCoreRoutes.js');

describe('trendCoreRoutes PR remediation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTrendAgent.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      agent_key: 'trend_detection',
      name: 'Trend Detection',
    });
    mockGetTrendSettings.mockResolvedValue({ compareTimeframes: [] });
  });

  it('sanitizes unexpected analyze 500 responses', async () => {
    mockExecuteTrendAnalysis.mockRejectedValue(
      Object.assign(new Error('provider 500 secret=abc123 token=xyz789'), { status: 500, code: 'PROVIDER_ERROR' }),
    );

    const app = express();
    app.use(express.json());
    app.use('/api/v1/ai-agents/:id/trend', trendRouter);

    const res = await request(app)
      .post('/api/v1/ai-agents/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/trend/analyze')
      .send({ symbol: 'BTC/USDT', timeframe: '1h' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
    expect(res.body.error.message).toBe('Trend analysis failed');
    expect(JSON.stringify(res.body)).not.toContain('abc123');
    expect(JSON.stringify(res.body)).not.toContain('xyz789');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Trend analyze error',
      expect.objectContaining({
        code: 'PROVIDER_ERROR',
        message: expect.stringContaining('[redacted]'),
      }),
    );
  });
});
