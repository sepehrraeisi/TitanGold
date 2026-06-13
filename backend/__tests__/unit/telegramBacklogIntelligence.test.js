/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import { estimateWaitFromThroughput } from '../../services/telegramBacklogIntelligence.js';

describe('telegramBacklogIntelligence', () => {
  describe('estimateWaitFromThroughput', () => {
    test('zero backlog → zero wait', () => {
      expect(estimateWaitFromThroughput(0, 500)).toEqual({
        estimatedWaitHours: 0,
        estimatedWaitDays: 0,
      });
    });

    test('DIRHAM-scale backlog at ~477/hr', () => {
      const result = estimateWaitFromThroughput(368, 477.3);
      expect(result.estimatedWaitHours).toBeLessThan(1);
    });

    test('high-volume channel at ~477/hr', () => {
      const total = 1_700_000;
      const result = estimateWaitFromThroughput(total, 477.3);
      expect(result.estimatedWaitDays).toBeGreaterThan(100);
    });
  });
});
