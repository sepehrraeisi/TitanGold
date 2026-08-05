import { describe, expect, it } from 'vitest';
import { buildAnalysisCompleteFeedback } from '../../../../../components/ai/trend/trendFeedback.ts';

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

  it('reports full comparison success', () => {
    const fb = buildAnalysisCompleteFeedback({
      requestedCompareTimeframes: ['30m', '15m'],
      requestedCount: 2,
      completedCount: 2,
      unavailableCount: 0,
      failedCount: 0,
      lifecycleStatus: 'complete',
    });
    expect(fb.state).toBe('analysis_completed_with_comparisons');
    expect(fb.detail).toBe('2/2');
  });

  it('reports partial comparison success', () => {
    const fb = buildAnalysisCompleteFeedback({
      requestedCompareTimeframes: ['30m', '15m'],
      requestedCount: 2,
      completedCount: 1,
      unavailableCount: 0,
      failedCount: 1,
      lifecycleStatus: 'complete_with_partial_comparisons',
    });
    expect(fb.state).toBe('analysis_completed_partial_comparisons');
  });

  it('reports comparison unavailable', () => {
    const fb = buildAnalysisCompleteFeedback({
      requestedCompareTimeframes: ['30m', '15m'],
      requestedCount: 2,
      completedCount: 0,
      unavailableCount: 1,
      failedCount: 1,
      lifecycleStatus: 'comparison_unavailable',
    });
    expect(fb.state).toBe('analysis_comparison_unavailable');
  });
});
