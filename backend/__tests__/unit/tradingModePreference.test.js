/**
 * @jest-environment node
 *
 * Trading-mode preference persistence — preference must update without enabling Live.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();
const mockGetRuntime = jest.fn(async () => ({
  globalMode: 'demo',
  killSwitchActive: true,
  version: 1,
}));

jest.unstable_mockModule('../../database/db.js', () => ({
  default: { query: mockQuery },
}));
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticate: (_req, _res, next) => next(),
  authenticateStrict: (req, _res, next) => {
    req.user = req.user || { id: 'u1', role: 'admin' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));
jest.unstable_mockModule('../../middleware/requireCapability.js', () => ({
  requireCapability: () => (req, res, next) => {
    if (req._denyCap) {
      return res.status(403).json({ code: 'CAPABILITY_DENIED' });
    }
    next();
  },
}));
jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getRuntimeExecutionState: mockGetRuntime,
  setGlobalRuntimeMode: jest.fn(),
  activateKillSwitch: jest.fn(),
  clearKillSwitch: jest.fn(),
  buildRuntimeView: (state, extra) => ({ ...state, ...extra }),
  ensureDefaultRuntimeState: jest.fn(),
}));

const express = (await import('express')).default;
const settingsRouter = (await import('../../routes/settings.js')).default;

function makeApp(user = { id: 'u1', role: 'admin' }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use(settingsRouter);
  return app;
}

async function post(app, body, user) {
  const routerApp = makeApp(user);
  const server = routerApp.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/trading-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

async function get(app, user) {
  const routerApp = makeApp(user);
  const server = routerApp.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/trading-mode`);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe('POST /trading-mode preference', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGetRuntime.mockClear();
  });

  it('Demo → Live preference succeeds under kill switch; effective stays demo', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ mode: 'live' }] }) // update
      ;
    const { status, json } = await post(null, { mode: 'live' });
    expect(status).toBe(200);
    expect(json.mode).toBe('live');
    expect(json.killSwitchActive).toBe(true);
    expect(json.effectiveMode).toBe('demo');
    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/jsonb_set/);
    expect(mockQuery.mock.calls[0][1][1]).toBe(JSON.stringify('live'));
  });

  it('Live → Demo preference succeeds', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ mode: 'demo' }] })
      .mockResolvedValueOnce({ rows: [{ balances: '{"USDT":10000}' }] }); // wallet exists
    const { status, json } = await post(null, { mode: 'demo' });
    expect(status).toBe(200);
    expect(json.mode).toBe('demo');
  });

  it('rejects invalid mode', async () => {
    const { status, json } = await post(null, { mode: 'banana' });
    expect(status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('inserts preferences row when missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const { status, json } = await post(null, { mode: 'live' });
    expect(status).toBe(200);
    expect(json.mode).toBe('live');
    expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO user_preferences/);
  });

  it('GET returns persisted preference', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ mode: 'live' }] });
    const { status, json } = await get();
    expect(status).toBe(200);
    expect(json.mode).toBe('live');
  });
});
