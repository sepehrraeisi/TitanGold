/**
 * TREND-CORE — Canonical Trend Detection product DTOs and mappers.
 */

export const TREND_DECISION_TYPE = 'trend_analysis';
export const TREND_AGENT_KEY = 'trend';

export const TREND_DIRECTION = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  SIDEWAYS: 'sideways',
  MIXED: 'mixed',
  UNAVAILABLE: 'unavailable',
};

export const TREND_REGIME = {
  TRENDING: 'trending',
  RANGING: 'ranging',
  TRANSITION: 'transition',
  UNAVAILABLE: 'unavailable',
};

export const RUN_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  RUNNING: 'running',
};

const VALID_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']);

export function normalizeDirection(raw) {
  if (!raw) return TREND_DIRECTION.UNAVAILABLE;
  const v = String(raw).toLowerCase();
  if (v === 'up' || v === 'bullish') return TREND_DIRECTION.BULLISH;
  if (v === 'down' || v === 'bearish') return TREND_DIRECTION.BEARISH;
  if (v === 'sideways' || v === 'neutral') return TREND_DIRECTION.SIDEWAYS;
  if (v === 'mixed') return TREND_DIRECTION.MIXED;
  return TREND_DIRECTION.UNAVAILABLE;
}

export function classifyRegime(direction, adxStrength, adxValue) {
  if (direction === TREND_DIRECTION.UNAVAILABLE) return TREND_REGIME.UNAVAILABLE;
  const adx = Number(adxValue);
  if (!Number.isFinite(adx)) return TREND_REGIME.UNAVAILABLE;
  if (adx < 20 || direction === TREND_DIRECTION.SIDEWAYS) return TREND_REGIME.RANGING;
  if (direction === TREND_DIRECTION.MIXED) return TREND_REGIME.TRANSITION;
  if (adx >= 20 && (direction === TREND_DIRECTION.BULLISH || direction === TREND_DIRECTION.BEARISH)) {
    return TREND_REGIME.TRENDING;
  }
  return TREND_REGIME.TRANSITION;
}

function mapRawDirectionStrength(rawTrend) {
  if (!rawTrend) return { direction: TREND_DIRECTION.UNAVAILABLE, strength: null };
  return {
    direction: normalizeDirection(rawTrend.direction),
    strength: rawTrend.strength ? String(rawTrend.strength) : null,
  };
}

function buildEvidenceItems(raw) {
  const supporting = [];
  const conflicting = [];

  const push = (list, item) => list.push(item);

  if (raw?.adx?.value != null) {
    const adxItem = {
      indicatorId: 'adx',
      displayKey: 'trend_indicator_adx',
      value: raw.adx.value,
      interpretation: raw.adx.interpretation || null,
      contribution: raw.adx.di_plus > raw.adx.di_minus ? 'bullish' : raw.adx.di_minus > raw.adx.di_plus ? 'bearish' : 'neutral',
      evidenceType: 'supporting',
      available: true,
    };
    if (raw.adx.strength === 'weak') {
      push(conflicting, { ...adxItem, evidenceType: 'conflicting', interpretationKey: 'trend_evidence_weak_adx' });
    } else {
      push(supporting, adxItem);
    }
  }

  if (raw?.moving_averages?.signal) {
    const ma = raw.moving_averages;
    const item = {
      indicatorId: 'moving_averages',
      displayKey: 'trend_indicator_ma',
      value: null,
      interpretation: ma.signal.description || null,
      contribution: ma.signal.signal || 'neutral',
      evidenceType: ma.signal.signal?.includes('bullish') ? 'supporting' : ma.signal.signal?.includes('bearish') ? 'supporting' : 'neutral',
      available: true,
    };
    if (ma.signal.signal?.startsWith('neutral')) {
      push(conflicting, { ...item, evidenceType: 'conflicting' });
    } else {
      push(supporting, item);
    }
  }

  return { supporting, conflicting };
}

function mapWeakeningReversal(raw) {
  const weakening = [];
  const reversal = [];

  if (raw?.adx?.strength === 'weak') {
    weakening.push({
      type: 'weak_trend_strength',
      displayKey: 'trend_weakening_adx',
      severity: 'low',
      available: true,
    });
  }

  for (const signal of raw?.reversal_signals || []) {
    reversal.push({
      type: signal.type,
      displayKey: 'trend_reversal_signal',
      description: signal.description,
      strength: signal.strength,
      confidence: signal.confidence,
      available: true,
    });
  }

  return { weakening, reversal };
}

export function buildTrendSnapshot(raw, meta = {}) {
  if (!raw || raw.error) {
    return {
      symbol: raw?.symbol || null,
      timeframe: raw?.timeframe || null,
      direction: TREND_DIRECTION.UNAVAILABLE,
      regime: TREND_REGIME.UNAVAILABLE,
      strength: null,
      strengthClassification: null,
      adx: null,
      currentPrice: null,
      supportingEvidence: [],
      conflictingEvidence: [],
      weakeningEvidence: [],
      reversalEvidence: [],
      sourceCandleTimestamp: raw?.timestamp || null,
      analysisTimestamp: raw?.timestamp || new Date().toISOString(),
      freshness: 'unavailable',
      freshnessMs: null,
      provenance: { source: 'mexc_public', cached: Boolean(raw?.from_cache) },
      unavailableReasons: raw?.error ? ['analysis_failed'] : ['insufficient_data'],
      analyticalSignal: null,
      ...meta,
    };
  }

  const { direction, strength } = mapRawDirectionStrength(raw.trend);
  const evidence = buildEvidenceItems(raw);
  const wr = mapWeakeningReversal(raw);

  const analysisTs = raw.timestamp ? new Date(raw.timestamp) : new Date();
  const freshnessMs = Date.now() - analysisTs.getTime();

  let analyticalSignal = 'neutral';
  const rec = raw.trading_recommendation?.action;
  if (rec === 'BUY') analyticalSignal = 'bullish_bias';
  else if (rec === 'SELL') analyticalSignal = 'bearish_bias';
  else if (rec === 'HOLD') analyticalSignal = 'neutral';

  return {
    symbol: raw.symbol,
    timeframe: raw.timeframe,
    direction,
    regime: classifyRegime(direction, raw.adx?.strength, raw.adx?.value),
    strength: raw.trend?.confidence != null ? Number(raw.trend.confidence) : null,
    strengthClassification: strength,
    adx: raw.adx
      ? {
          value: raw.adx.value,
          diPlus: raw.adx.di_plus,
          diMinus: raw.adx.di_minus,
          strength: raw.adx.strength,
          interpretation: raw.adx.interpretation,
        }
      : null,
    currentPrice: raw.current_price ?? null,
    movingAverages: raw.moving_averages || null,
    trendLines: raw.trend_lines || null,
    supportingEvidence: evidence.supporting,
    conflictingEvidence: evidence.conflicting,
    weakeningEvidence: wr.weakening,
    reversalEvidence: wr.reversal,
    summary: raw.summary || raw.trend?.description || null,
    sourceCandleTimestamp: raw.timestamp,
    analysisTimestamp: raw.timestamp,
    freshness: freshnessMs < 5 * 60 * 1000 ? 'fresh' : freshnessMs < 30 * 60 * 1000 ? 'stale' : 'aged',
    freshnessMs,
    provenance: {
      source: 'mexc_public',
      dataPoints: raw.data_points ?? null,
      cached: Boolean(raw.from_cache),
      executionTimeMs: raw.execution_time_ms ?? null,
    },
    unavailableReasons: [],
    analyticalSignal,
    executionTimeMs: raw.execution_time_ms ?? null,
    ...meta,
  };
}

export function buildSettingsDto(config = {}, defaults = {}) {
  const merged = { ...defaults, ...(config || {}) };
  return {
    symbol: merged.symbol || 'BTC/USDT',
    timeframe: merged.timeframe || '1h',
    compareTimeframes: Array.isArray(merged.compareTimeframes) ? merged.compareTimeframes : [],
    adxPeriod: Number(merged.adxPeriod) || 14,
    smaPeriod: Number(merged.smaPeriod) || 50,
    emaPeriod: Number(merged.emaPeriod) || 20,
    trendLineLookback: Number(merged.trendLineLookback) || 20,
    candleCount: Number(merged.candleCount) || 200,
    autoExecute: { supported: false, effective: false, reason: 'execution_blocked' },
    version: merged.version || 1,
  };
}

export function validateAnalyzeRequest(body = {}) {
  const symbol = String(body.symbol || '').trim();
  const timeframe = String(body.timeframe || '1h').trim();
  if (!symbol || symbol.length > 32) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid symbol' };
  }
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid timeframe' };
  }
  return { ok: true, symbol, timeframe };
}

export function validateSettingsInput(input = {}) {
  const allowed = ['symbol', 'timeframe', 'compareTimeframes', 'adxPeriod', 'smaPeriod', 'emaPeriod', 'trendLineLookback', 'candleCount', 'version'];
  const keys = Object.keys(input || {});
  const unknown = keys.filter((k) => !allowed.includes(k));
  if (unknown.length) {
    return { ok: false, code: 'VALIDATION_ERROR', message: `Unknown fields: ${unknown.join(', ')}` };
  }
  if (input.timeframe && !VALID_TIMEFRAMES.has(String(input.timeframe))) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid timeframe' };
  }
  return { ok: true, sanitized: input };
}

export function mapDecisionRowToRun(row, agentId) {
  const output = typeof row.output_data === 'object' ? row.output_data : {};
  const input = typeof row.input_data === 'object' ? row.input_data : {};
  const snapshot = buildTrendSnapshot(output);
  return {
    runId: row.id,
    agentId,
    status: row.was_successful === false || output.error ? RUN_STATUS.FAILED : RUN_STATUS.COMPLETED,
    trigger: input.trigger || 'manual',
    symbol: snapshot.symbol || input.symbol || null,
    timeframe: snapshot.timeframe || input.timeframe || null,
    startedAt: row.created_at,
    completedAt: row.created_at,
    durationMs: row.execution_time_ms ?? snapshot.executionTimeMs ?? null,
    snapshotSummary: {
      direction: snapshot.direction,
      regime: snapshot.regime,
      strengthClassification: snapshot.strengthClassification,
      adx: snapshot.adx?.value ?? null,
    },
    errorMessage: output.error || null,
  };
}

export function buildTrendIntegrationsDto({ redisOk, scheduler, runtime, mexcPublicOk }) {
  return {
    publicMarketData: { status: mexcPublicOk ? 'available' : 'degraded', owner: 'mexc_public' },
    trendAnalyzer: { status: 'available', owner: 'backend/services/trendAnalyzer.js' },
    persistence: { status: 'available', owner: 'ai_decisions' },
    redisCache: { status: redisOk ? 'available' : 'unavailable', owner: 'redis' },
    scheduler: {
      status: scheduler?.status || 'unknown',
      allowlisted: Array.isArray(scheduler?.allowlist) ? scheduler.allowlist.includes('arbitrage') : false,
      note: 'trend_not_scheduled',
      owner: 'titan-engine-worker',
    },
    executionCapability: {
      status: 'blocked',
      effectiveMode: runtime?.globalMode || 'demo',
      killSwitchActive: Boolean(runtime?.killSwitchActive),
      liveCapable: false,
    },
  };
}

export function compareSnapshots(current, previous) {
  if (!current || !previous) {
    return { available: false, reason: 'no_prior_run' };
  }
  return {
    available: true,
    directionChanged: current.direction !== previous.direction,
    strengthDelta:
      current.adx?.value != null && previous.adx?.value != null
        ? Number(current.adx.value) - Number(previous.adx.value)
        : null,
    regimeChanged: current.regime !== previous.regime,
    priorRunAt: previous.analysisTimestamp,
  };
}
