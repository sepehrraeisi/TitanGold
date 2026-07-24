#!/usr/bin/env node
/**
 * Fail-closed Staging deploy preflight — safe env names only, no Secrets.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STAGING_PUBLIC_ORIGIN, resolveCorsAllowedOrigins } from '../utils/corsOrigins.js';

const ALLOWED_NODE_ENVS = new Set(['development', 'staging', 'production']);

/**
 * @param {string} envFilePath
 * @returns {Record<string, string>}
 */
export function loadEnvFile(envFilePath) {
  if (!envFilePath || !fs.existsSync(envFilePath)) return {};
  const parsed = {};
  for (const line of fs.readFileSync(envFilePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ envFilePath?: string }} [options]
 */
export function validateDeployEnvironment(env = process.env, options = {}) {
  const errors = [];
  const fileEnv = options.envFilePath ? loadEnvFile(options.envFilePath) : {};
  const mergedEnv = { ...fileEnv, ...env };

  const nodeEnv = String(mergedEnv.NODE_ENV || '').trim() || '(unset)';
  const deployEnv = String(mergedEnv.TITAN_DEPLOY_ENV || '').trim() || '(unset)';
  const runtimeCommit = String(mergedEnv.TITAN_RUNTIME_COMMIT || '').trim();
  const jwtSecretPresent = Boolean(String(mergedEnv.JWT_SECRET || '').trim());
  const corsOrigins = resolveCorsAllowedOrigins(mergedEnv);
  const stagingOriginAllowed = corsOrigins.includes(STAGING_PUBLIC_ORIGIN);

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
  if (!jwtSecretPresent) {
    errors.push('JWT_SECRET must be present for authentication readiness');
  }
  if (deployEnv === 'staging' && !stagingOriginAllowed) {
    errors.push(`CORS must allow ${STAGING_PUBLIC_ORIGIN} for Staging browser login`);
  }

  return {
    ok: errors.length === 0,
    errors,
    safeReport: {
      NODE_ENV: nodeEnv,
      TITAN_DEPLOY_ENV: deployEnv,
      TITAN_RUNTIME_COMMIT: runtimeCommit ? runtimeCommit.slice(0, 7) : '(missing)',
      auth_secret: jwtSecretPresent ? 'present' : 'missing',
      cors_origins: corsOrigins.length ? 'configured' : 'missing',
      STAGING_ORIGIN_ALLOWED: stagingOriginAllowed ? 'yes' : 'no',
    },
  };
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const backendEnvPath =
    process.env.TITAN_BACKEND_ENV_FILE ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
  const result = validateDeployEnvironment(process.env, { envFilePath: backendEnvPath });
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
