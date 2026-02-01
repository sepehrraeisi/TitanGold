import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  truncateAddress,
  calculatePercentageChange,
  debounce,
} from '../utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats USD currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats with different currency', () => {
      expect(formatCurrency(1000, 'EUR')).toMatch(/€|EUR/);
    });

    it('handles zero value', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles negative values', () => {
      expect(formatCurrency(-500)).toBe('-$500.00');
    });
  });

  describe('truncateAddress', () => {
    const longAddress = '0x1234567890abcdef1234567890abcdef12345678';

    it('truncates long addresses correctly', () => {
      expect(truncateAddress(longAddress)).toBe('0x1234...5678');
    });

    it('handles custom character count', () => {
      expect(truncateAddress(longAddress, 6)).toBe('0x123456...345678');
    });

    it('does not truncate short addresses', () => {
      const shortAddress = '0x12345678';
      expect(truncateAddress(shortAddress)).toBe(shortAddress);
    });

    it('handles empty string', () => {
      expect(truncateAddress('')).toBe('');
    });
  });

  describe('calculatePercentageChange', () => {
    it('calculates positive percentage change', () => {
      expect(calculatePercentageChange(100, 150)).toBe(50);
    });

    it('calculates negative percentage change', () => {
      expect(calculatePercentageChange(100, 75)).toBe(-25);
    });

    it('handles zero old value', () => {
      expect(calculatePercentageChange(0, 100)).toBe(0);
    });

    it('handles same values (no change)', () => {
      expect(calculatePercentageChange(100, 100)).toBe(0);
    });

    it('calculates percentage for decimal values', () => {
      expect(calculatePercentageChange(1.5, 2.0)).toBeCloseTo(33.33, 2);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('delays function execution', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 500);

      debouncedFunc();
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('cancels previous calls when called multiple times', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 500);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      vi.advanceTimersByTime(500);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 500);

      debouncedFunc('test', 123);
      vi.advanceTimersByTime(500);

      expect(func).toHaveBeenCalledWith('test', 123);
    });
  });
});
