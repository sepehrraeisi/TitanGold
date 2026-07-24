export type ScanDurationAvailability = 'measured' | 'sub_ms' | 'unavailable';

export type ScanDurationFields = {
  durationMs?: number | null;
  durationAvailability?: ScanDurationAvailability;
};

export function formatScanDuration(
  run: ScanDurationFields | null | undefined,
  t: (key: string) => string,
): string {
  const availability = run?.durationAvailability;
  const ms = run?.durationMs;

  if (availability === 'unavailable') {
    return t('unavailable') || 'Unavailable';
  }
  if (availability === 'sub_ms' || ms === 0) {
    return t('arb_duration_sub_ms') || '<1 ms';
  }
  if (ms == null || !Number.isFinite(ms)) {
    return t('unavailable') || 'Unavailable';
  }
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function resolveLatestSuccessfulRunAt(
  historical:
    | {
        latestSuccessfulRunAt?: string | null;
        latestCompletedRunAt?: string | null;
        latestRunAt?: string | null;
      }
    | null
    | undefined,
  latestRun: { status?: string; completedAt?: string | null; startedAt?: string | null } | null | undefined,
): string | null {
  if (latestRun?.status === 'completed') {
    return latestRun.completedAt || latestRun.startedAt || null;
  }
  return historical?.latestSuccessfulRunAt || historical?.latestCompletedRunAt || null;
}
