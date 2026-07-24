/**
 * ARB-WP1A — Canonical Arbitrage scan metrics and history contracts.
 * Source of Truth for scan history: ai_decisions (decision_type = arbitrage_scan)
 * ai_agents.total_decisions is deprecated for Arbitrage metrics (stale; do not use).
 * ai_agents.metadata.last_result is a denormalized last-scan cache only.
 */

import { query } from '../database/db.js';

export const ARBITRAGE_DECISION_TYPE = 'arbitrage_scan';
export const ARBITRAGE_ANALYTICAL_MODE = 'analytical_spread_monitor';
export const ARBITRAGE_STRATEGY_CLASS = 'mexc_spot_spread_monitor';
/** Canonical modern contract version written by post-WP1A producers. */
export const ARBITRAGE_CONTRACT_VERSION_WP1A = '2.0.0-wp1a';

/** @typedef {'modern' | 'legacy' | 'partial'} ArbitrageScanClassification */

export const REJECTION_REASONS = Object.freeze({
  NON_POSITIVE_NET: 'NON_POSITIVE_NET',
  BELOW_MIN_PROFIT: 'BELOW_MIN_PROFIT',
  INSUFFICIENT_DEPTH: 'INSUFFICIENT_DEPTH',
  STALE_QUOTE: 'STALE_QUOTE',
  UNSUPPORTED_STRATEGY: 'UNSUPPORTED_STRATEGY',
  INCOMPLETE_LEGS: 'INCOMPLETE_LEGS',
  RISK_LIMIT: 'RISK_LIMIT',
  VOLUME_TOO_LOW: 'VOLUME_TOO_LOW',
  SPREAD_OUT_OF_RANGE: 'SPREAD_OUT_OF_RANGE',
  MISSING_QUOTE: 'MISSING_QUOTE',
  LEGACY_NEGATIVE_ESTIMATE: 'LEGACY_NEGATIVE_ESTIMATE',
  NOT_EXECUTABLE_ARBITRAGE: 'NOT_EXECUTABLE_ARBITRAGE',
});

/** Canonical read-only opportunity lifecycle (no submitted/filled/executed). */
export const OPPORTUNITY_LIFECYCLE = Object.freeze({
  DETECTED: 'detected',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  SIMULATED: 'simulated',
  BLOCKED: 'blocked',
});

/**
 * Map a spread candidate or rejection row to canonical lifecycle state.
 * @param {object|null} candidate
 * @param {{ demoMode?: boolean, killSwitchActive?: boolean }} [ctx]
 */
export function mapOpportunityLifecycle(candidate, ctx = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return OPPORTUNITY_LIFECYCLE.BLOCKED;
  }
  if (candidate.lifecycle && Object.values(OPPORTUNITY_LIFECYCLE).includes(candidate.lifecycle)) {
    return candidate.lifecycle;
  }
  if (candidate.classification === 'rejected_candidate') {
    return OPPORTUNITY_LIFECYCLE.REJECTED;
  }
  if (ctx.killSwitchActive || ctx.demoMode) {
    if (candidate.classification === 'spread_candidate') {
      const net = Number(candidate.netSpreadPct ?? candidate.netProfitUSDT);
      if (Number.isFinite(net) && net > 0) {
        return OPPORTUNITY_LIFECYCLE.VALIDATED;
      }
      return OPPORTUNITY_LIFECYCLE.DETECTED;
    }
    return OPPORTUNITY_LIFECYCLE.BLOCKED;
  }
  if (candidate.classification === 'spread_candidate') {
    return OPPORTUNITY_LIFECYCLE.DETECTED;
  }
  return OPPORTUNITY_LIFECYCLE.BLOCKED;
}

export function annotateCandidatesWithLifecycle(candidates = [], ctx = {}) {
  return candidates.map((c) => ({
    ...c,
    lifecycle: mapOpportunityLifecycle(c, ctx),
  }));
}

export function aggregateLifecycleMetrics(candidates = [], rejected = [], ctx = {}) {
  const all = [
    ...annotateCandidatesWithLifecycle(candidates, ctx),
    ...annotateCandidatesWithLifecycle(rejected, ctx),
  ];
  const counts = {
    detected: 0,
    validated: 0,
    rejected: 0,
    expired: 0,
    simulated: 0,
    blocked: 0,
  };
  for (const row of all) {
    const key = row.lifecycle;
    if (key && counts[key] != null) counts[key] += 1;
  }
  return counts;
}

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function readContractVersion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw.contractVersion ?? raw._meta?.version ?? null;
  return v == null ? null : String(v);
}

function isWp1aContractVersion(version) {
  if (!version) return false;
  const v = String(version).toLowerCase();
  return v === ARBITRAGE_CONTRACT_VERSION_WP1A || v.includes('wp1a');
}

function hasModernShape(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return (
    Array.isArray(raw.candidates) ||
    Array.isArray(raw.rejectedCandidates) ||
    raw.analyticalMode === ARBITRAGE_ANALYTICAL_MODE
  );
}

function hasHistoricalShape(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return Array.isArray(raw.opportunities);
}

/**
 * Canonical scan-contract classification owner (ARB-WP1A-R1).
 * Precedence:
 * 1) explicit contract/schema version
 * 2) explicit legacy/modern marker
 * 3) verified modern payload shape
 * 4) verified historical payload shape
 * 5) partial/unknown
 *
 * Callers must NOT force Legacy via options. The deprecated `legacy` option is
 * ignored so explicit modern data can never be overridden by a default.
 *
 * @returns {{ classification: ArbitrageScanClassification, legacy: boolean | null, contractVersion: string | null }}
 */
export function classifyScanContract(raw) {
  if (!raw || typeof raw !== 'object') {
    return { classification: 'partial', legacy: null, contractVersion: null };
  }

  const contractVersion = readContractVersion(raw);

  // 1) Explicit contract version
  if (isWp1aContractVersion(contractVersion)) {
    return { classification: 'modern', legacy: false, contractVersion };
  }

  // 2) Explicit persisted marker
  if (raw.legacy === true) {
    return { classification: 'legacy', legacy: true, contractVersion };
  }
  if (raw.legacy === false) {
    return { classification: 'modern', legacy: false, contractVersion };
  }

  // 3) Verified modern shape
  if (hasModernShape(raw)) {
    return { classification: 'modern', legacy: false, contractVersion };
  }

  // 4) Verified historical shape
  if (hasHistoricalShape(raw)) {
    return { classification: 'legacy', legacy: true, contractVersion };
  }

  // 5) Partial / ambiguous
  return { classification: 'partial', legacy: null, contractVersion };
}

function buildPartialNormalized(raw, classified) {
  return {
    classification: 'partial',
    legacy: null,
    contractVersion: classified.contractVersion,
    analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
    strategyClassification: ARBITRAGE_STRATEGY_CLASS,
    timestamp: asIso(raw?.timestamp) || asIso(raw?.completedAt) || null,
    status: 'unavailable',
    candidateStats: { total: 0, rejected: 0, spreadCandidates: 0, qualified: 0 },
    qualifiedStats: {
      total: 0,
      bestProfitBps: null,
      expectedNetProfitUSDT: null,
    },
    riskStats: { averageScore: null, unit: 'score_0_100' },
    candidates: [],
    rejectedCandidates: [],
    qualifiedOpportunities: [],
    unsupportedStrategies: [],
    execution: { supported: false, realizedProfitUSDT: null },
    error: Boolean(raw?.error),
    errorMessage: raw?.errorMessage || null,
    dryRun: true,
    summary: raw?.summary || null,
    config: raw?.config || null,
  };
}

/**
 * Normalize a persisted scan result (legacy or new) into the WP1A contract.
 * Classification is owned solely by classifyScanContract — options.legacy is ignored.
 */
export function normalizeScanResult(raw, _options = {}) {
  const classified = classifyScanContract(raw);

  if (classified.classification === 'partial') {
    return buildPartialNormalized(raw, classified);
  }

  if (classified.classification === 'modern') {
    const qualified = Array.isArray(raw.qualifiedOpportunities) ? raw.qualifiedOpportunities : [];
    const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    const rejected = Array.isArray(raw.rejectedCandidates) ? raw.rejectedCandidates : [];
    const avg = toNum(raw.riskStats?.averageScore ?? raw.summary?.avgRiskScore);
    const best =
      qualified.length > 0
        ? Math.max(...qualified.map((q) => toNum(q.expectedProfitBps) ?? Number.NEGATIVE_INFINITY))
        : null;

    const lifecycleCtx = { demoMode: true, killSwitchActive: true };
    const annotatedCandidates = annotateCandidatesWithLifecycle(candidates, lifecycleCtx);
    const annotatedRejected = annotateCandidatesWithLifecycle(rejected, lifecycleCtx);

    return {
      classification: 'modern',
      legacy: false,
      contractVersion: classified.contractVersion || ARBITRAGE_CONTRACT_VERSION_WP1A,
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      strategyClassification: raw.strategyClassification || ARBITRAGE_STRATEGY_CLASS,
      timestamp: asIso(raw.timestamp) || asIso(raw.completedAt),
      status: raw.error ? 'failed' : 'completed',
      candidateStats: {
        total: candidates.length + rejected.length + qualified.length,
        rejected: rejected.length,
        spreadCandidates: candidates.length,
        qualified: qualified.length,
      },
      qualifiedStats: {
        total: qualified.length,
        bestProfitBps: Number.isFinite(best) ? best : null,
        expectedNetProfitUSDT:
          qualified.length > 0
            ? qualified.reduce((s, q) => s + (toNum(q.netProfitUSDT) || 0), 0)
            : null,
      },
      riskStats: {
        averageScore: avg,
        unit: 'score_0_100',
      },
      candidates: annotatedCandidates,
      rejectedCandidates: annotatedRejected,
      qualifiedOpportunities: qualified,
      lifecycleMetrics: aggregateLifecycleMetrics(candidates, rejected, lifecycleCtx),
      unsupportedStrategies: Array.isArray(raw.unsupportedStrategies) ? raw.unsupportedStrategies : [],
      execution: { supported: false, realizedProfitUSDT: null },
      error: Boolean(raw.error),
      errorMessage: raw.errorMessage || null,
      dryRun: raw.dryRun !== false,
      summary: raw.summary || null,
      config: raw.config || null,
    };
  }

  // Legacy: opportunities[] treated as historical estimates — never as realized profit.
  const legacyOpps = Array.isArray(raw?.opportunities) ? raw.opportunities : [];
  const rejectedCandidates = [];
  const candidates = [];

  for (const opp of legacyOpps) {
    const net = toNum(opp.netProfitUSDT ?? opp.estimatedProfitUSDT);
    const bps = toNum(opp.expectedProfitBps ?? opp.profitBps);
    const base = {
      id: opp.id || `legacy-${opp.symbol || 'unknown'}`,
      symbol: opp.symbol || null,
      classification: 'spread_candidate',
      strategy: 'mexc_spot_spread_monitor',
      strategyLabelKey: 'strategy_mexc_spot_spread_monitor',
      path: Array.isArray(opp.path) ? opp.path : [],
      expectedProfitBps: bps,
      netProfitUSDT: net,
      riskScore: toNum(opp.riskScore),
      timestamp: asIso(opp.timestamp) || asIso(raw?.timestamp),
      analytical: true,
      executableArbitrage: false,
      legacy: true,
    };

    if (net == null || net <= 0) {
      rejectedCandidates.push({
        ...base,
        classification: 'rejected_candidate',
        rejectionReason: REJECTION_REASONS.LEGACY_NEGATIVE_ESTIMATE,
      });
    } else {
      // Positive legacy estimate is still not a Qualified Opportunity (same-market spread).
      candidates.push({
        ...base,
        notes: 'LEGACY_ANALYTICAL_SPREAD',
      });
    }
  }

  const avg = toNum(raw?.summary?.avgRiskScore);

  return {
    classification: 'legacy',
    legacy: true,
    contractVersion: classified.contractVersion,
    analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
    strategyClassification: ARBITRAGE_STRATEGY_CLASS,
    timestamp: asIso(raw?.timestamp),
    status: raw?.error ? 'failed' : 'completed',
    candidateStats: {
      total: candidates.length + rejectedCandidates.length,
      rejected: rejectedCandidates.length,
      spreadCandidates: candidates.length,
      qualified: 0,
    },
    qualifiedStats: {
      total: 0,
      bestProfitBps: null,
      expectedNetProfitUSDT: null,
    },
    riskStats: {
      averageScore: avg,
      unit: 'score_0_100',
    },
    candidates,
    rejectedCandidates,
    qualifiedOpportunities: [],
    unsupportedStrategies: [],
    execution: { supported: false, realizedProfitUSDT: null },
    error: Boolean(raw?.error),
    errorMessage: raw?.errorMessage || null,
    dryRun: true,
    summary: raw?.summary || null,
    config: raw?.config || null,
  };
}

export function buildArbitrageMetricsFromNormalized(normalized, scanCount, lastCompletedAt) {
  const avg = normalized?.riskStats?.averageScore;
  return {
    // Canonical
    totalScans: scanCount,
    scanStats: {
      total: scanCount,
      lastCompletedAt: lastCompletedAt || normalized?.timestamp || null,
    },
    candidateStats: normalized?.candidateStats || {
      total: 0,
      rejected: 0,
      spreadCandidates: 0,
      qualified: 0,
    },
    qualifiedStats: {
      total: 0,
      bestProfitBps: null,
      expectedNetProfitUSDT: null,
      ...(normalized?.qualifiedStats || {}),
    },
    riskStats: {
      averageScore: avg == null ? null : avg,
      unit: 'score_0_100',
    },
    execution: {
      supported: false,
      realizedProfitUSDT: null,
    },
    analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
    strategyClassification: ARBITRAGE_STRATEGY_CLASS,
    // Deprecated / removed false meanings — explicit nulls for clients that still read keys
    netProfitCapturedUSDT: null,
    bestProfitBps: normalized?.qualifiedStats?.bestProfitBps ?? null,
    opportunitiesFound: normalized?.candidateStats?.spreadCandidates ?? 0,
    averageProfitBps: null,
    simulatedVolumeUSDT: null,
    avgExecutionMs: null,
    successRate: null,
    riskAlerts: Array.isArray(normalized?.summary?.riskAlertCount)
      ? normalized.summary.riskAlertCount
      : toNum(normalized?.summary?.riskAlertCount) ?? 0,
    opportunityFrequency24h: null,
    // Explicitly unsupported — do not fabricate empty arrays as if implemented
    executionHistorySupported: false,
    opportunityHistorySupported: false,
  };
}

export async function countArbitrageScans(agentId) {
  const result = await query(
    `SELECT COUNT(*)::int AS total,
            MAX(created_at) AS last_completed_at
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2`,
    [agentId, ARBITRAGE_DECISION_TYPE],
  );
  return {
    total: result.rows[0]?.total || 0,
    lastCompletedAt: asIso(result.rows[0]?.last_completed_at),
  };
}

export async function fetchArbitrageHistoricalSummary(agentId) {
  const result = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE was_successful = true)::int AS successful,
            COUNT(*) FILTER (WHERE was_successful = false)::int AS failed,
            MAX(created_at) FILTER (WHERE was_successful = true) AS latest_success,
            MAX(created_at) FILTER (WHERE was_successful = false) AS latest_failed
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2`,
    [agentId, ARBITRAGE_DECISION_TYPE],
  );
  const triggerResult = await query(
    `SELECT COUNT(*) FILTER (
              WHERE COALESCE(input_data->>'trigger', 'scheduled') = 'scheduled'
            )::int AS scheduled,
            COUNT(*) FILTER (WHERE input_data->>'trigger' = 'manual')::int AS manual
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2`,
    [agentId, ARBITRAGE_DECISION_TYPE],
  );
  const row = result.rows[0] || {};
  const triggers = triggerResult.rows[0] || {};
  return {
    totalScanRuns: row.total || 0,
    successfulRuns: row.successful || 0,
    failedRuns: row.failed || 0,
    scheduledRuns: triggers.scheduled || 0,
    manualRuns: triggers.manual || 0,
    latestSuccessfulRunAt: asIso(row.latest_success),
    latestFailedRunAt: asIso(row.latest_failed),
  };
}

export async function fetchLatestArbitrageScanRow(agentId) {
  const result = await query(
    `SELECT id, input_data, output_data, created_at, execution_time_ms, was_successful
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [agentId, ARBITRAGE_DECISION_TYPE],
  );
  return result.rows[0] || null;
}

export async function fetchRecentArbitrageScanRows(agentId, limit = 10) {
  const safeLimit = Math.min(20, Math.max(1, parseInt(String(limit), 10) || 10));
  const result = await query(
    `SELECT id, input_data, output_data, created_at, execution_time_ms, was_successful
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2
     ORDER BY created_at DESC, id DESC
     LIMIT $3`,
    [agentId, ARBITRAGE_DECISION_TYPE, safeLimit],
  );
  return result.rows;
}

/**
 * Grouped scan counts for many agents — avoids N+1 on Agents list.
 */
export async function getArbitrageScanCountsByAgentIds(agentIds) {
  if (!agentIds?.length) return new Map();
  const result = await query(
    `SELECT agent_id,
            COUNT(*)::int AS total,
            MAX(created_at) AS last_completed_at
     FROM ai_decisions
     WHERE agent_id = ANY($1::uuid[])
       AND decision_type = $2
     GROUP BY agent_id`,
    [agentIds, ARBITRAGE_DECISION_TYPE],
  );
  return new Map(
    result.rows.map((r) => [
      r.agent_id,
      { total: r.total, lastCompletedAt: asIso(r.last_completed_at) },
    ]),
  );
}

export async function fetchArbitrageScanHistory(agentId, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));
  const offset = (safePage - 1) * safeSize;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2`,
    [agentId, ARBITRAGE_DECISION_TYPE],
  );
  const total = countResult.rows[0]?.total || 0;

  const rows = await query(
    `SELECT id, decision_type, confidence, output_data, created_at, was_successful
     FROM ai_decisions
     WHERE agent_id = $1 AND decision_type = $2
     ORDER BY created_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [agentId, ARBITRAGE_DECISION_TYPE, safeSize, offset],
  );

  const items = rows.rows.map((row) => {
    const raw = typeof row.output_data === 'string' ? JSON.parse(row.output_data) : row.output_data;
    const normalized = normalizeScanResult(raw);
    return {
      id: row.id,
      decisionType: row.decision_type,
      completedAt: asIso(row.created_at),
      startedAt: asIso(raw?.timestamp) || asIso(row.created_at),
      status: normalized.status,
      classification: normalized.classification,
      legacy: normalized.legacy,
      contractVersion: normalized.contractVersion,
      analyticalMode: normalized.analyticalMode,
      strategyClassification: normalized.strategyClassification,
      candidateStats: normalized.candidateStats,
      qualifiedStats: normalized.qualifiedStats,
      riskStats: normalized.riskStats,
      dryRun: true,
      errorMessage: normalized.errorMessage,
      confidence: toNum(row.confidence),
    };
  });

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
      hasMore: offset + items.length < total,
    },
  };
}

export function buildLastScanPayload(normalized) {
  if (!normalized) return null;
  return {
    timestamp: normalized.timestamp,
    analyticalMode: normalized.analyticalMode,
    strategyClassification: normalized.strategyClassification,
    candidates: normalized.candidates,
    rejectedCandidates: normalized.rejectedCandidates,
    qualifiedOpportunities: normalized.qualifiedOpportunities,
    candidateStats: normalized.candidateStats,
    qualifiedStats: normalized.qualifiedStats,
    riskStats: normalized.riskStats,
    avgRiskScore: normalized.riskStats?.averageScore,
    // Explicit: no qualified expected net when none qualified
    netProfitPotentialUSDT: normalized.qualifiedStats?.expectedNetProfitUSDT,
    avgExecutionMs: null,
    exchangesChecked: ['mexc'],
    symbolsChecked: [],
    execution: normalized.execution,
    classification: normalized.classification,
    legacy: normalized.legacy,
    contractVersion: normalized.contractVersion,
    dryRun: true,
    // Deprecated: do not treat as opportunities
    opportunities: [],
  };
}
