/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildProfitRiskAnalytics,
  mapCandidatesFromRunOutput,
  PROFIT_RISK_DATA_CONTRACT_VERSION,
} from '../../services/arbitrageProfitRiskDomain.js';
import { buildScanRunDto } from '../../services/arbitrageDomain.js';
import { calculateNetProfit } from '../../services/agents/arbitrage.js';

describe('arbitrage profit risk analytics contract', () => {
  it('buildProfitRiskAnalytics exposes canonical fields', () => {
    const rawOutput = {
      candidates: [{ symbol: 'BTCUSDT', spreadPct: 0.5, profitBps: 50, riskScore: 20 }],
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
    const candidates = mapCandidatesFromRunOutput(rawOutput, 'run-1');
    const analytics = buildProfitRiskAnalytics({
      scanRun,
      candidates,
      settings: { assumedFeesBps: 10, assumedSlippageBps: 10, minimumNetSpreadBps: 20 },
      rawOutput,
    });
    expect(analytics.dataContractVersion).toBe(PROFIT_RISK_DATA_CONTRACT_VERSION);
    expect(analytics.executionSupported).toBe(false);
    expect(analytics.realizedProfitSupported).toBe(false);
    expect(analytics.riskScore).toBe(20);
  });

  it('calculateNetProfit subtracts fees and slippage once', () => {
    const calc = calculateNetProfit(1.0, 10000, { feeBps: 10, slippageBps: 10 });
    expect(calc.netSpreadPct).toBeCloseTo(0.8, 6);
    expect(calc.profitUSDT).toBeCloseTo(80, 4);
  });

  it('does not treat unavailable profit as zero', () => {
    const analytics = buildProfitRiskAnalytics({
      scanRun: buildScanRunDto({ runId: 'r1', agentId: 'a1', rawOutput: {} }),
      candidates: [],
      settings: {},
      rawOutput: {},
    });
    expect(analytics.estimatedProfitValue).toBeNull();
    expect(analytics.estimateState).toBe('unavailable');
  });
});
