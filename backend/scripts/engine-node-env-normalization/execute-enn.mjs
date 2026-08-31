#!/usr/bin/env node
/**
 * ENGINE_NODE_ENV_NORMALIZATION V2 — one-shot Tier-3 executor.
 * Numeric retained pm_id restart only · EXTRA_ISOLATION_GATE · retained dump row binding.
 */

import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createLiveBoundary } from '../t2-retry-orchestrator/liveBoundary.mjs';
import { validateRequiredHealth } from '../t2-retry-orchestrator/requiredHealth.mjs';
import { sanitizeApplicationEnvContainer } from '../t2-retry-orchestrator/pm2SemanticModel.mjs';
import {
  AUTHORIZED_TRANSACTION_V2,
  assertExtraIsolationGate,
  assertSanitizedRestartEnvKeys,
  buildNumericPm2RestartSpec,
  buildSanitizedPm2RestartEnv,
  projectDumpNodeEnvRetainedOnly,
  resolveEngineTopology,
  resolveRetainedDumpRowBinding,
} from './ennV2Core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROD_ROOT = '/home/ubuntu/webapp/TitanGold';
const ECOSYSTEM = path.join(PROD_ROOT, 'backend/ecosystem.config.json');
const DUMP_PATH = path.join(process.env.PM2_HOME || '/home/ubuntu/.pm2', 'dump.pm2');
const EXPECTED_DUMP_SHA_PRE = '72d3ea60e3df1ca7364291278b790bc069e29fc1d4108cb9c2f1edf515a90a3d';
const B1_SHA = {
  engineWorkerLeader: 'bcf4f24ab20123290a3b602d6fbd9c08d7e6f19193e79775afb4eeb282fb1b9b',
  scheduler: 'a6545ac65d26ef37092a64d6748e04dbbef29a026874fe6279a6a18c1380779b',
  pipelineSchedulerRuntime: '9930ca2d6b6220a6def99e540aa66aaa1e4776feaee1b3ab66eece6a6ec8c1f5',
};

const SECRET_PATTERNS = [/PASSWORD/i, /SECRET/i, /TOKEN/i, /KEY/i, /JWT/i, /API_KEY/i, /PRIVATE/i, /CREDENTIAL/i];

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function runId() {
  return `ENN-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
}

function pm2Jlist() {
  const r = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('PM2_JLIST_FAIL');
  return JSON.parse(r.stdout);
}

function isSecretKey(k) {
  return SECRET_PATTERNS.some((re) => re.test(k));
}

function fingerprintEngine(pmId) {
  const list = pm2Jlist();
  const eng = list.find((p) => Number(p.pm_id) === Number(pmId));
  if (!eng) throw new Error('ENGINE_NOT_FOUND');
  const sanitized = sanitizeApplicationEnvContainer(eng.pm2_env?.env || {});
  const keys = Object.keys(sanitized).sort();
  const nonNode = {};
  for (const [k, v] of Object.entries(sanitized)) {
    if (k === 'NODE_ENV') continue;
    if (isSecretKey(k)) nonNode[k] = { class: 'SECRET', present: v != null && String(v) !== '' };
    else nonNode[k] = { class: 'NON_SECRET', hash: sha256Buf(Buffer.from(String(v ?? ''))) };
  }
  const sortedNonNode = Object.fromEntries(Object.keys(nonNode).sort().map((k) => [k, nonNode[k]]));
  return {
    liveNodeEnv: sanitized.NODE_ENV,
    livePath: sanitized.PATH,
    keysetFp: sha256Buf(Buffer.from(JSON.stringify(keys))),
    nonNodeFp: sha256Buf(Buffer.from(JSON.stringify(sortedNonNode))),
    pid: eng.pid,
  };
}

function curlStatus(url) {
  const r = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', url], {
    encoding: 'utf8',
  });
  const code = Number(String(r.stdout || '').trim());
  return Number.isFinite(code) ? code : 0;
}

function fetchHealth() {
  return {
    status5002: curlStatus('http://127.0.0.1:5002/health'),
    status5003: curlStatus('http://127.0.0.1:5003/health'),
    collectorHealth: curlStatus('http://127.0.0.1:5003/api/telegram-collector/health'),
    accounts: curlStatus('http://127.0.0.1:5003/api/telegram-collector/accounts'),
    channels: curlStatus('http://127.0.0.1:5003/api/telegram-collector/collector-channels'),
  };
}

function parseDumpNodeEnvRetained(dump, retainedLiveProc, binding) {
  const entries = Array.isArray(dump) ? dump : dump.apps || [];
  const row = entries[binding.retainedDumpIndex];
  return row?.NODE_ENV ?? row?.pm2_env?.env?.NODE_ENV ?? row?.env?.NODE_ENV;
}

function sanitizedNumericPm2Restart(pmId, nodeEnv, livePath) {
  const spec = buildNumericPm2RestartSpec(pmId, nodeEnv);
  if (!spec.ok) throw new Error(spec.error);
  const env = buildSanitizedPm2RestartEnv({
    nodeEnv,
    home: process.env.HOME,
    user: process.env.USER || 'ubuntu',
    logname: process.env.LOGNAME || process.env.USER || 'ubuntu',
    pm2Home: process.env.PM2_HOME || '/home/ubuntu/.pm2',
    path: livePath,
  });
  const envCheck = assertSanitizedRestartEnvKeys(env);
  if (!envCheck.ok) throw new Error(envCheck.error);
  return spawnSync(spec.command, spec.args, { encoding: 'utf8', env });
}

async function atomicRestoreDump(preBytes, preStat) {
  const dir = path.dirname(DUMP_PATH);
  const tmp = path.join(dir, `dump.pm2.enn.restore.${process.pid}.${Date.now()}`);
  await fsp.writeFile(tmp, preBytes, { mode: preStat.mode & 0o777 });
  await fsp.chmod(tmp, preStat.mode & 0o777);
  await fsp.rename(tmp, DUMP_PATH);
  const fh = await fsp.open(dir, 'r');
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }
}

const ledger = {
  RUN_ID: runId(),
  AUTHORIZED_TRANSACTION: AUTHORIZED_TRANSACTION_V2,
  PM2_SAVE_COUNT: 0,
  ENGINE_REFRESH_APPLIED: false,
  PROJECTED_DUMP_WRITE_APPLIED: false,
};

const report = [];
function log(line) {
  report.push(line);
  console.log(line);
}

function requireIsolation(pm2List, ids, phase) {
  const gate = assertExtraIsolationGate(pm2List, ids, phase);
  if (!gate.ok) throw new Error(`${gate.error}:${phase}`);
}

async function main() {
  const secureRoot = `/home/ubuntu/TITANGOLD_PM2_SECURE_BACKUPS/TITANGOLD_ENN_${ledger.RUN_ID}`;
  const evidencePath = `/home/ubuntu/TITANGOLD_ENN_${ledger.RUN_ID}.txt`;
  let terminal = 'STOPPED_PRECHECK';
  let pre = {};

  try {
    log(`RUN_ID=${ledger.RUN_ID}`);
    log(`AUTHORIZED_TRANSACTION=${ledger.AUTHORIZED_TRANSACTION}`);

    const dumpStat = fs.statSync(DUMP_PATH);
    const dumpShaPre = sha256Buf(fs.readFileSync(DUMP_PATH));
    const dumpJsonPre = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));

    const topology = resolveEngineTopology(pm2Jlist());
    if (!topology.ok) throw new Error(topology.error);

    const isolationIds = {
      extraPmId: topology.extraPmId,
      retainedPmId: topology.retainedPmId,
    };

    requireIsolation(pm2Jlist(), isolationIds, 'PRE');

    const dumpBindingPre = resolveRetainedDumpRowBinding(dumpJsonPre, topology.retained, {
      canonicalPath: null,
    });
    if (!dumpBindingPre.ok) throw new Error(dumpBindingPre.error);

    pre = {
      pmId: topology.retainedPmId,
      extraPmId: topology.extraPmId,
      pid: topology.retained.pid,
      dumpSha: dumpShaPre,
      dumpMode: dumpStat.mode & 0o777,
      dumpUid: dumpStat.uid,
      dumpGid: dumpStat.gid,
      dumpBytes: fs.readFileSync(DUMP_PATH),
      dumpBinding: dumpBindingPre,
      ...fingerprintEngine(topology.retainedPmId),
      backends: pm2Jlist().filter((p) => p.name === 'titan-backend' && p.pm2_env?.status === 'online').length,
      b1: {
        engineWorkerLeader: sha256File(path.join(PROD_ROOT, 'backend/workers/engineWorkerLeader.js')),
        scheduler: sha256File(path.join(PROD_ROOT, 'backend/engine/scheduler.js')),
        pipelineSchedulerRuntime: sha256File(path.join(PROD_ROOT, 'backend/services/pipelineSchedulerRuntime.js')),
      },
      persistedNodeEnv: parseDumpNodeEnvRetained(dumpJsonPre, topology.retained, dumpBindingPre),
      canonical: JSON.parse(fs.readFileSync(ECOSYSTEM, 'utf8')).apps.find((a) => a.name === 'titan-engine-worker')
        .env.NODE_ENV,
      health: fetchHealth(),
    };

    if (dumpShaPre !== EXPECTED_DUMP_SHA_PRE) throw new Error('PRE_DUMP_SHA_MISMATCH');
    if (pre.dumpMode !== 0o600) throw new Error('PRE_DUMP_MODE_MISMATCH');
    if (pre.dumpUid !== 1000 || pre.dumpGid !== 1000) throw new Error('PRE_DUMP_OWNER_MISMATCH');
    if (pre.liveNodeEnv !== 'development') throw new Error('PRE_LIVE_NODE_ENV_NOT_DEVELOPMENT');
    if (pre.canonical !== 'production') throw new Error('PRE_CANONICAL_NODE_ENV_NOT_PRODUCTION');
    if (pre.persistedNodeEnv !== 'development') throw new Error('PRE_PERSISTED_NODE_ENV_NOT_DEVELOPMENT');
    if (pre.backends !== 4) throw new Error('PRE_BACKEND_COUNT_MISMATCH');
    if (pre.b1.engineWorkerLeader !== B1_SHA.engineWorkerLeader) throw new Error('PRE_B1_ENGINE_SHA_MISMATCH');
    if (pre.b1.scheduler !== B1_SHA.scheduler) throw new Error('PRE_B1_SCHEDULER_SHA_MISMATCH');
    if (pre.b1.pipelineSchedulerRuntime !== B1_SHA.pipelineSchedulerRuntime) throw new Error('PRE_B1_PIPELINE_SHA_MISMATCH');
    const preHealth = validateRequiredHealth(pre.health);
    if (!preHealth.ok) throw new Error(`PRE_HEALTH_FAIL:${preHealth.error}`);

    log('PRECHECK_PASS');
    log(`EXTRA_ISOLATION_GATE_PRE=PASS retained_pm_id=${pre.pmId} extra_pm_id=${pre.extraPmId}`);
    ledger.AUTHORIZATION_CONSUMED_AT = new Date().toISOString();
    log(`AUTHORIZATION_CONSUMED_AT=${ledger.AUTHORIZATION_CONSUMED_AT}`);

    await fsp.mkdir(secureRoot, { recursive: true, mode: 0o700 });
    await fsp.writeFile(path.join(secureRoot, 'dump.pm2.pre'), pre.dumpBytes, { mode: 0o600 });
    await fsp.writeFile(
      path.join(secureRoot, 'pre-state.json'),
      JSON.stringify({
        pmId: pre.pmId,
        extraPmId: pre.extraPmId,
        keysetFp: pre.keysetFp,
        nonNodeFp: pre.nonNodeFp,
        liveNodeEnvPre: pre.liveNodeEnv,
        dumpShaPre: pre.dumpSha,
        dumpBinding: {
          retainedDumpIndex: pre.dumpBinding.retainedDumpIndex,
          extraDumpIndex: pre.dumpBinding.extraDumpIndex,
        },
      }),
      { mode: 0o600 },
    );
    log('BACKUP_VERIFIED');

    const refresh = sanitizedNumericPm2Restart(pre.pmId, 'production', pre.livePath);
    if (refresh.status !== 0) throw new Error(`ENGINE_REFRESH_FAIL:${refresh.status}`);
    ledger.ENGINE_REFRESH_APPLIED = true;
    log('ENGINE_REFRESH_APPLIED=YES');

    const midList = pm2Jlist();
    requireIsolation(midList, isolationIds, 'MID_FORWARD');

    const midFp = fingerprintEngine(pre.pmId);
    if (midFp.liveNodeEnv !== 'production') throw new Error('MID_LIVE_NODE_ENV_NOT_PRODUCTION');
    if (midFp.keysetFp !== pre.keysetFp) throw new Error('MID_KEYSET_FINGERPRINT_DRIFT');
    if (midFp.nonNodeFp !== pre.nonNodeFp) throw new Error('MID_NON_NODE_ENV_SEMANTIC_DRIFT');

    const midTopology = resolveEngineTopology(midList);
    if (!midTopology.ok || midTopology.retainedPmId !== pre.pmId) {
      throw new Error('MID_ENGINE_IDENTITY_DRIFT');
    }

    const midHealth = validateRequiredHealth(fetchHealth());
    if (!midHealth.ok) throw new Error(`MID_HEALTH_FAIL:${midHealth.error}`);

    for (const [k, v] of Object.entries(B1_SHA)) {
      const rel =
        k === 'engineWorkerLeader'
          ? 'workers/engineWorkerLeader.js'
          : k === 'scheduler'
            ? 'engine/scheduler.js'
            : 'services/pipelineSchedulerRuntime.js';
      if (sha256File(path.join(PROD_ROOT, 'backend', rel)) !== v) {
        throw new Error('MID_B1_SHA_DRIFT');
      }
    }
    log('MIDSTEP_PASS');

    requireIsolation(pm2Jlist(), isolationIds, 'PRE_DUMP');

    const currentDump = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
    const dumpBinding = resolveRetainedDumpRowBinding(currentDump, midTopology.retained, {
      canonicalPath: midFp.livePath,
    });
    if (!dumpBinding.ok) throw new Error(dumpBinding.error);
    if (dumpBinding.retainedDumpIndex !== pre.dumpBinding.retainedDumpIndex) {
      throw new Error('PRE_DUMP_BINDING_INDEX_DRIFT');
    }

    const projected = projectDumpNodeEnvRetainedOnly(currentDump, dumpBinding, 'production');
    const boundary = createLiveBoundary({ gatesSatisfied: true, dumpPath: DUMP_PATH });
    const writeRes = await boundary.writeProjectedActiveDump(projected.bytes, {
      expectedUid: pre.dumpUid,
      expectedGid: pre.dumpGid,
    });
    ledger.PROJECTED_DUMP_WRITE_APPLIED = true;
    log(`PROJECTED_DUMP_WRITE_APPLIED=YES sha256=${writeRes.sha256} leaves=${projected.changedLeafCount}`);

    requireIsolation(pm2Jlist(), isolationIds, 'POST');

    const postDump = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
    const postPersistedNodeEnv = parseDumpNodeEnvRetained(postDump, midTopology.retained, dumpBinding);
    if (postPersistedNodeEnv !== 'production') throw new Error('POST_PERSISTED_NODE_ENV_NOT_PRODUCTION');

    const postFp = fingerprintEngine(pre.pmId);
    const postTopology = resolveEngineTopology(pm2Jlist());
    const postHealth = validateRequiredHealth(fetchHealth());

    const proofs = {
      LIVE_ENGINE_NODE_ENV: postFp.liveNodeEnv === 'production' ? 'PASS' : 'FAIL',
      PERSISTED_ENGINE_NODE_ENV: postPersistedNodeEnv === 'production' ? 'PASS' : 'FAIL',
      RESURRECT_EXPECTED_ENGINE_NODE_ENV: postPersistedNodeEnv === 'production' ? 'PASS' : 'FAIL',
      ENGINE_ONLINE_COUNT: postTopology.ok && postTopology.retainedPmId === pre.pmId ? 'PASS' : 'FAIL',
      ENGINE_PM_ID: postTopology.retainedPmId === pre.pmId ? 'PASS' : 'FAIL',
      EXTRA_ISOLATION_GATE_POST:
        assertExtraIsolationGate(pm2Jlist(), isolationIds, 'POST').ok ? 'PASS' : 'FAIL',
      NON_NODE_ENV_ENGINE_ENV_SEMANTICS_PRESERVED:
        postFp.nonNodeFp === pre.nonNodeFp && postFp.keysetFp === pre.keysetFp ? 'YES' : 'NO',
      CURRENT_FULL_REQUIRED_HEALTH: postHealth.CURRENT_FULL_REQUIRED_HEALTH,
    };

    log(`POST LIVE_ENGINE_NODE_ENV=${postFp.liveNodeEnv}`);
    log(`POST PERSISTED_ENGINE_NODE_ENV=${postPersistedNodeEnv}`);
    log(`POST EXTRA_ISOLATION_GATE=${proofs.EXTRA_ISOLATION_GATE_POST}`);
    log(`POST ENGINE_PM_ID=${postTopology.retainedPmId} PRE=${pre.pmId}`);
    log(`POST NON_NODE_ENV_ENGINE_ENV_SEMANTICS_PRESERVED=${proofs.NON_NODE_ENV_ENGINE_ENV_SEMANTICS_PRESERVED}`);
    log(`POST CURRENT_FULL_REQUIRED_HEALTH=${postHealth.CURRENT_FULL_REQUIRED_HEALTH}`);
    log(`POST ACTIVE_DUMP_SHA256=${sha256Buf(fs.readFileSync(DUMP_PATH))}`);
    log(`PM2_SAVE_COUNT=${ledger.PM2_SAVE_COUNT}`);

    const allPass =
      proofs.LIVE_ENGINE_NODE_ENV === 'PASS' &&
      proofs.PERSISTED_ENGINE_NODE_ENV === 'PASS' &&
      proofs.RESURRECT_EXPECTED_ENGINE_NODE_ENV === 'PASS' &&
      proofs.ENGINE_ONLINE_COUNT === 'PASS' &&
      proofs.ENGINE_PM_ID === 'PASS' &&
      proofs.EXTRA_ISOLATION_GATE_POST === 'PASS' &&
      proofs.NON_NODE_ENV_ENGINE_ENV_SEMANTICS_PRESERVED === 'YES' &&
      postHealth.ok;

    if (!allPass) throw new Error('POST_VERIFICATION_FAIL');
    terminal = 'COMPLETED';
    log('TERMINAL=COMPLETED');
    log(`T2_PROJECTED_DIFF_ACTUAL_COUNT=${projected.changedLeafCount}`);
  } catch (err) {
    log(`FORWARD_FAILURE=${err.message}`);
    terminal = await rollback(pre, ledger);
  } finally {
    log(`FINAL_TERMINAL=${terminal}`);
    log(
      `SIDE_EFFECT_LEDGER ENGINE_REFRESH_APPLIED=${ledger.ENGINE_REFRESH_APPLIED} PROJECTED_DUMP_WRITE_APPLIED=${ledger.PROJECTED_DUMP_WRITE_APPLIED} PM2_SAVE_COUNT=${ledger.PM2_SAVE_COUNT}`,
    );
    try {
      await fsp.writeFile(evidencePath, report.join('\n') + '\n', { mode: 0o600 });
      log(`EVIDENCE=${evidencePath}`);
    } catch {
      /* ignore */
    }
  }

  process.exit(terminal === 'COMPLETED' ? 0 : 1);
}

async function rollback(pre, ledger) {
  if (!pre.pmId) return 'MANUAL_RECOVERY_REQUIRED';
  const secureRoot = `/home/ubuntu/TITANGOLD_PM2_SECURE_BACKUPS/TITANGOLD_ENN_${ledger.RUN_ID}`;
  try {
    if (ledger.PROJECTED_DUMP_WRITE_APPLIED) {
      const preBytes = fs.readFileSync(path.join(secureRoot, 'dump.pm2.pre'));
      const preStat = { mode: pre.dumpMode, uid: pre.dumpUid, gid: pre.dumpGid };
      await atomicRestoreDump(preBytes, preStat);
      const restoredSha = sha256Buf(fs.readFileSync(DUMP_PATH));
      if (restoredSha !== pre.dumpSha) throw new Error('ROLLBACK_DUMP_SHA_MISMATCH');
      log('ROLLBACK_DUMP_RESTORE=PASS');
    }
    if (ledger.ENGINE_REFRESH_APPLIED) {
      const r = sanitizedNumericPm2Restart(pre.pmId, 'development', pre.livePath);
      if (r.status !== 0) throw new Error(`ROLLBACK_LIVE_RESTART_FAIL:${r.status}`);
      log('ROLLBACK_LIVE_RESTART=PASS');
    }
    const fp = fingerprintEngine(pre.pmId);
    const topology = resolveEngineTopology(pm2Jlist());
    const health = validateRequiredHealth(fetchHealth());
    const isolationOk = assertExtraIsolationGate(
      pm2Jlist(),
      { extraPmId: pre.extraPmId, retainedPmId: pre.pmId },
      'POST',
    ).ok;
    const ok =
      fp.liveNodeEnv === pre.liveNodeEnv &&
      sha256Buf(fs.readFileSync(DUMP_PATH)) === pre.dumpSha &&
      topology.ok &&
      topology.retainedPmId === pre.pmId &&
      fp.nonNodeFp === pre.nonNodeFp &&
      isolationOk &&
      health.ok;
    if (!ok) throw new Error('ROLLBACK_PROOF_FAIL');
    log('TERMINAL=ROLLED_BACK');
    return 'ROLLED_BACK';
  } catch (e) {
    log(`ROLLBACK_FAILURE=${e.message}`);
    log('TERMINAL=MANUAL_RECOVERY_REQUIRED');
    return 'MANUAL_RECOVERY_REQUIRED';
  }
}

main();
