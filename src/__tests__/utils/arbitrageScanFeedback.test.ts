import { describe, expect, it } from 'vitest';
import {
  createScanIdempotencyKey,
  resolveArbitrageScanFeedback,
} from '../../../utils/arbitrageScanFeedback.ts';

describe('arbitrageScanFeedback', () => {
  const t = (key: string) =>
    ({
      arb_scan_in_progress:
        'An analytical scan is already running. Try again after it finishes.',
      arb_scan_rate_limited: 'Too many scan requests. Please wait and try again.',
      arb_scan_unauthorized: 'You do not have permission to run this scan.',
      arb_scan_server_failed: 'The analytical scan could not be completed.',
    })[key] ?? key;

  it('maps scan conflict to product-safe message', () => {
    const feedback = resolveArbitrageScanFeedback(
      Object.assign(new Error('conflict'), {
        status: 409,
        code: 'ARBITRAGE_SCAN_IN_PROGRESS',
      }),
      t,
    );
    expect(feedback.kind).toBe('conflict');
    expect(feedback.message).toContain('already running');
    expect(feedback.retryable).toBe(true);
  });

  it('maps unauthorized and rate limit states', () => {
    expect(
      resolveArbitrageScanFeedback(
        Object.assign(new Error('auth'), { status: 401, code: 'UNAUTHORIZED' }),
        t,
      ).kind,
    ).toBe('unauthorized');
    expect(
      resolveArbitrageScanFeedback(
        Object.assign(new Error('rate'), { status: 429, code: 'RATE_LIMITED' }),
        t,
      ).kind,
    ).toBe('rate_limited');
  });

  it('creates idempotency keys', () => {
    expect(createScanIdempotencyKey()).toMatch(
      /^[0-9a-f-]{36}$|arb-scan-/,
    );
  });
});
