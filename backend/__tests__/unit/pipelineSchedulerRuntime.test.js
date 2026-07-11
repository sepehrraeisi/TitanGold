/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  deriveSchedulerStatus,
  isJobExecutionFresh,
  SCHEDULER_FRESHNESS_GRACE,
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
        lastNormalizationAt: new Date(Date.now() - 45_000).toISOString(),
        lastTransferAt: null,
      },
    });
    expect(status).toBe('running');
    expect(status).not.toBe('stopped');
  });
});
