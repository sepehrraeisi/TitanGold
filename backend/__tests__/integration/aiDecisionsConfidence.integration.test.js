/**
 * DB-backed proof that ai_decisions.confidence accepts NULL.
 * Uses the migrated test database (DATABASE_URL). Rolls back the disposable insert.
 * @jest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import dotenv from 'dotenv';
import pool, { query } from '../../database/db.js';

dotenv.config();

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe('ai_decisions.confidence schema nullability', () => {
  /** @type {string|null} */
  let agentId = null;
  /** @type {boolean} */
  let createdDisposableAgent = false;

  beforeAll(async () => {
    if (!hasDatabase) return;
    const existing = await query(
      `SELECT id FROM ai_agents WHERE agent_key = 'trend_detection' LIMIT 1`,
    );
    if (existing.rows[0]?.id) {
      agentId = existing.rows[0].id;
      return;
    }
    const inserted = await query(
      `INSERT INTO ai_agents (name, agent_key, type, is_enabled)
       VALUES (
         'Trend Detection Confidence Probe',
         'trend_detection_confidence_probe',
         'analysis',
         TRUE
       )
       RETURNING id`,
    );
    agentId = inserted.rows[0].id;
    createdDisposableAgent = true;
  }, 30000);

  afterAll(async () => {
    if (hasDatabase && createdDisposableAgent && agentId) {
      await query(`DELETE FROM ai_agents WHERE id = $1`, [agentId]).catch(() => {});
    }
  }, 30000);

  it('reports confidence column is_nullable = YES', async () => {
    if (!hasDatabase) {
      throw new Error('DATABASE_URL required for confidence nullability verification');
    }
    const result = await query(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_decisions'
          AND column_name = 'confidence'`,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].is_nullable).toBe('YES');
  });

  it('accepts canonical INSERT with confidence NULL and rolls back', async () => {
    if (!hasDatabase) {
      throw new Error('DATABASE_URL required for confidence nullability verification');
    }
    expect(agentId).toBeTruthy();

    await query('BEGIN');
    try {
      const insert = await query(
        `INSERT INTO ai_decisions (
           agent_id, user_id, decision_type, confidence, input_data, output_data, execution_time_ms, was_successful, created_at
         ) VALUES ($1, NULL, $2, NULL, $3::jsonb, $4::jsonb, $5, TRUE, NOW())
         RETURNING id, confidence`,
        [
          agentId,
          'trend_detection_confidence_null_probe',
          JSON.stringify({ probe: true }),
          JSON.stringify({ probe: true }),
          1,
        ],
      );
      expect(insert.rowCount).toBe(1);
      expect(insert.rows[0].confidence).toBeNull();
    } finally {
      await query('ROLLBACK');
    }

    const leftover = await query(
      `SELECT id FROM ai_decisions WHERE decision_type = $1`,
      ['trend_detection_confidence_null_probe'],
    );
    expect(leftover.rowCount).toBe(0);
  });
});
