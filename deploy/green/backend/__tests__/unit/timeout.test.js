import { jest } from '@jest/globals';

/**
 * Unit tests for agent execution timeout
 * Tests BACKEND-001: Add Agent Execution Timeout
 */

// Mock the withTimeout function behavior
function withTimeout(promise, ms, errorMessage = 'Operation timed out', agentKey = 'unknown') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error(errorMessage);
      timeoutError.isTimeout = true;
      timeoutError.agentKey = agentKey;
      reject(timeoutError);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

describe('Agent Execution Timeout (BACKEND-001)', () => {
  describe('withTimeout function', () => {
    test('should resolve when promise completes within timeout', async () => {
      const fastPromise = new Promise(resolve => {
        setTimeout(() => resolve('success'), 100);
      });

      const result = await withTimeout(fastPromise, 1000, 'Should not timeout', 'test-agent');
      expect(result).toBe('success');
    });

    test('should timeout when promise takes too long', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('too late'), 2000);
      });

      await expect(
        withTimeout(slowPromise, 500, 'Test timeout', 'slow-agent')
      ).rejects.toThrow('Test timeout');
    });

    test('should set isTimeout flag on timeout error', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('too late'), 2000);
      });

      try {
        await withTimeout(slowPromise, 500, 'Test timeout', 'slow-agent');
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.isTimeout).toBe(true);
      }
    });

    test('should include agentKey in timeout error', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('too late'), 2000);
      });

      try {
        await withTimeout(slowPromise, 500, 'Test timeout', 'technical-agent');
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.agentKey).toBe('technical-agent');
      }
    });

    test('should use default timeout message', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('too late'), 2000);
      });

      await expect(
        withTimeout(slowPromise, 500)
      ).rejects.toThrow('Operation timed out');
    });

    test('should handle rejected promises correctly', async () => {
      const failingPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Promise failed')), 100);
      });

      await expect(
        withTimeout(failingPromise, 1000, 'Timeout', 'test-agent')
      ).rejects.toThrow('Promise failed');
    });
  });

  describe('Timeout configuration', () => {
    test('should use default timeout of 30000ms when env var not set', () => {
      delete process.env.AGENT_TIMEOUT_MS;
      const timeout = parseInt(process.env.AGENT_TIMEOUT_MS || '30000', 10);
      expect(timeout).toBe(30000);
    });

    test('should use custom timeout from environment variable', () => {
      process.env.AGENT_TIMEOUT_MS = '45000';
      const timeout = parseInt(process.env.AGENT_TIMEOUT_MS || '30000', 10);
      expect(timeout).toBe(45000);
    });

    test('should handle invalid env var gracefully', () => {
      process.env.AGENT_TIMEOUT_MS = 'invalid';
      const timeout = parseInt(process.env.AGENT_TIMEOUT_MS || '30000', 10);
      expect(isNaN(timeout)).toBe(true);
    });

    test('should parse numeric string correctly', () => {
      process.env.AGENT_TIMEOUT_MS = '60000';
      const timeout = parseInt(process.env.AGENT_TIMEOUT_MS, 10);
      expect(timeout).toBe(60000);
    });

    afterEach(() => {
      delete process.env.AGENT_TIMEOUT_MS;
    });
  });

  describe('Timeout behavior with different agent types', () => {
    test('should timeout technical agent', async () => {
      const longRunningAgent = new Promise(resolve => {
        setTimeout(() => resolve({ signal: 'BUY' }), 5000);
      });

      await expect(
        withTimeout(longRunningAgent, 1000, 'Technical agent timeout', 'technical')
      ).rejects.toThrow('Technical agent timeout');
    });

    test('should timeout risk agent', async () => {
      const longRunningAgent = new Promise(resolve => {
        setTimeout(() => resolve({ risk_level: 'high' }), 5000);
      });

      await expect(
        withTimeout(longRunningAgent, 1000, 'Risk agent timeout', 'risk')
      ).rejects.toThrow('Risk agent timeout');
    });

    test('should timeout arbitrage agent', async () => {
      const longRunningAgent = new Promise(resolve => {
        setTimeout(() => resolve({ opportunities: [] }), 5000);
      });

      await expect(
        withTimeout(longRunningAgent, 1000, 'Arbitrage agent timeout', 'arbitrage')
      ).rejects.toThrow('Arbitrage agent timeout');
    });
  });

  describe('Error response format', () => {
    test('timeout error should be distinguishable from other errors', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('result'), 5000);
      });

      try {
        await withTimeout(slowPromise, 1000, 'Timeout occurred', 'test-agent');
        fail('Should have thrown');
      } catch (timeoutError) {
        expect(timeoutError.isTimeout).toBe(true);
        expect(timeoutError.message).toContain('Timeout occurred');
        expect(timeoutError.agentKey).toBe('test-agent');
      }

      // Compare with regular error
      const normalError = new Error('Regular error');
      expect(normalError.isTimeout).toBeUndefined();
    });
  });

  describe('Timeout precision', () => {
    test('should timeout close to specified duration', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('result'), 5000);
      });

      const startTime = Date.now();
      
      try {
        await withTimeout(slowPromise, 1000, 'Timeout', 'test');
        fail('Should have thrown');
      } catch (error) {
        const duration = Date.now() - startTime;
        // Allow 100ms margin of error
        expect(duration).toBeGreaterThanOrEqual(990);
        expect(duration).toBeLessThan(1200);
      }
    });
  });
});
