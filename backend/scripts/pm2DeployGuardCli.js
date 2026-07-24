#!/usr/bin/env node
/**
 * CLI wrapper: guarded titan-backend restart with Scheduler fingerprint checks.
 */
import { spawnSync } from 'child_process';
import {
  BACKEND_PROCESS_NAME,
  captureSchedulerFingerprint,
  assertSchedulerUnchanged,
  validatePm2Invocation,
  outputContainsSecrets,
} from './pm2DeployGuard.js';

function readFlag(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return '';
  return process.argv[idx + 1];
}

function listProcesses() {
  const result = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('Failed to read PM2 process list');
  }
  return JSON.parse(result.stdout || '[]');
}

function main() {
  const command = process.argv[2];
  if (command !== 'restart-backend') {
    console.error('Usage: pm2DeployGuardCli.js restart-backend --node-env <env> --deploy-env <env> --runtime-commit <sha> [--cors-origins <origins>]');
    process.exit(2);
  }

  const nodeEnv = readFlag('--node-env') || 'development';
  const deployEnv = readFlag('--deploy-env') || 'staging';
  const runtimeCommit = readFlag('--runtime-commit');
  const corsOrigins = readFlag('--cors-origins');

  if (!runtimeCommit) {
    console.error('ERROR: --runtime-commit is required');
    process.exit(1);
  }

  const validation = validatePm2Invocation(['restart', BACKEND_PROCESS_NAME, '--update-env']);
  if (!validation.ok) {
    console.error(`ERROR: ${validation.errors.join('; ')}`);
    process.exit(1);
  }

  const before = captureSchedulerFingerprint(listProcesses());
  if (!before) {
    console.error('ERROR: Scheduler fingerprint unavailable before deploy');
    process.exit(1);
  }

  const childEnv = {
    ...process.env,
    NODE_ENV: nodeEnv,
    TITAN_DEPLOY_ENV: deployEnv,
    TITAN_RUNTIME_COMMIT: runtimeCommit,
  };
  if (corsOrigins) {
    childEnv.CORS_ALLOWED_ORIGINS = corsOrigins;
  }

  const restart = spawnSync(
    'pm2',
    ['restart', BACKEND_PROCESS_NAME, '--update-env'],
    { encoding: 'utf8', env: childEnv },
  );

  const combined = `${restart.stdout || ''}\n${restart.stderr || ''}`;
  if (outputContainsSecrets(combined)) {
    console.error('ERROR: PM2 output contained secret-like values');
    process.exit(1);
  }

  if (restart.status !== 0) {
    console.error(restart.stderr || 'ERROR: PM2 restart failed');
    process.exit(restart.status || 1);
  }

  const save = spawnSync('pm2', ['save'], { encoding: 'utf8' });
  if (save.status !== 0) {
    console.error(save.stderr || 'ERROR: pm2 save failed');
    process.exit(save.status || 1);
  }

  const after = captureSchedulerFingerprint(listProcesses());
  const stable = assertSchedulerUnchanged(before, after);
  if (!stable.ok) {
    console.error(`ERROR: ${stable.error}`);
    process.exit(1);
  }

  console.log(`Guarded PM2 restart OK: target=${BACKEND_PROCESS_NAME} scheduler_pid=${before.pid}`);
}

main();
