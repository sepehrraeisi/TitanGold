import { describe, expect, it } from 'vitest';
import {
  formatDataFreshness,
  formatDurationReason,
  formatFreshnessReason,
  formatScanDuration,
  resolveLatestSuccessfulRunAt,
} from '../../../utils/arbitrageScanTiming.ts';

describe('arbitrageScanTiming', () => {
  const t = (key: string) =>
    ({
      arb_duration_unavailable: 'Duration unavailable',
      arb_duration_sub_ms: '<1 ms',
      arb_freshness_unavailable: 'Data freshness unavailable',
      arb_duration_reason_not_recorded: 'Scan duration was not recorded for this historical run',
      arb_freshness_reason_source_timestamps_not_recorded:
        'Source timestamps were not recorded for this historical scan',
    })[key] ?? key;

  it('shows sub-ms label only for explicit sub_ms availability', () => {
    expect(formatScanDuration({ durationMs: 0, durationAvailability: 'sub_ms' }, t)).toBe('<1 ms');
  });

  it('shows unavailable when duration is missing', () => {
    expect(formatScanDuration({ durationMs: null, durationAvailability: 'unavailable' }, t)).toBe(
      'Duration unavailable',
    );
  });

  it('does not show sub-ms for same-second unavailable duration', () => {
    expect(
      formatScanDuration(
        {
          durationMs: null,
          durationAvailability: 'unavailable',
          durationReason: 'insufficient_timestamp_precision',
        },
        t,
      ),
    ).toBe('Duration unavailable');
  });

  it('formats measured durations', () => {
    expect(formatScanDuration({ durationMs: 250, durationAvailability: 'measured' }, t)).toBe('250 ms');
    expect(formatScanDuration({ durationMs: 1500, durationAvailability: 'measured' }, t)).toBe('1.5 s');
  });

  it('formats measured freshness and unavailable freshness with explanation keys', () => {
    expect(formatDataFreshness({ dataFreshnessState: 'measured', dataFreshnessMs: 750 }, t)).toBe('750 ms');
    expect(formatDataFreshness({ dataFreshnessState: 'unavailable' }, t)).toBe('Data freshness unavailable');
    expect(formatFreshnessReason('source_timestamps_not_recorded', t)).toBe(
      'Source timestamps were not recorded for this historical scan',
    );
    expect(formatDurationReason('duration_not_recorded', t)).toBe(
      'Scan duration was not recorded for this historical run',
    );
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
