import { describe, expect, it } from 'vitest';
import en from '../../../../../deploy/blue/locales/en.json';
import fa from '../../../../../deploy/blue/locales/fa.json';
import {
  buildAnalysisCompleteFeedback,
  formatAnalysisCompleteComparisonMessage,
  trendFeedbackMessage,
} from '../../../../../components/ai/trend/trendFeedback.ts';

type LocaleMap = Record<string, string>;

function makeT(catalog: LocaleMap) {
  return (key: string, options?: Record<string, string | number>) => {
    let translation = catalog[key] || key;
    if (options) {
      for (const [optionKey, value] of Object.entries(options)) {
        translation = translation.replace(new RegExp(`\\{${optionKey}\\}`, 'g'), String(value));
      }
    }
    return translation;
  };
}

describe('trendFeedback MTF lifecycle', () => {
  it('uses generic complete when no comparisons requested', () => {
    expect(buildAnalysisCompleteFeedback(null).state).toBe('analysis_completed');
    expect(
      buildAnalysisCompleteFeedback({
        requestedCount: 0,
        completedCount: 0,
        unavailableCount: 0,
        failedCount: 0,
        requestedCompareTimeframes: [],
        lifecycleStatus: 'complete',
      }).state,
    ).toBe('analysis_completed');
  });

  it('reports full comparison success with comparison count', () => {
    const fb = buildAnalysisCompleteFeedback({
      requestedCompareTimeframes: ['30m', '15m'],
      requestedCount: 2,
      completedCount: 2,
      unavailableCount: 0,
      failedCount: 0,
      lifecycleStatus: 'complete',
    });
    expect(fb.state).toBe('analysis_completed_with_comparisons');
    expect(fb.comparisonCount).toBe(2);
  });
});

describe('analysis complete comparison message EN', () => {
  const t = makeT(en as LocaleMap);

  it('0 comparisons — primary only', () => {
    expect(formatAnalysisCompleteComparisonMessage(0, t, 'en')).toBe(
      'Analysis complete: primary timeframe only.',
    );
    expect(
      trendFeedbackMessage({ state: 'analysis_completed', comparisonCount: 0 }, t, 'en'),
    ).toBe('Analysis complete: primary timeframe only.');
  });

  it('1 comparison — singular', () => {
    expect(formatAnalysisCompleteComparisonMessage(1, t, 'en')).toBe(
      'Analysis complete: primary + 1 comparison timeframe.',
    );
  });

  it('2 comparisons — plural', () => {
    expect(formatAnalysisCompleteComparisonMessage(2, t, 'en')).toBe(
      'Analysis complete: primary + 2 comparison timeframes.',
    );
  });

  it('3 comparisons — plural', () => {
    expect(formatAnalysisCompleteComparisonMessage(3, t, 'en')).toBe(
      'Analysis complete: primary + 3 comparison timeframes.',
    );
  });

  it('does not leak brace placeholders', () => {
    for (const count of [0, 1, 2, 3]) {
      const msg = formatAnalysisCompleteComparisonMessage(count, t, 'en');
      expect(msg).not.toMatch(/[{][{]?/);
      expect(msg).not.toMatch(/trend_feedback_/);
    }
  });
});

describe('analysis complete comparison message FA', () => {
  const t = makeT(fa as LocaleMap);

  it('0 comparisons — primary only', () => {
    expect(formatAnalysisCompleteComparisonMessage(0, t, 'fa')).toBe(
      'تحلیل کامل شد: فقط تایم‌فریم اصلی.',
    );
  });

  it('1 comparison — singular with localized digit', () => {
    expect(formatAnalysisCompleteComparisonMessage(1, t, 'fa')).toBe(
      'تحلیل کامل شد: تایم‌فریم اصلی + ۱ تایم‌فریم مقایسه.',
    );
  });

  it('2 comparisons — plural with localized digits', () => {
    expect(formatAnalysisCompleteComparisonMessage(2, t, 'fa')).toBe(
      'تحلیل کامل شد: تایم‌فریم اصلی + ۲ تایم‌فریم مقایسه.',
    );
  });

  it('3 comparisons — plural with localized digits', () => {
    expect(formatAnalysisCompleteComparisonMessage(3, t, 'fa')).toBe(
      'تحلیل کامل شد: تایم‌فریم اصلی + ۳ تایم‌فریم مقایسه.',
    );
  });

  it('does not leak brace placeholders or raw keys', () => {
    for (const count of [0, 1, 2, 3]) {
      const msg = formatAnalysisCompleteComparisonMessage(count, t, 'fa');
      expect(msg).not.toMatch(/[{][{]?/);
      expect(msg).not.toMatch(/trend_feedback_/);
    }
  });
});
