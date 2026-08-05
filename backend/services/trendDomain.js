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

/** Canonical reversal signal type → localized interpretation key (no generic placeholders). */
export const REVERSAL_SIGNAL_INTERPRETATION_KEYS = {
  bullish_crossover: 'trend_reversal_bullish_crossover',
  bearish_crossover: 'trend_reversal_bearish_crossover',
  trend_weakening: 'trend_reversal_adx_declining',
  support_bounce: 'trend_reversal_support_bounce',
  resistance_rejection: 'trend_reversal_resistance_rejection',
  overbought_trend: 'trend_reversal_overbought_exhaustion',
};

const REVERSAL_SIGNAL_DIRECTION = {
  bullish_crossover: 'bullish',
  bearish_crossover: 'bearish',
  trend_weakening: 'neutral',
  support_bounce: 'bullish',
  resistance_rejection: 'bearish',
  overbought_trend: 'neutral',
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
    const sig = ma.signal;
    const item = {
      indicatorId: 'moving_averages',
      displayKey: 'trend_indicator_ma',
      value: null,
      interpretation: sig.description || null,
      interpretationKey: sig.interpretationKey || null,
      contribution: sig.signal || 'neutral',
      evidenceType: sig.signal?.includes('bullish') ? 'supporting' : sig.signal?.includes('bearish') ? 'supporting' : 'neutral',
      available: true,
    };
    if (sig.signal?.startsWith('neutral')) {
      push(conflicting, { ...item, evidenceType: 'conflicting', interpretationKey: sig.interpretationKey || 'trend_evidence_neutral_ma' });
    } else {
      push(supporting, item);
    }
  }

  return { supporting, conflicting };
}

function mapReversalSignal(signal, analysisTimestamp) {
  const type = String(signal?.type || '');
  const interpretationKey = REVERSAL_SIGNAL_INTERPRETATION_KEYS[type] || null;
  const severityFromStrength =
    signal?.strength === 'strong' ? 'high' : signal?.strength === 'moderate' ? 'medium' : signal?.strength === 'weak' ? 'low' : null;
  return {
    type,
    signalType: type || null,
    interpretationKey,
    direction: REVERSAL_SIGNAL_DIRECTION[type] || null,
    strength: signal?.strength || null,
    severity: severityFromStrength,
    sourceTimestamp: analysisTimestamp || null,
    provenance: { source: 'trend_analyzer', indicator: 'reversal_signals' },
    evidenceState: interpretationKey ? 'detected' : 'insufficient',
    available: Boolean(interpretationKey),
  };
}

function mapWeakeningReversal(raw, regime) {
  const weakening = [];
  const reversal = [];
  const analysisTimestamp = raw?.timestamp || raw?.last_candle_timestamp || null;

  const adx = Number(raw?.adx?.value);
  if (
    Number.isFinite(adx) &&
    adx < ADX_REGIME_TRENDING_MIN &&
    regime !== TREND_REGIME.RANGING
  ) {
    weakening.push({
      type: 'developing_trend_strength',
      signalType: 'developing_trend_strength',
      displayKey: 'trend_weakening_adx',
      interpretationKey: 'trend_weakening_adx',
      direction: null,
      severity: adx < ADX_REGIME_RANGING_MAX ? 'medium' : 'low',
      sourceTimestamp: analysisTimestamp,
      provenance: { source: 'trend_analyzer', indicator: 'adx' },
      evidenceState: 'detected',
      available: true,
    });
  }

  for (const signal of raw?.reversal_signals || []) {
    reversal.push(mapReversalSignal(signal, analysisTimestamp));
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

  const chartSeries = raw.chart_series || null;
  let adxMomentum = null;
  if (chartSeries?.points?.length >= 2) {
    const adxPoints = chartSeries.points.map((p) => p.adx).filter((v) => v != null);
    if (adxPoints.length >= 2) {
      const delta = adxPoints[adxPoints.length - 1] - adxPoints[adxPoints.length - 2];
      if (Math.abs(delta) >= 0.5) {
        adxMomentum = delta > 0 ? 'strengthening' : 'weakening';
      }
    }
  }

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
          momentum: adxMomentum,
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
    summaryKey: raw.summary_key || raw.trend?.descriptionKey || null,
    chartSeries,
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
      status: trendAllowlisted ? workerStatus : 'not_scheduled',
      statusLabelKey: trendAllowlisted ? schedulerStatusKey : 'trend_int_status_not_scheduled',
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

export function resolveRunSymbolTimeframe(input = {}, output = {}, snapshot = null) {
  return {
    symbol: snapshot?.symbol || input?.symbol || output?.symbol || null,
    timeframe: snapshot?.timeframe || input?.timeframe || output?.timeframe || null,
  };
}

/**
 * Canonical MTF agreement — derived from direction, regime, strength class, freshness.
 * Values: full | partial | conflict | unavailable
 */
export function computeMtfAgreement(primarySnap, compareSnap) {
  if (!primarySnap || !compareSnap) {
    return {
      agreement: 'unavailable',
      reasonKey: 'trend_mtf_agreement_reason_unavailable',
      factors: {},
    };
  }
  if (
    primarySnap.direction === TREND_DIRECTION.UNAVAILABLE ||
    compareSnap.direction === TREND_DIRECTION.UNAVAILABLE
  ) {
    return {
      agreement: 'unavailable',
      reasonKey: 'trend_mtf_agreement_reason_unavailable',
      factors: { direction: 'unavailable' },
    };
  }

  const directionMatch = primarySnap.direction === compareSnap.direction;
  const directionConflict =
    (primarySnap.direction === TREND_DIRECTION.BULLISH && compareSnap.direction === TREND_DIRECTION.BEARISH) ||
    (primarySnap.direction === TREND_DIRECTION.BEARISH && compareSnap.direction === TREND_DIRECTION.BULLISH);
  const directionPartial =
    !directionMatch &&
    !directionConflict &&
    (primarySnap.direction === TREND_DIRECTION.SIDEWAYS ||
      compareSnap.direction === TREND_DIRECTION.SIDEWAYS ||
      primarySnap.direction === TREND_DIRECTION.MIXED ||
      compareSnap.direction === TREND_DIRECTION.MIXED);

  const regimeMatch = primarySnap.regime === compareSnap.regime;
  const strengthMatch = primarySnap.strengthClassification === compareSnap.strengthClassification;
  const freshnessMatch = primarySnap.freshness === compareSnap.freshness;

  const factors = {
    direction: directionMatch ? 'match' : directionConflict ? 'conflict' : 'partial',
    regime: regimeMatch ? 'match' : 'partial',
    strength: strengthMatch ? 'match' : 'partial',
    freshness: freshnessMatch ? 'match' : 'partial',
  };

  if (directionConflict) {
    return {
      agreement: 'conflict',
      reasonKey: 'trend_mtf_agreement_reason_direction_conflict',
      factors,
    };
  }
  if (directionMatch && regimeMatch && strengthMatch) {
    return {
      agreement: 'full',
      reasonKey: 'trend_mtf_agreement_reason_full',
      factors,
    };
  }
  if (directionPartial || !regimeMatch || !strengthMatch) {
    let reasonKey = 'trend_mtf_agreement_reason_partial';
    if (directionPartial) reasonKey = 'trend_mtf_agreement_reason_direction_partial';
    else if (!regimeMatch) reasonKey = 'trend_mtf_agreement_reason_regime_partial';
    else if (!strengthMatch) reasonKey = 'trend_mtf_agreement_reason_strength_partial';
    return { agreement: 'partial', reasonKey, factors };
  }
  return { agreement: 'partial', reasonKey: 'trend_mtf_agreement_reason_partial', factors };
}

export function compareSnapshots(
  current,
  previous,
  { currentSuccessful = true, priorSuccessful = true, priorRunId = null } = {},
) {
  if (!current || !previous) {
    return { available: false, reason: 'no_prior_run', reasonKey: 'trend_comparison_no_prior_run' };
  }
  if (!currentSuccessful || !priorSuccessful) {
    return { available: false, reason: 'incomparable_run_status', reasonKey: 'trend_comparison_incomparable_status' };
  }
  if (current.direction === TREND_DIRECTION.UNAVAILABLE || previous.direction === TREND_DIRECTION.UNAVAILABLE) {
    return { available: false, reason: 'unavailable_snapshot', reasonKey: 'trend_comparison_unavailable_snapshot' };
  }
  if (current.symbol && previous.symbol && current.symbol !== previous.symbol) {
    return { available: false, reason: 'symbol_mismatch', reasonKey: 'trend_comparison_symbol_mismatch' };
  }
  if (current.timeframe && previous.timeframe && current.timeframe !== previous.timeframe) {
    return { available: false, reason: 'timeframe_mismatch', reasonKey: 'trend_comparison_timeframe_mismatch' };
  }

  const adxCurrent = current.adx?.value != null ? Number(current.adx.value) : null;
  const adxPrior = previous.adx?.value != null ? Number(previous.adx.value) : null;

  return {
    available: true,
    priorRunId,
    priorRunAt: previous.analysisTimestamp || null,
    direction: {
      current: current.direction,
      prior: previous.direction,
      changed: current.direction !== previous.direction,
    },
    regime: {
      current: current.regime,
      prior: previous.regime,
      changed: current.regime !== previous.regime,
    },
    strengthClassification: {
      current: current.strengthClassification,
      prior: previous.strengthClassification,
      changed: current.strengthClassification !== previous.strengthClassification,
    },
    adx: {
      current: adxCurrent,
      prior: adxPrior,
      delta: adxCurrent != null && adxPrior != null ? adxCurrent - adxPrior : null,
    },
    freshness: {
      current: current.freshness,
      prior: previous.freshness,
      changed: current.freshness !== previous.freshness,
    },
    supportingEvidence: {
      currentCount: current.supportingEvidence?.length ?? 0,
      priorCount: previous.supportingEvidence?.length ?? 0,
    },
    conflictingEvidence: {
      currentCount: current.conflictingEvidence?.length ?? 0,
      priorCount: previous.conflictingEvidence?.length ?? 0,
    },
    directionChanged: current.direction !== previous.direction,
    strengthDelta: adxCurrent != null && adxPrior != null ? adxCurrent - adxPrior : null,
    regimeChanged: current.regime !== previous.regime,
  };
}
