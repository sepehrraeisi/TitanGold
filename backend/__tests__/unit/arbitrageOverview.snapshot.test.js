/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildArbitrageOverviewSnapshot,
  buildOverviewInterpretation,
  buildScanRunDto,
  MONITORING_STATE,
  resolveDataFreshness,
  resolveScanDurationMs,
} from '../../services/arbitrageDomain.js';

describe('arbitrage overview snapshot', () => {
  const agent = { id: 'agent-1', status: 'active' };
  const settings = {
    monitoredSymbols: ['BTCUSDT', 'ETHUSDT'],
    minimumNetSpreadBps: 20,
    assumedFeesBps: 10,
    assumedSlippageBps: 10,
    maximumDataAgeMs: 30000,
    monitoringState: MONITORING_STATE.ACTIVE,
    version: 3,
    updatedAt: '2026-07-24T10:00:00.000Z',
  };

  const latestRun = buildScanRunDto({
    runId: 'run-latest',
    agentId: agent.id,
    trigger: 'scheduled',
    startedAt: '2026-07-24T10:00:00.000Z',
    completedAt: '2026-07-24T10:00:05.000Z',
    durationMs: 5000,
    symbolsRequested: ['BTCUSDT', 'ETHUSDT'],
    symbolsEvaluated: ['BTCUSDT', 'ETHUSDT'],
    rawOutput: {
      candidates: [{ symbol: 'BTCUSDT' }],
      rejectedCandidates: [
        { symbol: 'ETHUSDT', rejectionReason: 'NON_POSITIVE_NET' },
        { symbol: 'SOLUSDT', rejectionReason: 'NON_POSITIVE_NET' },
      ],
      qualifiedOpportunities: [],
    },
  });

  const historicalSummary = {
    totalScanRuns: 1753,
    successfulRuns: 1740,
    failedRuns: 13,
    scheduledRuns: 1700,
    manualRuns: 53,
    latestSuccessfulRunAt: '2026-07-24T10:00:05.000Z',
    latestFailedRunAt: '2026-07-23T08:00:00.000Z',
  };

  it('builds canonical overview snapshot with matching totals', () => {
    const snapshot = buildArbitrageOverviewSnapshot({
      agent,
      settings,
      latestRun,
      historicalSummary,
      recentRuns: [
        {
          runId: 'run-latest',
          startedAt: latestRun.startedAt,
          completedAt: latestRun.completedAt,
          status: 'completed',
          trigger: 'scheduled',
          durationMs: 5000,
          funnel: latestRun.funnel,
        },
      ],
      schedulerState: { status: 'running' },
      runtimeState: { globalMode: 'demo', killSwitchActive: true },
      generatedAt: '2026-07-24T10:01:00.000Z',
    });

    expect(snapshot.generatedAt).toBe('2026-07-24T10:01:00.000Z');
    expect(snapshot.totalScanRuns).toBe(1753);
    expect(snapshot.historicalSummary.totalScanRuns).toBe(1753);
    expect(snapshot.latestRun.latestRunId).toBe('run-latest');
    expect(snapshot.latestRun.rejectedCandidates).toBe(2);
    expect(snapshot.latestRun.spreadCandidates).toBe(1);
    expect(snapshot.productState.emergencyStop).toBe(true);
    expect(snapshot.productState.executionSupported).toBe(false);
    expect(snapshot.configurationSummary.monitoredSymbolCount).toBe(2);
  });

  it('derives data-driven interpretation from rejection summary', () => {
    const interpretation = buildOverviewInterpretation({ latestRun, settings, historicalSummary });
    expect(interpretation.primaryMessage).toContain('2 observation');
    expect(interpretation.rejectionSummary.NON_POSITIVE_NET).toBe(2);
  });

  it('reports paused monitoring without fabricating funnel counts', () => {
    const pausedSettings = { ...settings, monitoringState: MONITORING_STATE.PAUSED };
    const interpretation = buildOverviewInterpretation({
      latestRun,
      settings: pausedSettings,
      historicalSummary,
    });
    expect(interpretation.safeReasonCodes).toContain('monitoring_paused');
    expect(interpretation.primaryMessage).toContain('paused');
  });

  it('resolves duration from timestamps when execution_time_ms is zero but timestamps differ', () => {
    const resolved = resolveScanDurationMs({
      durationMs: 0,
      startedAt: '2026-07-24T10:00:00.000Z',
      completedAt: '2026-07-24T10:00:05.000Z',
    });
    expect(resolved.durationAvailability).toBe('sub_ms');
    expect(resolved.durationMs).toBe(0);
  });

  it('does not fabricate sub-ms duration from same-second timestamps', () => {
    const resolved = resolveScanDurationMs({
      durationMs: null,
      startedAt: '2026-07-24T10:00:00.000Z',
      completedAt: '2026-07-24T10:00:00.000Z',
    });
    expect(resolved.durationAvailability).toBe('unavailable');
    expect(resolved.durationReason).toBe('insufficient_timestamp_precision');
  });

  it('marks unavailable duration when execution_time_ms is missing', () => {
    const resolved = resolveScanDurationMs({
      durationMs: null,
      startedAt: '2026-07-24T10:00:00.000Z',
      completedAt: null,
    });
    expect(resolved.durationAvailability).toBe('unavailable');
    expect(resolved.durationReason).toBe('duration_not_recorded');
  });

  it('derives timestamp-based duration when precision supports it', () => {
    const resolved = resolveScanDurationMs({
      durationMs: null,
      startedAt: '2026-07-24T10:00:00.000Z',
      completedAt: '2026-07-24T10:00:05.000Z',
    });
    expect(resolved.durationAvailability).toBe('measured');
    expect(resolved.durationMs).toBe(5000);
  });

  it('resolves measured freshness from candidate timestamps', () => {
    const freshness = resolveDataFreshness({
      scanStartedAt: '2026-07-24T10:00:10.000Z',
      rawOutput: {
        rejectedCandidates: [{ timestamp: '2026-07-24T10:00:07.500Z' }],
      },
    });
    expect(freshness.dataFreshnessState).toBe('measured');
    expect(freshness.dataFreshnessMs).toBe(2500);
  });

  it('reports unavailable freshness with reason when source timestamps are missing', () => {
    const freshness = resolveDataFreshness({
      scanStartedAt: '2026-07-24T10:00:10.000Z',
      rawOutput: { rejectedCandidates: [{ symbol: 'BTCUSDT' }] },
    });
    expect(freshness.dataFreshnessState).toBe('unavailable');
    expect(freshness.dataFreshnessReason).toBe('source_timestamps_not_recorded');
  });

  it('marks completed zero-qualified latest run as successful in run timing', () => {
    const completedZeroQualified = buildScanRunDto({
      runId: 'run-zero-qualified',
      agentId: agent.id,
      trigger: 'scheduled',
      startedAt: '2026-07-24T11:00:00.000Z',
      completedAt: '2026-07-24T11:00:02.000Z',
      durationMs: 2000,
      status: 'completed',
      symbolsRequested: ['BTCUSDT'],
      symbolsEvaluated: ['BTCUSDT'],
      rawOutput: {
        candidates: [],
        rejectedCandidates: [{ symbol: 'BTCUSDT', rejectionReason: 'NON_POSITIVE_NET' }],
        qualifiedOpportunities: [],
      },
    });

    const snapshot = buildArbitrageOverviewSnapshot({
      agent,
      settings,
      latestRun: completedZeroQualified,
      historicalSummary: { ...historicalSummary, latestSuccessfulRunAt: null },
      recentRuns: [],
      schedulerState: { status: 'running' },
      runtimeState: { globalMode: 'demo', killSwitchActive: true },
      generatedAt: '2026-07-24T11:00:03.000Z',
    });

    expect(snapshot.runTiming.latestSuccessfulRunAt).toBe('2026-07-24T11:00:02.000Z');
    expect(snapshot.latestRun.durationAvailability).toBe('measured');
    expect(snapshot.latestRun.qualifiedCandidates).toBe(0);
  });
});
