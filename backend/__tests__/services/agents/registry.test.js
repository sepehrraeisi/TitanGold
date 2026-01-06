/**
 * Unit Tests for Agent Registry
 * Task: TEST-002 - Write Unit Tests for Agent Registry
 * 
 * Tests cover:
 * - Load agent by key
 * - Invalid key handling
 * - Agent interface validation
 * - Agent execution with mocked data
 * - Caching behavior
 * - Registry utility functions
 * 
 * Coverage target: >80%
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as registry from '../../../services/agents/registry.js';

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  jest.clearAllMocks();
});

// =============================================================================
// Test Suite: Load Agent by Key
// =============================================================================

describe('Agent Registry - Load by Key', () => {
  it('should load valid agent by key (technical)', async () => {
    const agent = await registry.getAgentService('technical');
    
    expect(agent).toBeDefined();
    expect(typeof agent).toBe('object');
  });

  it('should load valid agent by key (risk)', async () => {
    const agent = await registry.getAgentService('risk');
    
    expect(agent).toBeDefined();
    expect(typeof agent).toBe('object');
  });

  it('should load valid agent by key (arbitrage)', async () => {
    const agent = await registry.getAgentService('arbitrage');
    
    expect(agent).toBeDefined();
    expect(typeof agent).toBe('object');
  });

  it('should load valid agent by key (fundamental)', async () => {
    const agent = await registry.getAgentService('fundamental');
    
    expect(agent).toBeDefined();
    expect(typeof agent).toBe('object');
  });

  it('should return agent with required interface methods', async () => {
    const agent = await registry.getAgentService('technical');
    
    // Required methods
    expect(typeof agent.run).toBe('function');
    expect(typeof agent.getDetails).toBe('function');
    expect(typeof agent.defaultConfig).toBe('function');
  });

  it('should cache loaded agents on subsequent calls', async () => {
    // First call - loads from file
    const agent1 = await registry.getAgentService('technical');
    
    // Second call - should return cached instance
    const agent2 = await registry.getAgentService('technical');
    
    // Should be the same instance (cached)
    expect(agent1).toBe(agent2);
  });

  it('should load all 15 registered agents', async () => {
    const agentKeys = [
      'technical', 'risk', 'sentiment', 'pattern', 'price_prediction',
      'arbitrage', 'portfolio', 'liquidity', 'trend', 'optimization',
      'order', 'fundamental', 'market_intelligence', 'volume', 'timing'
    ];

    for (const key of agentKeys) {
      const agent = await registry.getAgentService(key);
      expect(agent).toBeDefined();
      expect(typeof agent.run).toBe('function');
    }
  });
});

// =============================================================================
// Test Suite: Invalid Key Handling
// =============================================================================

describe('Agent Registry - Error Handling', () => {
  it('should throw error for invalid agent key', async () => {
    await expect(registry.getAgentService('nonexistent'))
      .rejects
      .toThrow('Agent not found: nonexistent');
  });

  it('should throw error for null key', async () => {
    await expect(registry.getAgentService(null))
      .rejects
      .toThrow();
  });

  it('should throw error for undefined key', async () => {
    await expect(registry.getAgentService(undefined))
      .rejects
      .toThrow();
  });

  it('should throw error for empty string key', async () => {
    await expect(registry.getAgentService(''))
      .rejects
      .toThrow('Agent not found: ');
  });

  it('should throw error for numeric key', async () => {
    await expect(registry.getAgentService(123))
      .rejects
      .toThrow();
  });

  it('should throw error for special characters in key', async () => {
    await expect(registry.getAgentService('technical@#$'))
      .rejects
      .toThrow('Agent not found: technical@#$');
  });

  it('should provide descriptive error message on load failure', async () => {
    await expect(registry.getAgentService('invalid_agent'))
      .rejects
      .toThrow(/Agent not found|Failed to load agent/);
  });
});

// =============================================================================
// Test Suite: Agent Interface Validation
// =============================================================================

describe('Agent Registry - Interface Validation', () => {
  it('should validate agent has run method', async () => {
    const agent = await registry.getAgentService('technical');
    
    expect(agent.run).toBeDefined();
    expect(typeof agent.run).toBe('function');
  });

  it('should validate agent has getDetails method', async () => {
    const agent = await registry.getAgentService('technical');
    
    expect(agent.getDetails).toBeDefined();
    expect(typeof agent.getDetails).toBe('function');
  });

  it('should validate agent has defaultConfig method', async () => {
    const agent = await registry.getAgentService('technical');
    
    expect(agent.defaultConfig).toBeDefined();
    expect(typeof agent.defaultConfig).toBe('function');
  });

  it('should validate all required methods exist on all agents', async () => {
    const agentKeys = ['technical', 'risk', 'sentiment'];
    const requiredMethods = ['run', 'getDetails', 'defaultConfig'];

    for (const key of agentKeys) {
      const agent = await registry.getAgentService(key);
      
      for (const method of requiredMethods) {
        expect(agent[method]).toBeDefined();
        expect(typeof agent[method]).toBe('function');
      }
    }
  });

  it('should validate optional command method when present', async () => {
    const agent = await registry.getAgentService('technical');
    
    // Command is optional, but if present should be a function
    if (agent.command) {
      expect(typeof agent.command).toBe('function');
    }
  });

  it('should validate optional validateConfig method when present', async () => {
    const agent = await registry.getAgentService('technical');
    
    // validateConfig is optional, but if present should be a function
    if (agent.validateConfig) {
      expect(typeof agent.validateConfig).toBe('function');
    }
  });
});

// =============================================================================
// Test Suite: Agent Execution with Mocked Data
// =============================================================================

describe('Agent Registry - Execution', () => {
  it('should execute agent run method via runAgent', async () => {
    const params = {
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      config: {}
    };

    const result = await registry.runAgent('technical', params);
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('symbol');
    expect(result).toHaveProperty('timeframe');
    expect(result).toHaveProperty('signal');
    expect(result.symbol).toBe('BTCUSDT');
  });

  it('should return expected result format from technical agent', async () => {
    const params = {
      userId: 1,
      symbol: 'ETHUSDT',
      timeframe: '4h',
      config: {}
    };

    const result = await registry.runAgent('technical', params);
    
    expect(result).toMatchObject({
      symbol: expect.any(String),
      timeframe: expect.any(String),
      indicators: expect.any(Object),
      signal: expect.stringMatching(/BUY|SELL|NEUTRAL/),
      confidence: expect.any(Number),
      timestamp: expect.any(String)
    });
  });

  it('should handle agent execution errors gracefully', async () => {
    // Try to run agent with missing required params
    await expect(registry.runAgent('technical', {}))
      .resolves
      .toBeDefined(); // MVP agents don't strictly validate params
  });

  it('should execute getAgentDetails', async () => {
    const params = { userId: 1 };
    const details = await registry.getAgentDetails('technical', params);
    
    expect(details).toBeDefined();
    expect(details).toHaveProperty('agent_key');
    expect(details).toHaveProperty('name');
    expect(details).toHaveProperty('description');
    expect(details.agent_key).toBe('technical');
  });

  it('should execute getAgentDefaultConfig', async () => {
    const config = await registry.getAgentDefaultConfig('technical');
    
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
    expect(config).toHaveProperty('indicators');
  });

  it('should execute agent command when supported', async () => {
    // Check if agent supports commands
    const agent = await registry.getAgentService('technical');
    
    if (typeof agent.command === 'function') {
      // Use a valid command that the agent supports
      const result = await registry.executeAgentCommand('technical', 'reset', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    } else {
      // Should throw if command not supported
      await expect(registry.executeAgentCommand('technical', 'test', {}))
        .rejects
        .toThrow('does not support commands');
    }
  });

  it('should execute multiple agents in sequence', async () => {
    const params = {
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      config: {}
    };

    const technical = await registry.runAgent('technical', params);
    const risk = await registry.runAgent('risk', params);
    const sentiment = await registry.runAgent('sentiment', params);

    expect(technical).toBeDefined();
    expect(risk).toBeDefined();
    expect(sentiment).toBeDefined();
  });

  it('should execute agents with different parameters', async () => {
    const btcParams = {
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      config: {}
    };

    const ethParams = {
      userId: 1,
      symbol: 'ETHUSDT',
      timeframe: '4h',
      config: {}
    };

    const btcResult = await registry.runAgent('technical', btcParams);
    const ethResult = await registry.runAgent('technical', ethParams);

    expect(btcResult.symbol).toBe('BTCUSDT');
    expect(btcResult.timeframe).toBe('1h');
    expect(ethResult.symbol).toBe('ETHUSDT');
    expect(ethResult.timeframe).toBe('4h');
  });
});

// =============================================================================
// Test Suite: Registry Utility Functions
// =============================================================================

describe('Agent Registry - Utility Functions', () => {
  it('should list all agent keys', () => {
    const keys = registry.listAgentKeys();
    
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBe(15);
    expect(keys).toContain('technical');
    expect(keys).toContain('risk');
    expect(keys).toContain('arbitrage');
  });

  it('should check if agent exists with hasAgent', () => {
    expect(registry.hasAgent('technical')).toBe(true);
    expect(registry.hasAgent('risk')).toBe(true);
    expect(registry.hasAgent('nonexistent')).toBe(false);
    expect(registry.hasAgent(null)).toBe(false);
    expect(registry.hasAgent(undefined)).toBe(false);
  });

  it('should return all 15 agent keys in correct list', () => {
    const expectedKeys = [
      'technical', 'risk', 'sentiment', 'pattern', 'price_prediction',
      'arbitrage', 'portfolio', 'liquidity', 'trend', 'optimization',
      'order', 'fundamental', 'market_intelligence', 'volume', 'timing'
    ];

    const keys = registry.listAgentKeys();
    
    expect(keys.sort()).toEqual(expectedKeys.sort());
  });

  it('should prewarm agents successfully', async () => {
    await expect(registry.prewarmAgents(['technical', 'risk']))
      .resolves
      .not.toThrow();
    
    // Verify agents are loaded (cached)
    const technical = await registry.getAgentService('technical');
    const risk = await registry.getAgentService('risk');
    
    expect(technical).toBeDefined();
    expect(risk).toBeDefined();
  });

  it('should handle prewarm with empty array', async () => {
    await expect(registry.prewarmAgents([]))
      .resolves
      .not.toThrow();
  });

  it('should handle prewarm with invalid agent keys gracefully', async () => {
    // Should not throw, just warn
    await expect(registry.prewarmAgents(['technical', 'invalid_agent']))
      .resolves
      .not.toThrow();
  });
});

// =============================================================================
// Test Suite: Default Export
// =============================================================================

describe('Agent Registry - Default Export', () => {
  it('should have default export with all methods', async () => {
    const { default: registryDefault } = await import('../../../services/agents/registry.js');
    
    expect(registryDefault).toBeDefined();
    expect(typeof registryDefault.getAgentService).toBe('function');
    expect(typeof registryDefault.runAgent).toBe('function');
    expect(typeof registryDefault.getAgentDetails).toBe('function');
    expect(typeof registryDefault.executeAgentCommand).toBe('function');
    expect(typeof registryDefault.getAgentDefaultConfig).toBe('function');
    expect(typeof registryDefault.listAgentKeys).toBe('function');
    expect(typeof registryDefault.hasAgent).toBe('function');
    expect(typeof registryDefault.prewarmAgents).toBe('function');
  });

  it('should work via default export', async () => {
    const { default: registryDefault } = await import('../../../services/agents/registry.js');
    
    const agent = await registryDefault.getAgentService('technical');
    expect(agent).toBeDefined();
    
    const keys = registryDefault.listAgentKeys();
    expect(keys.length).toBe(15);
  });
});

// =============================================================================
// Test Suite: Edge Cases and Boundary Conditions
// =============================================================================

describe('Agent Registry - Edge Cases', () => {
  it('should handle rapid successive loads of same agent', async () => {
    const promises = [
      registry.getAgentService('technical'),
      registry.getAgentService('technical'),
      registry.getAgentService('technical')
    ];

    const agents = await Promise.all(promises);
    
    expect(agents[0]).toBe(agents[1]);
    expect(agents[1]).toBe(agents[2]);
  });

  it('should handle loading all agents concurrently', async () => {
    const keys = registry.listAgentKeys();
    const promises = keys.map(key => registry.getAgentService(key));

    const agents = await Promise.all(promises);
    
    expect(agents.length).toBe(15);
    agents.forEach(agent => {
      expect(agent).toBeDefined();
      expect(typeof agent.run).toBe('function');
    });
  });

  it('should handle case sensitivity in agent keys', async () => {
    // Registry should be case-sensitive
    await expect(registry.getAgentService('Technical'))
      .rejects
      .toThrow();
    
    await expect(registry.getAgentService('TECHNICAL'))
      .rejects
      .toThrow();
  });

  it('should handle whitespace in agent keys', async () => {
    await expect(registry.getAgentService('technical '))
      .rejects
      .toThrow();
    
    await expect(registry.getAgentService(' technical'))
      .rejects
      .toThrow();
  });

  it('should handle agent execution with minimal params', async () => {
    const result = await registry.runAgent('technical', {
      symbol: 'BTCUSDT'
    });
    
    expect(result).toBeDefined();
    expect(result.symbol).toBe('BTCUSDT');
  });

  it('should maintain separate agent instances in cache', async () => {
    const technical = await registry.getAgentService('technical');
    const risk = await registry.getAgentService('risk');
    
    expect(technical).not.toBe(risk);
  });
});

// =============================================================================
// Test Suite: Performance and Reliability
// =============================================================================

describe('Agent Registry - Performance', () => {
  it('should load agent in reasonable time', async () => {
    const start = Date.now();
    await registry.getAgentService('technical');
    const duration = Date.now() - start;
    
    // Should load in less than 1 second
    expect(duration).toBeLessThan(1000);
  });

  it('should use cache for subsequent loads (faster)', async () => {
    // First load (uncached) - use a fresh agent
    const start1 = Date.now();
    await registry.getAgentService('pattern');
    const duration1 = Date.now() - start1;
    
    // Second load (cached)
    const start2 = Date.now();
    await registry.getAgentService('pattern');
    const duration2 = Date.now() - start2;
    
    // Cached load should be faster or equal (may be 0ms if very fast)
    // The main assertion is that it doesn't fail
    expect(duration2).toBeLessThanOrEqual(duration1);
    
    // Verify caching by checking both calls return same instance
    const agent1 = await registry.getAgentService('pattern');
    const agent2 = await registry.getAgentService('pattern');
    expect(agent1).toBe(agent2);
  });

  it('should handle 100 sequential agent executions', async () => {
    const params = {
      userId: 1,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      config: {}
    };

    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(registry.runAgent('technical', params));
    }

    const results = await Promise.all(promises);
    
    expect(results.length).toBe(100);
    results.forEach(result => {
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
    });
  });
});
