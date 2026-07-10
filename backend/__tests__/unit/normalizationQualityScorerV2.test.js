/**
 * DH-PIPELINE-P4-SCORING-CALIBRATION-1
 * @jest-environment node
 */

import {
  scoreNormalizedRecord,
  scoreNormalizedRecordV2,
  QUALITY_REASON_CODES,
  applyQualityToNormalized,
} from '../../services/normalizationQualityScorer.js';
import { dataNormalizer } from '../../services/normalizers/dataNormalizer.js';
import { dataValidator } from '../../services/validators/dataValidator.js';

const activeSource = {
  is_active: true,
  last_status: 'success',
  priority: 7,
  source_error_count: 0,
  collected_at: new Date().toISOString(),
};

describe('normalizationQualityScorerV2', () => {
  test('telegram ounce/silver quote lines score in high-value range', () => {
    const ounceQuote = dataNormalizer.normalize(
      {
        telegram_message_id: '1000',
        message_text: '🔻 انس: 5196.09\n🔻 نقره: 89.568\n1404-12-07 07:38:39',
        telegram_created_at: '2020-01-01T00:00:00.000Z',
      },
      'telegram',
      { category: 'signals', ingestionMode: 'collector' },
    );
    const v2 = scoreNormalizedRecordV2(ounceQuote, {
      ...activeSource,
      last_status: 'collector_linked',
      collected_at: new Date().toISOString(),
    });
    expect(v2.score).toBeGreaterThanOrEqual(65);
    expect(v2.reasonCodes).toContain(QUALITY_REASON_CODES.PRICE_PATTERN_DETECTED);
    expect(v2.reasonCodes).toContain(QUALITY_REASON_CODES.GOLD_TERM_DETECTED);
    expect(v2.reasonCodes).toContain(QUALITY_REASON_CODES.FRESH_CONTENT);
  });

  test('telegram price message scores higher than baseline generic short message', () => {
    const priceMsg = dataNormalizer.normalize(
      {
        telegram_message_id: '1001',
        message_text: '💰 دلار ۶۵,۵۰۰ تومان | طلا ۲,۵۰۰,۰۰۰ ↑ 1.2% #gold',
        telegram_created_at: new Date().toISOString(),
      },
      'telegram',
      { category: 'signals', ingestionMode: 'collector' },
    );
    const generic = dataNormalizer.normalize(
      {
        telegram_message_id: '1002',
        message_text: 'سلام دوستان امروز کانال بروزرسانی شد',
        telegram_created_at: new Date().toISOString(),
      },
      'telegram',
      { category: 'signals', ingestionMode: 'collector' },
    );

    const priceV2 = scoreNormalizedRecordV2(priceMsg, activeSource);
    const genericV2 = scoreNormalizedRecordV2(generic, activeSource);
    const genericV1 = scoreNormalizedRecord(generic, activeSource);

    expect(priceV2.score).toBeGreaterThan(genericV2.score);
    expect(priceV2.score).toBeGreaterThan(genericV1.score);
    expect(priceV2.score).toBeGreaterThanOrEqual(65);
    expect(priceV2.reasonCodes).toContain(QUALITY_REASON_CODES.PRICE_PATTERN_DETECTED);
  });

  test('telegram long analysis scores higher than generic short message', () => {
    const longAnalysis = dataNormalizer.normalize(
      {
        telegram_message_id: '2001',
        message_text:
          'تحلیل بازار طلا و دلار: نرخ دلار در بازار آزاد با افزایش نقدینگی به سطح ۶۵ هزار تومان رسید. ' +
          'انس جهانی طلا نیز تحت تاثیر تصمیم فدرال رزرو و تقاضای خرید در بازار آسیا رشد کرد. '.repeat(4),
        telegram_created_at: new Date().toISOString(),
      },
      'telegram',
      { category: 'signals', ingestionMode: 'collector' },
    );
    const shortGeneric = dataNormalizer.normalize(
      {
        telegram_message_id: '2002',
        message_text: 'یادآوری: کانال فعال است',
        telegram_created_at: new Date().toISOString(),
      },
      'telegram',
      { category: 'signals', ingestionMode: 'collector' },
    );

    const longV2 = scoreNormalizedRecordV2(longAnalysis, activeSource);
    const shortV2 = scoreNormalizedRecordV2(shortGeneric, activeSource);

    expect(longV2.score).toBeGreaterThan(shortV2.score);
    expect(longV2.reasonCodes).toContain(QUALITY_REASON_CODES.MARKET_NEWS_TERM_DETECTED);
  });

  test('telegram weak short message scores lower band', () => {
    const weak = dataNormalizer.normalize(
      {
        telegram_message_id: '3001',
        message_text: 'سلام',
        telegram_created_at: new Date().toISOString(),
      },
      'telegram',
      { category: 'signals', ingestionMode: 'collector' },
    );
    const v2 = scoreNormalizedRecordV2(weak, activeSource);
    expect(v2.score).toBeLessThanOrEqual(50);
    expect(v2.reasonCodes).toEqual(
      expect.arrayContaining([
        QUALITY_REASON_CODES.LOW_TEXT_SUBSTANCE,
        QUALITY_REASON_CODES.WEAK_CONTEXT,
      ]),
    );
  });

  test('media-only empty content fails validation before scoring', () => {
    const raw = {
      telegram_message_id: '4001',
      message_text: null,
      has_media: true,
      telegram_created_at: new Date().toISOString(),
    };
    const normalized = dataNormalizer.normalize(raw, 'telegram', { category: 'signals' });
    expect(dataValidator.validateContract(normalized).valid).toBe(false);
    const emptyV2 = scoreNormalizedRecordV2(normalized, activeSource);
    expect(emptyV2.score).toBe(0);
    expect(emptyV2.reasonCodes).toContain(QUALITY_REASON_CODES.MEDIA_ONLY_NO_TEXT);
  });

  test('RSS article receives reasonable v2 score', () => {
    const rss = dataNormalizer.normalize(
      {
        title: 'Fed signals cautious rate path amid inflation data',
        description: 'Markets reacted to the latest CPI print with mixed moves across equities and gold. '.repeat(8),
        pubDate: new Date().toISOString(),
        link: 'https://example.com/article/1',
        guid: 'rss-guid-1',
      },
      'rss',
      { category: 'news', sourceName: 'Market RSS' },
    );
    const v2 = scoreNormalizedRecordV2(rss, activeSource);
    expect(v2.score).toBeGreaterThanOrEqual(55);
    expect(v2.score).toBeLessThanOrEqual(100);
    expect(v2.reasonCodes).toContain(QUALITY_REASON_CODES.HAS_URL);
  });

  test('API structured payload receives reasonable v2 score', () => {
    const api = dataNormalizer.normalize(
      {
        title: 'BTC/USDT ticker',
        body: 'Price snapshot with bid/ask spread',
        published_at: new Date().toISOString(),
        symbol: 'BTCUSDT',
        bid: 65000,
        ask: 65010,
        volume: 1200,
        url: 'https://api.example.com/ticker',
      },
      'api',
      { category: 'signals', sourceName: 'Exchange API' },
    );
    const v2 = scoreNormalizedRecordV2(api, activeSource);
    expect(v2.score).toBeGreaterThanOrEqual(60);
    expect(v2.reasonCodes).toContain(QUALITY_REASON_CODES.HAS_URL);
  });

  test('applyQuality preserves v1 and writes v2 metadata', () => {
    const quality = scoreNormalizedRecord(
      { title: 't', content: 'دلار ۶۵,۰۰۰ تومان', sourceType: 'telegram', version: 'datahub.normalized.v1' },
      activeSource,
    );
    const out = applyQualityToNormalized({ title: 't', content: 'c', metadata: {} }, quality, 'test-v2');
    expect(out.metadata.quality_score).toBe(quality.score);
    expect(out.metadata.quality_score_v2).toBe(quality.v2.score);
    expect(out.metadata.quality_band_v2).toBe(quality.v2.band);
    expect(Array.isArray(out.metadata.quality_reason_codes)).toBe(true);
    expect(out.metadata.quality_factors_v2).toBeDefined();
  });

  test('v1 legacy score preserved alongside v2', () => {
    const normalized = dataNormalizer.normalize(
      {
        telegram_message_id: '99',
        message_text: 'Gold price surge #commodities',
        telegram_created_at: new Date().toISOString(),
      },
      'telegram',
      { category: 'signals' },
    );
    const quality = scoreNormalizedRecord(normalized, {
      is_active: true,
      priority: 5,
      collected_at: new Date().toISOString(),
    });
    expect(quality.score).toBeGreaterThan(0);
    expect(quality.v2.score).toBeGreaterThan(0);
    expect(quality.v2.reasonCodes.length).toBeGreaterThan(0);
    expect(quality.score).not.toBe(quality.v2.score);
  });
});
