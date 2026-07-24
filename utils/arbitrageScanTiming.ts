export type ScanDurationAvailability = 'measured' | 'sub_ms' | 'unavailable';

export type ScanDurationFields = {
  durationMs?: number | null;
  durationAvailability?: ScanDurationAvailability;
  durationReason?: string | null;
};

export type DataFreshnessState = 'measured' | 'unavailable';

export type DataFreshnessFields = {
  dataFreshnessState?: DataFreshnessState;
  dataFreshnessMs?: number | null;
  dataFreshnessReason?: string | null;
  sourceFreshnessMs?: number | null;
};

const DURATION_REASON_KEYS: Record<string, string> = {
  duration_not_recorded: 'arb_duration_reason_not_recorded',
  insufficient_timestamp_precision: 'arb_duration_reason_insufficient_timestamp_precision',
};

const FRESHNESS_REASON_KEYS: Record<string, string> = {
  source_timestamps_not_recorded: 'arb_freshness_reason_source_timestamps_not_recorded',
  scan_start_unavailable: 'arb_freshness_reason_scan_start_unavailable',
};

export function formatDurationReason(
  reason: string | null | undefined,
  t: (key: string) => string,
): string | undefined {
  if (!reason) return undefined;
  const key = DURATION_REASON_KEYS[reason];
  return key ? t(key) : undefined;
}

export function formatFreshnessReason(
  reason: string | null | undefined,
  t: (key: string) => string,
): string | undefined {
  if (!reason) return undefined;
  const key = FRESHNESS_REASON_KEYS[reason];
  return key ? t(key) : undefined;
}

export function formatScanDuration(
  run: ScanDurationFields | null | undefined,
  t: (key: string) => string,
): string {
  const availability = run?.durationAvailability;
  const ms = run?.durationMs;

  if (availability === 'unavailable') {
    return t('arb_duration_unavailable') || 'Duration unavailable';
  }
  if (availability === 'sub_ms' || ms === 0) {
    return t('arb_duration_sub_ms') || '<1 ms';
  }
  if (ms == null || !Number.isFinite(ms)) {
    return t('arb_duration_unavailable') || 'Duration unavailable';
  }
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatDataFreshness(
  run: DataFreshnessFields | null | undefined,
  t: (key: string) => string,
): string {
  const state = run?.dataFreshnessState;
  const ms = run?.dataFreshnessMs ?? run?.sourceFreshnessMs;

  if (state === 'measured' && ms != null && Number.isFinite(ms)) {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  return t('arb_freshness_unavailable') || 'Data freshness unavailable';
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
