/**
 * DH-PIPELINE-P4-SCORING-CALIBRATION-1 — source-type-specific quality scoring v2.
 */

import { NORMALIZED_DATA_VERSION } from './normalizers/normalizedDataContract.js';
import { qualityBandFromScore } from './normalizationQualityScorer.js';

/** @typedef {'excellent'|'good'|'acceptable'|'weak'|'poor'} QualityBand */

export const QUALITY_REASON_CODES = {
  PRICE_PATTERN_DETECTED: 'PRICE_PATTERN_DETECTED',
  GOLD_TERM_DETECTED: 'GOLD_TERM_DETECTED',
  CURRENCY_TERM_DETECTED: 'CURRENCY_TERM_DETECTED',
  CRYPTO_TERM_DETECTED: 'CRYPTO_TERM_DETECTED',
  MARKET_NEWS_TERM_DETECTED: 'MARKET_NEWS_TERM_DETECTED',
  SHORT_BUT_STRUCTURED: 'SHORT_BUT_STRUCTURED',
  LOW_TEXT_SUBSTANCE: 'LOW_TEXT_SUBSTANCE',
  MEDIA_ONLY_NO_TEXT: 'MEDIA_ONLY_NO_TEXT',
  SOURCE_HIGH_RELIABILITY: 'SOURCE_HIGH_RELIABILITY',
  SOURCE_LOW_RELIABILITY: 'SOURCE_LOW_RELIABILITY',
  FRESH_CONTENT: 'FRESH_CONTENT',
  STALE_CONTENT: 'STALE_CONTENT',
  HAS_URL: 'HAS_URL',
  HAS_HASHTAG: 'HAS_HASHTAG',
  HAS_NUMERIC_SIGNAL: 'HAS_NUMERIC_SIGNAL',
  MISSING_SUMMARY: 'MISSING_SUMMARY',
  WEAK_CONTEXT: 'WEAK_CONTEXT',
};

const PATTERNS = {
  price: /(?:\d{1,3}(?:[,\u060C\u066C]\d{3})+|\d+(?:\.\d+)?)\s*(?:تومان|ریال|تومن|usd|usdt|btc|درصد|%|¥|\$|€|eur)/i,
  commodityQuote: /انس\s*[:：]\s*\d|نقره\s*[:：]\s*\d|طلا\s*[:：]\s*\d|xau\s*[:：]?\s*\d|silver\s*[:：]?\s*\d/i,
  cryptoQuote: /bitcoin\s*[:：]\s*\d|ethereum\s*[:：]\s*\d|litecoin\s*[:：]\s*\d|ripple\s*[:：]\s*\d|dogecoin\s*[:：]\s*\d|btc\s*[:：]\s*\d|eth\s*[:：]\s*\d/i,
  fiatQuote: /(?:\d{1,3}(?:[,\u060C\u066C]\d{3})+|\d+(?:\.\d+)?)\s*(?:irt|irr|تومان|ریال|تومن|usd|usdt)/i,
  gold: /طلا|انس|ابشده|مثقال|سکه|gold|xau|ounce|عیار/i,
  silver: /نقره|silver|xag/i,
  currency: /دلار|یورو|پوند|تومان|ریال|dollar|eur|gbp|forex|نرخ ارز/i,
  crypto: /bitcoin|btc|eth|crypto|تتر|usdt|اتریوم|solana|bnb/i,
  marketNews: /بازار|نرخ|قیمت|تحلیل|سیگنال|signal|market|fed|نفت|oil|اقتصاد|تورم|نقدینگی/i,
  buySell: /خرید|فروش|buy|sell|long|short|bull|bear|ورود|خروج/i,
  arrows: /[↑↓⬆⬇📈📉🔺🔻⬆️⬇️]/,
  numeric: /\d{2,}/g,
  hashtag: /#\w+/,
  url: /https?:\/\/[^\s]+/i,
  bullet: /(?:^|\n)\s*[-•▪️✅📌]/m,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function collectMatches(text, regex) {
  if (!text) return [];
  if (regex.global) return [...text.matchAll(regex)].map((m) => m[0]);
  const m = text.match(regex);
  return m ? [m[0]] : [];
}

function hoursSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

/**
 * @param {object} sourceContext
 * @returns {{ score: number, reasonCodes: string[] }}
 */
function scoreSourceReliability(sourceContext, reasonCodes) {
  let score = 5;
  const lastStatus = String(sourceContext.last_status || '').toLowerCase();
  const priority = Number(sourceContext.priority);
  const errorCount = Number(sourceContext.source_error_count || 0);
  const collectedAgeH = hoursSince(sourceContext.collected_at);
  const operationallyHealthy =
    sourceContext.is_active && collectedAgeH != null && collectedAgeH <= 48;

  if (sourceContext.is_active) score += 3;
  if (['success', 'active', 'collector_active'].includes(lastStatus)) {
    score += 4;
    reasonCodes.push(QUALITY_REASON_CODES.SOURCE_HIGH_RELIABILITY);
  } else if (['collector_linked', 'collector_pending', 'linked', 'pending'].includes(lastStatus)) {
    score += 2;
  } else if (operationallyHealthy) {
    score += 2;
  } else if (['error', 'fetch_error', 'collector_error'].includes(lastStatus)) {
    score -= 4;
    reasonCodes.push(QUALITY_REASON_CODES.SOURCE_LOW_RELIABILITY);
  }

  if (Number.isFinite(priority)) {
    score += clamp(priority * 0.6, 0, 5);
  }

  if (errorCount >= 10) {
    score -= 3;
    if (!reasonCodes.includes(QUALITY_REASON_CODES.SOURCE_LOW_RELIABILITY)) {
      reasonCodes.push(QUALITY_REASON_CODES.SOURCE_LOW_RELIABILITY);
    }
  } else if (errorCount === 0 && sourceContext.is_active) {
    score += 1;
  }

  return { score: clamp(score, 0, 15), reasonCodes };
}

function scoreFreshness(normalized, sourceContext, reasonCodes, maxPoints = 10) {
  const published = normalized.publishedAt || normalized.timestamp;
  const ingested = sourceContext.collected_at || normalized.metadata?.ingested_at;
  const publishedAge = hoursSince(published);
  const ingestedAge = hoursSince(ingested);
  const ageH =
    publishedAge != null && ingestedAge != null
      ? Math.min(publishedAge, ingestedAge)
      : (ingestedAge ?? publishedAge);
  if (ageH == null) return { score: Math.round(maxPoints * 0.5), reasonCodes };

  if (ageH <= 1) {
    reasonCodes.push(QUALITY_REASON_CODES.FRESH_CONTENT);
    return { score: maxPoints, reasonCodes };
  }
  if (ageH <= 6) return { score: Math.round(maxPoints * 0.85), reasonCodes };
  if (ageH <= 24) return { score: Math.round(maxPoints * 0.65), reasonCodes };
  if (ageH <= 72) return { score: Math.round(maxPoints * 0.4), reasonCodes };
  reasonCodes.push(QUALITY_REASON_CODES.STALE_CONTENT);
  return { score: Math.round(maxPoints * 0.2), reasonCodes };
}

function scoreCompletenessV2(normalized, reasonCodes, maxPoints = 5) {
  let pts = 0;
  if (normalized?.version === NORMALIZED_DATA_VERSION) pts += 1;
  if (normalized?.language) pts += 1;
  if (normalized?.publishedAt) pts += 1;
  if (normalized?.metadata?.normalizerVersion) pts += 1;
  if (normalized?.summary) pts += 1;
  else reasonCodes.push(QUALITY_REASON_CODES.MISSING_SUMMARY);
  return { score: clamp(pts, 0, maxPoints), reasonCodes };
}

function scoreTelegramV2(normalized, sourceContext) {
  const reasonCodes = [];
  const factors = {};
  const content = String(normalized?.content || '').trim();
  const title = String(normalized?.title || '').trim();
  const blob = `${title}\n${content}`;

  if (!content) {
    reasonCodes.push(QUALITY_REASON_CODES.MEDIA_ONLY_NO_TEXT);
    return buildV2Result(
      { signalDensity: 0, contentSubstance: 0, marketRelevance: 0, sourceReliability: 0, structure: 0, freshness: 0, completeness: 0 },
      reasonCodes,
    );
  }

  let signalDensity = 0;
  if (
    PATTERNS.price.test(blob) ||
    PATTERNS.commodityQuote.test(blob) ||
    PATTERNS.cryptoQuote.test(blob) ||
    PATTERNS.fiatQuote.test(blob)
  ) {
    signalDensity += 12;
    reasonCodes.push(QUALITY_REASON_CODES.PRICE_PATTERN_DETECTED);
  }
  const numerics = collectMatches(blob, PATTERNS.numeric);
  if (numerics.length >= 4) {
    signalDensity += 8;
    reasonCodes.push(QUALITY_REASON_CODES.HAS_NUMERIC_SIGNAL);
  } else if (numerics.length >= 2) {
    signalDensity += 6;
    reasonCodes.push(QUALITY_REASON_CODES.HAS_NUMERIC_SIGNAL);
  } else if (numerics.length === 1) {
    signalDensity += 3;
  }
  if (PATTERNS.gold.test(blob)) {
    signalDensity += 5;
    reasonCodes.push(QUALITY_REASON_CODES.GOLD_TERM_DETECTED);
  }
  if (PATTERNS.currency.test(blob)) {
    signalDensity += 4;
    reasonCodes.push(QUALITY_REASON_CODES.CURRENCY_TERM_DETECTED);
  }
  if (PATTERNS.crypto.test(blob)) {
    signalDensity += 4;
    reasonCodes.push(QUALITY_REASON_CODES.CRYPTO_TERM_DETECTED);
  }
  if (PATTERNS.buySell.test(blob) || PATTERNS.arrows.test(blob)) {
    signalDensity += 4;
  }
  factors.signalDensity = clamp(signalDensity, 0, 28);

  let marketRelevance = 0;
  if (PATTERNS.marketNews.test(blob)) {
    marketRelevance += 12;
    reasonCodes.push(QUALITY_REASON_CODES.MARKET_NEWS_TERM_DETECTED);
  }
  if (PATTERNS.gold.test(blob)) marketRelevance += 6;
  if (PATTERNS.silver.test(blob)) marketRelevance += 4;
  if (PATTERNS.currency.test(blob)) marketRelevance += 4;
  if (PATTERNS.crypto.test(blob)) marketRelevance += 3;
  factors.marketRelevance = clamp(marketRelevance, 0, 22);

  let contentSubstance = 0;
  const len = content.length;
  if (len >= 500) contentSubstance = 17;
  else if (len >= 200) contentSubstance = 14;
  else if (len >= 80) contentSubstance = 10;
  else if (len >= 30) contentSubstance = 7;
  else if (len >= 15) contentSubstance = 5;
  else contentSubstance = 3;

  if (len < 40 && factors.signalDensity >= 10) {
    contentSubstance = Math.max(contentSubstance, 13);
    reasonCodes.push(QUALITY_REASON_CODES.SHORT_BUT_STRUCTURED);
  } else if (len < 40 && factors.signalDensity < 6) {
    reasonCodes.push(QUALITY_REASON_CODES.LOW_TEXT_SUBSTANCE);
    reasonCodes.push(QUALITY_REASON_CODES.WEAK_CONTEXT);
  }
  factors.contentSubstance = clamp(contentSubstance, 0, 17);

  let structure = 0;
  if (PATTERNS.url.test(blob)) {
    structure += 4;
    reasonCodes.push(QUALITY_REASON_CODES.HAS_URL);
  }
  if (PATTERNS.hashtag.test(blob)) {
    structure += 3;
    reasonCodes.push(QUALITY_REASON_CODES.HAS_HASHTAG);
  }
  if (PATTERNS.bullet.test(blob) || blob.includes('|') || blob.includes('—')) {
    structure += 2;
  }
  const tags = Array.isArray(normalized?.tags) ? normalized.tags : [];
  structure += clamp(tags.length, 0, 2);
  factors.structure = clamp(structure, 0, 10);

  const rel = scoreSourceReliability(sourceContext, reasonCodes);
  factors.sourceReliability = rel.score;

  const fresh = scoreFreshness(normalized, sourceContext, reasonCodes, 8);
  factors.freshness = fresh.score;

  const comp = scoreCompletenessV2(normalized, reasonCodes, 5);
  factors.completeness = comp.score;

  return buildV2Result(factors, reasonCodes);
}

function scoreRssV2(normalized, sourceContext) {
  const reasonCodes = [];
  const factors = {};
  const content = String(normalized?.content || '').trim();
  const title = String(normalized?.title || '').trim();

  let titleQuality = 0;
  if (title.length >= 40) titleQuality = 18;
  else if (title.length >= 20) titleQuality = 15;
  else if (title.length >= 10) titleQuality = 10;
  else titleQuality = 4;
  factors.titleQuality = titleQuality;

  factors.contentLength = clamp(Math.floor(content.length / 80), 0, 22);

  const rel = scoreSourceReliability(sourceContext, reasonCodes);
  factors.sourceReliability = clamp(rel.score, 0, 12);

  const fresh = scoreFreshness(normalized, sourceContext, reasonCodes, 14);
  factors.freshness = fresh.score;

  const category = String(normalized?.category || '').trim();
  factors.categoryMatch = category && category !== 'uncategorized' ? 8 : 3;

  let structure = 0;
  if (normalized?.url) {
    structure += 5;
    reasonCodes.push(QUALITY_REASON_CODES.HAS_URL);
  }
  if (normalized?.entities?.rss?.guid) structure += 4;
  factors.structure = clamp(structure, 0, 10);

  const comp = scoreCompletenessV2(normalized, reasonCodes, 6);
  factors.completeness = comp.score;

  if (PATTERNS.marketNews.test(`${title} ${content}`)) {
    reasonCodes.push(QUALITY_REASON_CODES.MARKET_NEWS_TERM_DETECTED);
  }

  return buildV2Result(factors, reasonCodes);
}

function scoreApiV2(normalized, sourceContext) {
  const reasonCodes = [];
  const factors = {};
  const content = String(normalized?.content || '').trim();
  const keys = normalized?.entities?.api?.keys || [];

  factors.payloadCompleteness = clamp(10 + Math.min(keys.length, 8), 0, 28);
  factors.contentRichness = clamp(Math.floor(content.length / 100), 0, 18);

  const rel = scoreSourceReliability(sourceContext, reasonCodes);
  factors.sourceReliability = clamp(rel.score, 0, 18);

  const fresh = scoreFreshness(normalized, sourceContext, reasonCodes, 16);
  factors.freshness = fresh.score;

  let structure = 0;
  if (keys.length >= 5) structure += 10;
  else if (keys.length >= 2) structure += 6;
  if (normalized?.url) {
    structure += 4;
    reasonCodes.push(QUALITY_REASON_CODES.HAS_URL);
  }
  factors.structuredRichness = clamp(structure, 0, 16);

  const comp = scoreCompletenessV2(normalized, reasonCodes, 8);
  factors.completeness = comp.score;

  return buildV2Result(factors, reasonCodes);
}

function scoreDefaultV2(normalized, sourceContext) {
  const reasonCodes = [];
  const factors = {};
  const content = String(normalized?.content || '').trim();
  factors.contentLength = clamp(Math.floor(content.length / 60), 0, 25);
  const rel = scoreSourceReliability(sourceContext, reasonCodes);
  factors.sourceReliability = rel.score;
  const fresh = scoreFreshness(normalized, sourceContext, reasonCodes, 10);
  factors.freshness = fresh.score;
  const comp = scoreCompletenessV2(normalized, reasonCodes, 8);
  factors.completeness = comp.score;
  return buildV2Result(factors, reasonCodes);
}

function buildV2Result(factors, reasonCodes) {
  const score = Math.round(
    Object.values(factors).reduce((sum, v) => sum + (Number(v) || 0), 0),
  );
  const band = qualityBandFromScore(score);
  const uniqueReasons = [...new Set(reasonCodes)];
  return {
    score: clamp(score, 0, 100),
    band,
    factors,
    reasonCodes: uniqueReasons,
  };
}

/**
 * @param {object} normalized
 * @param {object} [sourceContext]
 * @returns {{ score: number, band: QualityBand, factors: Record<string, number>, reasonCodes: string[] }}
 */
export function scoreNormalizedRecordV2(normalized, sourceContext = {}) {
  const sourceType = String(
    normalized?.sourceType || sourceContext.source_type || 'unknown',
  ).toLowerCase();

  switch (sourceType) {
    case 'telegram':
      return scoreTelegramV2(normalized, sourceContext);
    case 'rss':
      return scoreRssV2(normalized, sourceContext);
    case 'api':
      return scoreApiV2(normalized, sourceContext);
    default:
      return scoreDefaultV2(normalized, sourceContext);
  }
}
