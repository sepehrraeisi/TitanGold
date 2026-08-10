/**
 * @jest-environment node
 *
 * Ordinary product Artemis audit/readiness HTTP contract.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { productAuditContainsForbiddenField } from '../../services/artemisAuditProjection.js';

const mockQuery = jest.fn();
const mockBuildArtemisReadiness = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    if (req.headers['x-test-unauth'] === '1') {
      return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    req.user = {
      id: 'user-1',
      role: req.headers['x-test-role'] || 'user',
      is_active: true,
    };
    next();
  },
  authenticateStrict: (req, res, next) => {
    if (req.headers['x-test-unauth'] === '1') {
      return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    req.user = {
      id: 'user-1',
      role: req.headers['x-test-role'] || 'user',
      is_active: true,
    };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  },
}));

jest.unstable_mockModule('../../services/artemisReadinessService.js', () => ({
  buildArtemisReadiness: mockBuildArtemisReadiness,
}));

jest.unstable_mockModule('../../services/artemisOrchestrator.js', () => ({
  getMixtureDecision: jest.fn(),
}));

jest.unstable_mockModule('../../services/agentExecutionPolicyService.js', () => ({
  evaluateExecutionPolicy: jest.fn(),
  REASON: {},
}));

jest.unstable_mockModule('../../middleware/validation.js', () => ({
  validateBody: () => (_req, _res, next) => next(),
  validateParams: () => (_req, _res, next) => next(),
  validateResponse: () => (_req, _res, next) => next(),
}));

const artemisRouter = (await import('../../routes/artemis.js')).default;

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/artemis', artemisRouter);
  return server;
}

function mockAuditQueries() {
  mockQuery.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('FROM system_logs') && text.includes('COUNT(')) {
      return { rows: [{ c: 1 }] };
    }
    if (text.includes('FROM system_logs')) {
      return {
        rows: [
          {
            id: 'log-1',
            level: 'info',
            category: 'artemis_decision',
            message: 'HOLD BTC/USDT',
            metadata: {
              opportunity: { symbol: 'BTC/USDT' },
              decision: { action: 'HOLD', reason: 'advisory' },
              context: { portfolioValue: 10000, dailyLoss: 5, activeTrades: 1, maxTrades: 4 },
              signals: [{ agent: 'technical' }],
              providers: [{ name: 'openai' }],
            },
            created_at: '2026-08-08T12:00:00.000Z',
          },
        ],
      };
    }
    if (text.includes('FROM ai_decisions') && text.includes('COUNT(')) {
      return { rows: [{ c: 1 }] };
    }
    if (text.includes('FROM ai_decisions')) {
      return {
        rows: [
          {
            id: 'd1',
            agent_id: 'a1',
            agent_key: 'technical',
            agent_name: 'Technical',
            input: { symbol: 'ETH/USDT', context: { secret: 'nope' } },
            output: { action: 'BUY', providers: [] },
            was_successful: true,
            confidence: 0.7,
            created_at: '2026-08-08T12:01:00.000Z',
          },
        ],
      };
    }
    return { rows: [] };
  });
}

describe('Artemis product audit HTTP projection', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBuildArtemisReadiness.mockReset();
  });

  it('unauthenticated /logs is rejected', async () => {
    const res = await request(app()).get('/api/v1/artemis/logs').set('x-test-unauth', '1');
    expect(res.status).toBe(401);
  });

  it('roles without AI_AGENT_READ cannot read /logs', async () => {
    const res = await request(app()).get('/api/v1/artemis/logs').set('x-test-role', 'guest');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CAPABILITY_DENIED');
  });

  it('ordinary user/vip receive sanitized product audit without raw payloads', async () => {
    mockAuditQueries();
    for (const role of ['user', 'vip']) {
      const res = await request(app()).get('/api/v1/artemis/logs').set('x-test-role', role);
      expect(res.status).toBe(200);
      expect(productAuditContainsForbiddenField(res.body.systemLogs)).toBe(false);
      expect(productAuditContainsForbiddenField(res.body.decisions)).toBe(false);
      expect(res.body.systemLogs[0]).toMatchObject({
        action: 'HOLD',
        symbol: 'BTC/USDT',
        executionEligible: false,
        advisoryOnly: true,
      });
      expect(res.body.decisions[0]).toMatchObject({
        agentKey: 'technical',
        symbol: 'ETH/USDT',
        action: 'BUY',
        successful: true,
      });
      expect(res.body.systemLogs[0].metadata).toBeUndefined();
      expect(res.body.decisions[0].input).toBeUndefined();
      expect(res.body.decisions[0].output).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/portfolioValue/);
      expect(JSON.stringify(res.body)).not.toMatch(/dailyLoss/);
    }
    const runSql = mockQuery.mock.calls.map((call) => String(call[0])).find((sql) => sql.includes('FROM ai_decisions d'));
    expect(runSql).toMatch(/d\.input_data AS input/);
    expect(runSql).toMatch(/d\.output_data AS output/);
  });

  it('admin/trader still receive the same sanitized product projection (no raw-debug endpoint)', async () => {
    mockAuditQueries();
    const res = await request(app()).get('/api/v1/artemis/logs').set('x-test-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.systemLogs[0].metadata).toBeUndefined();
    expect(res.body.decisions[0].input).toBeUndefined();
    expect(res.body.decisions[0].output).toBeUndefined();
    expect(productAuditContainsForbiddenField(res.body.systemLogs)).toBe(false);
    expect(productAuditContainsForbiddenField(res.body.decisions)).toBe(false);
  });

  it('readiness 500 does not leak internal exception text', async () => {
    mockBuildArtemisReadiness.mockRejectedValue(new Error('relation "system_logs" does not exist'));
    const res = await request(app()).get('/api/v1/artemis/readiness').set('x-test-role', 'user');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to build Artemis readiness' });
    expect(JSON.stringify(res.body)).not.toMatch(/system_logs/);
    expect(JSON.stringify(res.body)).not.toMatch(/does not exist/);
    expect(res.body.message).toBeUndefined();
  });
});
