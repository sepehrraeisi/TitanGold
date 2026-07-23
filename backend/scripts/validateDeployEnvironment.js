#!/usr/bin/env node
/**
 * Fail-closed Staging deploy preflight — safe env names only, no Secrets.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const ALLOWED_NODE_ENVS = new Set(['development', 'staging', 'production']);

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: boolean, errors: string[], safeReport: Record<string, string> }}
 */
export function validateDeployEnvironment(env = process.env) {
  const errors = [];
  const nodeEnv = String(env.NODE_ENV || '').trim() || '(unset)';
  const deployEnv = String(env.TITAN_DEPLOY_ENV || '').trim() || '(unset)';
  const runtimeCommit = String(env.TITAN_RUNTIME_COMMIT || '').trim();

  if (nodeEnv === 'test') {
    errors.push('NODE_ENV=test is forbidden for Staging backend deploy');
  }
  if (nodeEnv === '(unset)') {
    errors.push('NODE_ENV must be set for Staging backend deploy');
  } else if (!ALLOWED_NODE_ENVS.has(nodeEnv)) {
    errors.push(`NODE_ENV=${nodeEnv} is not an allowed deploy environment`);
  }
  if (deployEnv === '(unset)') {
    errors.push('TITAN_DEPLOY_ENV must be set (expected staging)');
  } else if (deployEnv !== 'staging') {
    errors.push(`TITAN_DEPLOY_ENV=${deployEnv} is not staging`);
  }
  if (!runtimeCommit) {
    errors.push('TITAN_RUNTIME_COMMIT is required');
  } else if (!/^[0-9a-f]{7,40}$/i.test(runtimeCommit)) {
    errors.push('TITAN_RUNTIME_COMMIT must be a git SHA');
  }

  return {
    ok: errors.length === 0,
    errors,
    safeReport: {
      NODE_ENV: nodeEnv,
      TITAN_DEPLOY_ENV: deployEnv,
      TITAN_RUNTIME_COMMIT: runtimeCommit ? runtimeCommit.slice(0, 7) : '(missing)',
    },
  };
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const result = validateDeployEnvironment(process.env);
  for (const [k, v] of Object.entries(result.safeReport)) {
    console.log(`${k}=${v}`);
  }
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`PREFLIGHT FAIL: ${err}`);
    }
    process.exit(1);
  }
  console.log('PREFLIGHT OK');
}
