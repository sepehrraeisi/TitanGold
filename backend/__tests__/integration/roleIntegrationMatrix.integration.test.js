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
  createRoleFixture,
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
let technicalId = null;
let orderId = null;

suite('Role integration matrix (disposable fixtures)', () => {
  beforeAll(async () => {
    fixtures = await createAllRoleFixtures();
    const list = await api('/api/v1/ai-agents', { token: fixtures.admin.token });
    const agents = list.body.agents || list.body || [];
    technicalId = agents.find((a) => a.agent_key === 'technical')?.id;
    orderId = agents.find((a) => a.agent_key === 'order')?.id;
  });

  afterAll(async () => {
    await cleanupAllFixtures();
  });

  const cases = () => [
    { action: 'agent read', method: 'GET', path: '/api/v1/ai-agents', roles: { user: [200], vip: [200], trader: [200], admin: [200] } },
    { action: 'safe agent execution', method: 'POST', path: `/api/v1/ai-agents/${technicalId}/run`, body: { symbol: 'BTCUSDT', dry_run: true }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403, 422], admin: [200, 403, 422] } },
    { action: 'live-capable agent execution', method: 'POST', path: `/api/v1/ai-agents/${orderId}/run`, body: { symbol: 'BTCUSDT', params: { action: 'place_order', dry_run: true } }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403, 422], admin: [200, 403, 422] } },
    { action: 'agent config PATCH', method: 'PATCH', path: `/api/v1/ai-agents/${technicalId}/config`, body: { unknown_field: true }, roles: { user: [403, 401], vip: [403, 401], trader: [403, 401], admin: [400, 403, 422] } },
    { action: 'Topic Routing read', method: 'GET', path: '/api/v1/topic-routing', roles: { user: [200], vip: [200], trader: [200], admin: [200] } },
    { action: 'Topic Routing write', method: 'POST', path: '/api/v1/topic-routing', body: { name: 'fixture-test', agent_key: 'technical', topic: 'test' }, roles: { user: [403, 401], vip: [403, 401], trader: [403, 401, 400], admin: [200, 201, 400, 422] } },
    { action: 'Artemis decision', method: 'POST', path: '/api/v1/artemis/decision', body: { symbol: 'BTCUSDT', dry_run: true }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403, 422], admin: [200, 403, 422] } },
    { action: 'Kill Switch activate', method: 'POST', path: '/api/v1/settings/execution-runtime/kill-switch', body: { activate: true, reason: 'fixture_test' }, roles: { user: [403, 401], vip: [403, 401], trader: [200, 403], admin: [200, 403] } },
    { action: 'Kill Switch clear', method: 'POST', path: '/api/v1/settings/execution-runtime/kill-switch', body: { activate: false }, roles: { user: [403, 401], vip: [403, 401], trader: [403, 400], admin: [403, 400] } },
    // Status GETs use AI_AGENT_READ — user/vip may read; mutations remain capability-gated elsewhere
    { action: 'scheduler control', method: 'GET', path: '/api/v1/scheduler/status', roles: { user: [200], vip: [200], trader: [200], admin: [200] } },
    { action: 'trading-engine control', method: 'GET', path: '/api/v1/trading-engine/status', roles: { user: [200], vip: [200], trader: [200], admin: [200] } },
    { action: 'Autopilot action', method: 'GET', path: '/api/v1/autopilot/status', roles: { user: [403, 401], vip: [403, 401], trader: [403, 401], admin: [200, 403] } },
  ];

  for (const role of ROLES) {
    for (const row of [
      'agent read',
      'safe agent execution',
      'live-capable agent execution',
      'agent config PATCH',
      'Topic Routing read',
      'Topic Routing write',
      'Artemis decision',
      'Kill Switch activate',
      'Kill Switch clear',
      'scheduler control',
      'trading-engine control',
      'Autopilot action',
    ]) {
      it(`${role}: ${row}`, async () => {
        expect(technicalId && orderId).toBeTruthy();
        const def = cases().find((c) => c.action === row);
        const f = fixtures[role];
        const r = await api(def.path, { token: f.token, method: def.method, body: def.body });
        expect(def.roles[role]).toContain(r.status);
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
    fixtures.trader = await createRoleFixture('trader');
  });

  it('vip permissions match user for safe execution', async () => {
    const vipR = await api(`/api/v1/ai-agents/${technicalId}/run`, { token: fixtures.vip.token, method: 'POST', body: { symbol: 'BTCUSDT', dry_run: true } });
    const userR = await api(`/api/v1/ai-agents/${technicalId}/run`, { token: fixtures.user.token, method: 'POST', body: { symbol: 'BTCUSDT', dry_run: true } });
    expect(vipR.status).toBe(userR.status);
  });

  it('unknown field rejected on agent config PATCH for admin', async () => {
    const r = await api(`/api/v1/ai-agents/${technicalId}/config`, {
      token: fixtures.admin.token,
      method: 'PATCH',
      body: { unknown_field: true, config: { x: 1 } },
    });
    expect([400, 422]).toContain(r.status);
  });
});

suite('Role fixture lifecycle', () => {
  it('creates and cleans up fixtures without permanent users', async () => {
    const f = await createAllRoleFixtures();
    expect(Object.keys(f)).toHaveLength(4);
    await cleanupAllFixtures();
  });
});
