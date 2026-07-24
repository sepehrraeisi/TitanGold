/**
 * Fail-closed PM2 deployment guard for Staging backend provenance deploys.
 * Ensures only titan-backend may be restarted; titan-engine-worker must remain stable.
 */

export const BACKEND_PROCESS_NAME = 'titan-backend';
export const SCHEDULER_PROCESS_NAME = 'titan-engine-worker';

export const ALLOWED_PM2_VERBS = new Set(['restart']);
export const FORBIDDEN_PM2_VERBS = new Set([
  'delete',
  'kill',
  'resurrect',
  'reload',
  'stop',
  'start',
]);

const SECRET_LIKE = /(JWT_SECRET|PASSWORD|API_KEY|ENCRYPTION_KEY|DATABASE_URL|REDIS_PASSWORD)\s*=/i;

/**
 * @param {string[]} argv tokens after `pm2`
 * @returns {{ verb: string, targets: string[], flags: string[] }}
 */
export function parsePm2Invocation(argv = []) {
  const tokens = argv.filter(Boolean);
  const verb = tokens[0] || '';
  const flags = [];
  const targets = [];
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('-')) {
      flags.push(token);
      continue;
    }
    targets.push(token);
  }
  return { verb, targets, flags };
}

/**
 * @param {string[]} argv tokens after `pm2`
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePm2Invocation(argv = []) {
  const errors = [];
  const { verb, targets } = parsePm2Invocation(argv);

  if (!verb) {
    errors.push('PM2 verb is required');
    return { ok: false, errors };
  }

  if (FORBIDDEN_PM2_VERBS.has(verb)) {
    errors.push(`PM2 verb "${verb}" is forbidden during backend deploy`);
  }

  if (!ALLOWED_PM2_VERBS.has(verb)) {
    errors.push(`PM2 verb "${verb}" is not allowed during backend deploy`);
  }

  if (targets.length !== 1) {
    errors.push(`PM2 target must be exactly one process name (${BACKEND_PROCESS_NAME})`);
  }

  const [target] = targets;
  if (!target || target !== BACKEND_PROCESS_NAME) {
    errors.push(`PM2 target must be exactly "${BACKEND_PROCESS_NAME}"`);
  }

  if (target === SCHEDULER_PROCESS_NAME) {
    errors.push(`PM2 must not target protected Scheduler process "${SCHEDULER_PROCESS_NAME}"`);
  }

  if (target === 'all' || target === '*') {
    errors.push('PM2 wildcard target "all" is forbidden');
  }

  if (target && /^\d+$/.test(target)) {
    errors.push('PM2 numeric process-id targeting is forbidden');
  }

  if (target && /[*?[\]]/.test(target)) {
    errors.push('PM2 wildcard process targeting is forbidden');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {Array<Record<string, unknown>>} processList
 * @returns {{ pid: number|null, pmUptime: number|null, name: string }|null}
 */
export function captureSchedulerFingerprint(processList = []) {
  const matches = processList.filter((p) => p?.name === SCHEDULER_PROCESS_NAME);
  if (matches.length !== 1) {
    return null;
  }
  const worker = matches[0];
  return {
    pid: typeof worker.pid === 'number' ? worker.pid : null,
    pmUptime: worker.pm2_env?.pm_uptime ?? worker.pm_uptime ?? null,
    name: SCHEDULER_PROCESS_NAME,
  };
}

/**
 * @param {{ pid: number|null, pmUptime: number|null }|null} before
 * @param {{ pid: number|null, pmUptime: number|null }|null} after
 * @returns {{ ok: boolean, error?: string }}
 */
export function assertSchedulerUnchanged(before, after) {
  if (!before || !after) {
    return { ok: false, error: 'Scheduler fingerprint missing before or after deploy' };
  }
  if (before.pid == null || after.pid == null || before.pmUptime == null || after.pmUptime == null) {
    return { ok: false, error: 'Scheduler fingerprint incomplete' };
  }
  if (before.pid !== after.pid) {
    return { ok: false, error: `Scheduler PID changed (${before.pid} -> ${after.pid})` };
  }
  if (before.pmUptime !== after.pmUptime) {
    return { ok: false, error: 'Scheduler start time changed during backend deploy' };
  }
  return { ok: true };
}

/**
 * @param {Record<string, string>} envVars
 * @returns {string[]}
 */
export function buildBackendRestartArgv(envVars = {}) {
  const validation = validatePm2Invocation(['restart', BACKEND_PROCESS_NAME, '--update-env']);
  if (!validation.ok) {
    throw new Error(validation.errors.join('; '));
  }

  const envPrefix = Object.entries(envVars)
    .filter(([key, value]) => key && value != null && String(value).length > 0)
    .flatMap(([key, value]) => [`${key}=${value}`]);

  return [...envPrefix, 'pm2', 'restart', BACKEND_PROCESS_NAME, '--update-env'];
}

/**
 * @param {string} output
 * @returns {boolean}
 */
export function outputContainsSecrets(output = '') {
  return SECRET_LIKE.test(output);
}

/**
 * @typedef {object} DeployHarness
 * @property {() => Promise<Array<Record<string, unknown>>>} listProcesses
 * @property {(argv: string[]) => Promise<{ stdout: string, stderr: string, code: number }>} execPm2
 * @property {() => Promise<void>} savePm2
 */

/**
 * @param {DeployHarness} harness
 * @param {object} options
 * @param {Record<string, string>} options.envVars
 * @param {boolean} [options.preflightOk=true]
 * @param {() => Promise<{ ok: boolean }>} [options.verifyHealth]
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, schedulerStable: boolean }>}
 */
export async function executeGuardedBackendRestart(harness, options = {}) {
  const {
    envVars = {},
    preflightOk = true,
    verifyHealth = async () => ({ ok: true }),
  } = options;

  if (!preflightOk) {
    return {
      ok: false,
      stdout: '',
      stderr: 'Preflight failed — PM2 mutation skipped',
      schedulerStable: true,
      pm2Mutations: 0,
    };
  }

  const argv = buildBackendRestartArgv(envVars);
  const pm2Args = argv.slice(argv.indexOf('pm2') + 1);
  const validation = validatePm2Invocation(pm2Args);
  if (!validation.ok) {
    return {
      ok: false,
      stdout: '',
      stderr: validation.errors.join('; '),
      schedulerStable: true,
      pm2Mutations: 0,
    };
  }

  const before = captureSchedulerFingerprint(await harness.listProcesses());
  const result = await harness.execPm2(argv);
  const combined = `${result.stdout}\n${result.stderr}`;
  if (outputContainsSecrets(combined)) {
    return {
      ok: false,
      stdout: result.stdout,
      stderr: 'Deploy output contained secret-like values',
      schedulerStable: false,
      pm2Mutations: 1,
    };
  }

  if (result.code !== 0) {
    const afterFail = captureSchedulerFingerprint(await harness.listProcesses());
    const stable = assertSchedulerUnchanged(before, afterFail);
    return {
      ok: false,
      stdout: result.stdout,
      stderr: result.stderr || 'PM2 restart failed',
      schedulerStable: stable.ok,
      pm2Mutations: 1,
    };
  }

  await harness.savePm2();
  const after = captureSchedulerFingerprint(await harness.listProcesses());
  const stable = assertSchedulerUnchanged(before, after);
  if (!stable.ok) {
    return {
      ok: false,
      stdout: result.stdout,
      stderr: stable.error || 'Scheduler changed',
      schedulerStable: false,
      pm2Mutations: 1,
    };
  }

  const health = await verifyHealth();
  if (!health.ok) {
    return {
      ok: false,
      stdout: result.stdout,
      stderr: 'Backend health verification failed after guarded restart',
      schedulerStable: true,
      pm2Mutations: 1,
    };
  }

  return {
    ok: true,
    stdout: result.stdout,
    stderr: result.stderr,
    schedulerStable: true,
    pm2Mutations: 1,
  };
}
