import { describe, expect, it } from 'vitest';
import { formatScanDuration, resolveLatestSuccessfulRunAt } from '../../../utils/arbitrageScanTiming.ts';

describe('arbitrageScanTiming', () => {
  const t = (key: string) =>
    ({
      unavailable: 'Unavailable',
      arb_duration_sub_ms: '<1 ms',
    })[key] ?? key;

  it('shows sub-ms label instead of fabricated zero', () => {
    expect(formatScanDuration({ durationMs: 0, durationAvailability: 'sub_ms' }, t)).toBe('<1 ms');
  });

  it('shows unavailable when duration is missing', () => {
    expect(formatScanDuration({ durationMs: null, durationAvailability: 'unavailable' }, t)).toBe(
      'Unavailable',
    );
  });

  it('formats measured durations', () => {
    expect(formatScanDuration({ durationMs: 250, durationAvailability: 'measured' }, t)).toBe('250 ms');
    expect(formatScanDuration({ durationMs: 1500, durationAvailability: 'measured' }, t)).toBe('1.5 s');
  });

  it('treats completed zero-qualified latest run as successful scan timestamp', () => {
    const at = resolveLatestSuccessfulRunAt(
      { latestSuccessfulRunAt: null },
      {
        status: 'completed',
        completedAt: '2026-07-24T10:00:05.000Z',
        startedAt: '2026-07-24T10:00:00.000Z',
      },
    );
    expect(at).toBe('2026-07-24T10:00:05.000Z');
  });
});
