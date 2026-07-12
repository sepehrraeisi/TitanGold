#!/usr/bin/env node
/**
 * Expanded runtime-safety performance benchmark (baseline vs current).
 * Usage:
 *   node scripts/perf-runtime-benchmark.mjs --label=current
 *   node scripts/perf-runtime-benchmark.mjs --label=baseline --root=/tmp/titangold-baseline-d705bd2
 */
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const label = args.label || 'current';
const root = path.resolve(args.root || process.cwd());
const backendDir = path.join(root, 'backend');
const iterations = parseInt(args.iterations || '30', 10);
const API = process.env.BACKEND_INTEGRATION_URL || 'http://127.0.0.1:5002';

function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.ceil((p / 100) * s.length) - 1] ?? 0;
}

function stats(times) {
  return {
    p50: Math.round(percentile(times, 50) * 100) / 100,
    p95: Math.round(percentile(times, 95) * 100) / 100,
    p99: Math.round(percentile(times, 99) * 100) / 100,
    max: Math.round(Math.max(...times) * 100) / 100,
    n: times.length,
  };
}

function bundleSize() {
  const dist = path.join(root, 'dist/assets');
  if (!fs.existsSync(dist)) return { totalKb: null };
  let total = 0;
  for (const f of fs.readdirSync(dist)) {
    if (f.endsWith('.js')) total += fs.statSync(path.join(dist, f)).size;
  }
  return { totalKb: Math.round(total / 1024) };
}

async function benchRuntimeLookup() {
  const prev = process.cwd();
  process.chdir(backendDir);
  const dotenv = await import(pathToFileURL(path.join(backendDir, 'node_modules/dotenv/lib/main.js')).href);
  dotenv.config();
  const mod = await import(pathToFileURL(path.join(backendDir, 'services/runtimeExecutionStateService.js')).href);
  const times = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    await mod.getRuntimeExecutionState({ preferCache: i % 2 === 0 });
    times.push(performance.now() - t0);
  }
  process.chdir(prev);
  return stats(times);
}

async function benchHttp(name, fn) {
  const times = [];
  for (let i = 0; i < Math.min(iterations, 20); i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return { [name]: stats(times) };
}

async function benchEndpoints() {
  const out = {};
  try {
    out.health = (await benchHttp('health', () => fetch(`${API}/api/v1/health`))).health;
    out.ready = (await benchHttp('ready', () => fetch(`${API}/api/v1/health/ready`))).ready;
    out.agentsDenied = (await benchHttp('agentsDenied', () => fetch(`${API}/api/v1/ai-agents`))).agentsDenied;
    out.topicRoutingDenied = (await benchHttp('topicRoutingDenied', () => fetch(`${API}/api/v1/topic-routing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))).topicRoutingDenied;
  } catch (e) {
    out.endpointError = e.message;
  }
  return out;
}

async function main() {
  const result = {
    label,
    timestamp: new Date().toISOString(),
    root,
    bundle: bundleSize(),
    iterations,
  };
  try {
    result.runtimeLookupMs = await benchRuntimeLookup();
  } catch (e) {
    result.runtimeLookupMs = { error: e.message };
  }
  if (label === 'current') {
    result.endpoints = await benchEndpoints();
  }
  const outDir = path.join(root, 'docs/evidence/performance');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `perf-runtime-${label}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
