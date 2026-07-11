/**
 * Measure automation API performance before/after optimization.
 * Run: cd backend && node scripts/automation-p4-performance.mjs
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.API_BASE || 'http://localhost:5002';
const ADMIN_ID = 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots/automation-p4-performance.json');

async function timedFetch(path, opts = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, opts);
  const ms = Date.now() - t0;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { path, status: res.status, ms, ok: res.ok, bodySize: JSON.stringify(body || {}).length };
}

async function main() {
  const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const results = {
    capturedAt: new Date().toISOString(),
    baselineMs: { overview: 6874, refresh: 6874 },
    endpoints: [],
  };

  for (const path of [
    '/api/v1/data-hub/automation/overview',
    '/api/v1/data-hub/automation/topics',
    '/api/v1/data-hub/automation/queue',
    '/api/v1/data-hub/automation/executions?limit=20',
  ]) {
    results.endpoints.push(await timedFetch(path, { headers }));
  }

  results.endpoints.push(
    await timedFetch('/api/v1/data-hub/automation/queue/refresh', {
      method: 'POST',
      headers,
      body: '{}',
    }),
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
