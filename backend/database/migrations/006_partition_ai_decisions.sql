-- ============================================================================
-- Migration: Partition ai_decisions table by month
-- Task: DATABASE-001
-- Date: 2026-01-06
-- ============================================================================
-- 
-- This migration converts the ai_decisions table to use RANGE partitioning
-- by created_at column with monthly partitions for improved query performance
-- and data management.
--
-- IMPORTANT: This keeps the existing data in ai_decisions_old for safety.
-- After verification, manually drop ai_decisions_old table.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Rename existing table for backup
-- ============================================================================
ALTER TABLE ai_decisions RENAME TO ai_decisions_old;

-- ============================================================================
-- Step 2: Create new partitioned table with same structure
-- ============================================================================
CREATE TABLE ai_decisions (
    id UUID DEFAULT uuid_generate_v4(),
    agent_id UUID,
    user_id UUID,
    decision_type VARCHAR(255),
    input_data JSONB,
    output_data JSONB,
    confidence NUMERIC,
    was_successful BOOLEAN,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Composite primary key including partition key
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- Step 3: Create partitions for historical and future data
-- ============================================================================

-- 2025 Partitions (for existing data)
CREATE TABLE ai_decisions_2025_12 PARTITION OF ai_decisions 
FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 Partitions (current year - 12 months)
CREATE TABLE ai_decisions_2026_01 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE ai_decisions_2026_02 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE ai_decisions_2026_03 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE ai_decisions_2026_04 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE ai_decisions_2026_05 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE ai_decisions_2026_06 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE ai_decisions_2026_07 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE ai_decisions_2026_08 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE ai_decisions_2026_09 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE ai_decisions_2026_10 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE ai_decisions_2026_11 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE ai_decisions_2026_12 PARTITION OF ai_decisions 
FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 2027 Partitions (next 12 months ahead)
CREATE TABLE ai_decisions_2027_01 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE TABLE ai_decisions_2027_02 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

CREATE TABLE ai_decisions_2027_03 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

CREATE TABLE ai_decisions_2027_04 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

CREATE TABLE ai_decisions_2027_05 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

CREATE TABLE ai_decisions_2027_06 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

CREATE TABLE ai_decisions_2027_07 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');

CREATE TABLE ai_decisions_2027_08 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');

CREATE TABLE ai_decisions_2027_09 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');

CREATE TABLE ai_decisions_2027_10 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');

CREATE TABLE ai_decisions_2027_11 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');

CREATE TABLE ai_decisions_2027_12 PARTITION OF ai_decisions 
FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');

-- ============================================================================
-- Step 4: Recreate indexes on partitioned table
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent_id ON ai_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user_id ON ai_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_created_at ON ai_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_decision_type ON ai_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_metadata ON ai_decisions USING gin(metadata);

-- ============================================================================
-- Step 5: Migrate existing data from old table
-- ============================================================================
INSERT INTO ai_decisions 
SELECT * FROM ai_decisions_old 
ORDER BY created_at;

-- ============================================================================
-- Step 6: Verify migration success
-- ============================================================================
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM ai_decisions_old;
    SELECT COUNT(*) INTO new_count FROM ai_decisions;
    
    IF old_count != new_count THEN
        RAISE EXCEPTION 'Migration failed: old_count=% vs new_count=%', old_count, new_count;
    END IF;
    
    RAISE NOTICE '✅ Migration successful: % rows migrated', new_count;
END $$;

-- ============================================================================
-- Step 7: Recreate foreign key constraints (if any existed)
-- ============================================================================
-- Note: Foreign keys from ai_learning_events reference ai_decisions(id)
-- These will be recreated after this migration

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================
-- 1. Keep ai_decisions_old table for safety - DO NOT DROP yet
-- 2. Monitor application for 24-48 hours
-- 3. Verify all queries work as expected
-- 4. Run test_partition_queries.sql to validate
-- 5. After verification, manually drop ai_decisions_old:
--    DROP TABLE ai_decisions_old;
-- ============================================================================
