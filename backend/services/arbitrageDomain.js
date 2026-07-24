/**
 * ARBITRAGE-CORE — Canonical analytical domain contracts (single owner).
 * MEXC Spot Spread Monitor — read-only analytical product.
 */

import {
  ARBITRAGE_ANALYTICAL_MODE,
  ARBITRAGE_DECISION_TYPE,
  ARBITRAGE_STRATEGY_CLASS,
  REJECTION_REASONS,
} from './arbitrageScanContract.js';

export const PRODUCT_ID = 'arbitrage';
export const PRODUCT_DISPLAY_NAME = 'MEXC Spot Spread Monitor';
export const PRODUCT_DESCRIPTION =
  'Single-venue analytical bid/ask spread monitoring using MEXC public market data. It does not execute trades and does not provide cross-exchange or triangular arbitrage.';

export const ANALYTICAL_MODES = Object.freeze({
  SINGLE_VENUE_SPREAD: 'single_venue_spread_monitoring',
  TRIANGULAR: 'triangular_arbitrage',
  CROSS_EXCHANGE: 'cross_exchange_arbitrage',
  FUTURES_BASIS: 'futures_spot_basis_analysis',
});

export const MODE_AVAILABILITY = Object.freeze({
  [ANALYTICAL_MODES.SINGLE_VENUE_SPREAD]: 'operational',
  [ANALYTICAL_MODES.TRIANGULAR]: 'unavailable',
  [ANALYTICAL_MODES.CROSS_EXCHANGE]: 'unavailable',
  [ANALYTICAL_MODES.FUTURES_BASIS]: 'unavailable',
});

export const CANDIDATE_LIFECYCLE = Object.freeze({
  OBSERVED: 'observed',
  CANDIDATE: 'candidate',
  REJECTED: 'rejected',
  QUALIFIED: 'qualified',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
});

export const SCAN_RUN_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
});

export const MONITORING_STATE = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
});

export const FUNNEL_STAGES = Object.freeze([
  'symbolsRequested',
  'symbolsEvaluated',
  'rawObservations',
  'analyticalCandidates',
  'rejected',
  'qualified',
  'expired',
  'blocked',
]);

const MAX_SYMBOLS = 50;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export function getProductIdentity() {
  return {
    agentKey: PRODUCT_ID,
    displayName: PRODUCT_DISPLAY_NAME,
    description: PRODUCT_DESCRIPTION,
    activeMode: ANALYTICAL_MODES.SINGLE_VENUE_SPREAD,
    activeModeLabel: PRODUCT_DISPLAY_NAME,
    unavailableModes: [
      { mode: ANALYTICAL_MODES.TRIANGULAR, label: 'Triangular arbitrage', state: 'unavailable' },
      { mode: ANALYTICAL_MODES.CROSS_EXCHANGE, label: 'Cross-exchange arbitrage', state: 'unavailable' },
      { mode: ANALYTICAL_MODES.FUTURES_BASIS, label: 'Spot/futures basis analysis', state: 'unavailable' },
      { mode: 'financial_execution', label: 'Financial execution', state: 'blocked' },
    ],
    executionSupported: false,
    executionEligible: false,
  };
}

function parseSymbolParts(symbol = '') {
  const s = String(symbol || '').toUpperCase();
  if (s.endsWith('USDT')) {
    return { baseAsset: s.slice(0, -4), quoteAsset: 'USDT' };
  }
  if (s.endsWith('USDC')) {
    return { baseAsset: s.slice(0, -4), quoteAsset: 'USDC' };
  }
  return { baseAsset: s.slice(0, 3) || s, quoteAsset: s.slice(3) || 'USDT' };
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function summarizeRejections(rejected = []) {
  const map = new Map();
  for (const row of rejected) {
    const reason = row.rejectionReason || row.rejectionReasons?.[0] || 'unknown';
    map.set(reason, (map.get(reason) || 0) + 1);
  }
  return Object.fromEntries(map.entries());
}

/**
 * Build funnel counts with explicit definitions.
 */
export function buildFunnelCounts({
  symbolsRequested = [],
  symbolsEvaluated = [],
  rawObservations = 0,
  analyticalCandidates = 0,
  rejected = 0,
  qualified = 0,
  expired = 0,
  blocked = 0,
} = {}) {
  return {
    symbolsRequested: symbolsRequested.length,
    symbolsEvaluated: symbolsEvaluated.length,
    rawObservations,
    analyticalCandidates,
    rejected,
    qualified,
    expired,
    blocked,
  };
}

export function mapRawCandidateToDto(raw, { runId, mode = ANALYTICAL_MODES.SINGLE_VENUE_SPREAD } = {}) {
  const symbol = raw.symbol || '';
  const { baseAsset, quoteAsset } = parseSymbolParts(symbol);
  const observedAt = toIso(raw.timestamp) || new Date().toISOString();
  const lifecycleState = raw.lifecycle
    || (raw.classification === 'rejected_candidate' ? CANDIDATE_LIFECYCLE.REJECTED : CANDIDATE_LIFECYCLE.CANDIDATE);

  const grossSpreadBps = toNum(raw.profitBps ?? raw.expectedProfitBps ?? (raw.spreadPct != null ? raw.spreadPct * 100 : null));
  const assumedFeesBps = toNum(raw.fees?.feePct != null ? raw.fees.feePct * 100 : raw.feeBps);
  const estimatedSlippageBps = toNum(raw.fees?.slippagePct != null ? raw.fees.slippagePct * 100 : raw.slippageBps);
  const netSpreadBps = toNum(raw.netSpreadPct != null ? raw.netSpreadPct * 100 : grossSpreadBps);

  let unavailableReason = null;
  if (raw.netProfitUSDT == null && raw.estimatedProfitUSDT == null && lifecycleState === CANDIDATE_LIFECYCLE.REJECTED) {
    unavailableReason = raw.rejectionReason || 'candidate_not_qualified';
  }

  return {
    candidateId: raw.id || `${symbol}-${runId || 'unknown'}`,
    runId: runId || null,
    mode,
    symbol,
    baseAsset,
    quoteAsset,
    bid: toNum(raw.bidPrice),
    ask: toNum(raw.askPrice),
    sourceTimestamp: observedAt,
    observedAt,
    ageMs: 0,
    grossSpreadBps,
    assumedFeesBps,
    estimatedSlippageBps,
    netSpreadBps,
    estimatedNotional: toNum(raw.testVolumeUSDT),
    estimatedProfit: toNum(raw.netProfitUSDT ?? raw.estimatedProfitUSDT),
    estimatedProfitUnavailableReason: unavailableReason,
    liquidityState: raw.rejectionReason === REJECTION_REASONS.INSUFFICIENT_DEPTH ? 'insufficient' : 'ok',
    freshnessState: raw.rejectionReason === REJECTION_REASONS.STALE_QUOTE ? 'stale' : 'fresh',
    riskScore: toNum(raw.riskScore),
    riskScoreUnavailableReason: raw.riskScore == null ? 'candidate_not_qualified' : null,
    lifecycleState,
    rejectionReasons: raw.rejectionReason
      ? [raw.rejectionReason]
      : Array.isArray(raw.rejectionReasons)
        ? raw.rejectionReasons
        : [],
  };
}

export const DURATION_UNAVAILABLE_REASONS = Object.freeze({
  NOT_RECORDED: 'duration_not_recorded',
  INSUFFICIENT_TIMESTAMP_PRECISION: 'insufficient_timestamp_precision',
});

export const DATA_FRESHNESS_UNAVAILABLE_REASONS = Object.freeze({
  SOURCE_TIMESTAMPS_NOT_RECORDED: 'source_timestamps_not_recorded',
  SCAN_START_UNAVAILABLE: 'scan_start_unavailable',
});

/**
 * Resolve scan duration from stored execution_time_ms or timestamps.
 * Never fabricates sub-millisecond timing from missing or same-second data.
 */
export function resolveScanDurationMs({ durationMs, startedAt, completedAt } = {}) {
  const stored = toNum(durationMs);
  if (stored != null && stored > 0) {
    return {
      durationMs: stored,
      durationAvailability: 'measured',
      durationReason: null,
    };
  }

  if (stored === 0) {
    return {
      durationMs: 0,
      durationAvailability: 'sub_ms',
      durationReason: null,
    };
  }

  if (startedAt && completedAt) {
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(completedAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return {
        durationMs: endMs - startMs,
        durationAvailability: 'measured',
        durationReason: null,
      };
    }
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs === startMs) {
      return {
        durationMs: null,
        durationAvailability: 'unavailable',
        durationReason: DURATION_UNAVAILABLE_REASONS.INSUFFICIENT_TIMESTAMP_PRECISION,
      };
    }
  }

  return {
    durationMs: null,
    durationAvailability: 'unavailable',
    durationReason: DURATION_UNAVAILABLE_REASONS.NOT_RECORDED,
  };
}

function collectCandidateSourceTimestamps(rawOutput = {}) {
  const pools = [
    ...(rawOutput.candidates || []),
    ...(rawOutput.rejectedCandidates || []),
    ...(rawOutput.qualifiedOpportunities || []),
  ];
  const timestamps = [];
  for (const item of pools) {
    const ts = item?.timestamp || item?.observedAt;
    if (!ts) continue;
    const sourceMs = new Date(ts).getTime();
    if (Number.isFinite(sourceMs)) timestamps.push(sourceMs);
  }
  return timestamps;
}

/**
 * Resolve data freshness from persisted candidate source timestamps.
 * Does not fabricate freshness from scan completion time.
 */
export function resolveDataFreshness({ rawOutput = {}, scanStartedAt } = {}) {
  const referenceMs = scanStartedAt ? new Date(scanStartedAt).getTime() : NaN;
  if (!Number.isFinite(referenceMs)) {
    return {
      dataFreshnessState: 'unavailable',
      dataFreshnessMs: null,
      dataFreshnessReason: DATA_FRESHNESS_UNAVAILABLE_REASONS.SCAN_START_UNAVAILABLE,
    };
  }

  const sourceTimestamps = collectCandidateSourceTimestamps(rawOutput);
  if (sourceTimestamps.length === 0) {
    return {
      dataFreshnessState: 'unavailable',
      dataFreshnessMs: null,
      dataFreshnessReason: DATA_FRESHNESS_UNAVAILABLE_REASONS.SOURCE_TIMESTAMPS_NOT_RECORDED,
    };
  }

  const agesMs = sourceTimestamps
    .map(sourceMs => referenceMs - sourceMs)
    .filter(age => Number.isFinite(age) && age >= 0);
  if (agesMs.length === 0) {
    return {
      dataFreshnessState: 'unavailable',
      dataFreshnessMs: null,
      dataFreshnessReason: DATA_FRESHNESS_UNAVAILABLE_REASONS.SOURCE_TIMESTAMPS_NOT_RECORDED,
    };
  }

  return {
    dataFreshnessState: 'measured',
    dataFreshnessMs: Math.round(Math.max(...agesMs)),
    dataFreshnessReason: null,
  };
}

export function enrichRunTimingSummary(historicalSummary = {}, latestRun = null) {
  const latestRunAt = latestRun?.completedAt || latestRun?.startedAt || null;
  const latestCompletedRunAt =
    latestRun?.status === SCAN_RUN_STATUS.COMPLETED ? latestRunAt : null;
  let latestSuccessfulRunAt = historicalSummary.latestSuccessfulRunAt || null;

  if (latestRun?.status === SCAN_RUN_STATUS.COMPLETED) {
    latestSuccessfulRunAt = latestRun.completedAt || latestRun.startedAt || latestSuccessfulRunAt;
  }

  return {
    ...historicalSummary,
    latestRunAt,
    latestCompletedRunAt,
    latestSuccessfulRunAt,
  };
}

export function buildScanRunDto({
  runId,
  agentId,
  trigger = 'scheduled',
  startedAt,
  completedAt,
  durationMs,
  status = SCAN_RUN_STATUS.COMPLETED,
  dryRun = true,
  runtimeMode = 'demo',
  schedulerOwner = 'titan-engine-worker',
  symbolsRequested = [],
  symbolsEvaluated = [],
  sourceFreshnessMs = null,
  rawOutput = {},
  failureReason = null,
}) {
  const resolvedDuration = resolveScanDurationMs({ durationMs, startedAt, completedAt });
  const resolvedFreshness =
    sourceFreshnessMs != null
      ? {
          dataFreshnessState: 'measured',
          dataFreshnessMs: toNum(sourceFreshnessMs),
          dataFreshnessReason: null,
        }
      : resolveDataFreshness({ rawOutput, scanStartedAt: startedAt });
  const candidates = rawOutput.candidates || [];
  const rejected = rawOutput.rejectedCandidates || [];
  const qualified = rawOutput.qualifiedOpportunities || [];
  const funnel = buildFunnelCounts({
    symbolsRequested,
    symbolsEvaluated,
    rawObservations: symbolsEvaluated.length,
    analyticalCandidates: candidates.length,
    rejected: rejected.length,
    qualified: qualified.length,
    expired: 0,
    blocked: 0,
  });

  return {
    runId,
    agentId,
    mode: ANALYTICAL_MODES.SINGLE_VENUE_SPREAD,
    productDisplayName: PRODUCT_DISPLAY_NAME,
    trigger,
    startedAt: toIso(startedAt),
    completedAt: toIso(completedAt),
    durationMs: resolvedDuration.durationMs,
    durationAvailability: resolvedDuration.durationAvailability,
    durationReason: resolvedDuration.durationReason,
    dataFreshnessState: resolvedFreshness.dataFreshnessState,
    dataFreshnessMs: resolvedFreshness.dataFreshnessMs,
    dataFreshnessReason: resolvedFreshness.dataFreshnessReason,
    sourceFreshnessMs: resolvedFreshness.dataFreshnessMs,
    status,
    dryRun: dryRun !== false,
    runtimeMode,
    schedulerOwner,
    symbolsRequested,
    symbolsEvaluated,
    funnel,
    spreadCandidates: funnel.analyticalCandidates,
    rejectedCandidates: funnel.rejected,
    qualifiedCandidates: funnel.qualified,
    expiredCandidates: funnel.expired,
    blockedCandidates: funnel.blocked,
    rejectionSummary: summarizeRejections(rejected),
    failureReason,
    executionSupported: false,
    executionEligible: false,
  };
}

export function buildSettingsDto(rawConfig = {}, meta = {}) {
  const normalized = rawConfig || {};
  const strategies = Array.isArray(normalized.strategies) ? normalized.strategies : [];
  const spot = strategies.find((s) => s?.type === 'spot' || s?.type === 'mexc_spot_spread_monitor');

  const monitoringState =
    normalized.monitoringState
    || (normalized.enabled === false ? MONITORING_STATE.PAUSED : MONITORING_STATE.ACTIVE);

  return {
    monitoredSymbols: Array.isArray(normalized.symbols) ? normalized.symbols : [],
    minimumGrossSpreadBps: toNum(normalized.minSpreadPct != null ? normalized.minSpreadPct * 100 : null),
    minimumNetSpreadBps: toNum(spot?.minProfitBps ?? normalized.opportunityThresholdBps ?? 20),
    assumedFeesBps: toNum(normalized.feeBps ?? 10),
    assumedSlippageBps: toNum(normalized.slippageBps ?? 10),
    minimumLiquidity: toNum(normalized.minVolumeUSDT ?? 100000),
    maximumDataAgeMs: toNum(normalized.maximumDataAgeMs ?? 30000),
    scanIntervalSeconds: toNum(normalized.scanIntervalSec ?? 300),
    monitoringState,
    notificationPreference: Boolean(normalized.autoActions?.notifyOnOpportunity),
    notificationDeliveryAvailable: false,
    version: meta.version ?? normalized.settingsVersion ?? 1,
    updatedAt: toIso(meta.updatedAt || normalized.settingsUpdatedAt),
    updatedBy: meta.updatedBy || null,
    executionSupported: false,
    executionEligible: false,
    legacyExecutionPreferenceIgnored: Boolean(
      normalized.execution?.autoExecute || normalized.execution?.autoExecuteStoredPreference,
    ),
  };
}

export function sanitizeConfigForWrite(rawConfig = {}) {
  const next = { ...rawConfig };
  next.execution = {
    ...(next.execution || {}),
    autoExecute: false,
    autoExecuteStoredPreference: Boolean(next.execution?.autoExecute ?? next.execution?.autoExecuteStoredPreference),
    autoExecuteSupported: false,
  };
  next.autoTrade = false;
  if (next.execution?.autoExecute === true) {
    next.execution.autoExecute = false;
  }
  return next;
}

export function validateSettingsInput(input = {}) {
  const errors = [];
  const symbols = Array.isArray(input.monitoredSymbols) ? input.monitoredSymbols : input.symbols;
  if (!symbols || symbols.length === 0) {
    errors.push('At least one monitored symbol is required');
  }
  if (symbols && symbols.length > MAX_SYMBOLS) {
    errors.push(`Maximum ${MAX_SYMBOLS} monitored symbols allowed`);
  }
  const unique = new Set((symbols || []).map((s) => String(s).toUpperCase()));
  if (symbols && unique.size !== symbols.length) {
    errors.push('Duplicate symbols are not allowed');
  }
  for (const sym of symbols || []) {
    if (!/^[A-Z0-9]{5,20}$/.test(String(sym).toUpperCase())) {
      errors.push(`Invalid symbol: ${sym}`);
    }
  }
  const minNet = toNum(input.minimumNetSpreadBps ?? input.opportunityThresholdBps);
  const fees = toNum(input.assumedFeesBps ?? input.feeBps ?? 10);
  const slip = toNum(input.assumedSlippageBps ?? input.slippageBps ?? 10);
  if (minNet != null && minNet < fees + slip) {
    errors.push('Minimum net spread should account for assumed fees and slippage');
  }
  const maxAge = toNum(input.maximumDataAgeMs);
  if (maxAge != null && (maxAge <= 0 || maxAge > 600000)) {
    errors.push('Maximum data age must be between 1ms and 600000ms');
  }
  const interval = toNum(input.scanIntervalSeconds ?? input.scanIntervalSec);
  if (interval != null && (interval < 30 || interval > 3600)) {
    errors.push('Scan interval must be between 30 and 3600 seconds');
  }
  if (input.execution?.autoExecute === true) {
    errors.push('Auto Execute is unsupported and cannot be enabled');
  }
  return { ok: errors.length === 0, errors };
}

export function validatePagination({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(pageSize), 10) || DEFAULT_PAGE_SIZE));
  return { page: p, pageSize: size, offset: (p - 1) * size };
}

export function deriveInterpretation(scanRun, settings) {
  return buildOverviewInterpretation({ latestRun: scanRun, settings }).primaryMessage;
}

export function buildOverviewInterpretation({ latestRun, settings, historicalSummary } = {}) {
  const safeReasonCodes = [];
  let primaryMessage = 'Latest analytical scan completed successfully.';
  const rejectionSummary = latestRun?.rejectionSummary || {};

  if (settings?.monitoringState === MONITORING_STATE.PAUSED) {
    primaryMessage = 'Monitoring is paused; no scheduled scans will run.';
    safeReasonCodes.push('monitoring_paused');
    return { primaryMessage, safeReasonCodes, rejectionSummary };
  }

  if (!latestRun && (historicalSummary?.totalScanRuns || 0) === 0) {
    primaryMessage = 'No analytical scan has completed yet.';
    safeReasonCodes.push('no_scan_history');
    return { primaryMessage, safeReasonCodes, rejectionSummary };
  }

  if (!latestRun && (historicalSummary?.totalScanRuns || 0) > 0) {
    primaryMessage = 'Historical scans exist, but the latest run snapshot is unavailable.';
    safeReasonCodes.push('latest_run_unavailable');
    return { primaryMessage, safeReasonCodes, rejectionSummary };
  }

  if (latestRun?.status === SCAN_RUN_STATUS.FAILED) {
    primaryMessage = latestRun.failureReason
      ? `Latest scan failed: ${latestRun.failureReason}`
      : 'Latest scan failed.';
    safeReasonCodes.push('latest_scan_failed');
    return { primaryMessage, safeReasonCodes, rejectionSummary };
  }

  const funnel = latestRun?.funnel || {};
  const rejected = funnel.rejected || 0;
  const topReason = Object.entries(rejectionSummary).sort((a, b) => b[1] - a[1])[0];

  if (rejected > 0 && topReason) {
    primaryMessage = `${rejected} observation(s) were rejected because estimated net spread was not positive.`;
    safeReasonCodes.push(String(topReason[0]));
  } else if (funnel.qualified === 0 && funnel.analyticalCandidates > 0) {
    primaryMessage =
      'Monitoring is active, but no candidate met the configured net-spread threshold.';
    safeReasonCodes.push('no_qualified_candidates');
  } else if (funnel.analyticalCandidates === 0 && rejected > 0) {
    primaryMessage =
      'All evaluated symbols were rejected because net spread or liquidity thresholds were not met.';
    safeReasonCodes.push('all_symbols_rejected');
  } else if (
    latestRun?.dataFreshnessState === 'measured' &&
    (latestRun?.dataFreshnessMs || latestRun?.sourceFreshnessMs || 0) >
      (settings?.maximumDataAgeMs || 30000)
  ) {
    primaryMessage = 'The latest scan used stale market data for one or more symbols.';
    safeReasonCodes.push('stale_market_data');
  }

  return { primaryMessage, safeReasonCodes, rejectionSummary };
}

export function buildArbitrageOverviewSnapshot({
  agent,
  settings,
  latestRun,
  historicalSummary,
  recentRuns = [],
  schedulerState = {},
  runtimeState = {},
  generatedAt = new Date().toISOString(),
}) {
  const product = getProductIdentity();
  const interpretation = buildOverviewInterpretation({ latestRun, settings, historicalSummary });
  const enrichedHistorical = enrichRunTimingSummary(historicalSummary, latestRun);
  const resolvedLatest = latestRun
    ? {
        ...latestRun,
        ...resolveScanDurationMs({
          durationMs: latestRun.durationMs,
          startedAt: latestRun.startedAt,
          completedAt: latestRun.completedAt,
        }),
        ...(latestRun.dataFreshnessState
          ? {
              dataFreshnessState: latestRun.dataFreshnessState,
              dataFreshnessMs: latestRun.dataFreshnessMs,
              dataFreshnessReason: latestRun.dataFreshnessReason,
            }
          : resolveDataFreshness({
              rawOutput: latestRun.rawOutput || {},
              scanStartedAt: latestRun.startedAt,
            })),
      }
    : null;

  const resolvedRecentRuns = recentRuns.map(run =>
    enrichRecentRunTelemetry(run),
  );

  return {
    generatedAt,
    snapshotAt: generatedAt,
    runTiming: {
      latestRunAt: enrichedHistorical.latestRunAt,
      latestCompletedRunAt: enrichedHistorical.latestCompletedRunAt,
      latestSuccessfulRunAt: enrichedHistorical.latestSuccessfulRunAt,
    },
    productState: {
      productMode: product.activeMode,
      productName: product.displayName,
      monitoringState: settings?.monitoringState || MONITORING_STATE.ACTIVE,
      agentStatus: agent?.status || 'inactive',
      schedulerState: schedulerState?.status || 'unknown',
      runtimeMode: runtimeState?.globalMode || 'demo',
      emergencyStop: runtimeState?.killSwitchActive === true,
      executionSupported: false,
    },
    latestRun: resolvedLatest
      ? {
          latestRunId: resolvedLatest.runId,
          latestRunTrigger: resolvedLatest.trigger,
          latestRunStatus: resolvedLatest.status,
          startedAt: resolvedLatest.startedAt,
          completedAt: resolvedLatest.completedAt,
          durationMs: resolvedLatest.durationMs,
          durationAvailability: resolvedLatest.durationAvailability,
          durationReason: resolvedLatest.durationReason,
          symbolsRequested: latestRun.symbolsRequested || [],
          symbolsEvaluated: latestRun.symbolsEvaluated || [],
          dataFreshnessState: resolvedLatest.dataFreshnessState,
          dataFreshnessMs: resolvedLatest.dataFreshnessMs,
          dataFreshnessReason: resolvedLatest.dataFreshnessReason,
          sourceFreshnessMs: resolvedLatest.dataFreshnessMs,
          rawObservations: latestRun.funnel?.rawObservations ?? 0,
          spreadCandidates: latestRun.funnel?.analyticalCandidates ?? 0,
          rejectedCandidates: latestRun.funnel?.rejected ?? 0,
          qualifiedCandidates: latestRun.funnel?.qualified ?? 0,
          expiredCandidates: latestRun.funnel?.expired ?? 0,
          blockedCandidates: latestRun.funnel?.blocked ?? 0,
          funnel: resolvedLatest.funnel || {},
          rejectionSummary: resolvedLatest.rejectionSummary || {},
          failureReason: resolvedLatest.failureReason || null,
        }
      : null,
    historicalSummary: enrichedHistorical,
    configurationSummary: {
      monitoredSymbolCount: settings?.monitoredSymbols?.length || 0,
      minimumGrossSpreadBps: settings?.minimumGrossSpreadBps,
      minimumNetSpreadBps: settings?.minimumNetSpreadBps,
      assumedFeesBps: settings?.assumedFeesBps,
      assumedSlippageBps: settings?.assumedSlippageBps,
      maximumDataAgeMs: settings?.maximumDataAgeMs,
      settingsVersion: settings?.version ?? 1,
      settingsUpdatedAt: settings?.updatedAt ?? null,
    },
    interpretation,
    product,
    settings,
    totalScanRuns: historicalSummary?.totalScanRuns ?? 0,
    recentRuns: resolvedRecentRuns,
  };
}

export function enrichRecentRunTelemetry(run = {}) {
  const duration = resolveScanDurationMs({
    durationMs: run.durationMs,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  });
  const freshness =
    run.dataFreshnessState != null
      ? {
          dataFreshnessState: run.dataFreshnessState,
          dataFreshnessMs: run.dataFreshnessMs ?? null,
          dataFreshnessReason: run.dataFreshnessReason ?? null,
        }
      : resolveDataFreshness({
          rawOutput: run.rawOutput || {},
          scanStartedAt: run.startedAt,
        });

  return {
    ...run,
    ...duration,
    ...freshness,
    sourceFreshnessMs: freshness.dataFreshnessMs,
  };
}

export function mapDecisionRowToScanRun(row, agentId) {
  const output = row.output_data || {};
  const input = row.input_data || {};
  const symbols = input.config?.symbols || output.config?.symbols || [];
  const startedAt = row.created_at;
  const durationMs = row.execution_time_ms;
  const storedDuration = toNum(durationMs);
  const completedAt =
    storedDuration != null && storedDuration > 0 && startedAt
      ? new Date(new Date(startedAt).getTime() + storedDuration).toISOString()
      : output.completedAt || output.finishedAt || null;

  return buildScanRunDto({
    runId: row.id,
    agentId,
    trigger: input.trigger || output.trigger || 'scheduled',
    startedAt,
    completedAt,
    durationMs,
    status:
      output.error || row.was_successful === false
        ? SCAN_RUN_STATUS.FAILED
        : SCAN_RUN_STATUS.COMPLETED,
    dryRun: output.dryRun !== false,
    runtimeMode: input.input?.effective_mode || output.runtimeMode || 'demo',
    schedulerOwner: output.schedulerOwner || 'titan-engine-worker',
    symbolsRequested: symbols,
    symbolsEvaluated: symbols,
    rawOutput: output,
    failureReason: output.errorMessage || null,
  });
}

export {
  MAX_SYMBOLS,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  ARBITRAGE_DECISION_TYPE,
  ARBITRAGE_ANALYTICAL_MODE,
  ARBITRAGE_STRATEGY_CLASS,
};
