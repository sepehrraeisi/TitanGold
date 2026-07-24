/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  BACKEND_PROCESS_NAME,
  SCHEDULER_PROCESS_NAME,
  assertSchedulerUnchanged,
  buildBackendRestartArgv,
  captureSchedulerFingerprint,
  executeGuardedBackendRestart,
  outputContainsSecrets,
  parsePm2Invocation,
  validatePm2Invocation,
} from '../../scripts/pm2DeployGuard.js';

const schedulerProc = {
  name: SCHEDULER_PROCESS_NAME,
  pid: 4242,
  pm2_env: { pm_uptime: 1_700_000_000_000 },
};

const backendProc = {
  name: BACKEND_PROCESS_NAME,
  pid: 5151,
  pm2_env: { pm_uptime: 1_700_000_100_000 },
};

function createHarness(overrides = {}) {
  let mutations = 0;
  const listFn = overrides.listProcesses || (async () => [schedulerProc, backendProc]);
  return {
    get mutations() {
      return mutations;
    },
    listProcesses: listFn,
    execPm2: overrides.execPm2 || (async () => {
      mutations += 1;
      return { stdout: 'restarted titan-backend', stderr: '', code: 0 };
    }),
    savePm2: overrides.savePm2 || (async () => {}),
  };
}

describe('pm2DeployGuard', () => {
  it('accepts exact titan-backend restart', () => {
    const result = validatePm2Invocation(['restart', BACKEND_PROCESS_NAME, '--update-env']);
    expect(result.ok).toBe(true);
  });

  it('rejects titan-engine-worker target', () => {
    const result = validatePm2Invocation(['restart', SCHEDULER_PROCESS_NAME]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/titan-backend/);
  });

  it('rejects all target', () => {
    const result = validatePm2Invocation(['restart', 'all']);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/all|wildcard/i);
  });

  it('rejects numeric process target', () => {
    const result = validatePm2Invocation(['restart', '10']);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/numeric/i);
  });

  it('rejects delete verb', () => {
    const result = validatePm2Invocation(['delete', BACKEND_PROCESS_NAME]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/delete/i);
  });

  it('rejects kill verb', () => {
    const result = validatePm2Invocation(['kill']);
    expect(result.ok).toBe(false);
  });

  it('rejects resurrect verb', () => {
    const result = validatePm2Invocation(['resurrect']);
    expect(result.ok).toBe(false);
  });

  it('rejects wildcard target patterns', () => {
    const result = validatePm2Invocation(['restart', 'titan-*']);
    expect(result.ok).toBe(false);
  });

  it('rejects pm2 delete all --only titan-backend style invocation', () => {
    const parsed = parsePm2Invocation(['delete', 'all', '--only', BACKEND_PROCESS_NAME]);
    expect(parsed.verb).toBe('delete');
    expect(parsed.targets).toContain('all');
    const result = validatePm2Invocation(['delete', 'all']);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/delete|forbidden/i);
  });

  it('failed preflight causes no PM2 mutation', async () => {
    const harness = createHarness();
    const result = await executeGuardedBackendRestart(harness, { preflightOk: false });
    expect(result.ok).toBe(false);
    expect(result.pm2Mutations).toBe(0);
    expect(harness.mutations).toBe(0);
  });

  it('requires Scheduler PID/start time unchanged after guarded restart', async () => {
    const harness = createHarness({
      listProcesses: async () => [schedulerProc, backendProc],
    });
    const result = await executeGuardedBackendRestart(harness, {
      envVars: {
        NODE_ENV: 'development',
        TITAN_DEPLOY_ENV: 'staging',
        TITAN_RUNTIME_COMMIT: '2e5e493',
      },
      verifyHealth: async () => ({ ok: true }),
    });
    expect(result.ok).toBe(true);
    expect(result.schedulerStable).toBe(true);
  });

  it('fails when Scheduler PID changes during deploy', async () => {
    let call = 0;
    const harness = createHarness({
      listProcesses: async () => {
        call += 1;
        if (call === 1) return [{ ...schedulerProc, pid: 100 }];
        return [{ ...schedulerProc, pid: 200 }];
      },
    });
    const result = await executeGuardedBackendRestart(harness, {
      verifyHealth: async () => ({ ok: true }),
    });
    expect(result.ok).toBe(false);
    expect(result.schedulerStable).toBe(false);
    expect(result.stderr).toMatch(/PID changed/);
  });

  it('requires backend health and provenance verification', async () => {
    const harness = createHarness();
    const result = await executeGuardedBackendRestart(harness, {
      verifyHealth: async () => ({ ok: false }),
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/health verification failed/i);
  });

  it('does not print secret-like values in deploy output', () => {
    expect(outputContainsSecrets('JWT_SECRET=abc')).toBe(true);
    expect(outputContainsSecrets('restarted titan-backend')).toBe(false);
  });

  it('buildBackendRestartArgv uses exact backend process name', () => {
    const argv = buildBackendRestartArgv({
      NODE_ENV: 'development',
      TITAN_DEPLOY_ENV: 'staging',
      TITAN_RUNTIME_COMMIT: '2e5e493',
    });
    expect(argv).toContain('pm2');
    expect(argv).toContain('restart');
    expect(argv).toContain(BACKEND_PROCESS_NAME);
    expect(argv).not.toContain(SCHEDULER_PROCESS_NAME);
  });

  it('captureSchedulerFingerprint requires exactly one worker', () => {
    expect(captureSchedulerFingerprint([schedulerProc])).toEqual({
      pid: 4242,
      pmUptime: 1_700_000_000_000,
      name: SCHEDULER_PROCESS_NAME,
    });
    expect(captureSchedulerFingerprint([])).toBeNull();
    expect(captureSchedulerFingerprint([schedulerProc, { ...schedulerProc, pid: 9 }])).toBeNull();
  });

  it('assertSchedulerUnchanged compares pid and pm uptime', () => {
    const before = { pid: 1, pmUptime: 100 };
    const after = { pid: 1, pmUptime: 100 };
    expect(assertSchedulerUnchanged(before, after).ok).toBe(true);
    expect(assertSchedulerUnchanged(before, { pid: 2, pmUptime: 100 }).ok).toBe(false);
  });
});
