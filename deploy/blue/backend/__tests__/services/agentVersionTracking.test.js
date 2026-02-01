// ============================================================================
// Unit Tests: Agent Version Tracking (BACKEND-017)
// ============================================================================
//
// PREREQUISITE: Run migration 010_add_agent_versions.sql before these tests
// 
// Command:
//   psql -U postgres -d titangold_db -f backend/database/migrations/010_add_agent_versions.sql
//
// Or use the migration script:
//   cd backend && npm run migrate
//
// ============================================================================

import pool from '../../database/db.js';
import {
  getAgentVersion,
  bumpAgentVersion,
  incrementAgentVersion,
  getAgentVersionHistory,
  rollbackAgentVersion,
  getDecisionsByVersion,
  getAllAgentVersions,
  recordDecisionVersion
} from '../../services/agents/registry.js';

describe('Agent Version Tracking (BACKEND-017)', () => {
  let testAgentId;
  let testAgentKey = 'technical'; // Using existing technical agent

  beforeAll(async () => {
    // Get test agent ID
    const result = await pool.query(
      'SELECT id FROM ai_agents WHERE agent_key = $1',
      [testAgentKey]
    );
    
    if (result.rows.length > 0) {
      testAgentId = result.rows[0].id;
    }
  });

  beforeEach(async () => {
    // Reset technical agent to v1.0.0 before each test
    await pool.query(
      'UPDATE ai_agents SET version = $1 WHERE agent_key = $2',
      ['1.0.0', testAgentKey]
    );
  });

  // ============================================================================
  // Get Agent Version
  // ============================================================================

  describe('getAgentVersion', () => {
    it('should retrieve current agent version', async () => {
      const version = await getAgentVersion(testAgentKey);
      expect(version).toBe('1.0.0');
    });

    it('should throw error for non-existent agent', async () => {
      await expect(getAgentVersion('nonexistent')).rejects.toThrow('Agent not found');
    });
  });

  // ============================================================================
  // Bump Agent Version
  // ============================================================================

  describe('bumpAgentVersion', () => {
    it('should bump agent version successfully', async () => {
      const result = await bumpAgentVersion(
        testAgentKey,
        '1.1.0',
        'Added new feature',
        'test_user'
      );

      expect(result.success).toBe(true);
      expect(result.agent_key).toBe(testAgentKey);
      expect(result.previous_version).toBe('1.0.0');
      expect(result.new_version).toBe('1.1.0');
      expect(result.change_description).toBe('Added new feature');
    });

    it('should update version in database', async () => {
      await bumpAgentVersion(testAgentKey, '1.2.0', 'Test update');

      const version = await getAgentVersion(testAgentKey);
      expect(version).toBe('1.2.0');
    });

    it('should create version history entry', async () => {
      await bumpAgentVersion(testAgentKey, '1.1.0', 'History test');

      const history = await getAgentVersionHistory(testAgentKey, 1);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].version).toBe('1.1.0');
      expect(history[0].previous_version).toBe('1.0.0');
      expect(history[0].change_type).toBe('update');
    });

    it('should throw error for non-existent agent', async () => {
      await expect(
        bumpAgentVersion('nonexistent', '2.0.0', 'Test')
      ).rejects.toThrow('Agent not found');
    });
  });

  // ============================================================================
  // Increment Agent Version
  // ============================================================================

  describe('incrementAgentVersion', () => {
    it('should auto-increment patch version', async () => {
      const result = await incrementAgentVersion(testAgentKey, 'Bug fix');

      expect(result.success).toBe(true);
      expect(result.new_version).toBe('1.0.1');
    });

    it('should increment from 1.0.1 to 1.0.2', async () => {
      await bumpAgentVersion(testAgentKey, '1.0.1', 'First patch');
      const result = await incrementAgentVersion(testAgentKey, 'Second patch');

      expect(result.new_version).toBe('1.0.2');
    });

    it('should increment from 1.5.9 to 1.5.10', async () => {
      await bumpAgentVersion(testAgentKey, '1.5.9', 'Setup');
      const result = await incrementAgentVersion(testAgentKey, 'Increment');

      expect(result.new_version).toBe('1.5.10');
    });
  });

  // ============================================================================
  // Version History
  // ============================================================================

  describe('getAgentVersionHistory', () => {
    it('should retrieve version history', async () => {
      // Create some history
      await bumpAgentVersion(testAgentKey, '1.1.0', 'First update');
      await bumpAgentVersion(testAgentKey, '1.2.0', 'Second update');
      await bumpAgentVersion(testAgentKey, '1.3.0', 'Third update');

      const history = await getAgentVersionHistory(testAgentKey, 10);

      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history[0].version).toBe('1.3.0'); // Most recent first
      expect(history[0].previous_version).toBe('1.2.0');
    });

    it('should respect limit parameter', async () => {
      // Create multiple versions
      for (let i = 1; i <= 5; i++) {
        await bumpAgentVersion(testAgentKey, `1.${i}.0`, `Update ${i}`);
      }

      const history = await getAgentVersionHistory(testAgentKey, 3);
      expect(history.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for agent with no history', async () => {
      // Use a different agent that might not have history
      const history = await getAgentVersionHistory('timing', 10);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // ============================================================================
  // Rollback Version
  // ============================================================================

  describe('rollbackAgentVersion', () => {
    it('should rollback to previous version', async () => {
      // Create version history
      await bumpAgentVersion(testAgentKey, '1.1.0', 'First');
      await bumpAgentVersion(testAgentKey, '1.2.0', 'Second');

      // Rollback to 1.1.0
      const result = await rollbackAgentVersion(testAgentKey, '1.1.0', 'admin');

      expect(result.success).toBe(true);
      expect(result.agent_key).toBe(testAgentKey);
      expect(result.new_version).toBe('1.1.0');

      // Verify version in database
      const currentVersion = await getAgentVersion(testAgentKey);
      expect(currentVersion).toBe('1.1.0');
    });

    it('should create rollback entry in history', async () => {
      await bumpAgentVersion(testAgentKey, '1.1.0', 'First');
      await rollbackAgentVersion(testAgentKey, '1.0.0', 'admin');

      const history = await getAgentVersionHistory(testAgentKey, 1);
      expect(history[0].change_type).toBe('rollback');
      expect(history[0].version).toBe('1.0.0');
    });
  });

  // ============================================================================
  // Get Decisions by Version
  // ============================================================================

  describe('getDecisionsByVersion', () => {
    it('should query decisions by version', async () => {
      // This test assumes there might be decisions in the database
      const decisions = await getDecisionsByVersion(testAgentKey, '1.0.0', 10);

      expect(Array.isArray(decisions)).toBe(true);
      // Note: May be empty if no decisions exist for this version
    });

    it('should respect limit parameter', async () => {
      const decisions = await getDecisionsByVersion(testAgentKey, '1.0.0', 5);

      expect(decisions.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================================
  // Get All Agent Versions
  // ============================================================================

  describe('getAllAgentVersions', () => {
    it('should retrieve version summary for all agents', async () => {
      const summary = await getAllAgentVersions();

      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBeGreaterThan(0);

      // Check structure of first item
      const first = summary[0];
      expect(first).toHaveProperty('agent_key');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('current_version');
    });

    it('should include technical agent in summary', async () => {
      const summary = await getAllAgentVersions();
      const technical = summary.find(s => s.agent_key === testAgentKey);

      expect(technical).toBeDefined();
      expect(technical.current_version).toBeDefined();
    });
  });

  // ============================================================================
  // Record Decision Version
  // ============================================================================

  describe('recordDecisionVersion', () => {
    it('should record agent version for a decision', async () => {
      if (!testAgentId) {
        console.warn('Skipping test: testAgentId not available');
        return;
      }

      // Create a test decision
      const decisionResult = await pool.query(
        `INSERT INTO ai_decisions (agent_id, user_id, decision_type, confidence, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [testAgentId, null, 'TEST', 0.85]
      );

      const decisionId = decisionResult.rows[0].id;

      // Record version
      const decision = { id: decisionId, agent_id: testAgentId };
      const version = await recordDecisionVersion(decision);

      expect(version).toBeDefined();
      expect(typeof version).toBe('string');

      // Verify it was recorded in database
      const result = await pool.query(
        'SELECT agent_version FROM ai_decisions WHERE id = $1',
        [decisionId]
      );

      expect(result.rows[0].agent_version).toBe(version);

      // Cleanup
      await pool.query('DELETE FROM ai_decisions WHERE id = $1', [decisionId]);
    });

    it('should return null for non-existent agent', async () => {
      const decision = { id: 'fake-id', agent_id: '00000000-0000-0000-0000-000000000000' };
      const version = await recordDecisionVersion(decision);

      expect(version).toBeNull();
    });
  });

  // ============================================================================
  // Integration: Version Tracking Workflow
  // ============================================================================

  describe('Integration: Complete Version Workflow', () => {
    it('should track complete version lifecycle', async () => {
      // 1. Start at v1.0.0
      let version = await getAgentVersion(testAgentKey);
      expect(version).toBe('1.0.0');

      // 2. Increment to v1.0.1 (bug fix)
      await incrementAgentVersion(testAgentKey, 'Fixed calculation bug');
      version = await getAgentVersion(testAgentKey);
      expect(version).toBe('1.0.1');

      // 3. Bump to v1.1.0 (new feature)
      await bumpAgentVersion(testAgentKey, '1.1.0', 'Added new indicator');
      version = await getAgentVersion(testAgentKey);
      expect(version).toBe('1.1.0');

      // 4. Check history
      const history = await getAgentVersionHistory(testAgentKey, 5);
      expect(history.length).toBeGreaterThanOrEqual(2);

      // 5. Rollback to v1.0.1
      await rollbackAgentVersion(testAgentKey, '1.0.1', 'test');
      version = await getAgentVersion(testAgentKey);
      expect(version).toBe('1.0.1');

      // 6. Verify rollback in history
      const historyAfterRollback = await getAgentVersionHistory(testAgentKey, 1);
      expect(historyAfterRollback[0].change_type).toBe('rollback');
    });
  });
});
