/**
 * Canonical ScanRun presentation mapper — product labels from machine codes.
 */

import type { ArbitrageCoreRunDetail, ArbitrageCoreRunSummary } from '../services/api.ts';
import { formatRejectionReason } from './arbitrageReasonLabels.ts';
import { formatDataFreshness, formatScanDuration } from './arbitrageScanTiming.ts';

export type ScanRunPresentationMode = 'product' | 'technical';
export type TranslateFn = (key: string) => string;

const STATUS_KEYS: Record<string, string> = {
  queued: 'arb_scan_status_queued',
  running: 'arb_scan_status_running',
  completed: 'arb_scan_status_completed',
  failed: 'arb_scan_status_failed',
  cancelled: 'arb_scan_status_cancelled',
  expired: 'arb_scan_status_expired',
  blocked: 'arb_scan_status_blocked',
};

const TRIGGER_KEYS: Record<string, string> = {
  manual: 'manual',
  scheduled: 'scheduled',
};

const SORT_KEYS: Record<string, string> = {
  'startedAt:desc': 'arb_history_sort_newest',
  'startedAt:asc': 'arb_history_sort_oldest',
  'completedAt:desc': 'arb_history_sort_completed_newest',
  'completedAt:asc': 'arb_history_sort_completed_oldest',
};

export function resolveProductLabel(key: string, t: TranslateFn): string {
  const translated = t(key);
  if (translated && translated !== key) return translated;
  const unavailable = t('unavailable');
  return unavailable && unavailable !== 'unavailable' ? unavailable : 'Unavailable';
}

export function presentScanStatus(
  value: string | null | undefined,
  t: TranslateFn,
  mode: ScanRunPresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = STATUS_KEYS[value];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentScanTrigger(
  value: string | null | undefined,
  t: TranslateFn,
  mode: ScanRunPresentationMode = 'product',
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  if (mode === 'technical') return value;
  const key = TRIGGER_KEYS[value];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function presentSortOption(sort: string, t: TranslateFn): string {
  const key = SORT_KEYS[sort];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('sort', t);
}

export function presentScanDuration(
  run: Pick<ArbitrageCoreRunSummary, 'durationMs' | 'durationAvailability' | 'durationReason'> | null | undefined,
  t: TranslateFn,
): string {
  return formatScanDuration(run, t);
}

export function presentScanFreshness(
  run: Pick<
    ArbitrageCoreRunSummary,
    'dataFreshnessState' | 'dataFreshnessMs' | 'dataFreshnessReason' | 'sourceFreshnessMs'
  > | null | undefined,
  t: TranslateFn,
): string {
  return formatDataFreshness(run, t);
}

export function presentPrimaryOutcome(
  run: Pick<
    ArbitrageCoreRunSummary,
    'status' | 'failureReason' | 'primaryRejectionReasons' | 'rejectionSummary' | 'qualifiedCount' | 'funnel'
  > | null | undefined,
  t: TranslateFn,
): string {
  if (!run) return resolveProductLabel('unavailable', t);
  if (run.status === 'failed') {
    return run.failureReason
      ? formatRejectionReason(run.failureReason, t)
      : resolveProductLabel('arb_scan_outcome_failed', t);
  }
  const qualified = run.qualifiedCount ?? run.funnel?.qualified ?? 0;
  if (qualified > 0) {
    return resolveProductLabel('arb_scan_outcome_qualified', t);
  }
  const topReason = run.primaryRejectionReasons?.[0]
    ?? Object.entries(run.rejectionSummary || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topReason) return formatRejectionReason(topReason, t);
  return resolveProductLabel('arb_scan_outcome_analytical_only', t);
}

export function presentDryRunBadge(t: TranslateFn): string {
  return resolveProductLabel('arb_scan_dry_run_badge', t);
}

export function presentRuntimeMode(
  value: string | null | undefined,
  t: TranslateFn,
): string {
  if (!value) return resolveProductLabel('unavailable', t);
  const key = value === 'demo' ? 'execution_mode_demo' : 'runtime_mode';
  const label = resolveProductLabel(key, t);
  return value === 'demo' ? label : `${label}: ${value}`;
}

export function presentComparisonDelta(
  value: number | null | undefined,
  t: TranslateFn,
): string {
  if (value == null || !Number.isFinite(value)) {
    return resolveProductLabel('arb_comparison_unavailable', t);
  }
  if (value === 0) return resolveProductLabel('arb_comparison_no_change', t);
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

export function presentFieldLabel(field: string, t: TranslateFn): string {
  const keys: Record<string, string> = {
    runId: 'run_id',
    trigger: 'arb_history_field_trigger',
    status: 'status',
    duration: 'duration',
    freshness: 'arb_field_freshness',
    startedAt: 'arb_history_started_at',
    completedAt: 'arb_history_completed_at',
    runtimeMode: 'runtime_mode',
    schedulerOwner: 'arb_history_scheduler_owner',
    dryRun: 'arb_scan_dry_run_badge',
    funnel: 'arb_overview_candidate_funnel',
  };
  const key = keys[field];
  return key ? resolveProductLabel(key, t) : resolveProductLabel('unavailable', t);
}

export function isRawScanKey(text: string): boolean {
  return /^arb_[a-z0-9_]+$/.test(text) || /^[a-z]+_[a-z0-9_]+$/.test(text);
}

export type ScanRunDetailShape = ArbitrageCoreRunDetail & {
  primaryRejectionReasons?: string[];
  rejectionDistribution?: Record<string, number>;
  funnel?: Record<string, number>;
  schedulerOwner?: string;
  sideEffectsSuppressed?: boolean;
  executionSupported?: boolean;
};
