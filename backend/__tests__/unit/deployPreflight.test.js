/**
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
  const validBase = {
    NODE_ENV: 'development',
    TITAN_DEPLOY_ENV: 'staging',
    TITAN_RUNTIME_COMMIT: 'ce69b8c',
    JWT_SECRET: 'present-for-tests',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  };

  it('rejects NODE_ENV=test', () => {
    const result = validateDeployEnvironment({ ...validBase, NODE_ENV: 'test' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('NODE_ENV=test'))).toBe(true);
  });

  it('rejects missing runtime commit', () => {
    const result = validateDeployEnvironment({ ...validBase, TITAN_RUNTIME_COMMIT: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('TITAN_RUNTIME_COMMIT'))).toBe(true);
  });

  it('rejects missing deploy environment', () => {
    const result = validateDeployEnvironment({ ...validBase, TITAN_DEPLOY_ENV: '' });
    expect(result.ok).toBe(false);
  });

  it('requires auth secret for staging deploy', () => {
    const result = validateDeployEnvironment({
      NODE_ENV: 'development',
      TITAN_DEPLOY_ENV: 'staging',
      TITAN_RUNTIME_COMMIT: 'abc1234',
      CORS_ALLOWED_ORIGINS: 'https://titan.zala.ir',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/JWT_SECRET|auth/);
  });

  it('accepts canonical Staging development environment', () => {
    const result = validateDeployEnvironment(validBase);
    expect(result.ok).toBe(true);
    expect(result.safeReport.NODE_ENV).toBe('development');
    expect(result.safeReport.TITAN_DEPLOY_ENV).toBe('staging');
    expect(result.safeReport.TITAN_RUNTIME_COMMIT).toBe('ce69b8c');
    expect(result.safeReport.auth_secret).toBe('present');
    expect(result.safeReport.STAGING_ORIGIN_ALLOWED).toBe('yes');
  });

  it('passes when staging public origin comes from deploy env fallback', () => {
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

  it('safeReport never includes secret-like keys or values', () => {
    const result = validateDeployEnvironment({
      ...validBase,
      JWT_SECRET: 'must-not-appear',
      DATABASE_URL: 'postgres://secret',
    });
    const serialized = JSON.stringify(result.safeReport);
    expect(serialized).not.toContain('must-not-appear');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toMatch(/JWT_SECRET/);
  });

  it('loads auth/CORS readiness from backend .env file without printing secrets', () => {
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
    expect(result.safeReport.auth_secret).toBe('present');
  });
});
