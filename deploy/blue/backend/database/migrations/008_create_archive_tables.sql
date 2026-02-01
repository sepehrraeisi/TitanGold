-- ============================================================================
-- Migration: Create Archive Tables for ai_decisions
-- Task: DATABASE-003
-- Date: 2026-01-07
-- Purpose: Move old ai_decisions (>90 days) to cold storage for improved performance
-- ============================================================================
--
-- This migration creates an archival system for ai_decisions to:
-- - Move old records (>90 days) to archive table
-- - Improve query performance on active data
-- - Manage database growth efficiently
-- - Maintain full data accessibility via union view
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Create Archive Table (identical structure to ai_decisions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_decisions_archive (
    id UUID NOT NULL,
    agent_id UUID,
    user_id UUID,
    decision_type VARCHAR(255),
    input_data JSONB,
    output_data JSONB,
    confidence NUMERIC,
    was_successful BOOLEAN,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE ai_decisions_archive IS 
'Cold storage for ai_decisions older than 90 days. Partitioned yearly.';

COMMENT ON COLUMN ai_decisions_archive.archived_at IS 
'Timestamp when record was moved from active to archive table';

-- ============================================================================
-- 2. Create Archive Partitions (Yearly for historical data)
-- ============================================================================

-- 2024 partition (for any historical data)
CREATE TABLE IF NOT EXISTS ai_decisions_archive_2024 PARTITION OF ai_decisions_archive
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 2025 partition
CREATE TABLE IF NOT EXISTS ai_decisions_archive_2025 PARTITION OF ai_decisions_archive
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 2026 partition (for data that will be archived this year)
CREATE TABLE IF NOT EXISTS ai_decisions_archive_2026 PARTITION OF ai_decisions_archive
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Future partitions will be created as needed by maintenance functions

-- ============================================================================
-- 3. Create Indexes on Archive Table
-- ============================================================================
-- Fewer indexes than active table (optimize for storage, not speed)

CREATE INDEX IF NOT EXISTS idx_ai_decisions_archive_agent_id 
ON ai_decisions_archive(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_archive_user_id 
ON ai_decisions_archive(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_archive_created_at 
ON ai_decisions_archive(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_archive_archived_at 
ON ai_decisions_archive(archived_at);

-- GIN indexes for JSONB (inherited from active table strategy)
CREATE INDEX IF NOT EXISTS idx_ai_decisions_archive_input_data_gin 
ON ai_decisions_archive USING gin(input_data);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_archive_output_data_gin 
ON ai_decisions_archive USING gin(output_data);

-- ============================================================================
-- 4. Create Union View for Seamless Access
-- ============================================================================

CREATE OR REPLACE VIEW ai_decisions_all AS
-- Active data
SELECT 
    id,
    agent_id,
    user_id,
    decision_type,
    input_data,
    output_data,
    confidence,
    was_successful,
    execution_time_ms,
    created_at,
    metadata,
    'active'::TEXT as data_source,
    NULL::TIMESTAMP WITH TIME ZONE as archived_at
FROM ai_decisions

UNION ALL

-- Archived data
SELECT 
    id,
    agent_id,
    user_id,
    decision_type,
    input_data,
    output_data,
    confidence,
    was_successful,
    execution_time_ms,
    created_at,
    metadata,
    'archive'::TEXT as data_source,
    archived_at
FROM ai_decisions_archive;

COMMENT ON VIEW ai_decisions_all IS 
'Union view of active and archived ai_decisions for seamless querying. 
Adds data_source column to identify origin (active/archive).';

-- ============================================================================
-- 5. Create Archive Statistics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_decisions_archive_stats (
    id SERIAL PRIMARY KEY,
    archive_date DATE NOT NULL,
    records_archived INTEGER NOT NULL DEFAULT 0,
    oldest_record_date TIMESTAMP WITH TIME ZONE,
    newest_record_date TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_archive_stats_date 
ON ai_decisions_archive_stats(archive_date DESC);

CREATE INDEX IF NOT EXISTS idx_archive_stats_success 
ON ai_decisions_archive_stats(success, created_at DESC);

COMMENT ON TABLE ai_decisions_archive_stats IS 
'Tracks archival job execution history, statistics, and health monitoring data';

-- ============================================================================
-- 6. Verification
-- ============================================================================

DO $$
DECLARE
    archive_table_exists BOOLEAN;
    view_exists BOOLEAN;
    stats_table_exists BOOLEAN;
    partition_count INTEGER;
BEGIN
    -- Verify archive table exists
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_decisions_archive'
    ) INTO archive_table_exists;
    
    IF NOT archive_table_exists THEN
        RAISE EXCEPTION 'Archive table not created';
    END IF;
    
    -- Verify view exists
    SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'ai_decisions_all'
    ) INTO view_exists;
    
    IF NOT view_exists THEN
        RAISE EXCEPTION 'Union view not created';
    END IF;
    
    -- Verify stats table exists
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_decisions_archive_stats'
    ) INTO stats_table_exists;
    
    IF NOT stats_table_exists THEN
        RAISE EXCEPTION 'Stats table not created';
    END IF;
    
    -- Count archive partitions
    SELECT COUNT(*) INTO partition_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
    AND c.relispartition = true
    AND c.relname LIKE 'ai_decisions_archive_%'
    AND n.nspname = 'public';
    
    RAISE NOTICE '✅ Archive infrastructure created successfully';
    RAISE NOTICE '   - Archive table: ai_decisions_archive';
    RAISE NOTICE '   - Union view: ai_decisions_all';
    RAISE NOTICE '   - Stats table: ai_decisions_archive_stats';
    RAISE NOTICE '   - Archive partitions: % created', partition_count;
END $$;

-- Display created objects summary
SELECT 
    'Archive System Summary' as info,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'ai_decisions_archive%') as archive_tables,
    (SELECT COUNT(*) FROM pg_views WHERE viewname = 'ai_decisions_all') as union_views,
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_ai_decisions_archive%') as archive_indexes;

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================
-- 
-- 1. Next Steps:
--    - Apply archive_maintenance.sql to create archival functions
--    - Set up cron job for monthly archival
--    - Configure monitoring script
--
-- 2. Usage:
--    - Query active: SELECT * FROM ai_decisions WHERE ...
--    - Query archive: SELECT * FROM ai_decisions_archive WHERE ...
--    - Query both: SELECT * FROM ai_decisions_all WHERE ...
--
-- 3. Archival:
--    - Run: SELECT * FROM archive_old_decisions(90);
--    - Or use: ./scripts/archive-old-decisions.sh
--
-- 4. Monitoring:
--    - Run: SELECT * FROM check_archive_health();
--    - Or use: node scripts/check_archive_health.js
--
-- 5. Rollback (if needed):
--    DROP VIEW IF EXISTS ai_decisions_all CASCADE;
--    DROP TABLE IF EXISTS ai_decisions_archive CASCADE;
--    DROP TABLE IF EXISTS ai_decisions_archive_stats CASCADE;
--
-- ============================================================================
