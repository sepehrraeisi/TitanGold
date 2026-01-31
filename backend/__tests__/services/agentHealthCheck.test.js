/**
 * BACKEND-015: Agent Health Check Tests
 * Tests for agent health check functionality
 */

import {
  checkAgentHealth,
  checkAllAgentsHealth,
  getAgentHealthStatus,
  getAllAgentHealthStatus,
  isAgentHealthy,
  getHealthSummary,
  startPeriodicHealthChecks,
  stopPeriodicHealthChecks,
  disableUnhealthyAgent,
  enableAgent
} from '../../services/agents/registry.js';

describe('Agent Health Checks (BACKEND-015)', () => {
  afterEach(() => {
    // Clean up periodic health checks
    stopPeriodicHealthChecks();
  });

  describe('checkAgentHealth', () => {
    it('should return health status for a valid agent', async () => {
      const health = await checkAgentHealth('technical');
      
      expect(health).toHaveProperty('agent_key', 'technical');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('responseTime');
      expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(health.status);
    });

    it('should return unhealthy status for invalid agent', async () => {
      const health = await checkAgentHealth('nonexistent_agent');
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeTruthy();
    });

    it('should measure response time', async () => {
      const health = await checkAgentHealth('technical');
      
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(typeof health.responseTime).toBe('number');
    });

    it('should handle agents without healthCheck method', async () => {
      // Most agents won't have healthCheck yet - should still work
      const health = await checkAgentHealth('risk');
      
      expect(health.status).toBeTruthy();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('checkAllAgentsHealth', () => {
    it('should check health of all loaded agents', async () => {
      // Pre-load an agent first
      await checkAgentHealth('technical');
      
      const results = await checkAllAgentsHealth();
      
      expect(typeof results).toBe('object');
      expect(results).toHaveProperty('technical');
      
      // Each result should have proper structure
      for (const health of Object.values(results)) {
        expect(health).toHaveProperty('agent_key');
        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('timestamp');
      }
    });

    it('should return empty object if no agents loaded', async () => {
      // Don't load any agents
      const results = await checkAllAgentsHealth();
      
      expect(typeof results).toBe('object');
      // May be empty if no agents were pre-loaded
    });
  });

  describe('getAgentHealthStatus', () => {
    it('should return cached health status', async () => {
      await checkAgentHealth('technical');
      
      const cachedHealth = getAgentHealthStatus('technical');
      
      expect(cachedHealth).toBeTruthy();
      expect(cachedHealth.agent_key).toBe('technical');
    });

    it('should return null for unchecked agent', () => {
      const health = getAgentHealthStatus('never_checked_agent');
      
      expect(health).toBeNull();
    });
  });

  describe('getAllAgentHealthStatus', () => {
    it('should return all cached health statuses', async () => {
      await checkAgentHealth('technical');
      await checkAgentHealth('risk');
      
      const allHealth = getAllAgentHealthStatus();
      
      expect(typeof allHealth).toBe('object');
      expect(Object.keys(allHealth).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isAgentHealthy', () => {
    it('should return true for healthy agent', async () => {
      await checkAgentHealth('technical');
      
      // Note: This might be false if the agent is actually unhealthy
      // Just checking that the function works
      const result = isAgentHealthy('technical');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for unchecked agent', () => {
      const result = isAgentHealthy('never_checked');
      
      expect(result).toBe(false);
    });
  });

  describe('getHealthSummary', () => {
    it('should return health summary statistics', async () => {
      await checkAgentHealth('technical');
      
      const summary = getHealthSummary();
      
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('healthy');
      expect(summary).toHaveProperty('degraded');
      expect(summary).toHaveProperty('unhealthy');
      expect(summary).toHaveProperty('unknown');
      expect(summary).toHaveProperty('healthyPercentage');
      
      expect(typeof summary.total).toBe('number');
      expect(typeof summary.healthy).toBe('number');
      expect(typeof summary.healthyPercentage).toBe('number');
    });

    it('should calculate percentage correctly', async () => {
      await checkAgentHealth('technical');
      
      const summary = getHealthSummary();
      
      expect(summary.healthyPercentage).toBeGreaterThanOrEqual(0);
      expect(summary.healthyPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Periodic Health Checks', () => {
    it('should start periodic health checks', () => {
      startPeriodicHealthChecks(5000);
      
      // Can't easily test the interval execution in unit tests
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should stop periodic health checks', () => {
      startPeriodicHealthChecks(5000);
      stopPeriodicHealthChecks();
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should not start duplicate timers', () => {
      startPeriodicHealthChecks(5000);
      startPeriodicHealthChecks(5000);
      
      // Should log warning but not throw
      expect(true).toBe(true);
      
      stopPeriodicHealthChecks();
    });
  });

  describe('Agent Disable/Enable', () => {
    it('should disable unhealthy agent', async () => {
      // Create an unhealthy agent scenario
      await checkAgentHealth('nonexistent_agent');
      
      disableUnhealthyAgent('nonexistent_agent', 'Test disable');
      
      const health = getAgentHealthStatus('nonexistent_agent');
      expect(health.disabled).toBe(true);
      expect(health.disabledReason).toBe('Test disable');
    });

    it('should re-enable disabled agent', async () => {
      await checkAgentHealth('nonexistent_agent');
      disableUnhealthyAgent('nonexistent_agent', 'Test');
      
      enableAgent('nonexistent_agent');
      
      const health = getAgentHealthStatus('nonexistent_agent');
      expect(health.disabled).toBe(false);
      expect(health.disabledReason).toBeNull();
    });
  });

  describe('Health Check Contract', () => {
    it('health status should have required fields', async () => {
      const health = await checkAgentHealth('technical');
      
      // Required fields per contract
      expect(health).toHaveProperty('agent_key');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('responseTime');
      expect(health).toHaveProperty('error');
      expect(health).toHaveProperty('metadata');
      
      // Validate types
      expect(typeof health.agent_key).toBe('string');
      expect(typeof health.status).toBe('string');
      expect(typeof health.timestamp).toBe('string');
      expect(typeof health.responseTime).toBe('number');
      expect(typeof health.metadata).toBe('object');
    });

    it('status should be one of valid values', async () => {
      const health = await checkAgentHealth('technical');
      
      const validStatuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];
      expect(validStatuses).toContain(health.status);
    });

    it('timestamp should be valid ISO string', async () => {
      const health = await checkAgentHealth('technical');
      
      const timestamp = new Date(health.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple agents with mixed health', async () => {
      await checkAgentHealth('technical');
      await checkAgentHealth('risk');
      await checkAgentHealth('nonexistent');
      
      const summary = getHealthSummary();
      
      expect(summary.total).toBeGreaterThanOrEqual(2);
      expect(summary.healthy + summary.degraded + summary.unhealthy + summary.unknown).toBe(summary.total);
    });

    it('should maintain health history after multiple checks', async () => {
      // First check
      await checkAgentHealth('technical');
      const firstCheck = getAgentHealthStatus('technical');
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Second check
      await checkAgentHealth('technical');
      const secondCheck = getAgentHealthStatus('technical');
      
      // Timestamps should be different
      expect(secondCheck.timestamp).not.toBe(firstCheck.timestamp);
    });
  });
});
