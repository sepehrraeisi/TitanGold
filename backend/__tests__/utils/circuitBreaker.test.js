/**
 * BACKEND-016: Circuit Breaker Unit Tests
 * Tests for circuit breaker implementation
 */

import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  circuitBreakerManager
} from '../../utils/circuitBreaker.js';

describe('Circuit Breaker (BACKEND-016)', () => {
  let breaker;

  beforeEach(() => {
    // Create a fresh circuit breaker for each test
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 5,
      openTimeout: 1000, // 1 second for faster tests
      successThreshold: 2,
      timeout: 500
    });
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have zero failure count', () => {
      expect(breaker.failureCount).toBe(0);
    });

    it('should have initial metrics', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successfulCalls).toBe(0);
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.rejectedCalls).toBe(0);
    });
  });

  describe('Successful Execution', () => {
    it('should execute successful function', async () => {
      const result = await breaker.execute(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should increment success metrics', async () => {
      await breaker.execute(async () => 'success');
      
      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successfulCalls).toBe(1);
      expect(metrics.failedCalls).toBe(0);
    });

    it('should reset failure count on success', async () => {
      // Fail a few times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.failureCount).toBe(3);

      // Success should reset count
      await breaker.execute(async () => 'success');
      expect(breaker.failureCount).toBe(0);
    });
  });

  describe('Failed Execution', () => {
    it('should handle failed execution', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('Test failure');
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Test failure');
      }
    });

    it('should increment failure count', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.failureCount).toBe(1);
    });

    it('should increment failure metrics', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch (e) {
        // Expected
      }

      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.failedCalls).toBe(1);
    });
  });

  describe('Circuit Opening', () => {
    it('should open circuit after threshold failures', async () => {
      // Fail 5 times (threshold)
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.isOpen()).toBe(true);
    });

    it('should reject calls when circuit is open', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      // Next call should be rejected immediately
      try {
        await breaker.execute(async () => 'success');
        fail('Should have rejected call');
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is OPEN');
        expect(error.isCircuitBreakerError).toBe(true);
      }
    });

    it('should increment rejected calls metric', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      // Try to call - should be rejected
      try {
        await breaker.execute(async () => 'success');
      } catch (e) {
        // Expected
      }

      const metrics = breaker.getMetrics();
      expect(metrics.rejectedCalls).toBe(1);
    });

    it('should record state transition', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.recentTransitions.length).toBeGreaterThan(0);
      
      const lastTransition = metrics.recentTransitions[metrics.recentTransitions.length - 1];
      expect(lastTransition.from).toBe(CircuitState.CLOSED);
      expect(lastTransition.to).toBe(CircuitState.OPEN);
    });
  });

  describe('Half-Open State', () => {
    it('should transition to half-open after timeout', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should transition to half-open
      try {
        await breaker.execute(async () => {
          throw new Error('still failing');
        });
      } catch (e) {
        // Expected
      }

      // Should have transitioned through half-open (may be open again now)
      expect([CircuitState.HALF_OPEN, CircuitState.OPEN]).toContain(breaker.getState());
    });

    it('should close circuit after successful calls in half-open', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Succeed twice (success threshold is 2)
      await breaker.execute(async () => 'success1');
      await breaker.execute(async () => 'success2');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in half-open', async () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Fail in half-open
      try {
        await breaker.execute(async () => {
          throw new Error('fail again');
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow requests', async () => {
      const slowBreaker = new CircuitBreaker('slow-test', {
        timeout: 100
      });

      try {
        await slowBreaker.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return 'should not reach here';
        });
        fail('Should have timed out');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should count timeout as failure', async () => {
      const slowBreaker = new CircuitBreaker('slow-test', {
        timeout: 100,
        failureThreshold: 2
      });

      // Timeout twice
      for (let i = 0; i < 2; i++) {
        try {
          await slowBreaker.execute(async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
          });
        } catch (e) {
          // Expected
        }
      }

      expect(slowBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Metrics', () => {
    it('should calculate failure rate', async () => {
      // 3 successes, 2 failures
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');
      
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}
      
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch (e) {}

      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(5);
      expect(metrics.successfulCalls).toBe(3);
      expect(metrics.failedCalls).toBe(2);
      expect(metrics.failureRate).toBe(40); // 2/5 = 40%
      expect(metrics.successRate).toBe(60); // 3/5 = 60%
    });
  });

  describe('Manual Control', () => {
    it('should force open circuit', () => {
      breaker.forceOpen();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should force close circuit', () => {
      breaker.forceOpen();
      breaker.forceClose();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.failureCount).toBe(0);
    });

    it('should reset circuit', () => {
      // Create some state
      breaker.failureCount = 3;
      breaker.successCount = 1;
      breaker.forceOpen();

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.failureCount).toBe(0);
      expect(breaker.successCount).toBe(0);
    });
  });

  describe('Circuit Breaker Manager', () => {
    let manager;

    beforeEach(() => {
      manager = new CircuitBreakerManager();
    });

    it('should create and retrieve circuit breaker', () => {
      const breaker = manager.getBreaker('test-api');
      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.name).toBe('test-api');
    });

    it('should reuse existing circuit breaker', () => {
      const breaker1 = manager.getBreaker('test-api');
      const breaker2 = manager.getBreaker('test-api');
      expect(breaker1).toBe(breaker2);
    });

    it('should get all breakers', () => {
      manager.getBreaker('api1');
      manager.getBreaker('api2');
      manager.getBreaker('api3');

      const breakers = manager.getAllBreakers();
      expect(breakers.size).toBe(3);
    });

    it('should get all metrics', () => {
      manager.getBreaker('api1');
      manager.getBreaker('api2');

      const metrics = manager.getAllMetrics();
      expect(metrics.length).toBe(2);
      expect(metrics[0]).toHaveProperty('name');
      expect(metrics[0]).toHaveProperty('state');
    });

    it('should get health summary', () => {
      const b1 = manager.getBreaker('api1');
      const b2 = manager.getBreaker('api2');
      const b3 = manager.getBreaker('api3');

      b2.forceOpen();

      const summary = manager.getHealthSummary();
      expect(summary.total).toBe(3);
      expect(summary.closed).toBe(2);
      expect(summary.open).toBe(1);
      expect(summary.healthy).toBe(false);
    });

    it('should reset all breakers', () => {
      const b1 = manager.getBreaker('api1');
      const b2 = manager.getBreaker('api2');

      b1.forceOpen();
      b2.forceOpen();

      manager.resetAll();

      expect(b1.getState()).toBe(CircuitState.CLOSED);
      expect(b2.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Global Manager Instance', () => {
    it('should provide global circuit breaker manager', () => {
      expect(circuitBreakerManager).toBeInstanceOf(CircuitBreakerManager);
    });

    it('should allow getting breakers from global instance', () => {
      const breaker = circuitBreakerManager.getBreaker('global-test');
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });
  });
});
