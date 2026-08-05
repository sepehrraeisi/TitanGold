import type { TrendIntegrations, TrendRunSummary, TrendSnapshot } from '../../../services/trendCoreClient.ts';

type TFn = (key: string, options?: Record<string, string | number>) => string;

export const TREND_COMPARE_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;

export const TREND_INTEGRATION_ORDER = [
  'publicMarketData',
  'trendAnalyzer',
  'persistence',
  'redisCache',
  'scheduler',
  'executionCapability',
] as const;

export function localizeRegime(regime: string | null | undefined, t: TFn): string {
  if (!regime || regime === 'unavailable') return t('not_available');
  const key = `trend_regime_${regime}`;
  const translated = t(key);
  return translated === key ? regime : translated;
}

export function localizeDirection(direction: string | null | undefined, t: TFn): string {
  if (!direction || direction === 'unavailable') return t('not_available');
  const key = `trend_direction_${direction}`;
  const translated = t(key);
  return translated === key ? direction : translated;
}

export function localizeStrength(strength: string | null | undefined, t: TFn): string {
  if (!strength) return t('not_available');
  const key = `trend_strength_${strength}`;
  const translated = t(key);
  return translated === key ? strength : translated;
}

export function localizeFreshness(snapshot: TrendSnapshot | null, t: TFn, locale: string): string {
  if (!snapshot) return t('not_available');
  const reasonKey = (snapshot as TrendSnapshot & { freshnessReasonKey?: string }).freshnessReasonKey;
  const labelKey = reasonKey || `trend_freshness_${snapshot.freshness}`;
  const label = t(labelKey);
  const ts =
    (snapshot as TrendSnapshot & { sourceCandleTimestamp?: string; analysisTimestamp?: string })
      .sourceCandleTimestamp ||
    (snapshot as TrendSnapshot & { analysisTimestamp?: string }).analysisTimestamp;
  if (!ts) return label;
  const formatted = new Date(ts).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US');
  return `${label} · ${formatted}`;
}

export function localizeSummary(snapshot: TrendSnapshot | null, t: TFn): string | null {
  if (!snapshot) return null;
  const key = (snapshot as TrendSnapshot & { summaryKey?: string }).summaryKey;
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (snapshot.summary) return snapshot.summary;
  return null;
}

export function localizeAgreement(agreement: string | null | undefined, t: TFn): string {
  if (!agreement) return t('not_available');
  const normalized =
    agreement === 'agree' ? 'full' : agreement;
  const key = `trend_mtf_agreement_${normalized}`;
  const translated = t(key);
  return translated === key ? agreement : translated;
}

export function localizeAgreementReason(reasonKey: string | null | undefined, t: TFn): string | null {
  if (!reasonKey) return null;
  const translated = t(reasonKey);
  return translated === reasonKey ? null : translated;
}

export function localizeMtfUnavailableReason(reasonKey: string | null | undefined, t: TFn): string {
  if (!reasonKey) return t('not_available');
  const translated = t(reasonKey);
  return translated === reasonKey ? t('not_available') : translated;
}

export function localizeSignalType(signalType: string | null | undefined, t: TFn): string {
  if (!signalType) return t('not_available');
  const weakeningKey = `trend_signal_type_${signalType}`;
  const translated = t(weakeningKey);
  if (translated !== weakeningKey) return translated;
  const reversalKey = `trend_reversal_${signalType}`;
  const reversalTranslated = t(reversalKey);
  if (reversalTranslated !== reversalKey) return reversalTranslated;
  return t('not_available');
}

export function localizeSignalDirection(direction: string | null | undefined, t: TFn): string {
  if (!direction) return t('not_available');
  if (direction === 'neutral') return t('trend_signal_direction_neutral');
  return localizeDirection(direction, t);
}

/** Completed runs with numeric ADX for one symbol+timeframe — excludes failed/mixed-symbol series. */
export function filterComparableHistoryRuns(
  runs: TrendRunSummary[],
  symbol: string,
  timeframe: string,
): TrendRunSummary[] {
  return runs.filter(
    (r) =>
      r.status === 'completed' &&
      r.symbol === symbol &&
      r.timeframe === timeframe &&
      typeof r.snapshotSummary?.adx === 'number',
  );
}

export function extractHistoryFilterOptions(runs: TrendRunSummary[]): {
  symbols: string[];
  timeframes: string[];
} {
  const symbols = new Set<string>();
  const timeframes = new Set<string>();
  for (const r of runs) {
    if (r.status !== 'completed') continue;
    if (r.symbol) symbols.add(r.symbol);
    if (r.timeframe) timeframes.add(r.timeframe);
  }
  return {
    symbols: [...symbols].sort(),
    timeframes: [...timeframes].sort(),
  };
}

export const TREND_PRIMARY_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;

export function resolveEvidenceText(
  item: Record<string, unknown>,
  t: TFn,
): string {
  const interpretationKey = item.interpretationKey as string | undefined;
  if (interpretationKey) {
    const translated = t(interpretationKey);
    if (translated !== interpretationKey) return translated;
  }
  const displayKey = item.displayKey as string | undefined;
  if (displayKey) {
    const translated = t(displayKey);
    if (translated !== displayKey) return translated;
  }
  if (typeof item.interpretation === 'string' && item.interpretation) return item.interpretation;
  if (typeof item.description === 'string' && item.description) return item.description;
  return t('not_available');
}

export function integrationEntries(integrations: TrendIntegrations | null) {
  if (!integrations) return [];
  return TREND_INTEGRATION_ORDER.filter(key => key in integrations).map(key => ({
    key,
    ...(integrations[key] as Record<string, unknown>),
  }));
}

export function integrationLabel(key: string, t: TFn): string {
  const labelKey = `trend_int_${key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}`;
  const mapped: Record<string, string> = {
    publicMarketData: 'trend_int_public_market_data',
    trendAnalyzer: 'trend_int_trend_analyzer',
    persistence: 'trend_int_persistence',
    redisCache: 'trend_int_redis_cache',
    scheduler: 'trend_int_scheduler',
    executionCapability: 'trend_int_execution_capability',
  };
  const k = mapped[key] || labelKey;
  const translated = t(k);
  return translated === k ? key : translated;
}

export function integrationStatusLabel(
  entry: Record<string, unknown>,
  t: TFn,
): string {
  const statusLabelKey = entry.statusLabelKey as string | undefined;
  if (statusLabelKey) {
    const translated = t(statusLabelKey);
    if (translated !== statusLabelKey) return translated;
  }
  const status = String(entry.status || 'unknown');
  const key = `trend_int_status_${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function integrationReason(entry: Record<string, unknown>, t: TFn): string | null {
  const reasonKey = entry.reasonKey as string | undefined;
  if (!reasonKey) return null;
  const translated = t(reasonKey);
  return translated === reasonKey ? null : translated;
}
