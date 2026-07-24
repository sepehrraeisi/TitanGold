/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildArbitrageOverviewSnapshot,
  buildOverviewInterpretation,
  buildScanRunDto,
  MONITORING_STATE,
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
});
