#!/usr/bin/env node
/**
 * Gap-fill only: Redis scenarios #14 and #15 from Human-QA reconciliation.
 * Short CLIENT PAUSE (auto-expires). NEVER clears Kill Switch / NEVER enables Live.
 */
import { execSync } from 'child_process';
import { createClient } from '../backend/node_modules/redis/dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(root, 'backend/.env') });

const API = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
const results = {
  startedAt: new Date().toISOString(),
  scenarios: [],
  note: 'Gap-only: worker restart during Redis unavailable; one backend cluster instance restart during Redis unavailable',
};

async function apiGet(p) {
  const res = await fetch(`${API}${p}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function pgState() {
  const out = execSync(
    `cd ${path.join(root, 'backend')} && node --input-type=module -e "import dotenv from 'dotenv'; dotenv.config(); import { query } from './database/db.js'; const r=await query(\\"SELECT value FROM system_settings WHERE key='global_execution_runtime'\\"); console.log(JSON.stringify(r.rows[0].value)); process.exit(0);"`,
    { encoding: 'utf8' },
  );
  return JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{')).pop());
}

async function stagingRedis() {
  // Host Redis has no requirepass; env REDIS_URL embeds a stale password — use bare localhost.
  const client = createClient({ url: 'redis://127.0.0.1:6379' });
  client.on('error', () => {});
  await client.connect();
  await client.ping();
  return client;
}

async function pauseRedis(client, ms = 4000) {
  try {
    await client.sendCommand(['CLIENT', 'PAUSE', String(ms), 'ALL']);
  } catch {
    await client.sendCommand(['CLIENT', 'PAUSE', String(ms)]);
  }
}

function pm2List() {
  return JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
}

function assertSafety(pg, readyBody) {
  const issues = [];
  if (pg.killSwitchActive !== true) issues.push('PG killSwitch false');
  if (String(pg.globalMode).toLowerCase() !== 'demo') issues.push('PG mode not demo');
  const rs = readyBody?.checks?.runtime_safety;
  if (rs && rs.killSwitchActive !== true) issues.push('ready killSwitch false');
  if (rs && rs.effectiveMode !== 'demo') issues.push('ready not demo');
  return issues;
}

async function main() {
  // --- #14 Worker restart while Redis unavailable ---
  {
    const name = 'gap14_worker_restart_while_redis_unavailable';
    const started = new Date().toISOString();
    const before = pm2List().find((x) => x.name === 'titan-engine-worker');
    const client = await stagingRedis();
    await pauseRedis(client, 5000);
    let restartOut = '';
    try {
      restartOut = execSync('pm2 restart titan-engine-worker --update-env', {
        encoding: 'utf8',
        timeout: 15000,
      });
    } catch (e) {
      restartOut = String(e.stdout || e.message);
    }
    // Wait through pause + worker boot; do not clear KS
    await new Promise((r) => setTimeout(r, 5500));
    try {
      await client.quit();
    } catch {
      /* paused connection */
    }
    await new Promise((r) => setTimeout(r, 1500));
    const after = pm2List().find((x) => x.name === 'titan-engine-worker');
    const pg = pgState();
    const ready = await apiGet('/api/v1/health/ready');
    const issues = assertSafety(pg, ready.body);
    const ok =
      issues.length === 0 &&
      after?.pm2_env?.status === 'online' &&
      ready.body?.checks?.runtime_safety?.killSwitchActive === true &&
      ready.body?.checks?.runtime_safety?.effectiveMode === 'demo';
    results.scenarios.push({
      name,
      requiredScenario: 14,
      started,
      ended: new Date().toISOString(),
      status: ok ? 'PASS' : 'FAIL',
      issues,
      detail: {
        beforePid: before?.pid,
        afterPid: after?.pid,
        afterStatus: after?.pm2_env?.status,
        restartSnippet: restartOut.slice(0, 200),
        ready: ready.body?.checks?.runtime_safety,
        pg: {
          killSwitchActive: pg.killSwitchActive,
          globalMode: pg.globalMode,
          version: pg.version,
          workerAckRevision: pg.workerAckRevision,
        },
        connections: ready.body?.checks?.user_connections?.count,
      },
    });
    console.log(ok ? 'PASS' : 'FAIL', name, issues);
  }

  // --- #15 One backend cluster instance restart while Redis unavailable ---
  {
    const name = 'gap15_backend_cluster_instance_restart_while_redis_unavailable';
    const started = new Date().toISOString();
    const backends = pm2List().filter((x) => x.name === 'titan-backend');
    const targetId = backends[0]?.pm2_env?.pm_id;
    const client = await stagingRedis();
    await pauseRedis(client, 5000);
    let restartOut = '';
    try {
      restartOut = execSync(`pm2 restart ${targetId} --update-env`, {
        encoding: 'utf8',
        timeout: 20000,
      });
    } catch (e) {
      restartOut = String(e.stdout || e.message);
    }
    // Probe during/after pause via surviving instance
    const midProbes = [];
    for (let i = 0; i < 6; i++) {
      try {
        const h = await apiGet('/api/v1/health');
        midProbes.push(h.status);
      } catch {
        midProbes.push(0);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 3500));
    try {
      await client.quit();
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 2000));
    const afterBackends = pm2List().filter((x) => x.name === 'titan-backend');
    const pg = pgState();
    const ready = await apiGet('/api/v1/health/ready');
    const issues = assertSafety(pg, ready.body);
    const any200 = midProbes.some((c) => c === 200);
    const allOnline = afterBackends.every((b) => b.pm2_env?.status === 'online') && afterBackends.length === 2;
    const ok =
      issues.length === 0 &&
      any200 &&
      allOnline &&
      ready.body?.checks?.runtime_safety?.killSwitchActive === true &&
      ready.body?.checks?.runtime_safety?.effectiveMode === 'demo';
    results.scenarios.push({
      name,
      requiredScenario: 15,
      started,
      ended: new Date().toISOString(),
      status: ok ? 'PASS' : 'FAIL',
      issues,
      detail: {
        targetPmId: targetId,
        midHealthProbes: midProbes,
        after: afterBackends.map((b) => ({
          pm_id: b.pm2_env?.pm_id,
          pid: b.pid,
          status: b.pm2_env?.status,
          mode: b.pm2_env?.exec_mode,
        })),
        restartSnippet: restartOut.slice(0, 200),
        ready: ready.body?.checks?.runtime_safety,
        pg: {
          killSwitchActive: pg.killSwitchActive,
          globalMode: pg.globalMode,
          version: pg.version,
          workerAckRevision: pg.workerAckRevision,
        },
        connections: ready.body?.checks?.user_connections?.count,
      },
    });
    console.log(ok ? 'PASS' : 'FAIL', name, issues, { any200, allOnline });
  }

  const finalPg = pgState();
  const finalReady = await apiGet('/api/v1/health/ready');
  results.final = {
    pg: {
      killSwitchActive: finalPg.killSwitchActive,
      globalMode: finalPg.globalMode,
      version: finalPg.version,
      workerAckRevision: finalPg.workerAckRevision,
    },
    ready: finalReady.body?.checks?.runtime_safety,
    connections: finalReady.body?.checks?.user_connections?.count,
  };
  results.pass = results.scenarios.every((s) => s.status === 'PASS') && finalPg.killSwitchActive === true;
  results.endedAt = new Date().toISOString();

  const out = path.join(root, 'docs/evidence/redis-gap-scenarios-14-15.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('Wrote', out, 'pass=', results.pass);
  process.exit(results.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
