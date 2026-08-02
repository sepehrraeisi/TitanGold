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
import { normalizeArbitrageConfig } from './normalizeArbitrageConfig.js';

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
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
});

export const SCAN_RUN_DATA_CONTRACT_VERSION = '1.0';

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

export const SETTINGS_DEFAULTS = Object.freeze({
  monitoredSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'],
  minimumGrossSpreadBps: 20,
  minimumNetSpreadBps: 20,
  assumedFeesBps: 10,
  assumedSlippageBps: 10,
  minimumLiquidity: 100000,
  maximumDataAgeMs: 30000,
  scanIntervalSeconds: 300,
  notificationPreference: true,
});

export const FIELD_SOURCES = Object.freeze({
  CONFIGURED: 'configured',
  DEFAULT: 'default',
  LEGACY_NORMALIZED: 'legacy_normalized',
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED: 'unsupported',
  BLOCKED: 'blocked',
  READ_ONLY: 'read_only',
});

const ALLOWED_SETTINGS_INPUT_KEYS = new Set([
  'monitoredSymbols',
  'symbols',
  'minimumGrossSpreadBps',
  'minimumNetSpreadBps',
  'opportunityThresholdBps',
  'assumedFeesBps',
  'feeBps',
  'assumedSlippageBps',
  'slippageBps',
  'minimumLiquidity',
  'minVolumeUSDT',
  'maximumDataAgeMs',
  'scanIntervalSeconds',
  'scanIntervalSec',
  'notificationPreference',
  'expectedVersion',
  'version',
  'settings',
]);

const FORBIDDEN_SETTINGS_INPUT_KEYS = new Set([
  'apiKey',
  'apiSecret',
  'secret',
  'password',
  'token',
  'credentials',
  'privateKey',
  'autoExecute',
  'autoTrade',
  'monitoringState',
  'execution',
]);

function isFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function hasOwnConfigured(raw, key) {
  return raw != null && Object.prototype.hasOwnProperty.call(raw, key) && raw[key] != null;
}

function resolveSpotStrategy(raw, normalized) {
  const strategies = Array.isArray(raw?.strategies)
    ? raw.strategies
    : Array.isArray(normalized?.strategies)
      ? normalized.strategies
      : [];
  return strategies.find((s) => s?.type === 'spot' || s?.type === 'mexc_spot_spread_monitor') || null;
}

export const SETTINGS_REASON_CODES = Object.freeze({
  ENGINE_THRESHOLD_READ_ONLY: 'engine_threshold_read_only',
  LIQUIDITY_ENGINE_OWNED: 'liquidity_engine_owned',
  DATA_AGE_INTERPRETATION_ONLY: 'data_age_interpretation_only',
  SCAN_INTERVAL_LEGACY: 'scan_interval_legacy',
  NOTIFICATION_PREFERENCE_ONLY: 'notification_preference_only',
  MONITORING_ACTION_BAR: 'monitoring_action_bar',
  AUTO_EXECUTE_BLOCKED: 'auto_execute_blocked',
});

function buildSettingsField({
  effective,
  configured,
  defaultValue,
  source,
  supported = true,
  editable = true,
  readOnly = false,
  reasonCode = null,
  min = null,
  max = null,
  unit = null,
}) {
  return {
    effective,
    configured,
    defaultValue,
    source,
    supported,
    editable: supported && editable && !readOnly,
    readOnly,
    reasonCode,
    constraints: min != null || max != null ? { min, max } : null,
    unit,
  };
}

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
const PRODUCER_LIFECYCLE_MAP = Object.freeze({
  detected: CANDIDATE_LIFECYCLE.CANDIDATE,
  validated: CANDIDATE_LIFECYCLE.CANDIDATE,
  rejected: CANDIDATE_LIFECYCLE.REJECTED,
  expired: CANDIDATE_LIFECYCLE.EXPIRED,
  simulated: CANDIDATE_LIFECYCLE.CANDIDATE,
  blocked: CANDIDATE_LIFECYCLE.BLOCKED,
  observed: CANDIDATE_LIFECYCLE.OBSERVED,
  candidate: CANDIDATE_LIFECYCLE.CANDIDATE,
  qualified: CANDIDATE_LIFECYCLE.QUALIFIED,
});

export function normalizeCandidateLifecycle(raw = {}) {
  const lc = raw.lifecycle;
  if (lc && PRODUCER_LIFECYCLE_MAP[lc]) return PRODUCER_LIFECYCLE_MAP[lc];
  if (lc && Object.values(CANDIDATE_LIFECYCLE).includes(lc)) return lc;
  if (raw.classification === 'rejected_candidate') return CANDIDATE_LIFECYCLE.REJECTED;
  return CANDIDATE_LIFECYCLE.CANDIDATE;
}

export function buildCandidateFunnelFromItems(items = []) {
  const counts = {
    observed: 0,
    analyticalCandidates: 0,
    rejected: 0,
    qualified: 0,
    expired: 0,
    blocked: 0,
  };
  for (const item of items) {
    switch (item.lifecycleState) {
      case CANDIDATE_LIFECYCLE.OBSERVED:
        counts.observed += 1;
        break;
      case CANDIDATE_LIFECYCLE.CANDIDATE:
        counts.analyticalCandidates += 1;
        break;
      case CANDIDATE_LIFECYCLE.REJECTED:
        counts.rejected += 1;
        break;
      case CANDIDATE_LIFECYCLE.QUALIFIED:
        counts.qualified += 1;
        break;
      case CANDIDATE_LIFECYCLE.EXPIRED:
        counts.expired += 1;
        break;
      case CANDIDATE_LIFECYCLE.BLOCKED:
        counts.blocked += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}

export function buildCandidateAvailableFilters(items = []) {
  const lifecycles = new Set();
  const symbols = new Set();
  const rejectionReasons = new Set();
  const freshnessStates = new Set();

  for (const item of items) {
    if (item.lifecycleState) lifecycles.add(item.lifecycleState);
    if (item.symbol) symbols.add(item.symbol);
    for (const reason of item.rejectionReasons || []) {
      if (reason) rejectionReasons.add(reason);
    }
    if (item.freshnessState) freshnessStates.add(item.freshnessState);
  }

  return {
    lifecycles: [...lifecycles].sort(),
    symbols: [...symbols].sort(),
    rejectionReasons: [...rejectionReasons].sort(),
    freshnessStates: [...freshnessStates].sort(),
  };
}

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
  const lifecycleState = normalizeCandidateLifecycle(raw);
  const observedMs = Date.parse(observedAt) || Date.now();

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
    ageMs: Math.max(0, Date.now() - observedMs),
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
    source: raw.source || raw.venue || 'mexc_public',
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
    durationState: resolvedDuration.durationAvailability,
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
    requestedSymbols: funnel.symbolsRequested,
    evaluatedSymbols: funnel.symbolsEvaluated,
    rawObservationCount: funnel.rawObservations,
    analyticalCandidateCount: funnel.analyticalCandidates,
    rejectedCount: funnel.rejected,
    qualifiedCount: funnel.qualified,
    expiredCount: funnel.expired,
    blockedCount: funnel.blocked,
    rejectionSummary: summarizeRejections(rejected),
    primaryRejectionReasons: buildPrimaryRejectionReasons(summarizeRejections(rejected)),
    rejectionDistribution: summarizeRejections(rejected),
    failureReason,
    failureCode: status === SCAN_RUN_STATUS.FAILED ? (failureReason ? 'scan_failed' : 'unknown') : null,
    failureMessage: failureReason || null,
    sideEffectsSuppressed: true,
    executionSupported: false,
    executionEligible: false,
    createdAt: toIso(startedAt),
    source: 'mexc_public',
    dataContractVersion: SCAN_RUN_DATA_CONTRACT_VERSION,
  };
}

export function buildPrimaryRejectionReasons(rejectionSummary = {}) {
  return Object.entries(rejectionSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code]) => code);
}

export function buildHistorySummary(historicalSummary = {}) {
  return {
    totalScanRuns: historicalSummary.totalScanRuns ?? 0,
    successfulRuns: historicalSummary.successfulRuns ?? 0,
    failedRuns: historicalSummary.failedRuns ?? 0,
    scheduledRuns: historicalSummary.scheduledRuns ?? 0,
    manualRuns: historicalSummary.manualRuns ?? 0,
    latestSuccessfulRunAt: historicalSummary.latestSuccessfulRunAt ?? null,
    latestFailedRunAt: historicalSummary.latestFailedRunAt ?? null,
    latestRunAt: historicalSummary.latestRunAt ?? null,
    latestCompletedRunAt: historicalSummary.latestCompletedRunAt ?? null,
  };
}

const HISTORY_SORT_ALLOWLIST = new Set([
  'startedAt:desc',
  'startedAt:asc',
  'completedAt:desc',
  'completedAt:asc',
]);

export function validateHistoryQuery(filters = {}) {
  const pagination = validatePagination(filters);
  const trigger =
    filters.trigger && ['manual', 'scheduled'].includes(String(filters.trigger))
      ? String(filters.trigger)
      : null;
  const status =
    filters.status && Object.values(SCAN_RUN_STATUS).includes(String(filters.status))
      ? String(filters.status)
      : null;
  const sort = HISTORY_SORT_ALLOWLIST.has(String(filters.sort || ''))
    ? String(filters.sort)
    : 'startedAt:desc';

  let dateFrom = null;
  let dateTo = null;
  if (filters.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (!Number.isNaN(d.getTime())) dateFrom = d.toISOString();
  }
  if (filters.dateTo) {
    const d = new Date(filters.dateTo);
    if (!Number.isNaN(d.getTime())) dateTo = d.toISOString();
  }

  const searchRaw = filters.search ? String(filters.search).trim().slice(0, 64) : '';
  const search = searchRaw || null;

  return {
    ...pagination,
    trigger,
    status,
    sort,
    dateFrom,
    dateTo,
    search,
  };
}

export function compareScanRuns(current = {}, previous = null) {
  if (!previous) {
    return {
      hasPrevious: false,
      triggerContext: current.trigger || null,
      deltas: {},
    };
  }

  const curFunnel = current.funnel || {};
  const prevFunnel = previous.funnel || {};
  const delta = (field) => {
    const a = toNum(curFunnel[field]) ?? toNum(current[`${field}Count`]) ?? 0;
    const b = toNum(prevFunnel[field === 'analyticalCandidates' ? 'analyticalCandidates' : field])
      ?? toNum(previous[`${field}Count`])
      ?? 0;
    return a - b;
  };

  const deltas = {
    evaluatedSymbols: (toNum(curFunnel.symbolsEvaluated) ?? 0) - (toNum(prevFunnel.symbolsEvaluated) ?? 0),
    analyticalCandidates: delta('analyticalCandidates'),
    rejected: delta('rejected'),
    qualified: delta('qualified'),
    durationMs:
      current.durationAvailability === 'measured' && previous.durationAvailability === 'measured'
        ? (toNum(current.durationMs) ?? 0) - (toNum(previous.durationMs) ?? 0)
        : null,
    freshnessMs:
      current.dataFreshnessState === 'measured' && previous.dataFreshnessState === 'measured'
        ? (toNum(current.dataFreshnessMs) ?? 0) - (toNum(previous.dataFreshnessMs) ?? 0)
        : null,
  };

  const rejectionDelta = {};
  const allKeys = new Set([
    ...Object.keys(current.rejectionDistribution || current.rejectionSummary || {}),
    ...Object.keys(previous.rejectionDistribution || previous.rejectionSummary || {}),
  ]);
  for (const key of allKeys) {
    const a = (current.rejectionDistribution || current.rejectionSummary || {})[key] || 0;
    const b = (previous.rejectionDistribution || previous.rejectionSummary || {})[key] || 0;
    rejectionDelta[key] = a - b;
  }

  return {
    hasPrevious: true,
    triggerContext: current.trigger || null,
    previousTrigger: previous.trigger || null,
    deltas: { ...deltas, rejectionDistribution: rejectionDelta },
  };
}

export function buildSettingsDto(rawConfig = {}, meta = {}) {
  const raw = rawConfig || {};
  const normalized = meta.normalizedConfig || normalizeArbitrageConfig(raw);
  const spot = resolveSpotStrategy(raw, normalized);

  const symbolsConfigured = hasOwnConfigured(raw, 'symbols') && Array.isArray(raw.symbols);
  const monitoredSymbols = symbolsConfigured
    ? raw.symbols.map((s) => String(s).toUpperCase())
    : [...SETTINGS_DEFAULTS.monitoredSymbols];

  const grossConfigured = hasOwnConfigured(raw, 'minSpreadPct');
  const minimumGrossSpreadBps = grossConfigured
    ? toNum(raw.minSpreadPct * 100)
    : SETTINGS_DEFAULTS.minimumGrossSpreadBps;

  const netConfigured =
    hasOwnConfigured(raw, 'opportunityThresholdBps')
    || (hasOwnConfigured(raw, 'strategies') && spot?.minProfitBps != null);
  const minimumNetSpreadBps = netConfigured
    ? toNum(raw.opportunityThresholdBps ?? spot?.minProfitBps)
    : toNum(spot?.minProfitBps ?? normalized.opportunityThresholdBps ?? SETTINGS_DEFAULTS.minimumNetSpreadBps);

  const feesConfigured = hasOwnConfigured(raw, 'feeBps');
  const assumedFeesBps = feesConfigured ? toNum(raw.feeBps) : SETTINGS_DEFAULTS.assumedFeesBps;

  const slippageConfigured = hasOwnConfigured(raw, 'slippageBps');
  const assumedSlippageBps = slippageConfigured
    ? toNum(raw.slippageBps)
    : SETTINGS_DEFAULTS.assumedSlippageBps;

  const liquidityConfigured = hasOwnConfigured(raw, 'minVolumeUSDT');
  const minimumLiquidity = liquidityConfigured
    ? toNum(raw.minVolumeUSDT)
    : SETTINGS_DEFAULTS.minimumLiquidity;

  const maxAgeConfigured = hasOwnConfigured(raw, 'maximumDataAgeMs');
  const maximumDataAgeMs = maxAgeConfigured
    ? toNum(raw.maximumDataAgeMs)
    : SETTINGS_DEFAULTS.maximumDataAgeMs;

  const intervalConfigured = hasOwnConfigured(raw, 'scanIntervalSec');
  const scanIntervalSeconds = intervalConfigured
    ? toNum(raw.scanIntervalSec)
    : SETTINGS_DEFAULTS.scanIntervalSeconds;

  const notifyConfigured =
    raw.autoActions != null && Object.prototype.hasOwnProperty.call(raw.autoActions, 'notifyOnOpportunity');
  const notificationPreference = notifyConfigured
    ? Boolean(raw.autoActions.notifyOnOpportunity)
    : SETTINGS_DEFAULTS.notificationPreference;

  const monitoringState =
    raw.monitoringState
    || (raw.enabled === false
      ? MONITORING_STATE.PAUSED
      : normalized.enabled === false
        ? MONITORING_STATE.PAUSED
        : MONITORING_STATE.ACTIVE);

  const legacyAutoExecute =
    Boolean(raw.execution?.autoExecute)
    || Boolean(raw.execution?.autoExecuteStoredPreference)
    || Boolean(raw.autoTrade);

  const version = meta.version ?? raw.settingsVersion ?? 1;
  const updatedAt = toIso(meta.updatedAt || raw.settingsUpdatedAt);
  const updatedBy = meta.updatedBy || null;

  const fields = {
    monitoredSymbols: buildSettingsField({
      effective: monitoredSymbols,
      configured: symbolsConfigured ? monitoredSymbols : null,
      defaultValue: SETTINGS_DEFAULTS.monitoredSymbols,
      source: symbolsConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      editable: true,
      min: 1,
      max: MAX_SYMBOLS,
    }),
    minimumNetSpreadBps: buildSettingsField({
      effective: minimumNetSpreadBps,
      configured: netConfigured ? minimumNetSpreadBps : null,
      defaultValue: SETTINGS_DEFAULTS.minimumNetSpreadBps,
      source: netConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      editable: true,
      min: 0,
      max: 10000,
      unit: 'bps',
    }),
    minimumGrossSpreadBps: buildSettingsField({
      effective: minimumGrossSpreadBps,
      configured: grossConfigured ? minimumGrossSpreadBps : null,
      defaultValue: SETTINGS_DEFAULTS.minimumGrossSpreadBps,
      source: grossConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      readOnly: true,
      editable: false,
      reasonCode: SETTINGS_REASON_CODES.ENGINE_THRESHOLD_READ_ONLY,
      unit: 'bps',
    }),
    assumedFeesBps: buildSettingsField({
      effective: assumedFeesBps,
      configured: feesConfigured ? assumedFeesBps : null,
      defaultValue: SETTINGS_DEFAULTS.assumedFeesBps,
      source: feesConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      editable: true,
      min: 0,
      max: 500,
      unit: 'bps',
    }),
    assumedSlippageBps: buildSettingsField({
      effective: assumedSlippageBps,
      configured: slippageConfigured ? assumedSlippageBps : null,
      defaultValue: SETTINGS_DEFAULTS.assumedSlippageBps,
      source: slippageConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      editable: true,
      min: 0,
      max: 500,
      unit: 'bps',
    }),
    minimumLiquidity: buildSettingsField({
      effective: minimumLiquidity,
      configured: liquidityConfigured ? minimumLiquidity : null,
      defaultValue: SETTINGS_DEFAULTS.minimumLiquidity,
      source: liquidityConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      readOnly: true,
      editable: false,
      reasonCode: SETTINGS_REASON_CODES.LIQUIDITY_ENGINE_OWNED,
      unit: 'USDT',
    }),
    maximumDataAgeMs: buildSettingsField({
      effective: maximumDataAgeMs,
      configured: maxAgeConfigured ? maximumDataAgeMs : null,
      defaultValue: SETTINGS_DEFAULTS.maximumDataAgeMs,
      source: maxAgeConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      editable: true,
      min: 1,
      max: 600000,
      unit: 'ms',
      reasonCode: SETTINGS_REASON_CODES.DATA_AGE_INTERPRETATION_ONLY,
    }),
    scanIntervalSeconds: buildSettingsField({
      effective: scanIntervalSeconds,
      configured: intervalConfigured ? scanIntervalSeconds : null,
      defaultValue: SETTINGS_DEFAULTS.scanIntervalSeconds,
      source: intervalConfigured ? FIELD_SOURCES.LEGACY_NORMALIZED : FIELD_SOURCES.DEFAULT,
      readOnly: true,
      editable: false,
      reasonCode: SETTINGS_REASON_CODES.SCAN_INTERVAL_LEGACY,
      unit: 's',
    }),
    notificationPreference: buildSettingsField({
      effective: notificationPreference,
      configured: notifyConfigured ? notificationPreference : null,
      defaultValue: SETTINGS_DEFAULTS.notificationPreference,
      source: notifyConfigured ? FIELD_SOURCES.CONFIGURED : FIELD_SOURCES.DEFAULT,
      editable: true,
      reasonCode: SETTINGS_REASON_CODES.NOTIFICATION_PREFERENCE_ONLY,
    }),
    monitoringState: buildSettingsField({
      effective: monitoringState,
      configured: hasOwnConfigured(raw, 'monitoringState') ? monitoringState : null,
      defaultValue: MONITORING_STATE.ACTIVE,
      source: hasOwnConfigured(raw, 'monitoringState')
        ? FIELD_SOURCES.CONFIGURED
        : raw.enabled === false
          ? FIELD_SOURCES.CONFIGURED
          : FIELD_SOURCES.DEFAULT,
      readOnly: true,
      editable: false,
      reasonCode: SETTINGS_REASON_CODES.MONITORING_ACTION_BAR,
    }),
    autoExecute: buildSettingsField({
      effective: false,
      configured: legacyAutoExecute ? true : null,
      defaultValue: false,
      source: legacyAutoExecute ? FIELD_SOURCES.LEGACY_NORMALIZED : FIELD_SOURCES.BLOCKED,
      supported: false,
      editable: false,
      readOnly: true,
      reasonCode: SETTINGS_REASON_CODES.AUTO_EXECUTE_BLOCKED,
    }),
  };

  const unsupportedCapabilities = [
    { id: 'auto_execute', state: 'blocked', legacyStoredPreference: legacyAutoExecute },
    { id: 'triangular_arbitrage', state: 'unsupported' },
    { id: 'cross_exchange_arbitrage', state: 'unsupported' },
    { id: 'futures_basis', state: 'unsupported' },
    { id: 'settlement_transfers', state: 'unsupported' },
    { id: 'private_account_execution', state: 'unsupported' },
  ];

  return {
    monitoredSymbols,
    minimumGrossSpreadBps,
    minimumNetSpreadBps,
    assumedFeesBps,
    assumedSlippageBps,
    minimumLiquidity,
    maximumDataAgeMs,
    scanIntervalSeconds,
    monitoringState,
    notificationPreference,
    notificationDeliveryAvailable: false,
    version,
    updatedAt,
    updatedBy,
    executionSupported: false,
    executionEligible: false,
    legacyExecutionPreferenceIgnored: legacyAutoExecute,
    fields,
    unsupportedCapabilities,
    dataContractVersion: '1.0',
  };
}

export const INTEGRATIONS_DATA_CONTRACT_VERSION = '1.0';

export const INTEGRATION_OPERATIONAL_STATE = Object.freeze({
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  LIMITED: 'limited',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  NOT_REQUIRED: 'not_required',
  UNKNOWN: 'unknown',
});

export const INTEGRATION_VERIFICATION_STATE = Object.freeze({
  VERIFIED: 'verified',
  INFERRED: 'inferred',
  UNVERIFIED: 'unverified',
  UNKNOWN: 'unknown',
});

export const INTEGRATIONS_REASON_CODES = Object.freeze({
  PUBLIC_SPOT_NO_CREDENTIALS: 'public_spot_no_credentials',
  PUBLIC_DATA_NOT_EXECUTION: 'public_data_not_execution',
  PROXY_CONFIGURED: 'proxy_configured',
  PROXY_EVIDENCE_FROM_SCAN: 'proxy_evidence_from_scan',
  PROXY_BLOCKS_SCANS: 'proxy_blocks_scans',
  PROXY_EVIDENCE_UNAVAILABLE: 'proxy_evidence_unavailable',
  SCHEDULER_OWNER_WORKER: 'scheduler_owner_worker',
  SCHEDULER_STALE: 'scheduler_stale',
  SCHEDULER_NOT_REGISTERED: 'scheduler_not_registered',
  SCHEDULER_NOT_ALLOWLISTED: 'scheduler_not_allowlisted',
  SCHEDULER_MONITORING_PAUSED: 'scheduler_monitoring_paused',
  REDIS_CONFIGURED: 'redis_configured',
  REDIS_UNVERIFIED: 'redis_unverified',
  REDIS_MEMORY_FALLBACK: 'redis_memory_fallback',
  REDIS_UNAVAILABLE: 'redis_unavailable',
  PERSISTENCE_AVAILABLE: 'persistence_available',
  PERSISTENCE_NO_RUNS: 'persistence_no_runs',
  NOTIFICATION_PREFERENCE_STORED: 'notification_preference_stored',
  NOTIFICATION_DELIVERY_DISABLED: 'notification_delivery_disabled',
  PRIVATE_CONNECTIONS_NOT_REQUIRED: 'private_connections_not_required',
  EXECUTION_NOT_SUPPORTED: 'execution_not_supported',
  EXECUTION_DEMO_RUNTIME: 'execution_demo_runtime',
  EXECUTION_EMERGENCY_STOP: 'execution_emergency_stop',
  EXECUTION_LIVE_UNAVAILABLE: 'execution_live_unavailable',
});

const MARKET_PROXY_BASE_PATH = '/api/market/mexc';

function buildIntegrationItem(partial = {}) {
  return {
    id: partial.id,
    productLabelKey: partial.productLabelKey,
    category: partial.category,
    configured: partial.configured === true,
    operationalState: partial.operationalState || INTEGRATION_OPERATIONAL_STATE.UNKNOWN,
    verificationState: partial.verificationState || INTEGRATION_VERIFICATION_STATE.UNKNOWN,
    requiredForMonitoring: partial.requiredForMonitoring === true,
    requiredForExecution: partial.requiredForExecution === true,
    owner: partial.owner ?? null,
    dependency: partial.dependency ?? null,
    lastCheckedAt: partial.lastCheckedAt ?? null,
    lastSuccessfulAt: partial.lastSuccessfulAt ?? null,
    evidenceSource: partial.evidenceSource ?? null,
    reasonCode: partial.reasonCode ?? null,
    consumerImpact: partial.consumerImpact ?? null,
    action: partial.action ?? null,
    technicalDetails: partial.technicalDetails ?? null,
  };
}

function resolveScanEvidence(latestScanRow) {
  if (!latestScanRow) {
    return {
      hasSuccessfulScan: false,
      lastSuccessfulAt: null,
      lastAttemptAt: null,
      scanFailed: false,
      failureReason: null,
    };
  }
  const successful = latestScanRow.was_successful === true;
  const output = latestScanRow.output_data || {};
  return {
    hasSuccessfulScan: successful,
    lastSuccessfulAt: successful ? toIso(latestScanRow.created_at) : null,
    lastAttemptAt: toIso(latestScanRow.created_at),
    scanFailed: latestScanRow.was_successful === false,
    failureReason: output.errorMessage || output.error || null,
  };
}

function resolveSchedulerDimensions(schedulerRead = {}, monitoringState = MONITORING_STATE.ACTIVE) {
  const status = schedulerRead.status || null;
  const allowlist = Array.isArray(status?.allowlist) ? status.allowlist : [];
  const registeredJobs = Array.isArray(status?.registeredJobs) ? status.registeredJobs : [];
  const arbitrageAllowlisted = allowlist.includes('arbitrage');
  const arbitrageRegistered =
    registeredJobs.includes('arbitrage')
    || registeredJobs.some((job) => String(job).toLowerCase().includes('arbitrage'));
  const monitoringPaused = monitoringState === MONITORING_STATE.PAUSED;
  const lastRun = status?.lastRun || null;
  const lastArbitrageRunAt =
    lastRun?.agentKey === 'arbitrage' || lastRun?.agentId
      ? toIso(lastRun?.completedAt || lastRun?.startedAt || status?.lastSuccessAt)
      : toIso(status?.lastSuccessAt);

  return {
    owner: status?.owner || 'titan-engine-worker',
    registered: Boolean(status && (arbitrageRegistered || arbitrageAllowlisted)),
    enabled: status?.agentsEnabled === true,
    allowlisted: arbitrageAllowlisted,
    scheduled: arbitrageAllowlisted && status?.agentsEnabled === true && !monitoringPaused,
    monitoringState,
    lastTickAt: toIso(status?.lastTickAt),
    lastSuccessfulArbitrageRunAt: lastArbitrageRunAt,
    stale: schedulerRead.stale === true,
    source: schedulerRead.source || 'unknown',
    pid: status?.pid ?? null,
  };
}

function resolveExecutionBlockedReasons(runtimeState = {}, executionSupported = false) {
  const reasons = [];
  if (!executionSupported) reasons.push(INTEGRATIONS_REASON_CODES.EXECUTION_NOT_SUPPORTED);
  if (normalizeMode(runtimeState?.globalMode) === 'demo') {
    reasons.push(INTEGRATIONS_REASON_CODES.EXECUTION_DEMO_RUNTIME);
  }
  if (runtimeState?.killSwitchActive === true) {
    reasons.push(INTEGRATIONS_REASON_CODES.EXECUTION_EMERGENCY_STOP);
  }
  reasons.push(INTEGRATIONS_REASON_CODES.EXECUTION_LIVE_UNAVAILABLE);
  return reasons;
}

function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase();
  return m === 'live' ? 'live' : 'demo';
}

/**
 * Canonical read-only Integrations DTO for the Arbitrage analytical monitor.
 */
export function buildArbitrageIntegrationsDto(context = {}) {
  const generatedAt = new Date().toISOString();
  const product = context.product || getProductIdentity();
  const settings = context.settings || buildSettingsDto(context.rawConfig || {});
  const scanEvidence = resolveScanEvidence(context.latestScanRow);
  const historical = context.historicalSummary || {};
  const schedulerDims = resolveSchedulerDimensions(
    context.schedulerRead || {},
    settings.monitoringState,
  );
  const runtimeState = context.runtimeState || {};
  const redisConfigured = context.redisConfigured === true;
  const redisVerificationState = context.redisVerificationState
    || (redisConfigured
      ? INTEGRATION_VERIFICATION_STATE.UNVERIFIED
      : INTEGRATION_VERIFICATION_STATE.UNKNOWN);
  const executionSupported = false;
  const executionBlockedReasons = resolveExecutionBlockedReasons(runtimeState, executionSupported);
  const livePossible =
    normalizeMode(runtimeState.globalMode) === 'live'
    && runtimeState.killSwitchActive !== true
    && executionSupported;

  const mexcOperationalState = scanEvidence.hasSuccessfulScan
    ? INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
    : scanEvidence.scanFailed
      ? INTEGRATION_OPERATIONAL_STATE.DEGRADED
      : historical.totalScanRuns > 0
        ? INTEGRATION_OPERATIONAL_STATE.DEGRADED
        : INTEGRATION_OPERATIONAL_STATE.UNKNOWN;

  const mexcVerificationState = scanEvidence.hasSuccessfulScan
    ? INTEGRATION_VERIFICATION_STATE.VERIFIED
    : historical.totalScanRuns > 0
      ? INTEGRATION_VERIFICATION_STATE.INFERRED
      : INTEGRATION_VERIFICATION_STATE.UNKNOWN;

  const proxyOperationalState = scanEvidence.hasSuccessfulScan
    ? INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
    : scanEvidence.scanFailed
      ? INTEGRATION_OPERATIONAL_STATE.UNAVAILABLE
      : INTEGRATION_OPERATIONAL_STATE.UNKNOWN;

  const proxyVerificationState = scanEvidence.hasSuccessfulScan
    ? INTEGRATION_VERIFICATION_STATE.INFERRED
    : INTEGRATION_VERIFICATION_STATE.UNKNOWN;

  const schedulerOperationalState = !schedulerDims.registered
    ? INTEGRATION_OPERATIONAL_STATE.UNAVAILABLE
    : !schedulerDims.allowlisted
      ? INTEGRATION_OPERATIONAL_STATE.LIMITED
      : schedulerDims.stale
        ? INTEGRATION_OPERATIONAL_STATE.DEGRADED
        : schedulerDims.scheduled
          ? INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
          : INTEGRATION_OPERATIONAL_STATE.LIMITED;

  const redisOperationalState = redisConfigured
    ? redisVerificationState === INTEGRATION_VERIFICATION_STATE.VERIFIED
      ? INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
      : INTEGRATION_OPERATIONAL_STATE.DEGRADED
    : INTEGRATION_OPERATIONAL_STATE.LIMITED;

  const persistenceOperationalState = historical.totalScanRuns > 0
    ? INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
    : INTEGRATION_OPERATIONAL_STATE.DEGRADED;

  const notificationPreferenceStored =
    settings.fields?.notificationPreference?.source === 'configured'
    || settings.notificationPreference != null;

  const items = [
    buildIntegrationItem({
      id: 'mexc_public_market_data',
      productLabelKey: 'arb_int_item_mexc_public',
      category: 'data_pipeline',
      configured: true,
      operationalState: mexcOperationalState,
      verificationState: mexcVerificationState,
      requiredForMonitoring: true,
      requiredForExecution: false,
      owner: 'mexc-public-market-data',
      dependency: 'MEXC spot public ticker and depth via internal proxy',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: scanEvidence.lastSuccessfulAt,
      evidenceSource: scanEvidence.hasSuccessfulScan ? 'ai_decisions.latest_scan' : null,
      reasonCode: INTEGRATIONS_REASON_CODES.PUBLIC_SPOT_NO_CREDENTIALS,
      consumerImpact: 'analytical_scan_market_observations',
      technicalDetails: {
        credentialRequired: false,
        privateAccountIntegration: false,
        authorizesExecution: false,
        exchangeId: 'mexc',
        dataClass: 'public_spot',
      },
    }),
    buildIntegrationItem({
      id: 'internal_market_proxy',
      productLabelKey: 'arb_int_item_market_proxy',
      category: 'data_pipeline',
      configured: true,
      operationalState: proxyOperationalState,
      verificationState: proxyVerificationState,
      requiredForMonitoring: true,
      requiredForExecution: false,
      owner: 'market-proxy-route',
      dependency: MARKET_PROXY_BASE_PATH,
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: scanEvidence.lastSuccessfulAt,
      evidenceSource: scanEvidence.hasSuccessfulScan ? 'ai_decisions.latest_scan' : null,
      reasonCode: scanEvidence.hasSuccessfulScan
        ? INTEGRATIONS_REASON_CODES.PROXY_EVIDENCE_FROM_SCAN
        : scanEvidence.scanFailed
          ? INTEGRATIONS_REASON_CODES.PROXY_BLOCKS_SCANS
          : INTEGRATIONS_REASON_CODES.PROXY_EVIDENCE_UNAVAILABLE,
      consumerImpact: scanEvidence.scanFailed ? 'blocks_analytical_scans' : 'feeds_public_market_data',
      technicalDetails: {
        basePath: MARKET_PROXY_BASE_PATH,
        readOnly: true,
        blocksScansWhenUnavailable: true,
      },
    }),
    buildIntegrationItem({
      id: 'scheduler',
      productLabelKey: 'arb_int_item_scheduler',
      category: 'runtime_orchestration',
      configured: schedulerDims.registered,
      operationalState: schedulerOperationalState,
      verificationState: schedulerDims.stale
        ? INTEGRATION_VERIFICATION_STATE.INFERRED
        : schedulerDims.lastTickAt
          ? INTEGRATION_VERIFICATION_STATE.VERIFIED
          : INTEGRATION_VERIFICATION_STATE.UNKNOWN,
      requiredForMonitoring: true,
      requiredForExecution: false,
      owner: schedulerDims.owner,
      dependency: 'analytical_scheduler_status',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: schedulerDims.lastSuccessfulArbitrageRunAt,
      evidenceSource: schedulerDims.lastTickAt ? 'scheduler_status_cache' : null,
      reasonCode: !schedulerDims.allowlisted
        ? INTEGRATIONS_REASON_CODES.SCHEDULER_NOT_ALLOWLISTED
        : schedulerDims.stale
          ? INTEGRATIONS_REASON_CODES.SCHEDULER_STALE
          : INTEGRATIONS_REASON_CODES.SCHEDULER_OWNER_WORKER,
      consumerImpact: 'scheduled_analytical_scans',
      technicalDetails: {
        dimensions: {
          owner: schedulerDims.owner,
          registered: schedulerDims.registered,
          enabled: schedulerDims.enabled,
          allowlisted: schedulerDims.allowlisted,
          scheduled: schedulerDims.scheduled,
          monitoringState: schedulerDims.monitoringState,
          allowlist: schedulerDims.allowlisted ? ['arbitrage'] : [],
          lastTickAt: schedulerDims.lastTickAt,
          lastSuccessfulArbitrageRunAt: schedulerDims.lastSuccessfulArbitrageRunAt,
          stale: schedulerDims.stale,
          statusSource: schedulerDims.source,
          pid: schedulerDims.pid,
        },
      },
    }),
    buildIntegrationItem({
      id: 'redis_scan_lock',
      productLabelKey: 'arb_int_item_redis_lock',
      category: 'runtime_orchestration',
      configured: redisConfigured,
      operationalState: redisOperationalState,
      verificationState: redisVerificationState,
      requiredForMonitoring: false,
      requiredForExecution: false,
      owner: 'arbitrage-scan-lock',
      dependency: context.redisKeyPrefix || 'titan:arbitrage:scan_lock:',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: null,
      evidenceSource: redisConfigured ? 'runtime_redis_client' : null,
      reasonCode: redisConfigured
        ? INTEGRATIONS_REASON_CODES.REDIS_CONFIGURED
        : INTEGRATIONS_REASON_CODES.REDIS_MEMORY_FALLBACK,
      consumerImpact: redisConfigured ? 'duplicate_scan_protection' : 'memory_fallback_duplicate_protection',
      technicalDetails: {
        fallback: 'memory',
        ttlSec: context.redisTtlSec ?? 120,
        duplicateScanProtection: redisConfigured ? 'redis_primary_with_memory_fallback' : 'memory_only',
      },
    }),
    buildIntegrationItem({
      id: 'database_persistence',
      productLabelKey: 'arb_int_item_database',
      category: 'persistence',
      configured: true,
      operationalState: persistenceOperationalState,
      verificationState: INTEGRATION_VERIFICATION_STATE.VERIFIED,
      requiredForMonitoring: true,
      requiredForExecution: false,
      owner: 'ai_decisions',
      dependency: ARBITRAGE_DECISION_TYPE,
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: historical.latestSuccessfulRunAt || scanEvidence.lastSuccessfulAt,
      evidenceSource: 'ai_decisions.summary_query',
      reasonCode: historical.totalScanRuns > 0
        ? INTEGRATIONS_REASON_CODES.PERSISTENCE_AVAILABLE
        : INTEGRATIONS_REASON_CODES.PERSISTENCE_NO_RUNS,
      consumerImpact: historical.totalScanRuns > 0 ? 'scan_history_available' : 'history_empty_until_first_scan',
      technicalDetails: {
        decisionType: ARBITRAGE_DECISION_TYPE,
        totalScanRuns: historical.totalScanRuns ?? 0,
        readOnlyHistory: true,
      },
    }),
    buildIntegrationItem({
      id: 'notification_preference',
      productLabelKey: 'arb_int_item_notification_preference',
      category: 'notifications',
      configured: notificationPreferenceStored,
      operationalState: notificationPreferenceStored
        ? INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
        : INTEGRATION_OPERATIONAL_STATE.DEGRADED,
      verificationState: notificationPreferenceStored
        ? INTEGRATION_VERIFICATION_STATE.VERIFIED
        : INTEGRATION_VERIFICATION_STATE.INFERRED,
      requiredForMonitoring: false,
      requiredForExecution: false,
      owner: 'arbitrage_settings',
      dependency: 'agent.config.autoActions.notifyOnOpportunity',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: settings.updatedAt,
      evidenceSource: 'settings_dto',
      reasonCode: INTEGRATIONS_REASON_CODES.NOTIFICATION_PREFERENCE_STORED,
      consumerImpact: 'stores_user_preference_only',
      action: {
        type: 'navigate',
        target: 'settings',
        labelKey: 'arb_int_action_open_settings',
      },
    }),
    buildIntegrationItem({
      id: 'notification_delivery',
      productLabelKey: 'arb_int_item_notification_delivery',
      category: 'notifications',
      configured: false,
      operationalState: INTEGRATION_OPERATIONAL_STATE.UNAVAILABLE,
      verificationState: INTEGRATION_VERIFICATION_STATE.VERIFIED,
      requiredForMonitoring: false,
      requiredForExecution: false,
      owner: 'notification_platform',
      dependency: 'delivery_pipeline',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: null,
      evidenceSource: 'product_contract',
      reasonCode: INTEGRATIONS_REASON_CODES.NOTIFICATION_DELIVERY_DISABLED,
      consumerImpact: 'no_outbound_alerts_for_analytical_scans',
      technicalDetails: {
        deliveryImplemented: false,
        deliveryOperational: false,
        channels: ['dashboard'],
      },
    }),
    buildIntegrationItem({
      id: 'connections_private_mexc',
      productLabelKey: 'arb_int_item_connections',
      category: 'connections',
      configured: false,
      operationalState: INTEGRATION_OPERATIONAL_STATE.NOT_REQUIRED,
      verificationState: INTEGRATION_VERIFICATION_STATE.VERIFIED,
      requiredForMonitoring: false,
      requiredForExecution: true,
      owner: 'settings_connections',
      dependency: 'private_mexc_connection',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: null,
      evidenceSource: 'product_contract',
      reasonCode: INTEGRATIONS_REASON_CODES.PRIVATE_CONNECTIONS_NOT_REQUIRED,
      consumerImpact: 'not_required_for_public_data_monitor',
      action: {
        type: 'navigate',
        target: 'connections',
        labelKey: 'arb_int_action_manage_connections',
        contextual: true,
      },
      technicalDetails: {
        privateCredentialsRequiredForMonitor: false,
        improvesAnalyticalScans: false,
      },
    }),
    buildIntegrationItem({
      id: 'financial_execution',
      productLabelKey: 'arb_int_item_execution',
      category: 'execution',
      configured: false,
      operationalState: INTEGRATION_OPERATIONAL_STATE.BLOCKED,
      verificationState: INTEGRATION_VERIFICATION_STATE.VERIFIED,
      requiredForMonitoring: false,
      requiredForExecution: true,
      owner: 'runtime_execution_policy',
      dependency: 'global_execution_runtime',
      lastCheckedAt: generatedAt,
      lastSuccessfulAt: null,
      evidenceSource: 'runtime_execution_state',
      reasonCode: executionBlockedReasons[0] || INTEGRATIONS_REASON_CODES.EXECUTION_NOT_SUPPORTED,
      consumerImpact: 'no_orders_settlement_or_transfers',
      technicalDetails: {
        executionSupported,
        executionEligible: false,
        demoRuntime: normalizeMode(runtimeState.globalMode) === 'demo',
        emergencyStopActive: runtimeState.killSwitchActive === true,
        livePossible,
        blockedReasons: executionBlockedReasons,
      },
    }),
  ];

  const publicDataReady =
    mexcOperationalState === INTEGRATION_OPERATIONAL_STATE.OPERATIONAL
    || mexcOperationalState === INTEGRATION_OPERATIONAL_STATE.DEGRADED;
  const schedulingReady =
    schedulerDims.allowlisted
    && schedulerDims.enabled
    && schedulerOperationalState !== INTEGRATION_OPERATIONAL_STATE.UNAVAILABLE;
  const persistenceReady = persistenceOperationalState !== INTEGRATION_OPERATIONAL_STATE.UNAVAILABLE;
  const notificationDeliveryReady = false;
  const executionReady = false;

  const limitations = [
    {
      code: 'execution_not_supported',
      labelKey: 'arb_int_limit_execution_not_supported',
    },
    {
      code: 'notification_delivery_disabled',
      labelKey: 'arb_int_limit_notification_delivery',
    },
    {
      code: 'private_credentials_not_required',
      labelKey: 'arb_int_limit_private_not_required',
    },
  ];

  if (!schedulerDims.allowlisted) {
    limitations.push({
      code: 'scheduler_not_allowlisted',
      labelKey: 'arb_int_limit_scheduler_allowlist',
    });
  }

  const availableActions = [
    { id: 'open_settings', labelKey: 'arb_int_action_open_settings', target: 'settings' },
    { id: 'view_scan_history', labelKey: 'arb_int_action_view_history', target: 'history' },
    {
      id: 'manage_connections',
      labelKey: 'arb_int_action_manage_connections',
      target: 'connections',
      contextual: true,
    },
  ];

  let overallState = 'ready';
  let overallReasonCode = 'monitoring_ready';
  if (!publicDataReady && !persistenceReady) {
    overallState = 'limited';
    overallReasonCode = 'monitoring_limited';
  } else if (!schedulingReady || schedulerDims.stale) {
    overallState = 'degraded';
    overallReasonCode = schedulerDims.stale ? 'scheduler_stale' : 'scheduling_degraded';
  } else if (mexcOperationalState === INTEGRATION_OPERATIONAL_STATE.UNKNOWN) {
    overallState = 'degraded';
    overallReasonCode = 'market_data_unverified';
  }

  return {
    productId: product.agentKey || PRODUCT_ID,
    generatedAt,
    dataContractVersion: INTEGRATIONS_DATA_CONTRACT_VERSION,
    overallState,
    overallReasonCode,
    publicDataReady,
    schedulingReady,
    persistenceReady,
    notificationDeliveryReady,
    executionReady,
    items,
    limitations,
    availableActions,
    executionSupported: false,
    executionEligible: false,
    dataSources: ['MEXC spot (public market data)'],
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
  const codes = [];
  const payload = input?.settings && typeof input.settings === 'object' ? input.settings : input;

  for (const key of Object.keys(payload || {})) {
    if (FORBIDDEN_SETTINGS_INPUT_KEYS.has(key)) {
      errors.push(`Field "${key}" is not allowed in settings updates`);
      codes.push('FORBIDDEN_FIELD');
    } else if (!ALLOWED_SETTINGS_INPUT_KEYS.has(key)) {
      errors.push(`Unknown field "${key}" is not supported`);
      codes.push('UNKNOWN_FIELD');
    }
  }

  if (payload?.execution?.autoExecute === true || payload?.autoExecute === true) {
    errors.push('Auto Execute is unsupported and cannot be enabled');
    codes.push('AUTO_EXECUTE_BLOCKED');
  }

  const symbols = Array.isArray(payload?.monitoredSymbols)
    ? payload.monitoredSymbols
    : payload?.symbols;
  if (!symbols || symbols.length === 0) {
    errors.push('At least one monitored symbol is required');
    codes.push('SYMBOLS_REQUIRED');
  }
  if (symbols && symbols.length > MAX_SYMBOLS) {
    errors.push(`Maximum ${MAX_SYMBOLS} monitored symbols allowed`);
    codes.push('SYMBOLS_LIMIT');
  }
  const unique = new Set((symbols || []).map((s) => String(s).toUpperCase()));
  if (symbols && unique.size !== symbols.length) {
    errors.push('Duplicate symbols are not allowed');
    codes.push('SYMBOLS_DUPLICATE');
  }
  for (const sym of symbols || []) {
    if (!/^[A-Z0-9]{5,20}$/.test(String(sym).toUpperCase())) {
      errors.push(`Invalid symbol: ${sym}`);
      codes.push('SYMBOL_INVALID');
    }
  }

  const numericChecks = [
    ['minimumNetSpreadBps', 0, 10000, 'NET_SPREAD_RANGE'],
    ['minimumGrossSpreadBps', 0, 10000, 'GROSS_SPREAD_RANGE'],
    ['assumedFeesBps', 0, 500, 'FEES_RANGE'],
    ['assumedSlippageBps', 0, 500, 'SLIPPAGE_RANGE'],
    ['minimumLiquidity', 0, 1_000_000_000, 'LIQUIDITY_RANGE'],
    ['maximumDataAgeMs', 1, 600000, 'DATA_AGE_RANGE'],
    ['scanIntervalSeconds', 30, 3600, 'SCAN_INTERVAL_RANGE'],
  ];

  for (const [field, min, max, code] of numericChecks) {
    if (payload?.[field] == null) continue;
    const value = Number(payload[field]);
    if (!Number.isFinite(value)) {
      errors.push(`${field} must be a finite number`);
      codes.push('NUMERIC_INVALID');
    } else if (value < min || value > max) {
      errors.push(`${field} must be between ${min} and ${max}`);
      codes.push(code);
    }
  }

  const minNet = toNum(payload?.minimumNetSpreadBps ?? payload?.opportunityThresholdBps);
  const fees = toNum(payload?.assumedFeesBps ?? payload?.feeBps ?? SETTINGS_DEFAULTS.assumedFeesBps);
  const slip = toNum(payload?.assumedSlippageBps ?? payload?.slippageBps ?? SETTINGS_DEFAULTS.assumedSlippageBps);
  if (minNet != null && minNet < fees + slip) {
    errors.push('Minimum net spread should account for assumed fees and slippage');
    codes.push('NET_SPREAD_TOO_LOW');
  }

  if (payload?.notificationPreference != null && typeof payload.notificationPreference !== 'boolean') {
    errors.push('notificationPreference must be a boolean');
    codes.push('BOOLEAN_INVALID');
  }

  return { ok: errors.length === 0, errors, codes };
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
