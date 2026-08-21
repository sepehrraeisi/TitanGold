/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  deriveSchedulerStatus,
  isJobExecutionFresh,
  SCHEDULER_FRESHNESS_GRACE,
  classifyTelegramTransferLifecycleOutcome,
  deriveTelegramLifecycleFreshness,
  buildTelegramLifecycleDegradedRead,
  TELEGRAM_LIFECYCLE_OUTCOMES,
} from '../../services/pipelineSchedulerRuntime.js';

describe('pipelineSchedulerRuntime', () => {
  const transferIntervalMs = 5 * 60 * 1000;
  const normalizationIntervalMs = 60 * 1000;
  const now = Date.now();

  it('isJobExecutionFresh respects grace window', () => {
    const recent = new Date(now - normalizationIntervalMs).toISOString();
    const stale = new Date(
      now - normalizationIntervalMs * SCHEDULER_FRESHNESS_GRACE - 1000,
    ).toISOString();
    expect(isJobExecutionFresh(recent, normalizationIntervalMs, now)).toBe(true);
    expect(isJobExecutionFresh(stale, normalizationIntervalMs, now)).toBe(false);
  });

  it('deriveSchedulerStatus returns running from normalization heartbeat', () => {
    expect(
      deriveSchedulerStatus({
        transferIntervalMs,
        normalizationIntervalMs,
        heartbeats: {
          transfer: null,
          normalization: { at: new Date(Date.now() - 30_000).toISOString() },
        },
        dbActivity: { lastNormalizationAt: null, lastTransferAt: null },
      }),
    ).toBe('running');
  });

  it('deriveSchedulerStatus returns running from DB transfer activity', () => {
    expect(
      deriveSchedulerStatus({
        transferIntervalMs,
        normalizationIntervalMs,
        heartbeats: { transfer: null, normalization: null },
        dbActivity: {
          lastNormalizationAt: null,
          lastTransferAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        },
      }),
    ).toBe('running');
  });

  it('deriveSchedulerStatus returns stopped when signals exist but are stale', () => {
    const stale = new Date(
      Date.now() - transferIntervalMs * SCHEDULER_FRESHNESS_GRACE - 60_000,
    ).toISOString();
    expect(
      deriveSchedulerStatus({
        transferIntervalMs,
        normalizationIntervalMs,
        heartbeats: { transfer: { at: stale }, normalization: null },
        dbActivity: { lastNormalizationAt: null, lastTransferAt: null },
      }),
    ).toBe('stopped');
  });

  it('deriveSchedulerStatus returns unknown without any signal', () => {
    expect(
      deriveSchedulerStatus({
        transferIntervalMs,
        normalizationIntervalMs,
        heartbeats: { transfer: null, normalization: null },
        dbActivity: { lastNormalizationAt: null, lastTransferAt: null },
      }),
    ).toBe('unknown');
  });

  it('never returns stopped while normalization DB activity is fresh', () => {
    const status = deriveSchedulerStatus({
      transferIntervalMs,
      normalizationIntervalMs,
      heartbeats: { transfer: null, normalization: null },
      dbActivity: {
        lastNormalizationAt: new Date(Date.now() - 10_000).toISOString(),
        lastTransferAt: null,
      },
    });
    expect(status).toBe('running');
  });

  it('classifyTelegramTransferLifecycleOutcome maps skip and noop outcomes', () => {
    expect(
      classifyTelegramTransferLifecycleOutcome({
        skipped_run: true,
        skip_reason: 'in_memory_lock',
      }),
    ).toBe(TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SKIP_IN_MEMORY);
    expect(
      classifyTelegramTransferLifecycleOutcome({
        skipped_run: true,
        skip_reason: 'advisory_lock',
      }),
    ).toBe(TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SKIP_ADVISORY_LOCK);
    expect(
      classifyTelegramTransferLifecycleOutcome({ selected: 0, skipped_run: false }),
    ).toBe(TELEGRAM_LIFECYCLE_OUTCOMES.TICK_NOOP_SELECTED_ZERO);
    expect(
      classifyTelegramTransferLifecycleOutcome({ selected: 3, skipped_run: false }),
    ).toBe(TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SUCCESS);
  });

  it('A1 fresh ARMED => ARMED_WAITING_FIRST_TICK', () => {
    const age = transferIntervalMs; // < interval × 2.5
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: {
          state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED,
          at: new Date(now - age).toISOString(),
        },
        intervalMs: transferIntervalMs,
        nowMs: now,
      }),
    ).toBe('ARMED_WAITING_FIRST_TICK');
  });

  it('A2 stale ARMED => STALE_STOPPED', () => {
    const age = transferIntervalMs * SCHEDULER_FRESHNESS_GRACE + 1000;
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: {
          state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED,
          at: new Date(now - age).toISOString(),
        },
        intervalMs: transferIntervalMs,
        nowMs: now,
      }),
    ).toBe('STALE_STOPPED');
  });

  it('A3 ARMED at exact interval×2.5 boundary follows isJobExecutionFresh', () => {
    const age = transferIntervalMs * SCHEDULER_FRESHNESS_GRACE;
    const at = new Date(now - age).toISOString();
    const expectedFresh = isJobExecutionFresh(at, transferIntervalMs, now);
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: { state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED, at },
        intervalMs: transferIntervalMs,
        nowMs: now,
      }),
    ).toBe(expectedFresh ? 'ARMED_WAITING_FIRST_TICK' : 'STALE_STOPPED');
    // Document current isJobExecutionFresh: age <= interval*grace is fresh
    expect(expectedFresh).toBe(true);
  });

  it('A4 malformed ARMED missing/invalid timestamp => STALE_STOPPED', () => {
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: { state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED },
        intervalMs: transferIntervalMs,
        nowMs: now,
      }),
    ).toBe('STALE_STOPPED');
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: { state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED, at: 'not-a-date' },
        intervalMs: transferIntervalMs,
        nowMs: now,
      }),
    ).toBe('STALE_STOPPED');
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: { state: TELEGRAM_LIFECYCLE_OUTCOMES.ARMED, at: null },
        intervalMs: transferIntervalMs,
        nowMs: now,
      }),
    ).toBe('STALE_STOPPED');
  });

  it('null lifecycle => NOT_INITIALIZED (Redis healthy, key absent)', () => {
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: null,
        intervalMs: transferIntervalMs,
      }),
    ).toBe('NOT_INITIALIZED');
  });

  it('OBSERVABILITY_DEGRADED lifecycle is distinguishable from NOT_INITIALIZED', () => {
    const degraded = buildTelegramLifecycleDegradedRead('redis_unavailable');
    expect(degraded.state).toBe(TELEGRAM_LIFECYCLE_OUTCOMES.OBSERVABILITY_DEGRADED);
    expect(degraded.reason).toBe('redis_unavailable');
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: degraded,
        intervalMs: transferIntervalMs,
      }),
    ).toBe('OBSERVABILITY_DEGRADED');
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: buildTelegramLifecycleDegradedRead('redis_read_failed'),
        intervalMs: transferIntervalMs,
      }),
    ).toBe('OBSERVABILITY_DEGRADED');
  });

  it('fresh TICK_SUCCESS remains FRESH', () => {
    expect(
      deriveTelegramLifecycleFreshness({
        lifecycle: {
          state: TELEGRAM_LIFECYCLE_OUTCOMES.TICK_SUCCESS,
          at: new Date().toISOString(),
        },
        intervalMs: transferIntervalMs,
      }),
    ).toBe('FRESH');
  });
});
