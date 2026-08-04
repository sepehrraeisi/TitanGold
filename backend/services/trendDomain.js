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

/** Canonical ADX thresholds — single source for regime, strength and evidence. */
export const ADX_REGIME_RANGING_MAX = 20;
export const ADX_REGIME_TRENDING_MIN = 25;

const TIMEFRAME_MS = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};

export function classifyAdxStrength(adxValue) {
  const adx = Number(adxValue);
  if (!Number.isFinite(adx)) return null;
  if (adx < ADX_REGIME_RANGING_MAX) return 'weak';
  if (adx < ADX_REGIME_TRENDING_MIN) return 'developing';
  if (adx < 40) return 'moderate';
  return 'strong';
}

export function computeFreshness(timeframe, lastCandleTimestamp, analysisTimestamp) {
  const tfMs = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['1h'];
  const candleTs = lastCandleTimestamp ? new Date(lastCandleTimestamp).getTime() : null;
  const analysisTs = analysisTimestamp ? new Date(analysisTimestamp).getTime() : Date.now();
  const basisTs = Number.isFinite(candleTs) ? candleTs : analysisTs;
  const ageMs = Math.max(0, Date.now() - basisTs);
  const freshThreshold = tfMs * 1.5;
  const staleThreshold = tfMs * 4;

  let freshness = 'aged';
  let freshnessReasonKey = 'trend_freshness_aged';
  if (ageMs <= freshThreshold) {
    freshness = 'fresh';
    freshnessReasonKey = 'trend_freshness_fresh';
  } else if (ageMs <= staleThreshold) {
    freshness = 'stale';
    freshnessReasonKey = 'trend_freshness_stale';
  }

  return {
    freshness,
    freshnessMs: ageMs,
    freshnessReasonKey,
    sourceCandleTimestamp: lastCandleTimestamp || (Number.isFinite(candleTs) ? new Date(candleTs).toISOString() : null),
    analysisTimestamp: analysisTimestamp || new Date(analysisTs).toISOString(),
  };
}

export function buildCanonicalAdxInterpretation(adxValue, regime) {
  const adx = Number(adxValue);
  if (!Number.isFinite(adx)) return { interpretationKey: 'trend_adx_unavailable', interpretation: null };
  if (regime === TREND_REGIME.RANGING || adx < ADX_REGIME_RANGING_MAX) {
    return { interpretationKey: 'trend_adx_ranging', interpretation: null };
  }
  if (regime === TREND_REGIME.TRANSITION || adx < ADX_REGIME_TRENDING_MIN) {
    return { interpretationKey: 'trend_adx_transition', interpretation: null };
  }
  if (adx >= 40) {
    return { interpretationKey: 'trend_adx_strong', interpretation: null };
  }
  return { interpretationKey: 'trend_adx_moderate', interpretation: null };
}

export function normalizeDirection(raw) {
  if (!raw) return TREND_DIRECTION.UNAVAILABLE;
  const v = String(raw).toLowerCase();
  if (v === 'up' || v === 'bullish') return TREND_DIRECTION.BULLISH;
  if (v === 'down' || v === 'bearish') return TREND_DIRECTION.BEARISH;
  if (v === 'sideways' || v === 'neutral') return TREND_DIRECTION.SIDEWAYS;
  if (v === 'mixed') return TREND_DIRECTION.MIXED;
  return TREND_DIRECTION.UNAVAILABLE;
}

export function classifyRegime(direction, _adxStrength, adxValue) {
  if (direction === TREND_DIRECTION.UNAVAILABLE) return TREND_REGIME.UNAVAILABLE;
  const adx = Number(adxValue);
  if (!Number.isFinite(adx)) return TREND_REGIME.UNAVAILABLE;
  if (direction === TREND_DIRECTION.SIDEWAYS || adx < ADX_REGIME_RANGING_MAX) return TREND_REGIME.RANGING;
  if (direction === TREND_DIRECTION.MIXED) return TREND_REGIME.TRANSITION;
  if (
    adx >= ADX_REGIME_TRENDING_MIN &&
    (direction === TREND_DIRECTION.BULLISH || direction === TREND_DIRECTION.BEARISH)
  ) {
    return TREND_REGIME.TRENDING;
  }
  if (
    adx >= ADX_REGIME_RANGING_MAX &&
    adx < ADX_REGIME_TRENDING_MIN &&
    (direction === TREND_DIRECTION.BULLISH || direction === TREND_DIRECTION.BEARISH)
  ) {
    return TREND_REGIME.TRANSITION;
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

function buildEvidenceItems(raw, regime) {
  const supporting = [];
  const conflicting = [];

  const push = (list, item) => list.push(item);

  if (raw?.adx?.value != null) {
    const adxValue = raw.adx.value;
    const adxItem = {
      indicatorId: 'adx',
      displayKey: 'trend_indicator_adx',
      value: adxValue,
      interpretation: raw.adx.interpretation || null,
      contribution: raw.adx.di_plus > raw.adx.di_minus ? 'bullish' : raw.adx.di_minus > raw.adx.di_plus ? 'bearish' : 'neutral',
      evidenceType: 'supporting',
      available: true,
    };
    const canonical = buildCanonicalAdxInterpretation(adxValue, regime);
    adxItem.interpretationKey = canonical.interpretationKey;
    if (regime === TREND_REGIME.RANGING) {
      push(conflicting, { ...adxItem, evidenceType: 'conflicting', interpretationKey: 'trend_evidence_ranging_adx' });
    } else if (regime === TREND_REGIME.TRANSITION) {
      push(supporting, { ...adxItem, interpretationKey: 'trend_evidence_developing_adx' });
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
      push(conflicting, { ...item, evidenceType: 'conflicting', interpretationKey: 'trend_evidence_neutral_ma' });
    } else {
      push(supporting, item);
    }
  }

  return { supporting, conflicting };
}

function mapWeakeningReversal(raw, regime) {
  const weakening = [];
  const reversal = [];

  const adx = Number(raw?.adx?.value);
  if (
    Number.isFinite(adx) &&
    adx < ADX_REGIME_TRENDING_MIN &&
    regime !== TREND_REGIME.RANGING
  ) {
    weakening.push({
      type: 'developing_trend_strength',
      displayKey: 'trend_weakening_adx',
      interpretationKey: 'trend_weakening_adx',
      severity: adx < ADX_REGIME_RANGING_MAX ? 'medium' : 'low',
      available: true,
    });
  }

  for (const signal of raw?.reversal_signals || []) {
    reversal.push({
      type: signal.type,
      displayKey: 'trend_reversal_signal',
      interpretationKey: 'trend_reversal_signal',
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
  const adxValue = raw.adx?.value;
  const regime = classifyRegime(direction, strength, adxValue);
  const strengthClassification = classifyAdxStrength(adxValue) || strength;
  const evidence = buildEvidenceItems(raw, regime);
  const wr = mapWeakeningReversal(raw, regime);
  const adxCanonical = buildCanonicalAdxInterpretation(adxValue, regime);
  const freshnessMeta = computeFreshness(
    raw.timeframe,
    raw.last_candle_timestamp || raw.timestamp,
    raw.timestamp,
  );

  let analyticalSignal = 'neutral';
  const rec = raw.trading_recommendation?.action;
  if (rec === 'BUY') analyticalSignal = 'bullish_bias';
  else if (rec === 'SELL') analyticalSignal = 'bearish_bias';
  else if (rec === 'HOLD') analyticalSignal = 'neutral';

  return {
    symbol: raw.symbol,
    timeframe: raw.timeframe,
    direction,
    regime,
    strength: raw.trend?.confidence != null ? Number(raw.trend.confidence) : null,
    strengthClassification,
    adx: raw.adx
      ? {
          value: raw.adx.value,
          diPlus: raw.adx.di_plus,
          diMinus: raw.adx.di_minus,
          strength: strengthClassification,
          interpretation: raw.adx.interpretation || null,
          interpretationKey: adxCanonical.interpretationKey,
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
    sourceCandleTimestamp: freshnessMeta.sourceCandleTimestamp,
    analysisTimestamp: freshnessMeta.analysisTimestamp,
    freshness: freshnessMeta.freshness,
    freshnessMs: freshnessMeta.freshnessMs,
    freshnessReasonKey: freshnessMeta.freshnessReasonKey,
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
  if (input.compareTimeframes !== undefined) {
    if (!Array.isArray(input.compareTimeframes)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'compareTimeframes must be an array' };
    }
    if (input.compareTimeframes.length > 3) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'At most 3 compare timeframes allowed' };
    }
    const invalid = input.compareTimeframes.filter((tf) => !VALID_TIMEFRAMES.has(String(tf)));
    if (invalid.length) {
      return { ok: false, code: 'VALIDATION_ERROR', message: `Invalid compare timeframes: ${invalid.join(', ')}` };
    }
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

export function resolveSchedulerIntegrationStatus(schedulerRead) {
  if (!schedulerRead) return 'unknown';
  const inner = schedulerRead.status;
  if (typeof inner === 'string') return inner;
  if (inner && typeof inner.status === 'string') return inner.status;
  if (schedulerRead.stale) return 'stale';
  if (schedulerRead.source === 'unavailable' || schedulerRead.source === 'missing') return 'unavailable';
  return 'unknown';
}

export function buildTrendIntegrationsDto({ redisOk, scheduler, runtime, mexcPublicOk }) {
  const schedulerInner = scheduler?.status;
  const allowlist = Array.isArray(schedulerInner?.allowlist) ? schedulerInner.allowlist : [];
  const workerStatus = resolveSchedulerIntegrationStatus(scheduler);
  const trendAllowlisted = allowlist.includes('trend') || allowlist.includes('trend_detection');
  const schedulerStatusKey =
    workerStatus === 'online'
      ? 'trend_int_status_online'
      : workerStatus === 'stale'
        ? 'trend_int_status_stale'
        : workerStatus === 'unavailable'
          ? 'trend_int_status_unavailable'
          : 'trend_int_status_unknown';

  return {
    publicMarketData: {
      status: mexcPublicOk ? 'available' : 'degraded',
      statusLabelKey: mexcPublicOk ? 'trend_int_status_available' : 'trend_int_status_degraded',
      owner: 'mexc_public',
    },
    trendAnalyzer: {
      status: 'available',
      statusLabelKey: 'trend_int_status_available',
      owner: 'backend/services/trendAnalyzer.js',
    },
    persistence: {
      status: 'available',
      statusLabelKey: 'trend_int_status_available',
      owner: 'ai_decisions',
    },
    redisCache: {
      status: redisOk ? 'available' : 'unavailable',
      statusLabelKey: redisOk ? 'trend_int_status_available' : 'trend_int_status_unavailable',
      owner: 'redis',
    },
    scheduler: {
      status: workerStatus,
      statusLabelKey: schedulerStatusKey,
      trendAllowlisted,
      scheduledMonitoringStatus: trendAllowlisted ? 'scheduled' : 'not_scheduled',
      reasonKey: trendAllowlisted ? null : 'trend_int_scheduler_not_allowlisted',
      owner: 'titan-engine-worker',
    },
    executionCapability: {
      status: 'blocked',
      statusLabelKey: 'trend_int_status_blocked',
      reasonKey: 'trend_int_execution_analytical_only',
      effectiveMode: runtime?.globalMode || 'demo',
      killSwitchActive: Boolean(runtime?.killSwitchActive),
      liveCapable: false,
    },
  };
}

export function compareSnapshots(current, previous, { currentSuccessful = true, priorSuccessful = true } = {}) {
  if (!current || !previous) {
    return { available: false, reason: 'no_prior_run' };
  }
  if (!currentSuccessful || !priorSuccessful) {
    return { available: false, reason: 'incomparable_run_status' };
  }
  if (current.direction === TREND_DIRECTION.UNAVAILABLE || previous.direction === TREND_DIRECTION.UNAVAILABLE) {
    return { available: false, reason: 'unavailable_snapshot' };
  }
  if (current.symbol && previous.symbol && current.symbol !== previous.symbol) {
    return { available: false, reason: 'symbol_mismatch' };
  }
  if (current.timeframe && previous.timeframe && current.timeframe !== previous.timeframe) {
    return { available: false, reason: 'timeframe_mismatch' };
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
