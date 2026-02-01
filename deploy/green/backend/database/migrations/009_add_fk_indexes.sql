-- ============================================================================
-- Migration: Add Foreign Key Indexes
-- Task: DATABASE-004
-- Date: 2026-01-07
-- Purpose: Improve JOIN performance and cascade delete speed
-- ============================================================================

-- ============================================================================
-- 1. Index on ai_decisions.agent_id (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent_id 
ON ai_decisions(agent_id);

-- ============================================================================
-- 2. Index on ai_decisions.user_id (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_decisions_user_id 
ON ai_decisions(user_id);

-- ============================================================================
-- 3. Verify ai_learning_events indexes (created in migration 003)
-- ============================================================================

-- Note: These indexes already exist from migration 003_add_learning_system.sql:
-- - idx_learning_events_agent (on agent_id)
-- - idx_learning_events_decision (on decision_id)
-- No action needed.

-- ============================================================================
-- Comments on Indexes
-- ============================================================================

COMMENT ON INDEX idx_ai_decisions_agent_id IS 
'Foreign key index for JOINs with ai_agents table and agent-based queries';

COMMENT ON INDEX idx_ai_decisions_user_id IS 
'Foreign key index for JOINs with users table and user-based queries';

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- DROP INDEX IF EXISTS idx_ai_decisions_agent_id;
-- DROP INDEX IF EXISTS idx_ai_decisions_user_id;
-- ============================================================================
