/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildProfitRiskAnalytics,
  computeEstimatedNetSpreadBps,
  computeEstimatedProfitValue,
  extractGrossSpreadBpsFromRaw,
  mapCandidatesFromRunOutput,
  PROFIT_RISK_DATA_CONTRACT_VERSION,
  SELECTION_BASIS,
} from '../../services/arbitrageProfitRiskDomain.js';
import { buildScanRunDto, CANDIDATE_LIFECYCLE } from '../../services/arbitrageDomain.js';

describe('arbitrage profit risk canonical calculations', () => {
  it('PRT-4: 0.92 gross with 10 bps fees and slippage yields -19.08 net', () => {
    const net = computeEstimatedNetSpreadBps(0.92, 10, 10);
    expect(net.estimatedNetSpreadBps).toBeCloseTo(-19.08, 4);

    const profit = computeEstimatedProfitValue(1000, net.estimatedNetSpreadBps);
    expect(profit.estimatedProfitValue).toBeCloseTo(-1.908, 4);
    expect(profit.estimatedProfitCurrency).toBe('USDT');
  });

  it('never uses profitBps as gross spread source', () => {
    expect(
      extractGrossSpreadBpsFromRaw({ profitBps: 0.92, spreadPct: 0.0092 }),
    ).toBeCloseTo(0.92, 4);
  });

  it('positive gross and positive net scenario', () => {
    const net = computeEstimatedNetSpreadBps(50, 10, 10);
    expect(net.estimatedNetSpreadBps).toBe(30);
    const profit = computeEstimatedProfitValue(5000, net.estimatedNetSpreadBps);
    expect(profit.estimatedProfitValue).toBeCloseTo(15, 4);
  });

  it('positive gross but negative net scenario', () => {
    const net = computeEstimatedNetSpreadBps(15, 10, 10);
    expect(net.estimatedNetSpreadBps).toBe(-5);
  });

  it('zero net spread scenario', () => {
    const net = computeEstimatedNetSpreadBps(20, 10, 10);
    expect(net.estimatedNetSpreadBps).toBe(0);
  });

  it('missing gross yields unavailable net', () => {
    const net = computeEstimatedNetSpreadBps(null, 10, 10);
    expect(net.estimatedNetSpreadBps).toBeNull();
    expect(net.estimateReason).toBe('gross_unavailable');
  });

  it('missing fees yields unavailable net', () => {
    const net = computeEstimatedNetSpreadBps(10, null, 10);
    expect(net.estimatedNetSpreadBps).toBeNull();
    expect(net.estimateReason).toBe('fees_unavailable');
  });

  it('missing slippage yields unavailable net', () => {
    const net = computeEstimatedNetSpreadBps(10, 10, null);
    expect(net.estimatedNetSpreadBps).toBeNull();
    expect(net.estimateReason).toBe('slippage_unavailable');
  });

  it('missing notional yields unavailable profit without using state label as value', () => {
    const profit = computeEstimatedProfitValue(null, -19.08);
    expect(profit.estimatedProfitValue).toBeNull();
    expect(profit.estimateReason).toBe('notional_unavailable');
  });

  it('explicit zero notional yields unavailable profit', () => {
    const profit = computeEstimatedProfitValue(0, 10);
    expect(profit.estimatedProfitValue).toBeNull();
    expect(profit.estimateReason).toBe('notional_unavailable');
  });

  it('rejected candidate with negative net uses least-negative selection basis', () => {
    const rawOutput = {
      candidates: [],
      rejectedCandidates: [
        { id: 'a', symbol: 'BTCUSDT', spreadPct: 0.0092, rejectionReason: 'below_threshold' },
        { id: 'b', symbol: 'ETHUSDT', spreadPct: 0.005, rejectionReason: 'below_threshold' },
      ],
    };
    const scanRun = buildScanRunDto({
      runId: 'run-rej',
      agentId: 'agent-1',
      rawOutput,
      symbolsRequested: ['BTCUSDT', 'ETHUSDT'],
      symbolsEvaluated: ['BTCUSDT', 'ETHUSDT'],
    });
    const candidates = mapCandidatesFromRunOutput(rawOutput, 'run-rej');
    const analytics = buildProfitRiskAnalytics({
      scanRun,
      candidates,
      rawCandidates: rawOutput.rejectedCandidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10 },
      rawOutput,
    });
    expect(analytics.estimatedNetSpreadBps).toBeCloseTo(-19.08, 2);
    expect(analytics.selectionBasis).toBe(SELECTION_BASIS.LEAST_NEGATIVE_REJECTED);
    expect(analytics.selectedCandidateSymbol).toBe('BTCUSDT');
  });

  it('qualified candidate selection uses best qualified basis', () => {
    const rawOutput = {
      candidates: [
        { id: 'q1', symbol: 'BTCUSDT', spreadPct: 0.5, lifecycleState: CANDIDATE_LIFECYCLE.QUALIFIED },
      ],
      rejectedCandidates: [],
    };
    const scanRun = buildScanRunDto({
      runId: 'run-q',
      agentId: 'agent-1',
      rawOutput,
      symbolsRequested: ['BTCUSDT'],
      symbolsEvaluated: ['BTCUSDT'],
    });
    const analytics = buildProfitRiskAnalytics({
      scanRun,
      candidates: mapCandidatesFromRunOutput(rawOutput, 'run-q'),
      rawCandidates: rawOutput.candidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10 },
      rawOutput,
    });
    expect(analytics.selectionBasis).toBe(SELECTION_BASIS.BEST_QUALIFIED);
    expect(analytics.estimatedNetSpreadBps).toBeCloseTo(30, 2);
  });

  it('legacy percentage-shaped spreadPct converts to bps once', () => {
    expect(extractGrossSpreadBpsFromRaw({ spreadPct: 0.92 })).toBeCloseTo(92, 4);
    expect(extractGrossSpreadBpsFromRaw({ spreadPct: 0.0092 })).toBeCloseTo(0.92, 4);
  });

  it('does not double-subtract fees from stored netSpreadPct', () => {
    const rawOutput = {
      candidates: [
        {
          id: 'x',
          symbol: 'BTCUSDT',
          spreadPct: 0.0092,
          netSpreadPct: 0.0092,
          profitBps: 0.92,
        },
      ],
      rejectedCandidates: [],
    };
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r1', agentId: 'a1', rawOutput }),
      candidates: mapCandidatesFromRunOutput(rawOutput, 'r1'),
      rawCandidates: rawOutput.candidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10 },
      rawOutput,
    });
    expect(analytics.grossSpreadBps).toBeCloseTo(0.92, 2);
    expect(analytics.estimatedNetSpreadBps).toBeCloseTo(-19.08, 2);
  });

  it('profit uses division by 10000 not 100', () => {
    const profit = computeEstimatedProfitValue(1000, 100);
    expect(profit.estimatedProfitValue).toBeCloseTo(10, 4);
  });

  it('risk score unavailable when no evidence exists', () => {
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r1', agentId: 'a1', rawOutput: {} }),
      candidates: [],
      rawCandidates: [],
      settings: {},
      rawOutput: {},
    });
    expect(analytics.riskScore).toBeNull();
    expect(analytics.riskScoreState).toBe('unavailable');
  });

  it('buildProfitRiskAnalytics exposes canonical contract version', () => {
    const rawOutput = {
      candidates: [{ symbol: 'BTCUSDT', spreadPct: 0.5, riskScore: 20 }],
      rejectedCandidates: [],
      riskStats: { averageScore: 20 },
    };
    const scanRun = buildScanRunDto({
      runId: 'run-1',
      agentId: 'agent-1',
      rawOutput,
      symbolsRequested: ['BTCUSDT'],
      symbolsEvaluated: ['BTCUSDT'],
    });
    const analytics = buildProfitRiskAnalytics({
      scanRun,
      candidates: mapCandidatesFromRunOutput(rawOutput, 'run-1'),
      rawCandidates: rawOutput.candidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10 },
      rawOutput,
    });
    expect(analytics.dataContractVersion).toBe(PROFIT_RISK_DATA_CONTRACT_VERSION);
    expect(analytics.executionSupported).toBe(false);
    expect(analytics.riskScore).toBe(20);
    expect(analytics.notionalValue).toBeNull();
    expect(analytics.estimatedProfitValue).toBeNull();
  });

  it('exposes analytical notional from candidate testVolumeUSDT only', () => {
    const rawOutput = {
      candidates: [
        {
          id: 'c1',
          symbol: 'BTCUSDT',
          spreadPct: 0.5,
          testVolumeUSDT: 10000,
          riskScore: 10,
        },
      ],
      rejectedCandidates: [],
      riskStats: { averageScore: 10 },
    };
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r-n', agentId: 'a1', rawOutput }),
      candidates: mapCandidatesFromRunOutput(rawOutput, 'r-n'),
      rawCandidates: rawOutput.candidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10, testVolumeUSDT: 99999 },
      rawOutput,
    });
    expect(analytics.notionalValue).toBe(10000);
    expect(analytics.notionalSource).toBe('candidate.testVolumeUSDT');
    expect(analytics.estimatedProfitValue).toBeCloseTo((10000 * 30) / 10000, 4);
  });

  it('does not infer default notional from settings', () => {
    const rawOutput = {
      candidates: [{ id: 'c1', symbol: 'BTCUSDT', spreadPct: 0.5 }],
      rejectedCandidates: [],
    };
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r-no', agentId: 'a1', rawOutput }),
      candidates: mapCandidatesFromRunOutput(rawOutput, 'r-no'),
      rawCandidates: rawOutput.candidates,
      settings: { testVolumeUSDT: 10000, assumedFeesBps: 10, assumedSlippageBps: 10 },
      rawOutput,
    });
    expect(analytics.notionalValue).toBeNull();
    expect(analytics.estimatedProfitValue).toBeNull();
  });

  it('accepts explicit measured risk zero when scored candidates exist', () => {
    const rawOutput = {
      candidates: [{ symbol: 'BTCUSDT', spreadPct: 0.5, riskScore: 0, testVolumeUSDT: 1000 }],
      rejectedCandidates: [],
      riskStats: { averageScore: 0 },
    };
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r0', agentId: 'a1', rawOutput }),
      candidates: mapCandidatesFromRunOutput(rawOutput, 'r0'),
      rawCandidates: rawOutput.candidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10 },
      rawOutput,
    });
    expect(analytics.riskScore).toBe(0);
    expect(analytics.riskScoreState).toBe('measured');
    expect(analytics.riskScoreSource).toBe('run_risk_stats_average');
  });

  it('rejects legacy risk stats zero without scored candidates', () => {
    const rawOutput = {
      candidates: [],
      rejectedCandidates: [{ symbol: 'BTCUSDT', spreadPct: 0.0092, rejectionReason: 'SPREAD_OUT_OF_RANGE' }],
      riskStats: { averageScore: 0 },
      summary: { avgRiskScore: 0 },
    };
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r-leg', agentId: 'a1', rawOutput }),
      candidates: mapCandidatesFromRunOutput(rawOutput, 'r-leg'),
      rawCandidates: rawOutput.rejectedCandidates,
      settings: {},
      rawOutput,
    });
    expect(analytics.riskScore).toBeNull();
    expect(analytics.riskScoreState).toBe('unavailable');
  });
});
