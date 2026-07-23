/**
 * Deploy preflight checks for Staging authentication readiness.
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadEnvFile,
  validateDeployEnvironment,
} from '../../scripts/validateDeployEnvironment.js';

describe('validateDeployEnvironment', () => {
  it('rejects NODE_ENV=test', () => {
    const result = validateDeployEnvironment({
      NODE_ENV: 'test',
      TITAN_DEPLOY_ENV: 'staging',
      TITAN_RUNTIME_COMMIT: 'abc1234',
      JWT_SECRET: 'present',
      CORS_ALLOWED_ORIGINS: 'https://titan.zala.ir',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/NODE_ENV=test/);
  });

  it('requires JWT_SECRET for staging deploy', () => {
    const result = validateDeployEnvironment({
      NODE_ENV: 'development',
      TITAN_DEPLOY_ENV: 'staging',
      TITAN_RUNTIME_COMMIT: 'abc1234',
      CORS_ALLOWED_ORIGINS: 'https://titan.zala.ir',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/JWT_SECRET/);
  });

  it('passes when staging CORS includes public origin via deploy env fallback', () => {
    const result = validateDeployEnvironment({
      NODE_ENV: 'development',
      TITAN_DEPLOY_ENV: 'staging',
      TITAN_RUNTIME_COMMIT: 'abc1234',
      JWT_SECRET: 'present',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    });
    expect(result.ok).toBe(true);
    expect(result.safeReport.STAGING_ORIGIN_ALLOWED).toBe('yes');
  });

  it('loads CORS from backend .env file without printing secrets', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-env-'));
    const envPath = path.join(dir, '.env');
    fs.writeFileSync(
      envPath,
      'JWT_SECRET=from-file\nCORS_ALLOWED_ORIGINS=https://titan.zala.ir,http://localhost:3000\n',
    );
    const loaded = loadEnvFile(envPath);
    expect(loaded.JWT_SECRET).toBe('from-file');
    expect(loaded.CORS_ALLOWED_ORIGINS).toContain('titan.zala.ir');

    const result = validateDeployEnvironment(
      {
        NODE_ENV: 'development',
        TITAN_DEPLOY_ENV: 'staging',
        TITAN_RUNTIME_COMMIT: 'abc1234',
      },
      { envFilePath: envPath },
    );
    expect(result.ok).toBe(true);
    expect(result.safeReport.JWT_SECRET).toBe('present');
  });
});
