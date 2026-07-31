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
