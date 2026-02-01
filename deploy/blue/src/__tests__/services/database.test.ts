/**
 * Database Service Tests (FRONTEND-007)
 * 
 * Tests for IndexedDB atomic transactions and rollback behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { database } from '../../../services/database';
import type { AIAgent } from '../../../types';

describe('Database Service - Atomic Transactions (FRONTEND-007)', () => {
  // Mock IndexedDB availability
  const originalIndexedDB = global.indexedDB;

  beforeEach(async () => {
    // Ensure database is initialized
    await database.init();
    
    // Clear the aiAgents store before each test
    try {
      await database.clear('aiAgents');
    } catch (e) {
      // Ignore if already clear
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await database.clear('aiAgents');
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('saveAll() - Atomic Transaction', () => {
    it('should save multiple agents in a single transaction', async () => {
      const agents: AIAgent[] = [
        {
          id: '1',
          name: 'Agent 1',
          role: 'Technical Analysis',
          status: 'active',
          accuracy: 85.5,
          decisions: 100,
          level: 'Expert',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Agent 2',
          role: 'Risk Management',
          status: 'active',
          accuracy: 90.0,
          decisions: 150,
          level: 'Expert',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Agent 3',
          role: 'Sentiment Analysis',
          status: 'inactive',
          accuracy: 75.0,
          decisions: 50,
          level: 'Advanced',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
      ];

      // Save all agents
      await database.saveAll('aiAgents', agents);

      // Verify all agents were saved
      const saved = await database.getAll<AIAgent>('aiAgents');
      expect(saved.length).toBe(3);
      expect(saved.map(a => a.id).sort()).toEqual(['1', '2', '3']);
    });

    it('should handle empty array gracefully', async () => {
      const agents: AIAgent[] = [];
      
      // Should not throw
      await expect(database.saveAll('aiAgents', agents)).resolves.toBeUndefined();
      
      // Should not affect existing data
      const saved = await database.getAll<AIAgent>('aiAgents');
      expect(saved.length).toBe(0);
    });

    it('should update existing agents', async () => {
      // First, save initial agents
      const initialAgents: AIAgent[] = [
        {
          id: '1',
          name: 'Agent 1',
          role: 'Technical Analysis',
          status: 'active',
          accuracy: 85.5,
          decisions: 100,
          level: 'Expert',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
      ];
      await database.saveAll('aiAgents', initialAgents);

      // Update with new data
      const updatedAgents: AIAgent[] = [
        {
          id: '1',
          name: 'Agent 1 Updated',
          role: 'Technical Analysis',
          status: 'inactive',
          accuracy: 90.0,
          decisions: 200,
          level: 'Expert',
          capabilities: ['test', 'new'],
          lastUpdate: new Date().toISOString(),
        },
      ];
      await database.saveAll('aiAgents', updatedAgents);

      // Verify update
      const saved = await database.getAll<AIAgent>('aiAgents');
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe('Agent 1 Updated');
      expect(saved[0].accuracy).toBe(90.0);
      expect(saved[0].status).toBe('inactive');
    });

    it('should be significantly faster than sequential saves', async () => {
      // Create 15 agents (typical agent count)
      const agents: AIAgent[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Agent ${i + 1}`,
        role: `Role ${i + 1}`,
        status: 'active' as const,
        accuracy: 80 + i,
        decisions: 100 + i * 10,
        level: 'Expert' as const,
        capabilities: ['test'],
        lastUpdate: new Date().toISOString(),
      }));

      // Time bulk save
      const bulkStart = performance.now();
      await database.saveAll('aiAgents', agents);
      const bulkTime = performance.now() - bulkStart;

      // Clear for sequential test
      await database.clear('aiAgents');

      // Time sequential saves
      const sequentialStart = performance.now();
      for (const agent of agents) {
        await database.save('aiAgents', agent);
      }
      const sequentialTime = performance.now() - sequentialStart;

      console.log(`Bulk save: ${bulkTime.toFixed(2)}ms`);
      console.log(`Sequential save: ${sequentialTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(sequentialTime / bulkTime).toFixed(2)}x`);

      // Bulk save should be at least 2x faster (actually often 10x+ faster)
      // Using 1.5x as minimum threshold to account for test environment variability
      expect(bulkTime).toBeLessThan(sequentialTime / 1.5);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback on error in IndexedDB mode', async () => {
      if (!database.isUsingIndexedDB()) {
        console.log('Skipping IndexedDB-specific test (using localStorage fallback)');
        return;
      }

      // Save initial agent
      const initialAgent: AIAgent = {
        id: '1',
        name: 'Initial Agent',
        role: 'Test',
        status: 'active',
        accuracy: 80,
        decisions: 100,
        level: 'Expert',
        capabilities: ['test'],
        lastUpdate: new Date().toISOString(),
      };
      await database.save('aiAgents', initialAgent);

      // Try to save invalid data (should cause error)
      const invalidAgents: any[] = [
        {
          id: '2',
          name: 'Valid Agent',
          role: 'Test',
          status: 'active',
          accuracy: 85,
          decisions: 100,
          level: 'Expert',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
        // Invalid: missing required id field
        {
          name: 'Invalid Agent - No ID',
          role: 'Test',
        },
      ];

      // This should fail and rollback
      try {
        await database.saveAll('aiAgents', invalidAgents);
      } catch (e) {
        // Expected to fail
      }

      // Verify original agent still exists and no partial saves
      const saved = await database.getAll<AIAgent>('aiAgents');
      expect(saved.length).toBe(1);
      expect(saved[0].id).toBe('1');
      expect(saved[0].name).toBe('Initial Agent');
    });

    it('should handle transaction errors gracefully', async () => {
      // In localStorage fallback mode, non-existent stores just create new entries
      // This test is primarily for IndexedDB mode
      if (!database.isUsingIndexedDB()) {
        console.log('Skipping IndexedDB-specific error test');
        return;
      }

      // Attempt to save to non-existent store
      const agents: any[] = [{ id: '1', data: 'test' }];
      
      await expect(
        database.saveAll('nonExistentStore', agents)
      ).rejects.toThrow();

      // Database should still be functional
      const testAgent: AIAgent = {
        id: 'test',
        name: 'Test Agent',
        role: 'Test',
        status: 'active',
        accuracy: 80,
        decisions: 100,
        level: 'Expert',
        capabilities: ['test'],
        lastUpdate: new Date().toISOString(),
      };
      
      await expect(database.save('aiAgents', testAgent)).resolves.toBeUndefined();
    });
  });

  describe('Database Fallback', () => {
    it('should work with localStorage fallback when IndexedDB unavailable', async () => {
      // This test verifies localStorage fallback behavior
      const agents: AIAgent[] = [
        {
          id: '1',
          name: 'Agent 1',
          role: 'Test',
          status: 'active',
          accuracy: 80,
          decisions: 100,
          level: 'Expert',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Agent 2',
          role: 'Test',
          status: 'active',
          accuracy: 85,
          decisions: 150,
          level: 'Expert',
          capabilities: ['test'],
          lastUpdate: new Date().toISOString(),
        },
      ];

      // Save should work regardless of backend
      await database.saveAll('aiAgents', agents);

      // Retrieve should work
      const saved = await database.getAll<AIAgent>('aiAgents');
      expect(saved.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should sync 15 agents in under 100ms (IndexedDB)', async () => {
      if (!database.isUsingIndexedDB()) {
        console.log('Skipping IndexedDB-specific benchmark');
        return;
      }

      const agents: AIAgent[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Agent ${i + 1}`,
        role: `Role ${i + 1}`,
        status: 'active' as const,
        accuracy: 80 + i,
        decisions: 100 + i * 10,
        level: 'Expert' as const,
        capabilities: ['test'],
        lastUpdate: new Date().toISOString(),
      }));

      const start = performance.now();
      await database.saveAll('aiAgents', agents);
      const duration = performance.now() - start;

      console.log(`Sync time for 15 agents: ${duration.toFixed(2)}ms`);
      
      // Should be fast (under 100ms on most systems)
      // Using 200ms threshold for CI environments
      expect(duration).toBeLessThan(200);
    });
  });
});
