/**
 * Canonical analytical Profit & Risk contract — read-only estimates, not execution P&L.
 *
 * Unit contract:
 * - Fields ending in Bps are basis points (1 bps = 0.01%).
 * - estimatedNetSpreadBps = grossSpreadBps - assumedFeesBps - assumedSlippageBps
 * - estimatedProfitValue = notionalValue * estimatedNetSpreadBps / 10000 (when notional exists)
 */

import {
  buildPrimaryRejectionReasons,
  CANDIDATE_LIFECYCLE,
  mapRawCandidateToDto,
  SCAN_RUN_DATA_CONTRACT_VERSION,
} from './arbitrageDomain.js';

export const PROFIT_RISK_DATA_CONTRACT_VERSION = '1.1';

export const ESTIMATE_STATE = Object.freeze({
  MEASURED: 'measured',
  DERIVED: 'derived_estimate',
  ASSUMPTION: 'assumption',
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED: 'unsupported',
});

export const SELECTION_BASIS = Object.freeze({
  BEST_QUALIFIED: 'best_qualified_candidate',
  BEST_ESTIMATED_NET: 'best_estimated_net_spread',
  BEST_OBSERVED_GROSS: 'best_observed_gross_spread',
  BEST_ANALYTICAL: 'best_analytical_candidate',
  LEAST_NEGATIVE_REJECTED: 'least_negative_rejected_candidate',
});

function toNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalize percent-shaped legacy input to bps without double conversion. */
export function normalizeLegacySpreadToBps(value, { shape = 'bps' } = {}) {
  const n = toNum(value);
  if (n == null) return null;
  if (shape === 'percent') return n * 100;
  if (shape === 'ratio') return n * 10000;
  return n;
}

/** Gross spread from raw scan candidate — never treat net profit bps as gross. */
export function extractGrossSpreadBpsFromRaw(raw = {}) {
  if (raw.grossSpreadBps != null) return toNum(raw.grossSpreadBps);
  if (raw.spreadPct != null) return normalizeLegacySpreadToBps(raw.spreadPct, { shape: 'percent' });
  if (raw.spreadBps != null) return toNum(raw.spreadBps);
  return null;
}

export function extractAssumedFeesBps(raw = {}, settings = {}) {
  const fromRaw = toNum(
    raw.assumedFeesBps ??
      (raw.fees?.feePct != null ? normalizeLegacySpreadToBps(raw.fees.feePct, { shape: 'percent' }) : null) ??
      raw.feeBps,
  );
  if (fromRaw != null) return fromRaw;
  return toNum(settings.assumedFeesBps);
}

export function extractAssumedSlippageBps(raw = {}, settings = {}) {
  const fromRaw = toNum(
    raw.assumedSlippageBps ??
      (raw.fees?.slippagePct != null
        ? normalizeLegacySpreadToBps(raw.fees.slippagePct, { shape: 'percent' })
        : null) ??
      raw.slippageBps ??
      raw.estimatedSlippageBps,
  );
  if (fromRaw != null) return fromRaw;
  return toNum(settings.assumedSlippageBps);
}

export function extractNotionalValue(raw = {}, settings = {}) {
  const fromRaw = toNum(raw.testVolumeUSDT ?? raw.estimatedNotional ?? raw.notionalValue);
  if (fromRaw != null) return fromRaw;
  return toNum(settings.analyticalNotionalUSDT ?? settings.testVolumeUSDT);
}

export function computeEstimatedNetSpreadBps(grossSpreadBps, assumedFeesBps, assumedSlippageBps) {
  if (grossSpreadBps == null) {
    return { estimatedNetSpreadBps: null, estimateState: ESTIMATE_STATE.UNAVAILABLE, estimateReason: 'gross_unavailable' };
  }
  if (assumedFeesBps == null) {
    return { estimatedNetSpreadBps: null, estimateState: ESTIMATE_STATE.UNAVAILABLE, estimateReason: 'fees_unavailable' };
  }
  if (assumedSlippageBps == null) {
    return {
      estimatedNetSpreadBps: null,
      estimateState: ESTIMATE_STATE.UNAVAILABLE,
      estimateReason: 'slippage_unavailable',
    };
  }
  const estimatedNetSpreadBps = grossSpreadBps - assumedFeesBps - assumedSlippageBps;
  return {
    estimatedNetSpreadBps,
    estimateState: ESTIMATE_STATE.DERIVED,
    estimateReason: 'canonical_net_spread_formula',
  };
}

export function computeEstimatedProfitValue(notionalValue, estimatedNetSpreadBps, currency = 'USDT') {
  if (notionalValue == null || notionalValue <= 0) {
    return {
      estimatedProfitValue: null,
      estimatedProfitCurrency: null,
      estimateState: ESTIMATE_STATE.UNAVAILABLE,
      estimateReason: 'notional_unavailable',
    };
  }
  if (estimatedNetSpreadBps == null) {
    return {
      estimatedProfitValue: null,
      estimatedProfitCurrency: null,
      estimateState: ESTIMATE_STATE.UNAVAILABLE,
      estimateReason: 'net_spread_unavailable',
    };
  }
  return {
    estimatedProfitValue: (notionalValue * estimatedNetSpreadBps) / 10000,
    estimatedProfitCurrency: currency,
    estimateState: ESTIMATE_STATE.DERIVED,
    estimateReason: 'notional_net_spread_formula',
  };
}

function buildCandidateEconomics(raw = {}, settings = {}) {
  const grossSpreadBps = extractGrossSpreadBpsFromRaw(raw);
  const assumedFeesBps = extractAssumedFeesBps(raw, settings);
  const assumedSlippageBps = extractAssumedSlippageBps(raw, settings);
  const net = computeEstimatedNetSpreadBps(grossSpreadBps, assumedFeesBps, assumedSlippageBps);
  const notionalValue = extractNotionalValue(raw, settings);
  const profit = computeEstimatedProfitValue(notionalValue, net.estimatedNetSpreadBps);
  const lifecycleState =
    raw.lifecycleState ||
    (raw.rejectionReason || raw.classification === 'rejected_candidate'
      ? CANDIDATE_LIFECYCLE.REJECTED
      : CANDIDATE_LIFECYCLE.CANDIDATE);

  return {
    candidateId: raw.id || raw.candidateId || `${raw.symbol || 'unknown'}-candidate`,
    symbol: raw.symbol || null,
    lifecycleState,
    grossSpreadBps,
    assumedFeesBps,
    assumedSlippageBps,
    estimatedNetSpreadBps: net.estimatedNetSpreadBps,
    notionalValue,
    notionalCurrency: notionalValue != null ? 'USDT' : null,
    estimatedProfitValue: profit.estimatedProfitValue,
    estimatedProfitCurrency: profit.estimatedProfitCurrency,
    riskScore: toNum(raw.riskScore),
  };
}

function economicsFromDto(candidate, settings = {}) {
  if (!candidate) return null;
  return buildCandidateEconomics(
    {
      id: candidate.candidateId,
      symbol: candidate.symbol,
      spreadPct: candidate.grossSpreadBps != null ? candidate.grossSpreadBps / 100 : null,
      grossSpreadBps: candidate.grossSpreadBps,
      fees: {
        feePct: candidate.assumedFeesBps != null ? candidate.assumedFeesBps / 100 : null,
        slippagePct: candidate.estimatedSlippageBps != null ? candidate.estimatedSlippageBps / 100 : null,
      },
      testVolumeUSDT: candidate.estimatedNotional,
      riskScore: candidate.riskScore,
      lifecycleState: candidate.lifecycleState,
      rejectionReason: candidate.rejectionReasons?.[0],
    },
    settings,
  );
}

function selectEconomicsCandidate(rawCandidates = [], dtoCandidates = [], settings = {}) {
  const economicsList = rawCandidates.map(raw => buildCandidateEconomics(raw, settings));

  const qualified = economicsList.filter(c => c.lifecycleState === CANDIDATE_LIFECYCLE.QUALIFIED);
  if (qualified.length) {
    const best = qualified.reduce((a, b) =>
      (b.estimatedNetSpreadBps ?? Number.NEGATIVE_INFINITY) > (a.estimatedNetSpreadBps ?? Number.NEGATIVE_INFINITY)
        ? b
        : a,
    );
    return {
      economics: best,
      selectedCandidateId: best.candidateId,
      selectedCandidateSymbol: best.symbol,
      selectionBasis: SELECTION_BASIS.BEST_QUALIFIED,
      selectionReason: 'highest_estimated_net_spread_among_qualified',
    };
  }

  const withNet = economicsList.filter(c => c.estimatedNetSpreadBps != null);
  if (withNet.length) {
    const bestNet = withNet.reduce((a, b) => (b.estimatedNetSpreadBps > a.estimatedNetSpreadBps ? b : a));
    const allRejected = withNet.every(c => c.lifecycleState === CANDIDATE_LIFECYCLE.REJECTED);
    if (allRejected && bestNet.estimatedNetSpreadBps <= 0) {
      const leastNegative = withNet.reduce((a, b) => (b.estimatedNetSpreadBps > a.estimatedNetSpreadBps ? b : a));
      return {
        economics: leastNegative,
        selectedCandidateId: leastNegative.candidateId,
        selectedCandidateSymbol: leastNegative.symbol,
        selectionBasis: SELECTION_BASIS.LEAST_NEGATIVE_REJECTED,
        selectionReason: 'least_negative_net_spread_among_rejected',
      };
    }
    return {
      economics: bestNet,
      selectedCandidateId: bestNet.candidateId,
      selectedCandidateSymbol: bestNet.symbol,
      selectionBasis: SELECTION_BASIS.BEST_ESTIMATED_NET,
      selectionReason: 'highest_estimated_net_spread_in_run',
    };
  }

  const withGross = economicsList.filter(c => c.grossSpreadBps != null);
  if (withGross.length) {
    const bestGross = withGross.reduce((a, b) => (b.grossSpreadBps > a.grossSpreadBps ? b : a));
    return {
      economics: bestGross,
      selectedCandidateId: bestGross.candidateId,
      selectedCandidateSymbol: bestGross.symbol,
      selectionBasis: SELECTION_BASIS.BEST_OBSERVED_GROSS,
      selectionReason: 'highest_observed_gross_spread_in_run',
    };
  }

  if (dtoCandidates.length) {
    const fallback = economicsFromDto(dtoCandidates[0], settings);
    if (fallback) {
      return {
        economics: fallback,
        selectedCandidateId: fallback.candidateId,
        selectedCandidateSymbol: fallback.symbol,
        selectionBasis: SELECTION_BASIS.BEST_ANALYTICAL,
        selectionReason: 'first_analytical_candidate_without_spread',
      };
    }
  }

  return {
    economics: null,
    selectedCandidateId: null,
    selectedCandidateSymbol: null,
    selectionBasis: null,
    selectionReason: 'no_candidates_in_run',
  };
}

function summarizeCandidateEconomics(rawCandidates = [], dtoCandidates = [], settings = {}) {
  const feeBps = toNum(settings.assumedFeesBps) ?? 10;
  const slippageBps = toNum(settings.assumedSlippageBps) ?? 10;
  const selection = selectEconomicsCandidate(rawCandidates, dtoCandidates, settings);
  const selected = selection.economics;

  let grossSpreadBps = selected?.grossSpreadBps ?? null;
  let estimatedNetSpreadBps = null;
  let estimatedProfitValue = null;
  let estimatedProfitCurrency = null;
  let estimateState = ESTIMATE_STATE.UNAVAILABLE;
  let estimateReason = selection.selectionReason || 'no_observations';

  if (selected) {
    grossSpreadBps = selected.grossSpreadBps;
    const net = computeEstimatedNetSpreadBps(grossSpreadBps, feeBps, slippageBps);
    estimatedNetSpreadBps = net.estimatedNetSpreadBps;
    const profit = computeEstimatedProfitValue(selected.notionalValue, estimatedNetSpreadBps);
    estimatedProfitValue = profit.estimatedProfitValue;
    estimatedProfitCurrency = profit.estimatedProfitCurrency;

    if (selected.lifecycleState === CANDIDATE_LIFECYCLE.QUALIFIED && estimatedProfitValue != null) {
      estimateState = ESTIMATE_STATE.MEASURED;
      estimateReason = null;
    } else if (estimatedNetSpreadBps != null) {
      estimateState = ESTIMATE_STATE.DERIVED;
      estimateReason = net.estimateReason;
    } else {
      estimateState = ESTIMATE_STATE.UNAVAILABLE;
      estimateReason = net.estimateReason || selection.selectionReason;
    }

    if (profit.estimateReason === 'notional_unavailable') {
      estimatedProfitValue = null;
      estimatedProfitCurrency = null;
    }
  } else if (rawCandidates.length === 0 && dtoCandidates.length === 0) {
    estimateReason = 'no_candidates_in_run';
  }

  const allEconomics = rawCandidates.map(raw => buildCandidateEconomics(raw, settings));
  const bestNet = allEconomics
    .filter(c => c.estimatedNetSpreadBps != null)
    .reduce(
      (best, c) =>
        !best || c.estimatedNetSpreadBps > best.estimatedNetSpreadBps ? c : best,
      null,
    );
  const worstNet = allEconomics
    .filter(c => c.estimatedNetSpreadBps != null)
    .reduce(
      (worst, c) =>
        !worst || c.estimatedNetSpreadBps < worst.estimatedNetSpreadBps ? c : worst,
      null,
    );

  return {
    grossSpreadBps,
    assumedFeesBps: feeBps,
    assumedSlippageBps: slippageBps,
    estimatedNetSpreadBps,
    estimatedProfitValue,
    estimatedProfitCurrency,
    notionalValue: selected?.notionalValue ?? null,
    notionalCurrency: selected?.notionalValue != null ? 'USDT' : null,
    estimateState,
    estimateReason,
    selectedCandidateId: selection.selectedCandidateId,
    selectedCandidateSymbol: selection.selectedCandidateSymbol,
    selectionBasis: selection.selectionBasis,
    selectionReason: selection.selectionReason,
    bestObservedCandidate: bestNet
      ? {
          symbol: bestNet.symbol,
          netSpreadBps: bestNet.estimatedNetSpreadBps,
          grossSpreadBps: bestNet.grossSpreadBps,
        }
      : null,
    worstObservedCandidate: worstNet
      ? {
          symbol: worstNet.symbol,
          netSpreadBps: worstNet.estimatedNetSpreadBps,
          grossSpreadBps: worstNet.grossSpreadBps,
        }
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
  if (
    economics.estimatedNetSpreadBps != null &&
    economics.estimatedNetSpreadBps < (settings.minimumNetSpreadBps ?? 20)
  ) {
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
  const riskStats = rawOutput.riskStats;
  const summary = rawOutput.summary;
  const hasRiskStatsAverage =
    riskStats != null &&
    typeof riskStats === 'object' &&
    riskStats.averageScore != null &&
    Number.isFinite(Number(riskStats.averageScore));
  const hasSummaryAverage =
    summary != null &&
    typeof summary === 'object' &&
    summary.avgRiskScore != null &&
    Number.isFinite(Number(summary.avgRiskScore));

  if (hasRiskStatsAverage) {
    return {
      riskScore: Math.round(Number(riskStats.averageScore)),
      riskScoreState: ESTIMATE_STATE.MEASURED,
      riskScoreReason: null,
    };
  }
  if (hasSummaryAverage) {
    return {
      riskScore: Math.round(Number(summary.avgRiskScore)),
      riskScoreState: ESTIMATE_STATE.MEASURED,
      riskScoreReason: null,
    };
  }

  const scored = candidates.filter(c => c.riskScore != null && Number.isFinite(Number(c.riskScore)));
  if (!scored.length) {
    return {
      riskScore: null,
      riskScoreState: ESTIMATE_STATE.UNAVAILABLE,
      riskScoreReason: 'no_risk_evidence',
    };
  }

  const avg = scored.reduce((s, c) => s + Number(c.riskScore), 0) / scored.length;
  const rounded = Math.round(avg);
  if (rounded === 0 && !scored.some(c => Number(c.riskScore) > 0)) {
    const hasExplicitZero = scored.some(
      c => c.riskScoreUnavailableReason == null && c.lifecycleState !== CANDIDATE_LIFECYCLE.REJECTED,
    );
    if (!hasExplicitZero) {
      return {
        riskScore: null,
        riskScoreState: ESTIMATE_STATE.UNAVAILABLE,
        riskScoreReason: 'no_measured_risk_evidence',
      };
    }
  }

  return {
    riskScore: rounded,
    riskScoreState: ESTIMATE_STATE.DERIVED,
    riskScoreReason: 'candidate_average',
  };
}

export function buildHistoricalTrend(recentRuns = [], settings = {}) {
  return recentRuns.map(run => {
    const output = run.rawOutput || {};
    const rawCandidates = [...(output.candidates || []), ...(output.rejectedCandidates || [])];
    let netSpreadBps = null;
    if (rawCandidates.length) {
      const economics = rawCandidates.map(raw => buildCandidateEconomics(raw, settings));
      const best = economics
        .filter(c => c.estimatedNetSpreadBps != null)
        .reduce(
          (a, b) => (!a || b.estimatedNetSpreadBps > a.estimatedNetSpreadBps ? b : a),
          null,
        );
      netSpreadBps = best?.estimatedNetSpreadBps ?? null;
    } else if (run.bestNetSpreadBps != null) {
      netSpreadBps = run.bestNetSpreadBps;
    }

    const riskFromOutput = toNum(output.riskStats?.averageScore ?? output.summary?.avgRiskScore);
    const riskScore =
      output.riskStats?.averageScore != null || output.summary?.avgRiskScore != null
        ? riskFromOutput
        : run.avgRiskScore ?? null;

    return {
      runId: run.runId,
      completedAt: run.completedAt || run.startedAt,
      trigger: run.trigger,
      status: run.status,
      qualifiedCount: run.qualifiedCount ?? run.funnel?.qualified ?? 0,
      rejectedCount: run.rejectedCount ?? run.funnel?.rejected ?? 0,
      analyticalCandidateCount: run.funnel?.analyticalCandidates ?? 0,
      grossSpreadBps: run.bestGrossSpreadBps ?? null,
      netSpreadBps,
      riskScore,
      riskScoreState: riskScore != null ? ESTIMATE_STATE.DERIVED : ESTIMATE_STATE.UNAVAILABLE,
      freshnessMs: run.dataFreshnessMs ?? null,
      isSelected: Boolean(run.isSelected),
    };
  });
}

export function buildProfitRiskAnalytics({
  scanRun,
  candidates = [],
  rawCandidates = [],
  settings = {},
  rawOutput = {},
  trendRuns = [],
  generatedAt = new Date().toISOString(),
}) {
  const funnel = scanRun?.funnel || {};
  const rejectionDistribution = scanRun?.rejectionDistribution || scanRun?.rejectionSummary || {};
  const mergedRaw =
    rawCandidates.length > 0
      ? rawCandidates
      : [...(rawOutput.candidates || []), ...(rawOutput.rejectedCandidates || [])];
  const economics = summarizeCandidateEconomics(mergedRaw, candidates, settings);
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

  const selectedRunId = scanRun?.runId;
  const historicalTrend = buildHistoricalTrend(
    trendRuns.map(r => ({ ...r, isSelected: r.runId === selectedRunId, rawOutput: r.rawOutput })),
    settings,
  );

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
    historicalTrend,
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
  const rawCandidates = [...(output.candidates || []), ...(output.rejectedCandidates || [])];
  const economics = rawCandidates.map(raw => buildCandidateEconomics(raw, {}));
  const bestNet = economics
    .filter(c => c.estimatedNetSpreadBps != null)
    .reduce((a, b) => (!a || b.estimatedNetSpreadBps > a.estimatedNetSpreadBps ? b : a), null);
  const bestGross = economics
    .filter(c => c.grossSpreadBps != null)
    .reduce((a, b) => (!a || b.grossSpreadBps > a.grossSpreadBps ? b : a), null);

  return {
    ...scanRun,
    rawOutput: output,
    bestNetSpreadBps: bestNet?.estimatedNetSpreadBps ?? null,
    bestGrossSpreadBps: bestGross?.grossSpreadBps ?? null,
    avgRiskScore: toNum(output.riskStats?.averageScore ?? output.summary?.avgRiskScore),
  };
}
