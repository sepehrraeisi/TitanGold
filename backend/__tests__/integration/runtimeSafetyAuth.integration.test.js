/**
 * Auth + capability integration matrix (live backend when RUN_INTEGRATION=1)
 * @jest-environment node
 */
import { describe, expect, it, beforeAll } from '@jest/globals';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { query } from '../../database/db.js';

dotenv.config();

const INTEGRATION = process.env.RUN_INTEGRATION === '1';
const BASE = process.env.BACKEND_INTEGRATION_URL || 'http://127.0.0.1:5002';
const suite = INTEGRATION ? describe : describe.skip;

function sign(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

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

suite('Authentication integration matrix', () => {
  let adminId;
  let userId;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    const admin = await query("SELECT id FROM users WHERE role='admin' AND is_active=true LIMIT 1");
    const user = await query("SELECT id FROM users WHERE role='user' AND is_active=true LIMIT 1");
    adminId = admin.rows[0]?.id;
    userId = user.rows[0]?.id;
    if (adminId) adminToken = sign(adminId);
    if (userId) userToken = sign(userId);
  });

  it('missing token → 401 on agents list', async () => {
    const r = await api('/api/v1/ai-agents');
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('UNAUTHENTICATED');
  });

  it('expired token → 401', async () => {
    const expired = jwt.sign({ userId: adminId || userId }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const r = await api('/api/v1/ai-agents', { token: expired });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('TOKEN_EXPIRED');
  });

  it('invalid signature → 401', async () => {
    const bad = jwt.sign({ userId: adminId || userId }, 'wrong-secret', { expiresIn: '1h' });
    const r = await api('/api/v1/ai-agents', { token: bad });
    expect(r.status).toBe(401);
  });

  it('forged elevated JWT role still resolves DB role for user', async () => {
    if (!userId) return;
    const forged = jwt.sign({ userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const r = await api('/api/v1/ai-agents/order/run', {
      token: forged,
      method: 'POST',
      body: { symbol: 'BTCUSDT', params: { action: 'place_order' } },
    });
    expect([403, 401, 404, 422]).toContain(r.status);
  });

  it('user cannot POST topic-routing create', async () => {
    if (!userToken) return;
    const r = await api('/api/v1/topic-routing', {
      token: userToken,
      method: 'POST',
      body: { name: 'test', agent_key: 'technical', topic: 'test' },
    });
    expect([403, 401, 400, 422]).toContain(r.status);
  });

  it('admin can GET execution-runtime', async () => {
    if (!adminToken) return;
    const r = await api('/api/v1/settings/execution-runtime', { token: adminToken });
    expect(r.status).toBe(200);
    expect(r.body.killSwitchActive).toBe(true);
    expect(r.body.effectiveMode).toBe('demo');
  });

  it('user GET capabilities returns stable contract', async () => {
    if (!userToken) return;
    const r = await api('/api/v1/auth/capabilities', { token: userToken });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.capabilities)).toBe(true);
    expect(r.body.capabilities).toContain('AI_AGENT_READ');
    expect(r.body.capabilities).not.toContain('AI_AGENT_EXECUTE_SAFE');
  });

  it('admin GET capabilities includes configure', async () => {
    if (!adminToken) return;
    const r = await api('/api/v1/auth/capabilities', { token: adminToken });
    expect(r.status).toBe(200);
    expect(r.body.capabilities).toContain('AI_AGENT_CONFIGURE');
    expect(r.body.capabilities).toContain('KILL_SWITCH_CONTROL');
  });

  it('emergency-stop alias uses canonical service', async () => {
    if (!adminToken) return;
    const r = await api('/api/v1/trading-engine/emergency-stop', {
      token: adminToken,
      method: 'POST',
      body: { reason: 'alias_test' },
    });
    expect(r.status).toBe(200);
    expect(r.body.killSwitchActive).toBe(true);
  });
});
