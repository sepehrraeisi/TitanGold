/**
 * CORS origin resolution for Staging browser login.
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  STAGING_PUBLIC_ORIGIN,
  isOriginAllowed,
  resolveCorsAllowedOrigins,
} from '../../utils/corsOrigins.js';

describe('resolveCorsAllowedOrigins', () => {
  it('uses localhost defaults when CORS env is unset', () => {
    const origins = resolveCorsAllowedOrigins({});
    expect(origins).toContain('http://localhost:3000');
  });

  it('merges legacy CORS_ORIGIN alias', () => {
    const origins = resolveCorsAllowedOrigins({
      CORS_ORIGIN: 'https://legacy.example.com',
    });
    expect(origins).toContain('https://legacy.example.com');
  });

  it('adds Staging public origin when TITAN_DEPLOY_ENV=staging', () => {
    const origins = resolveCorsAllowedOrigins({
      TITAN_DEPLOY_ENV: 'staging',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    });
    expect(origins).toContain(STAGING_PUBLIC_ORIGIN);
  });

  it('allows Staging browser origin in staging deploy env', () => {
    expect(
      isOriginAllowed(STAGING_PUBLIC_ORIGIN, {
        TITAN_DEPLOY_ENV: 'staging',
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      }),
    ).toBe(true);
  });

  it('blocks unknown origins outside staging fallback', () => {
    expect(
      isOriginAllowed('https://evil.example.com', {
        CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      }),
    ).toBe(false);
  });
});
