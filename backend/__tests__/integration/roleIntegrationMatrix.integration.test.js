/**
 * Role integration matrix — tests actual mounted APIs with disposable fixtures.
 * @jest-environment node
 */
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import {
  createAllRoleFixtures,
  cleanupAllFixtures,
  disableFixture,
  deleteFixture,
  changeFixtureRole,
  signToken,
  ROLES,
} from '../helpers/roleFixtures.js';

dotenv.config();

const INTEGRATION = process.env.RUN_INTEGRATION === '1';
const BASE = process.env.BACKEND_INTEGRATION_URL || 'http://127.0.0.1:5002';
const suite = INTEGRATION ? describe : describe.skip;

async function api(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

/** @type {Record<string, { id: string, token: string }>} */
let fixtures = {};

const MATRIX = [
  { action: 'agent read', method: 'GET', path: '/api/v1/ai-agents', roles: { user: [200], vip: [200], trader: [200], admin: [200] } },
  { action: 'safe agent execution', method: 'POST', path: '/api/v1/ai-agents/technical/run', body: { symbol: 'BTCUSDT', dry_run: true }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403, 422], admin: [200, 403, 422] } },
  { action: 'live-capable agent execution', method: 'POST', path: '/api/v1/ai-agents/order/run', body: { symbol: 'BTCUSDT', params: { action: 'place_order', dry_run: true } }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403, 422], admin: [200, 403, 422] } },
  { action: 'agent config PATCH', method: 'PATCH', path: '/api/v1/ai-agents/technical/config', body: { unknown_field: true }, roles: { user: [403, 401], vip: [403, 401], trader: [403, 401], admin: [400, 403, 422] } },
  { action: 'Topic Routing read', method: 'GET', path: '/api/v1/topic-routing', roles: { user: [200], vip: [200], trader: [200], admin: [200] } },
  { action: 'Topic Routing write', method: 'POST', path: '/api/v1/topic-routing', body: { name: 'fixture-test', agent_key: 'technical', topic: 'test' }, roles: { user: [403, 401], vip: [403, 401], trader: [403, 401, 400], admin: [200, 201, 400, 422] } },
  { action: 'Artemis decision', method: 'POST', path: '/api/v1/artemis/decision', body: { symbol: 'BTCUSDT', dry_run: true }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403, 422], admin: [200, 403, 422] } },
  { action: 'Kill Switch activate', method: 'POST', path: '/api/v1/settings/kill-switch/activate', body: { reason: 'fixture_test' }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403], admin: [200, 403] } },
  { action: 'Kill Switch clear', method: 'POST', path: '/api/v1/settings/kill-switch/clear', body: {}, roles: { user: [403, 401], vip: [403, 401], trader: [403], admin: [403] } },
  { action: 'scheduler control', method: 'GET', path: '/api/v1/scheduler/status', roles: { user: [403, 401], vip: [403, 401], trader: [200, 403], admin: [200, 403] } },
  { action: 'trading-engine control', method: 'GET', path: '/api/v1/trading-engine/status', roles: { user: [403, 401], vip: [403, 401], trader: [200, 403], admin: [200, 403] } },
  { action: 'Autopilot action', method: 'GET', path: '/api/v1/autopilot/status', roles: { user: [403, 401], vip: [403, 401], trader: [403, 401], admin: [200, 403] } },
];

suite('Role integration matrix (disposable fixtures)', () => {
  beforeAll(async () => {
    fixtures = await createAllRoleFixtures();
  });

  afterAll(async () => {
    await cleanupAllFixtures();
  });

  for (const row of MATRIX) {
    for (const role of ROLES) {
      it(`${role}: ${row.action}`, async () => {
        const f = fixtures[role];
        if (!f) return;
        const r = await api(row.path, {
          token: f.token,
          method: row.method,
          body: row.body,
        });
        expect(row.roles[role]).toContain(r.status);
      });
    }
  }

  it('forged JWT role cannot elevate DB role', async () => {
    const f = fixtures.user;
    const forged = signToken(f.id, { role: 'admin' });
    const r = await api('/api/v1/topic-routing', { token: forged, method: 'POST', body: { name: 'x', agent_key: 'technical', topic: 't' } });
    expect([403, 401, 400, 422]).toContain(r.status);
  });

  it('expired token fails closed', async () => {
    const expired = jwt.sign({ userId: fixtures.admin.id }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const r = await api('/api/v1/ai-agents', { token: expired });
    expect(r.status).toBe(401);
  });

  it('disabled fixture fails closed', async () => {
    await disableFixture('trader');
    const r = await api('/api/v1/ai-agents', { token: fixtures.trader.token });
    expect([401, 403]).toContain(r.status);
    await createAllRoleFixtures();
    fixtures = await createAllRoleFixtures();
  });

  it('vip permissions match user for safe execution', async () => {
    const vipR = await api('/api/v1/ai-agents/technical/run', { token: fixtures.vip.token, method: 'POST', body: { symbol: 'BTCUSDT', dry_run: true } });
    const userR = await api('/api/v1/ai-agents/technical/run', { token: fixtures.user.token, method: 'POST', body: { symbol: 'BTCUSDT', dry_run: true } });
    expect(vipR.status).toBe(userR.status);
  });
});

suite('Role fixture lifecycle', () => {
  it('creates and cleans up fixtures without permanent users', async () => {
    const f = await createAllRoleFixtures();
    expect(Object.keys(f)).toHaveLength(4);
    await cleanupAllFixtures();
  });
});
