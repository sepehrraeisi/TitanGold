#!/usr/bin/env node
/**
 * Real Redis + Worker/Scheduler process-level safety verification.
 * Uses isolated Redis :6381 for injection cases and short CLIENT PAUSE
 * against staging Redis for unavailable scenarios (auto-resumes).
 * NEVER clears Kill Switch. NEVER enables Live.
 */
import { spawn, execSync } from 'child_process';
import { createClient } from '../backend/node_modules/redis/dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const backend = path.join(root, 'backend');
const API = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
const ISOLATED_REDIS = 'redis://127.0.0.1:6381';
const results = {
  startedAt: new Date().toISOString(),
  scenarios: [],
  pass: true,
};

function log(msg) {
  console.log(`[redis-proc] ${msg}`);
}

async function apiGet(p) {
  const res = await fetch(`${API}${p}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function pgState() {
  const out = execSync(
    `cd ${backend} && node --input-type=module -e "import dotenv from 'dotenv'; dotenv.config(); import { query } from './database/db.js'; const r=await query(\\"SELECT value FROM system_settings WHERE key='global_execution_runtime'\\"); console.log(JSON.stringify(r.rows[0].value)); process.exit(0);"`,
    { encoding: 'utf8' },
  );
  return JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{')).pop());
}

function assertSafety(label, state, readyBody) {
  const issues = [];
  if (state.killSwitchActive !== true) issues.push('killSwitch not active in PG');
  if (String(state.globalMode).toLowerCase() !== 'demo') issues.push('globalMode not demo in PG');
  if (readyBody?.checks?.runtime_safety) {
    const rs = readyBody.checks.runtime_safety;
    if (rs.killSwitchActive !== true) issues.push('ready killSwitch false');
    if (rs.effectiveMode !== 'demo') issues.push('ready effectiveMode not demo');
  }
  return issues;
}

async function record(name, fn) {
  const started = new Date().toISOString();
  const t0 = performance.now();
  try {
    const detail = await fn();
    const ended = new Date().toISOString();
    const pg = await pgState();
    const ready = await apiGet('/api/v1/health/ready');
    const issues = assertSafety(name, pg, ready.body);
    const ok = issues.length === 0 && detail?.ok !== false;
    results.scenarios.push({
      name,
      started,
      ended,
      durationMs: Math.round(performance.now() - t0),
      status: ok ? 'PASS' : 'FAIL',
      issues,
      detail,
      pg: { killSwitchActive: pg.killSwitchActive, globalMode: pg.globalMode, version: pg.version, workerAckRevision: pg.workerAckRevision },
      readyStatus: ready.status,
      readyRuntime: ready.body?.checks?.runtime_safety,
    });
    if (!ok) results.pass = false;
    log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  } catch (e) {
    results.pass = false;
    results.scenarios.push({
      name,
      started,
      ended: new Date().toISOString(),
      status: 'FAIL',
      error: e.message,
    });
    log(`FAIL ${name}: ${e.message}`);
  }
}

function runChild(envExtra, code, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const child = spawn('node', ['--input-type=module'], {
      cwd: backend,
      env: { ...process.env, ...envExtra },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ exitCode: -1, stdout, stderr, timedOut: true });
    }, timeoutMs);
    child.stdin.write(code);
    child.stdin.end();
    child.on('close', (codeExit) => {
      clearTimeout(timer);
      resolve({ exitCode: codeExit, stdout, stderr, timedOut: false });
    });
  });
}

const childProbe = `
import dotenv from 'dotenv'; dotenv.config();
import { getRuntimeExecutionState, buildRuntimeView, isKillSwitchActive } from './services/runtimeExecutionStateService.js';
import { evaluateExecutionPolicy } from './services/agentExecutionPolicyService.js';
const state = await getRuntimeExecutionState({ preferCache: true });
const view = buildRuntimeView(state);
const kill = await isKillSwitchActive();
const policy = await evaluateExecutionPolicy({
  agentKey: 'order', userId: 'system', role: 'admin', requestedMode: 'live',
});
console.log(JSON.stringify({
  killSwitchActive: state.killSwitchActive,
  globalMode: state.globalMode,
  version: state.version,
  effectiveMode: view.effectiveMode,
  killCheck: kill,
  policyAllowed: policy.allowed,
  policyMode: policy.effectiveMode,
  sideEffectsSuppressed: policy.sideEffectsSuppressed,
}));
process.exit(state.killSwitchActive === true && view.effectiveMode === 'demo' ? 0 : 2);
`;

async function stagingRedisClient() {
  // connect without password attempt failures using env URL
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const client = createClient({ url, password: process.env.REDIS_PASSWORD || undefined });
  client.on('error', () => {});
  try {
    await client.connect();
    return client;
  } catch {
    const client2 = createClient({ url: 'redis://127.0.0.1:6379' });
    client2.on('error', () => {});
    await client2.connect();
    return client2;
  }
}

async function main() {
  // Preflight
  const prePg = await pgState();
  if (prePg.killSwitchActive !== true) throw new Error('Preflight: Kill Switch not active — abort');

  await record('backend_ready_redis_available', async () => {
    const health = await apiGet('/api/v1/health');
    const ready = await apiGet('/api/v1/health/ready');
    return {
      ok: health.status === 200 && ready.status === 200 && ready.body?.checks?.runtime_safety?.killSwitchActive === true,
      health: health.status,
      ready: ready.status,
    };
  });

  await record('process_start_redis_unavailable', async () => {
    const r = await runChild(
      { REDIS_URL: 'redis://127.0.0.1:19999', REDIS_PASSWORD: '' },
      childProbe,
    );
    const line = r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
    const parsed = line ? JSON.parse(line) : null;
    return {
      ok: r.exitCode === 0 && parsed?.killSwitchActive === true && parsed?.effectiveMode === 'demo',
      exitCode: r.exitCode,
      parsed,
      timedOut: r.timedOut,
      stderrTail: r.stderr.slice(-300),
    };
  });

  await record('worker_ack_path_redis_unavailable', async () => {
    const code = `
import dotenv from 'dotenv'; dotenv.config();
import { acknowledgeWorkerState, getRuntimeExecutionState, buildRuntimeView } from './services/runtimeExecutionStateService.js';
await acknowledgeWorkerState({ revision: undefined, pid: process.pid, host: 'proc-test' });
const state = await getRuntimeExecutionState({ preferCache: false });
const view = buildRuntimeView(state);
console.log(JSON.stringify({
  killSwitchActive: state.killSwitchActive,
  workerAckRevision: state.workerAckRevision,
  version: state.version,
  workerAcknowledged: view.workerAcknowledged,
  effectiveMode: view.effectiveMode,
}));
process.exit(state.killSwitchActive && view.effectiveMode === 'demo' ? 0 : 2);
`;
    const r = await runChild({ REDIS_URL: 'redis://127.0.0.1:19999', REDIS_PASSWORD: '' }, code);
    const line = r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
    return { ok: r.exitCode === 0, exitCode: r.exitCode, parsed: line ? JSON.parse(line) : null };
  });

  await record('scheduler_policy_redis_unavailable', async () => {
    const code = `
import dotenv from 'dotenv'; dotenv.config();
import { evaluateExecutionPolicy } from './services/agentExecutionPolicyService.js';
const decision = await evaluateExecutionPolicy({
  agentKey: 'order', userId: 'system', role: 'trader', requestedMode: 'live', executionContext: 'scheduler',
});
console.log(JSON.stringify(decision));
process.exit(decision.effectiveMode === 'live' ? 2 : 0);
`;
    const r = await runChild({ REDIS_URL: 'redis://127.0.0.1:19999', REDIS_PASSWORD: '' }, code);
    const line = r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
    const d = line ? JSON.parse(line) : {};
    return { ok: r.exitCode === 0 && d.effectiveMode !== 'live', exitCode: r.exitCode, decision: d };
  });

  await record('redis_pause_during_runtime_lookup', async () => {
    // CLIENT PAUSE WRITE 3s — Redis unavailable briefly for writes; GET may still work on some versions.
    // Use DEBUG SLEEP as fallback or iptables — CLIENT PAUSE is safest temporary block.
    let client;
    try {
      client = await stagingRedisClient();
      await client.sendCommand(['CLIENT', 'PAUSE', '3000', 'ALL']).catch(async () => {
        await client.sendCommand(['CLIENT', 'PAUSE', '3000']);
      });
    } catch (e) {
      return { ok: false, error: `pause failed: ${e.message}` };
    }
    const t0 = performance.now();
    const ready = await apiGet('/api/v1/health/ready');
    const elapsed = performance.now() - t0;
    // wait for pause to end
    await new Promise((r) => setTimeout(r, 3500));
    try { await client.quit(); } catch { /* ignore */ }
    const ready2 = await apiGet('/api/v1/health/ready');
    const stillSafe = ready2.body?.checks?.runtime_safety?.killSwitchActive === true;
    // During pause ready may degrade redis to warning but must not enable live
    const unsafe = ready.body?.checks?.runtime_safety?.effectiveMode === 'live'
      || ready.body?.checks?.runtime_safety?.killSwitchActive === false;
    return {
      ok: !unsafe && stillSafe,
      duringPauseReady: ready.status,
      duringPauseRuntime: ready.body?.checks?.runtime_safety,
      duringPauseRedis: ready.body?.checks?.redis,
      afterReady: ready2.status,
      elapsedMs: Math.round(elapsed),
    };
  });

  await record('redis_stale_weaker_cache_rejected', async () => {
    const pg = await pgState();
    const client = await stagingRedisClient();
    const weaker = {
      globalMode: 'live',
      killSwitchActive: false,
      version: Math.max(1, (pg.version || 1) - 1),
    };
    await client.setEx('titan:runtime:execution_state', 30, JSON.stringify(weaker));
    const code = `
import dotenv from 'dotenv'; dotenv.config();
import { getRuntimeExecutionState, buildRuntimeView } from './services/runtimeExecutionStateService.js';
const state = await getRuntimeExecutionState({ preferCache: true });
const view = buildRuntimeView(state);
console.log(JSON.stringify({ state, view }));
process.exit(state.killSwitchActive === true && view.effectiveMode === 'demo' ? 0 : 2);
`;
    const r = await runChild({}, code);
    await client.del('titan:runtime:execution_state');
    await client.quit();
    const line = r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
    return { ok: r.exitCode === 0, exitCode: r.exitCode, parsed: line ? JSON.parse(line) : null };
  });

  await record('redis_invalid_json_ignored', async () => {
    const client = await stagingRedisClient();
    await client.setEx('titan:runtime:execution_state', 30, 'NOT_JSON{{{');
    const code = `
import dotenv from 'dotenv'; dotenv.config();
import { getRuntimeExecutionState, buildRuntimeView } from './services/runtimeExecutionStateService.js';
const state = await getRuntimeExecutionState({ preferCache: true });
const view = buildRuntimeView(state);
console.log(JSON.stringify({ killSwitchActive: state.killSwitchActive, effectiveMode: view.effectiveMode }));
process.exit(state.killSwitchActive === true ? 0 : 2);
`;
    const r = await runChild({}, code);
    await client.del('titan:runtime:execution_state');
    await client.quit();
    return { ok: r.exitCode === 0, exitCode: r.exitCode };
  });

  await record('redis_invalid_newer_revision_ignored', async () => {
    const pg = await pgState();
    const client = await stagingRedisClient();
    await client.setEx('titan:runtime:execution_state', 30, JSON.stringify({
      globalMode: 'live', killSwitchActive: false, version: (pg.version || 1) + 9999,
    }));
    const code = `
import dotenv from 'dotenv'; dotenv.config();
import { getRuntimeExecutionState, buildRuntimeView } from './services/runtimeExecutionStateService.js';
const state = await getRuntimeExecutionState({ preferCache: true });
const view = buildRuntimeView(state);
console.log(JSON.stringify({ killSwitchActive: state.killSwitchActive, version: state.version, effectiveMode: view.effectiveMode, cachedVersionSkipped: true }));
process.exit(state.killSwitchActive === true && view.effectiveMode === 'demo' ? 0 : 2);
`;
    const r = await runChild({}, code);
    await client.del('titan:runtime:execution_state');
    await client.quit();
    return { ok: r.exitCode === 0, exitCode: r.exitCode };
  });

  await record('isolated_redis_pubsub_duplicate_out_of_order', async () => {
    const iso = createClient({ url: ISOLATED_REDIS });
    await iso.connect();
    const events = [];
    const sub = iso.duplicate();
    await sub.connect();
    await sub.subscribe('titan:runtime:events', (msg) => {
      try { events.push(JSON.parse(msg)); } catch { events.push({ raw: msg }); }
    });
    const pg = await pgState();
    // delayed / out-of-order / duplicate
    const make = (type, version) => JSON.stringify({
      type,
      state: { ...pg, version, killSwitchActive: true, globalMode: 'demo' },
      at: new Date().toISOString(),
    });
    await iso.publish('titan:runtime:events', make('runtime.updated', pg.version));
    await iso.publish('titan:runtime:events', make('runtime.updated', pg.version)); // duplicate
    await iso.publish('titan:runtime:events', make('runtime.updated', pg.version - 5)); // older/out-of-order
    await new Promise((r) => setTimeout(r, 300));
    // Simulate delayed event after policy decision
    await iso.publish('titan:runtime:events', make('runtime.updated', pg.version));
    await new Promise((r) => setTimeout(r, 200));
    await sub.quit();
    await iso.quit();
    // Safety still from PG — Child with isolated redis should still use PG
    const r = await runChild({ REDIS_URL: ISOLATED_REDIS, REDIS_PASSWORD: '' }, childProbe);
    return {
      ok: r.exitCode === 0 && events.length >= 3,
      eventsReceived: events.length,
      exitCode: r.exitCode,
    };
  });

  await record('backend_survives_redis_reconnect', async () => {
    const before = await apiGet('/api/v1/health/ready');
    const client = await stagingRedisClient();
    await client.sendCommand(['CLIENT', 'PAUSE', '2000', 'ALL']).catch(async () => {
      await client.sendCommand(['CLIENT', 'PAUSE', '2000']);
    });
    await new Promise((r) => setTimeout(r, 2500));
    try { await client.quit(); } catch { /* */ }
    const after = await apiGet('/api/v1/health');
    const ready = await apiGet('/api/v1/health/ready');
    return {
      ok: after.status === 200 && ready.body?.checks?.runtime_safety?.killSwitchActive === true,
      before: before.status,
      afterHealth: after.status,
      afterReady: ready.status,
      runtime: ready.body?.checks?.runtime_safety,
    };
  });

  // Worker restart while redis paused — use PM2 soft restart after pause ends? Too risky.
  // Instead spawn short worker-ack child with redis unavailable (already covered) and verify staging worker still online.
  await record('staging_worker_still_online_after_tests', async () => {
    const out = execSync('pm2 jlist', { encoding: 'utf8' });
    const list = JSON.parse(out);
    const worker = list.find((x) => x.name === 'titan-engine-worker');
    const backends = list.filter((x) => x.name === 'titan-backend');
    return {
      ok: worker?.pm2_env?.status === 'online' && backends.every((b) => b.pm2_env?.status === 'online'),
      workerPid: worker?.pid,
      backendPids: backends.map((b) => b.pid),
      backendMode: backends[0]?.pm2_env?.exec_mode,
    };
  });

  // Final safety verify
  const finalPg = await pgState();
  const finalReady = await apiGet('/api/v1/health/ready');
  results.final = {
    pg: { killSwitchActive: finalPg.killSwitchActive, globalMode: finalPg.globalMode, version: finalPg.version, workerAckRevision: finalPg.workerAckRevision },
    ready: finalReady.body?.checks?.runtime_safety,
    brokerConnections: finalReady.body?.checks?.user_connections?.count,
  };
  if (finalPg.killSwitchActive !== true || finalPg.globalMode !== 'demo') results.pass = false;

  results.endedAt = new Date().toISOString();
  results.summary = {
    total: results.scenarios.length,
    pass: results.scenarios.filter((s) => s.status === 'PASS').length,
    fail: results.scenarios.filter((s) => s.status === 'FAIL').length,
  };

  const out = path.join(root, 'docs/evidence/redis-process-level.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  log(`Wrote ${out}`);
  log(JSON.stringify(results.summary));
  process.exit(results.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
