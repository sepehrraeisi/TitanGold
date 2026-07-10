/** Benchmark fast vs full pipeline snapshot paths */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024';
const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000001', role: 'admin' }, JWT_SECRET);
const headers = { Authorization: `Bearer ${token}` };

async function bench(label, url) {
  const t0 = Date.now();
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(120000) });
  const ms = Date.now() - t0;
  const body = await r.text();
  return { label, status: r.status, ms, bytes: body.length };
}

const base = 'http://127.0.0.1:5002/api/v1/data-sources';
const results = [];
for (const [label, url] of [
  ['fast_pipeline', `${base}/pipeline?includeBacklog=false`],
  ['full_pipeline', `${base}/pipeline?includeBacklog=true`],
  ['backlog_only', `${base}/pipeline/backlog`],
]) {
  results.push(await bench(label, url));
  console.log(JSON.stringify(results[results.length - 1]));
}
