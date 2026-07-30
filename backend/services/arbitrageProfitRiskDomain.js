/**
 * Canonical analytical Profit & Risk contract — read-only estimates, not execution P&L.
 */

import { calculateNetProfit } from './agents/arbitrage.js';
import {
  buildPrimaryRejectionReasons,
  CANDIDATE_LIFECYCLE,
  mapRawCandidateToDto,
  SCAN_RUN_DATA_CONTRACT_VERSION,
} from './arbitrageDomain.js';

export const PROFIT_RISK_DATA_CONTRACT_VERSION = '1.0';

export const ESTIMATE_STATE = Object.freeze({
  MEASURED: 'measured',
  DERIVED: 'derived_estimate',
  ASSUMPTION: 'assumption',
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED: 'unsupported',
});

function toNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickBestCandidate(candidates = []) {
  const scored = candidates.filter(c => c.netSpreadBps != null);
  if (!scored.length) return null;
  return scored.reduce((best, c) => (c.netSpreadBps > (best?.netSpreadBps ?? Number.NEGATIVE_INFINITY) ? c : best));
}

function pickWorstCandidate(candidates = []) {
  const scored = candidates.filter(c => c.netSpreadBps != null);
  if (!scored.length) return null;
  return scored.reduce((worst, c) => (c.netSpreadBps < (worst?.netSpreadBps ?? Number.POSITIVE_INFINITY) ? c : worst));
}

function summarizeCandidateEconomics(candidates = [], settings = {}) {
  const feeBps = toNum(settings.assumedFeesBps) ?? 10;
  const slippageBps = toNum(settings.assumedSlippageBps) ?? 10;
  const best = pickBestCandidate(candidates);
  const worst = pickWorstCandidate(candidates);

  let grossSpreadBps = best?.grossSpreadBps ?? null;
  let estimatedNetSpreadBps = best?.netSpreadBps ?? null;
  let estimatedProfitValue = best?.estimatedProfit ?? null;
  let estimateState = ESTIMATE_STATE.UNAVAILABLE;
  let estimateReason = 'no_observations';

  if (best) {
    grossSpreadBps = best.grossSpreadBps;
    estimatedNetSpreadBps = best.netSpreadBps;
    estimatedProfitValue = best.estimatedProfit;
    if (best.lifecycleState === CANDIDATE_LIFECYCLE.QUALIFIED && estimatedProfitValue != null) {
      estimateState = ESTIMATE_STATE.MEASURED;
      estimateReason = null;
    } else if (estimatedNetSpreadBps != null && estimatedNetSpreadBps > 0) {
      estimateState = ESTIMATE_STATE.DERIVED;
      estimateReason = 'analytical_spread_estimate';
    } else if (estimatedNetSpreadBps != null && estimatedNetSpreadBps <= 0) {
      estimateState = ESTIMATE_STATE.DERIVED;
      estimateReason = 'non_positive_net_spread';
    } else {
      estimateState = ESTIMATE_STATE.UNAVAILABLE;
      estimateReason = best.estimatedProfitUnavailableReason || 'candidate_not_qualified';
    }
  } else if (candidates.length === 0) {
    estimateReason = 'no_candidates_in_run';
  }

  return {
    grossSpreadBps,
    assumedFeesBps: feeBps,
    assumedSlippageBps: slippageBps,
    estimatedNetSpreadBps,
    estimatedProfitValue,
    estimatedProfitCurrency: estimatedProfitValue != null ? 'USDT' : null,
    estimateState,
    estimateReason,
    bestObservedCandidate: best
      ? { symbol: best.symbol, netSpreadBps: best.netSpreadBps, grossSpreadBps: best.grossSpreadBps }
      : null,
    worstObservedCandidate: worst
      ? { symbol: worst.symbol, netSpreadBps: worst.netSpreadBps, grossSpreadBps: worst.grossSpreadBps }
      : null,
  };
}

function buildRiskFactors({ candidates = [], settings = {}, economics = {}, rawOutput = {} }) {
  const factors = [];
  const staleCount = candidates.filter(c => c.freshnessState === 'stale').length;
  const liquidityIssues = candidates.filter(c => c.liquidityState === 'insufficient').length;
  const negativeNet = candidates.filter(c => (c.netSpreadBps ?? 0) <= 0).length;

  if (staleCount > 0) {
    factors.push({ code: 'stale_data', count: staleCount, severity: 'warning' });
  }
  if (liquidityIssues > 0) {
    factors.push({ code: 'insufficient_liquidity', count: liquidityIssues, severity: 'warning' });
  }
  if (negativeNet > 0) {
    factors.push({ code: 'negative_net_spread', count: negativeNet, severity: 'info' });
  }
  if ((economics.estimatedNetSpreadBps ?? 0) < (settings.minimumNetSpreadBps ?? 20)) {
    factors.push({ code: 'below_threshold', severity: 'info' });
  }
  if (rawOutput.execution?.supported === true) {
    factors.push({ code: 'execution_enabled', severity: 'critical' });
  } else {
    factors.push({ code: 'execution_suppressed', severity: 'info' });
  }
  return factors;
}

function resolveRiskScore(candidates = [], rawOutput = {}) {
  const fromOutput = toNum(rawOutput.riskStats?.averageScore ?? rawOutput.summary?.avgRiskScore);
  if (fromOutput != null) {
    return { riskScore: fromOutput, riskScoreState: ESTIMATE_STATE.MEASURED, riskScoreReason: null };
  }
  const scored = candidates.filter(c => c.riskScore != null);
  if (!scored.length) {
    return { riskScore: null, riskScoreState: ESTIMATE_STATE.UNAVAILABLE, riskScoreReason: 'no_scored_candidates' };
  }
  const avg = scored.reduce((s, c) => s + c.riskScore, 0) / scored.length;
  return { riskScore: Math.round(avg), riskScoreState: ESTIMATE_STATE.DERIVED, riskScoreReason: null };
}

export function buildHistoricalTrend(recentRuns = []) {
  return recentRuns.map(run => ({
    runId: run.runId,
    completedAt: run.completedAt || run.startedAt,
    trigger: run.trigger,
    qualifiedCount: run.qualifiedCount ?? run.funnel?.qualified ?? 0,
    rejectedCount: run.rejectedCount ?? run.funnel?.rejected ?? 0,
    analyticalCandidateCount: run.funnel?.analyticalCandidates ?? 0,
    netSpreadBps: run.bestNetSpreadBps ?? null,
    riskScore: run.avgRiskScore ?? null,
    freshnessMs: run.dataFreshnessMs ?? null,
  }));
}

export function buildProfitRiskAnalytics({
  scanRun,
  candidates = [],
  settings = {},
  rawOutput = {},
  trendRuns = [],
  generatedAt = new Date().toISOString(),
}) {
  const funnel = scanRun?.funnel || {};
  const rejectionDistribution = scanRun?.rejectionDistribution || scanRun?.rejectionSummary || {};
  const economics = summarizeCandidateEconomics(candidates, settings);
  const risk = resolveRiskScore(candidates, rawOutput);
  const qualifiedCandidateCount = funnel.qualified ?? 0;
  const analyticalCandidateCount = funnel.analyticalCandidates ?? candidates.length;
  const rejectedCandidateCount = funnel.rejected ?? 0;

  let freshnessState = scanRun?.dataFreshnessState || 'unavailable';
  let freshnessMs = scanRun?.dataFreshnessMs ?? null;
  const staleCandidates = candidates.filter(c => c.freshnessState === 'stale').length;
  if (staleCandidates > 0) freshnessState = 'degraded';

  const liquidityState =
    candidates.some(c => c.liquidityState === 'insufficient') ? 'insufficient' : candidates.length ? 'ok' : 'unavailable';

  return {
    runId: scanRun?.runId,
    generatedAt,
    ...economics,
    qualifiedCandidateCount,
    analyticalCandidateCount,
    rejectedCandidateCount,
    freshnessState,
    freshnessMs,
    liquidityState,
    ...risk,
    riskFactors: buildRiskFactors({ candidates, settings, economics, rawOutput }),
    rejectionDistribution,
    primaryRejectionReasons: buildPrimaryRejectionReasons(rejectionDistribution),
    historicalTrend: buildHistoricalTrend(trendRuns),
    assumptions: {
      assumedFeesBps: economics.assumedFeesBps,
      assumedSlippageBps: economics.assumedSlippageBps,
      minimumNetSpreadBps: settings.minimumNetSpreadBps ?? null,
      maximumDataAgeMs: settings.maximumDataAgeMs ?? null,
      monitoredSymbols: settings.monitoredSymbols ?? [],
      assumptionState: ESTIMATE_STATE.ASSUMPTION,
    },
    executionSupported: false,
    realizedProfitSupported: false,
    capturedProfitSupported: false,
    runtimeMode: scanRun?.runtimeMode || 'demo',
    sideEffectsSuppressed: scanRun?.sideEffectsSuppressed !== false,
    dataContractVersion: PROFIT_RISK_DATA_CONTRACT_VERSION,
    malformed: rawOutput == null || typeof rawOutput !== 'object',
  };
}

export function mapCandidatesFromRunOutput(output = {}, runId) {
  return [
    ...(output.candidates || []).map(c => mapRawCandidateToDto(c, { runId })),
    ...(output.rejectedCandidates || []).map(c => mapRawCandidateToDto(c, { runId })),
  ];
}

export function enrichTrendRunFromOutput(row, agentId, mapDecisionRowToScanRun) {
  const output = typeof row.output_data === 'object' ? row.output_data : {};
  const scanRun = mapDecisionRowToScanRun(
    {
      id: row.id,
      created_at: row.created_at,
      execution_time_ms: row.execution_time_ms,
      output_data: output,
      input_data: row.input_data,
      was_successful: row.was_successful,
    },
    agentId,
  );
  const candidates = mapCandidatesFromRunOutput(output, row.id);
  const best = pickBestCandidate(candidates);
  return {
    ...scanRun,
    bestNetSpreadBps: best?.netSpreadBps ?? null,
    avgRiskScore: toNum(output.riskStats?.averageScore ?? output.summary?.avgRiskScore),
  };
}

export { calculateNetProfit };
