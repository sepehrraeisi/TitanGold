#!/usr/bin/env node
/**
 * Runtime safety performance benchmark
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
const root = path.resolve(args.root || args.cwd || process.cwd());
const backendDir = path.join(root, 'backend');
const iterations = parseInt(args.iterations || '50', 10);

function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.ceil((p / 100) * s.length) - 1] ?? 0;
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
  return { p50: percentile(times, 50), p95: percentile(times, 95), max: Math.max(...times) };
}

async function main() {
  const result = { label, timestamp: new Date().toISOString(), root, bundle: bundleSize() };
  try {
    result.runtimeLookupMs = await benchRuntimeLookup();
  } catch (e) {
    result.runtimeLookupMs = { error: e.message };
  }
  const out = path.join(root, `perf-runtime-${label}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
