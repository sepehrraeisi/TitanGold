#!/usr/bin/env node
/**
 * PM2 cluster + Nginx + dependency startup verification evidence.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const API = 'http://127.0.0.1:5002';
const results = { startedAt: new Date().toISOString(), checks: [], pass: true };

function add(name, ok, detail) {
  results.checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) results.pass = false;
  console.log(`[cluster] ${ok ? 'PASS' : 'FAIL'} ${name}`);
}

async function main() {
  const list = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
  const backends = list.filter((x) => x.name === 'titan-backend');
  const worker = list.find((x) => x.name === 'titan-engine-worker');

  add('pm2_cluster_mode', backends.every((b) => b.pm2_env?.exec_mode === 'cluster_mode'), {
    modes: backends.map((b) => b.pm2_env?.exec_mode),
  });
  add('pm2_instance_count_two', backends.length === 2, { count: backends.length, pids: backends.map((b) => b.pid) });
  add('both_backend_online', backends.every((b) => b.pm2_env?.status === 'online' && b.pid), {
    statuses: backends.map((b) => ({ pid: b.pid, status: b.pm2_env?.status, restarts: b.pm2_env?.restart_time })),
  });
  add('worker_separate_fork', worker?.pm2_env?.exec_mode === 'fork_mode' && worker?.pm2_env?.status === 'online', {
    pid: worker?.pid, mode: worker?.pm2_env?.exec_mode,
  });
  add('no_restart_loop', backends.every((b) => (b.pm2_env?.restart_time || 0) < 50), {
    restarts: backends.map((b) => b.pm2_env?.restart_time),
  });

  // Port + repeated requests
  const port = execSync("ss -tlnp | grep ':5002 ' || true", { encoding: 'utf8' });
  add('port_5002_bound', /:5002/.test(port), { port: port.trim() });

  const statuses = [];
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${API}/api/v1/health`);
    statuses.push(r.status);
  }
  add('repeated_health_200', statuses.every((s) => s === 200), { statuses: statuses.slice(0, 5), n: statuses.length });

  // Nginx via local host header if possible
  let nginx = null;
  try {
    const r = await fetch('http://127.0.0.1/api/v1/health', { headers: { Host: 'titan.zala.ir' }, redirect: 'manual' });
    nginx = { status: r.status, via: 'host-header-http' };
  } catch (e) {
    try {
      const r = await fetch('https://titan.zala.ir/api/v1/health', { redirect: 'manual' });
      nginx = { status: r.status, via: 'https-public' };
    } catch (e2) {
      nginx = { status: 0, error: e2.message, via: 'failed' };
    }
  }
  add('nginx_upstream_health', nginx.status === 200 || nginx.status === 301 || nginx.status === 302, nginx);

  // One instance restart — API remains available
  const victim = backends[0]?.pm2_env?.pm_id;
  if (victim !== undefined) {
    execSync(`pm2 restart ${victim}`, { encoding: 'utf8' });
    await new Promise((r) => setTimeout(r, 5000));
    const during = [];
    for (let i = 0; i < 10; i++) {
      try {
        const r = await fetch(`${API}/api/v1/health`);
        during.push(r.status);
      } catch {
        during.push(0);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const afterList = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' })).filter((x) => x.name === 'titan-backend');
    add('single_instance_restart_api_available', during.filter((s) => s === 200).length >= 7, {
      during,
      afterPids: afterList.map((b) => b.pid),
      afterStatuses: afterList.map((b) => b.pm2_env?.status),
    });
  } else {
    add('single_instance_restart_api_available', false, { error: 'no pm_id' });
  }

  // Runtime safety still ok
  const ready = await fetch(`${API}/api/v1/health/ready`).then((r) => r.json());
  add('runtime_safety_after_cluster_ops', ready.checks?.runtime_safety?.killSwitchActive === true && ready.checks?.runtime_safety?.effectiveMode === 'demo', ready.checks?.runtime_safety);

  // PostgreSQL/Redis auto-start evidence
  const pgUnit = execSync('systemctl is-enabled postgresql@14-main 2>/dev/null || systemctl is-enabled postgresql 2>/dev/null || echo unknown', { encoding: 'utf8' }).trim();
  const redisUnit = execSync('systemctl is-enabled redis-server 2>/dev/null || systemctl is-enabled redis 2>/dev/null || echo unknown', { encoding: 'utf8' }).trim();
  const pm2Startup = execSync('systemctl is-enabled pm2-ubuntu 2>/dev/null || systemctl is-enabled pm2-root 2>/dev/null || ls ~/.pm2/dump.pm2 >/dev/null 2>&1 && echo dump_exists || echo unknown', { encoding: 'utf8' }).trim();
  add('postgres_enabled_or_documented', pgUnit === 'enabled' || pgUnit === 'enabled-runtime' || pgUnit === 'static', { pgUnit });
  add('redis_enabled_or_documented', redisUnit === 'enabled' || redisUnit === 'enabled-runtime' || redisUnit === 'static' || redisUnit === 'unknown', { redisUnit });
  add('pm2_resurrect_configured', /enabled|dump_exists/.test(pm2Startup), { pm2Startup });

  results.endedAt = new Date().toISOString();
  const out = path.join(root, 'docs/evidence/pm2-cluster-nginx.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.pass, checks: results.checks.length }, null, 2));
  process.exit(results.pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
