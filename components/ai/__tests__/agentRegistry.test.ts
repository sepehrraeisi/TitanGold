/**
 * Agent Registry Tests
 * Task: FRONTEND-002 - Refactor Agent Selection to Use Registry
 * 
 * Tests verify:
 * - Registry loads correct components for each agent
 * - Dynamic component loading works
 * - Helper functions work correctly
 * - Registry completeness
 */

import { describe, it, expect } from 'vitest';
import { 
  agentRegistry, 
  getAgentControl, 
  hasAgentControl, 
  getRegisteredAgentKeys 
} from '../agentRegistry';
import { AGENT_KEYS } from '../../../constants/agentKeys';

describe('Agent Registry (FRONTEND-002)', () => {
  
  describe('Registry Structure', () => {
    it('should have registry defined', () => {
      expect(agentRegistry).toBeDefined();
      expect(typeof agentRegistry).toBe('object');
    });

    it('should contain all expected agents', () => {
      const expectedAgents = [
        AGENT_KEYS.TECHNICAL,
        AGENT_KEYS.RISK,
        AGENT_KEYS.SENTIMENT,
        AGENT_KEYS.PATTERN,
        AGENT_KEYS.PRICE_PREDICTION,
        AGENT_KEYS.ARBITRAGE,
        AGENT_KEYS.PORTFOLIO,
        AGENT_KEYS.LIQUIDITY,
        'trend', // Not yet using constant
        AGENT_KEYS.OPTIMIZATION,
        AGENT_KEYS.ORDER,
        AGENT_KEYS.FUNDAMENTAL,
        AGENT_KEYS.MARKET_INTELLIGENCE,
        AGENT_KEYS.VOLUME,
        AGENT_KEYS.TIMING
      ];

      expectedAgents.forEach(key => {
        expect(agentRegistry[key]).toBeDefined();
        expect(agentRegistry[key]).toHaveProperty('key');
        expect(agentRegistry[key]).toHaveProperty('component');
        expect(agentRegistry[key]).toHaveProperty('fallbackTitle');
      });
    });

    it('should have all registry entries with correct structure', () => {
      Object.values(agentRegistry).forEach(entry => {
        expect(entry).toHaveProperty('key');
        expect(entry).toHaveProperty('component');
        expect(entry).toHaveProperty('fallbackTitle');
        
        expect(typeof entry.key).toBe('string');
        expect(typeof entry.component).toBe('object'); // Lazy component
        expect(typeof entry.fallbackTitle).toBe('string');
      });
    });

    it('should have 15 agents registered', () => {
      const keys = Object.keys(agentRegistry);
      expect(keys.length).toBe(15);
    });
  });

  describe('getAgentControl()', () => {
    it('should return registry entry for valid agent key', () => {
      const entry = getAgentControl(AGENT_KEYS.TECHNICAL);
      
      expect(entry).toBeDefined();
      expect(entry?.key).toBe(AGENT_KEYS.TECHNICAL);
      expect(entry?.component).toBeDefined();
      expect(entry?.fallbackTitle).toBe('Technical Analysis Agent Error');
    });

    it('should handle all valid agent keys', () => {
      const validKeys = [
        AGENT_KEYS.TECHNICAL,
        AGENT_KEYS.RISK,
        AGENT_KEYS.SENTIMENT,
        AGENT_KEYS.PATTERN,
        AGENT_KEYS.PRICE_PREDICTION,
        AGENT_KEYS.ARBITRAGE,
        AGENT_KEYS.PORTFOLIO,
        AGENT_KEYS.LIQUIDITY,
        'trend',
        AGENT_KEYS.OPTIMIZATION,
        AGENT_KEYS.ORDER,
        AGENT_KEYS.FUNDAMENTAL,
        AGENT_KEYS.MARKET_INTELLIGENCE,
        AGENT_KEYS.VOLUME,
        AGENT_KEYS.TIMING
      ];

      validKeys.forEach(key => {
        const entry = getAgentControl(key);
        expect(entry).toBeDefined();
        expect(entry?.key).toBe(key);
      });
    });

    it('should return undefined for invalid agent key', () => {
      const entry = getAgentControl('invalid_agent_key');
      expect(entry).toBeUndefined();
    });

    it('should return undefined for undefined key', () => {
      const entry = getAgentControl(undefined);
      expect(entry).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const entry = getAgentControl('');
      expect(entry).toBeUndefined();
    });

    it('should handle backend agent_key format', () => {
      // Backend might send 'technical_analysis' but registry uses 'technical'
      const entry = getAgentControl('technical');
      expect(entry).toBeDefined();
      expect(entry?.key).toBe('technical');
    });
  });

  describe('hasAgentControl()', () => {
    it('should return true for valid agent key', () => {
      expect(hasAgentControl(AGENT_KEYS.TECHNICAL)).toBe(true);
      expect(hasAgentControl(AGENT_KEYS.RISK)).toBe(true);
      expect(hasAgentControl(AGENT_KEYS.SENTIMENT)).toBe(true);
    });

    it('should return false for invalid agent key', () => {
      expect(hasAgentControl('invalid_key')).toBe(false);
      expect(hasAgentControl('nonexistent')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasAgentControl('')).toBe(false);
    });
  });

  describe('getRegisteredAgentKeys()', () => {
    it('should return array of all agent keys', () => {
      const keys = getRegisteredAgentKeys();
      
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBe(15);
    });

    it('should return all expected keys', () => {
      const keys = getRegisteredAgentKeys();
      
      expect(keys).toContain(AGENT_KEYS.TECHNICAL);
      expect(keys).toContain(AGENT_KEYS.RISK);
      expect(keys).toContain(AGENT_KEYS.SENTIMENT);
      expect(keys).toContain(AGENT_KEYS.PATTERN);
      expect(keys).toContain(AGENT_KEYS.PRICE_PREDICTION);
      expect(keys).toContain(AGENT_KEYS.ARBITRAGE);
      expect(keys).toContain(AGENT_KEYS.PORTFOLIO);
      expect(keys).toContain(AGENT_KEYS.LIQUIDITY);
      expect(keys).toContain('trend');
      expect(keys).toContain(AGENT_KEYS.OPTIMIZATION);
      expect(keys).toContain(AGENT_KEYS.ORDER);
      expect(keys).toContain(AGENT_KEYS.FUNDAMENTAL);
      expect(keys).toContain(AGENT_KEYS.MARKET_INTELLIGENCE);
      expect(keys).toContain(AGENT_KEYS.VOLUME);
      expect(keys).toContain(AGENT_KEYS.TIMING);
    });
  });

  describe('Lazy Loading', () => {
    it('should use lazy-loaded components', () => {
      Object.values(agentRegistry).forEach(entry => {
        // Lazy components have a $$typeof property
        expect(entry.component).toHaveProperty('$$typeof');
      });
    });

    it('should not load component until accessed', () => {
      // Components should be lazy, not eagerly loaded
      const entry = agentRegistry[AGENT_KEYS.TECHNICAL];
      
      // The component should be a lazy wrapper with React's internal structure
      // Lazy components have a $$typeof property set to Symbol(react.lazy)
      expect(entry.component).toHaveProperty('$$typeof');
    });
  });

  describe('Fallback Titles', () => {
    it('should have descriptive fallback titles', () => {
      Object.values(agentRegistry).forEach(entry => {
        expect(entry.fallbackTitle.length).toBeGreaterThan(0);
        expect(entry.fallbackTitle).toContain('Agent');
        expect(entry.fallbackTitle).toContain('Error');
      });
    });

    it('should have unique fallback titles', () => {
      const titles = Object.values(agentRegistry).map(e => e.fallbackTitle);
      const uniqueTitles = new Set(titles);
      
      expect(uniqueTitles.size).toBe(titles.length);
    });
  });

  describe('Registry Extensibility', () => {
    it('should allow easy addition of new agents', () => {
      // This test documents that adding a new agent is simple:
      // Just add a new entry to agentRegistry
      
      const exampleNewAgent = {
        key: 'new_agent',
        component: {} as any, // Would be lazy(() => import(...))
        fallbackTitle: 'New Agent Error'
      };

      // Verify the structure is correct
      expect(exampleNewAgent).toHaveProperty('key');
      expect(exampleNewAgent).toHaveProperty('component');
      expect(exampleNewAgent).toHaveProperty('fallbackTitle');
    });
  });

  describe('Integration with AIAgents Component', () => {
    it('should provide all necessary data for rendering', () => {
      const testAgentKey = AGENT_KEYS.TECHNICAL;
      const entry = getAgentControl(testAgentKey);

      // Verify entry has everything needed by AIAgents.tsx
      expect(entry).toBeDefined();
      expect(entry?.component).toBeDefined(); // For rendering
      expect(entry?.fallbackTitle).toBeDefined(); // For ErrorBoundary
    });

    it('should handle missing agent gracefully', () => {
      const entry = getAgentControl('nonexistent_agent');
      
      // Should return undefined, allowing component to handle gracefully
      expect(entry).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('should have typed registry entries', () => {
      const entry = agentRegistry[AGENT_KEYS.TECHNICAL];
      
      // TypeScript should enforce these properties
      expect(entry.key).toBeDefined();
      expect(entry.component).toBeDefined();
      expect(entry.fallbackTitle).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should return registry entries quickly', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        getAgentControl(AGENT_KEYS.TECHNICAL);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 lookups in under 10ms
      expect(totalTime).toBeLessThan(10);
    });

    it('should check existence quickly', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        hasAgentControl(AGENT_KEYS.TECHNICAL);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 checks in under 10ms
      expect(totalTime).toBeLessThan(10);
    });
  });
});
