-- ============================================================================
-- Migration: Add version tracking to ai_agents and ai_decisions tables
-- Task: BACKEND-017
-- Date: 2026-01-31
-- ============================================================================
-- 
-- This migration adds version tracking to support agent rollback capability:
-- 1. Add version column to ai_agents table
-- 2. Add agent_version column to ai_decisions table
-- 3. Create indexes for efficient version-based queries
-- 4. Add versioning documentation
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Add version column to ai_agents table
-- ============================================================================
-- Add version column with semantic versioning format (e.g., "1.0.0")
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0' NOT NULL;

-- Add version update timestamp
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS version_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- Step 2: Create version history tracking
-- ============================================================================
-- This allows us to track all version changes over time
CREATE TABLE IF NOT EXISTS ai_agent_version_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    agent_key VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    previous_version VARCHAR(20),
    change_type VARCHAR(50) DEFAULT 'update', -- 'created', 'update', 'rollback'
    change_description TEXT,
    changed_by VARCHAR(100), -- user ID or 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for efficient version history queries
CREATE INDEX IF NOT EXISTS idx_agent_version_history_agent_id 
ON ai_agent_version_history(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_version_history_agent_key 
ON ai_agent_version_history(agent_key);

CREATE INDEX IF NOT EXISTS idx_agent_version_history_created_at 
ON ai_agent_version_history(created_at DESC);

-- ============================================================================
-- Step 3: Add agent_version to ai_decisions table
-- ============================================================================
-- Track which version of the agent made each decision
ALTER TABLE ai_decisions 
ADD COLUMN IF NOT EXISTS agent_version VARCHAR(20);

-- Create index for version-based queries on decisions
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent_version 
ON ai_decisions(agent_version);

-- Composite index for agent + version queries
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent_id_version 
ON ai_decisions(agent_id, agent_version);

-- ============================================================================
-- Step 4: Backfill version data for existing records
-- ============================================================================
-- Set agent_version in decisions from agent's current version
UPDATE ai_decisions d
SET agent_version = a.version
FROM ai_agents a
WHERE d.agent_id = a.id
AND d.agent_version IS NULL;

-- ============================================================================
-- Step 5: Create trigger to auto-update version_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_agent_version_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if version actually changed
    IF NEW.version IS DISTINCT FROM OLD.version THEN
        NEW.version_updated_at = NOW();
        
        -- Insert into version history
        INSERT INTO ai_agent_version_history (
            agent_id,
            agent_key,
            version,
            previous_version,
            change_type,
            change_description,
            changed_by
        ) VALUES (
            NEW.id,
            NEW.agent_key,
            NEW.version,
            OLD.version,
            'update',
            'Version updated from ' || OLD.version || ' to ' || NEW.version,
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_agent_version_timestamp ON ai_agents;
CREATE TRIGGER trigger_update_agent_version_timestamp
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_version_timestamp();

-- ============================================================================
-- Step 6: Create function to query decisions by agent version
-- ============================================================================
CREATE OR REPLACE FUNCTION get_decisions_by_version(
    p_agent_key VARCHAR(50),
    p_version VARCHAR(20),
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    decision_type VARCHAR,
    input_data JSONB,
    output_data JSONB,
    confidence NUMERIC,
    was_successful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.decision_type,
        d.input_data,
        d.output_data,
        d.confidence,
        d.was_successful,
        d.created_at
    FROM ai_decisions d
    JOIN ai_agents a ON d.agent_id = a.id
    WHERE a.agent_key = p_agent_key
    AND d.agent_version = p_version
    ORDER BY d.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 7: Create function to rollback agent to previous version
-- ============================================================================
CREATE OR REPLACE FUNCTION rollback_agent_version(
    p_agent_key VARCHAR(50),
    p_target_version VARCHAR(20),
    p_changed_by VARCHAR(100) DEFAULT 'system'
)
RETURNS JSONB AS $$
DECLARE
    v_agent_id UUID;
    v_current_version VARCHAR(20);
    v_result JSONB;
BEGIN
    -- Get agent info
    SELECT id, version INTO v_agent_id, v_current_version
    FROM ai_agents
    WHERE agent_key = p_agent_key;
    
    IF v_agent_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Agent not found'
        );
    END IF;
    
    -- Update agent version
    UPDATE ai_agents
    SET version = p_target_version,
        version_updated_at = NOW()
    WHERE id = v_agent_id;
    
    -- Log rollback in history
    INSERT INTO ai_agent_version_history (
        agent_id,
        agent_key,
        version,
        previous_version,
        change_type,
        change_description,
        changed_by
    ) VALUES (
        v_agent_id,
        p_agent_key,
        p_target_version,
        v_current_version,
        'rollback',
        'Rolled back from ' || v_current_version || ' to ' || p_target_version,
        p_changed_by
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'agent_key', p_agent_key,
        'previous_version', v_current_version,
        'new_version', p_target_version,
        'rolled_back_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 8: Create view for version analytics
-- ============================================================================
CREATE OR REPLACE VIEW agent_version_summary AS
SELECT 
    a.agent_key,
    a.name,
    a.version AS current_version,
    a.version_updated_at,
    COUNT(DISTINCT avh.version) AS total_versions,
    (
        SELECT version 
        FROM ai_agent_version_history 
        WHERE agent_key = a.agent_key 
        ORDER BY created_at DESC 
        LIMIT 1 OFFSET 1
    ) AS previous_version,
    (
        SELECT COUNT(*) 
        FROM ai_decisions d 
        WHERE d.agent_id = a.id AND d.agent_version = a.version
    ) AS decisions_on_current_version,
    (
        SELECT jsonb_agg(DISTINCT agent_version ORDER BY agent_version DESC)
        FROM ai_decisions d
        WHERE d.agent_id = a.id
    ) AS all_decision_versions
FROM ai_agents a
LEFT JOIN ai_agent_version_history avh ON a.id = avh.agent_id
GROUP BY a.id, a.agent_key, a.name, a.version, a.version_updated_at;

-- ============================================================================
-- Step 9: Add comments for documentation
-- ============================================================================
COMMENT ON COLUMN ai_agents.version IS 
    'Semantic version of the agent (e.g., 1.0.0, 1.2.3) - bumped on code changes';

COMMENT ON COLUMN ai_agents.version_updated_at IS 
    'Timestamp when the version was last updated';

COMMENT ON COLUMN ai_decisions.agent_version IS 
    'Version of the agent that made this decision - used for rollback queries';

COMMENT ON TABLE ai_agent_version_history IS 
    'Complete history of all agent version changes for audit and rollback';

COMMENT ON FUNCTION get_decisions_by_version IS 
    'Query all decisions made by a specific agent version';

COMMENT ON FUNCTION rollback_agent_version IS 
    'Rollback an agent to a previous version and log the change';

COMMENT ON VIEW agent_version_summary IS 
    'Summary view of agent versions with decision counts';

-- ============================================================================
-- Step 10: Log migration completion
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 010: Agent version tracking added successfully';
    RAISE NOTICE '   - version column added to ai_agents';
    RAISE NOTICE '   - agent_version column added to ai_decisions';
    RAISE NOTICE '   - ai_agent_version_history table created';
    RAISE NOTICE '   - Indexes created for version queries';
    RAISE NOTICE '   - Functions: get_decisions_by_version, rollback_agent_version';
    RAISE NOTICE '   - View: agent_version_summary';
END $$;

COMMIT;

-- ============================================================================
-- Migration complete - BACKEND-017
-- ============================================================================
