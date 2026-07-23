/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { validateDeployEnvironment } from '../../scripts/validateDeployEnvironment.js';

describe('validateDeployEnvironment', () => {
  const validBase = {
    NODE_ENV: 'development',
    TITAN_DEPLOY_ENV: 'staging',
    TITAN_RUNTIME_COMMIT: 'ce69b8c',
  };

  it('rejects NODE_ENV=test', () => {
    const result = validateDeployEnvironment({ ...validBase, NODE_ENV: 'test' });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('NODE_ENV=test'))).toBe(true);
  });

  it('rejects missing runtime commit', () => {
    const result = validateDeployEnvironment({ ...validBase, TITAN_RUNTIME_COMMIT: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('TITAN_RUNTIME_COMMIT'))).toBe(true);
  });

  it('rejects missing deploy environment', () => {
    const result = validateDeployEnvironment({ ...validBase, TITAN_DEPLOY_ENV: '' });
    expect(result.ok).toBe(false);
  });

  it('accepts canonical Staging development environment', () => {
    const result = validateDeployEnvironment(validBase);
    expect(result.ok).toBe(true);
    expect(result.safeReport.NODE_ENV).toBe('development');
    expect(result.safeReport.TITAN_DEPLOY_ENV).toBe('staging');
    expect(result.safeReport.TITAN_RUNTIME_COMMIT).toBe('ce69b8c');
  });

  it('safeReport never includes secret-like keys', () => {
    const result = validateDeployEnvironment({
      ...validBase,
      JWT_SECRET: 'must-not-appear',
      DATABASE_URL: 'postgres://secret',
    });
    expect(JSON.stringify(result.safeReport)).not.toContain('JWT');
    expect(JSON.stringify(result.safeReport)).not.toContain('postgres');
  });
});
