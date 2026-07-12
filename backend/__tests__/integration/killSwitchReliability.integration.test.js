/**
 * Kill switch reliability — process-level integration (requires live backend + worker)
 * Run: RUN_INTEGRATION=1 npm test -- killSwitchReliability.integration.test.js
 * @jest-environment node
 */
import { describe, expect, it, beforeAll } from '@jest/globals';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { query } from '../../database/db.js';

dotenv.config();

const INTEGRATION = process.env.RUN_INTEGRATION === '1';
const BASE = process.env.BACKEND_INTEGRATION_URL || 'http://127.0.0.1:5002';
const CYCLES = parseInt(process.env.KILL_SWITCH_CYCLES || '30', 10);

const suite = INTEGRATION ? describe : describe.skip;

function percentile(sorted, p) {
  if (!sorted.length) return -1;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

suite('Kill Switch reliability integration', () => {
  let token;
  let headers;

  beforeAll(async () => {
    const admin = await query("SELECT id FROM users WHERE role='admin' AND is_active=true LIMIT 1");
    if (!admin.rows[0]) throw new Error('No admin user for integration tests');
    token = jwt.sign({ userId: admin.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  });

  it(`completes ${CYCLES} activation cycles with worker ack`, async () => {
    const latencies = [];
    let failures = 0;
    let revisionMismatches = 0;
    let duplicateAcks = 0;
    const seenAckRevisions = new Set();

    for (let i = 0; i < CYCLES; i += 1) {
      const t0 = Date.now();
      const actRes = await fetch(`${BASE}/api/v1/settings/execution-runtime/kill-switch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: `reliability_${i}`, activate: true }),
      });
      expect(actRes.status).toBe(200);

      let acked = false;
      let lastBody = null;
      while (Date.now() - t0 < 5000) {
        const st = await fetch(`${BASE}/api/v1/settings/execution-runtime`, { headers });
        lastBody = await st.json();
        if (lastBody.workerAcknowledged && lastBody.workerAckRevision === lastBody.stateVersion) {
          latencies.push(Date.now() - t0);
          if (seenAckRevisions.has(lastBody.workerAckRevision)) duplicateAcks += 1;
          seenAckRevisions.add(lastBody.workerAckRevision);
          acked = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
      }

      if (!acked) {
        failures += 1;
        if (lastBody?.workerAckRevision != null && lastBody.workerAckRevision !== lastBody.stateVersion) {
          revisionMismatches += 1;
        }
      }
    }

    latencies.sort((a, b) => a - b);
    const summary = {
      cycles: CYCLES,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? latencies[latencies.length - 1] : -1,
      failures,
      duplicateAcks,
      revisionMismatches,
    };
    // eslint-disable-next-line no-console
    console.log('KILL_SWITCH_RELIABILITY', JSON.stringify(summary));

    expect(failures).toBe(0);
    expect(summary.p95).toBeLessThan(500);
    expect(summary.p99).toBeLessThan(1000);
  }, 120000);

  it('rejects unauthorized kill switch clear', async () => {
    const user = await query("SELECT id FROM users WHERE role='user' AND is_active=true LIMIT 1");
    if (!user.rows[0]) return;
    const userToken = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await fetch(`${BASE}/api/v1/settings/execution-runtime/kill-switch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate: false, confirm_clear_kill_switch: true }),
    });
    expect([403, 401]).toContain(res.status);
  });

  it('execution-runtime requires authentication', async () => {
    const res = await fetch(`${BASE}/api/v1/settings/execution-runtime`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHENTICATED');
  });
});
