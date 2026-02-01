-- ============================================================================
-- Partition Maintenance Functions
-- Task: DATABASE-001
-- Date: 2026-01-06
-- ============================================================================
--
-- This file contains utility functions for managing ai_decisions table
-- partitions automatically.
-- ============================================================================

-- ============================================================================
-- Function: create_future_partitions
-- Purpose: Automatically create partitions for future months
-- Usage: SELECT create_future_partitions(12); -- Create 12 months ahead
-- ============================================================================
CREATE OR REPLACE FUNCTION create_future_partitions(months_ahead INTEGER DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    result TEXT := '';
    partitions_created INTEGER := 0;
BEGIN
    FOR i IN 0..months_ahead LOOP
        start_date := DATE_TRUNC('month', current_date + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'ai_decisions_' || TO_CHAR(start_date, 'YYYY_MM');
        
        -- Check if partition already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = partition_name
            AND n.nspname = 'public'
        ) THEN
            -- Create partition
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF ai_decisions FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            result := result || '✅ Created: ' || partition_name || 
                     ' [' || start_date || ' to ' || end_date || ']' || E'\n';
            partitions_created := partitions_created + 1;
        ELSE
            result := result || '⏭️  Exists: ' || partition_name || E'\n';
        END IF;
    END LOOP;
    
    IF partitions_created = 0 THEN
        result := '✅ All partitions already exist for the next ' || months_ahead || ' months' || E'\n';
    ELSE
        result := '✅ Created ' || partitions_created || ' new partition(s)' || E'\n' || result;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_future_partitions IS 
'Automatically creates monthly partitions for ai_decisions table. 
Call with number of months to create ahead (default 12).';

-- ============================================================================
-- Function: check_missing_partitions
-- Purpose: Alert if critical partitions are missing
-- Usage: SELECT check_missing_partitions();
-- Returns: Status message with warnings/alerts
-- ============================================================================
CREATE OR REPLACE FUNCTION check_missing_partitions()
RETURNS TEXT AS $$
DECLARE
    current_month DATE := DATE_TRUNC('month', CURRENT_DATE);
    next_month DATE := current_month + INTERVAL '1 month';
    month_after_next DATE := current_month + INTERVAL '2 months';
    current_partition TEXT := 'ai_decisions_' || TO_CHAR(current_month, 'YYYY_MM');
    next_partition TEXT := 'ai_decisions_' || TO_CHAR(next_month, 'YYYY_MM');
    month_after_partition TEXT := 'ai_decisions_' || TO_CHAR(month_after_next, 'YYYY_MM');
    result TEXT := '';
    has_issues BOOLEAN := false;
BEGIN
    -- Check current month partition (CRITICAL)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = current_partition
        AND n.nspname = 'public'
    ) THEN
        result := result || '🚨 ALERT: Missing CURRENT month partition: ' || current_partition || E'\n';
        has_issues := true;
    END IF;
    
    -- Check next month partition (WARNING)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = next_partition
        AND n.nspname = 'public'
    ) THEN
        result := result || '⚠️  WARNING: Missing NEXT month partition: ' || next_partition || E'\n';
        has_issues := true;
    END IF;
    
    -- Check month after next (INFO)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = month_after_partition
        AND n.nspname = 'public'
    ) THEN
        result := result || 'ℹ️  INFO: Missing partition 2 months ahead: ' || month_after_partition || E'\n';
        has_issues := true;
    END IF;
    
    IF NOT has_issues THEN
        result := '✅ OK: All critical partitions exist (' || current_partition || ', ' || next_partition || ', ' || month_after_partition || ')';
    ELSE
        result := result || E'\n💡 Run: SELECT create_future_partitions(12); to create missing partitions';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_missing_partitions IS 
'Checks if critical partitions exist (current month, next month, month after).
Used by monitoring scripts to alert on missing partitions.';

-- ============================================================================
-- Function: list_partitions
-- Purpose: List all existing partitions with row counts
-- Usage: SELECT * FROM list_partitions();
-- ============================================================================
CREATE OR REPLACE FUNCTION list_partitions()
RETURNS TABLE (
    partition_name TEXT,
    start_date TEXT,
    end_date TEXT,
    row_count BIGINT,
    size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::TEXT as partition_name,
        pg_get_expr(c.relpartbound, c.oid, true)::TEXT as start_date,
        ''::TEXT as end_date,
        (SELECT COUNT(*) FROM ai_decisions WHERE tableoid = c.oid::regclass) as row_count,
        pg_size_pretty(pg_relation_size(c.oid)) as size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
    AND c.relispartition = true
    AND c.relname LIKE 'ai_decisions_%'
    AND n.nspname = 'public'
    ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION list_partitions IS 
'Lists all ai_decisions partitions with row counts and sizes.';

-- ============================================================================
-- Function: drop_old_partitions
-- Purpose: Drop partitions older than specified months (for data retention)
-- Usage: SELECT drop_old_partitions(12); -- Drop partitions older than 12 months
-- ============================================================================
CREATE OR REPLACE FUNCTION drop_old_partitions(months_to_keep INTEGER DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
    cutoff_date DATE := DATE_TRUNC('month', CURRENT_DATE - (months_to_keep || ' months')::INTERVAL);
    partition_record RECORD;
    result TEXT := '';
    dropped_count INTEGER := 0;
BEGIN
    FOR partition_record IN 
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
        AND c.relispartition = true
        AND c.relname LIKE 'ai_decisions_20%'
        AND n.nspname = 'public'
    LOOP
        -- Extract date from partition name (format: ai_decisions_YYYY_MM)
        DECLARE
            year_str TEXT := substring(partition_record.relname from 14 for 4);
            month_str TEXT := substring(partition_record.relname from 19 for 2);
            partition_date DATE := (year_str || '-' || month_str || '-01')::DATE;
        BEGIN
            IF partition_date < cutoff_date THEN
                EXECUTE 'DROP TABLE ' || quote_ident(partition_record.relname) || ' CASCADE';
                result := result || '🗑️  Dropped: ' || partition_record.relname || 
                         ' (older than ' || cutoff_date || ')' || E'\n';
                dropped_count := dropped_count + 1;
            END IF;
        END;
    END LOOP;
    
    IF dropped_count = 0 THEN
        result := '✅ No partitions to drop (all within ' || months_to_keep || ' months retention)';
    ELSE
        result := '✅ Dropped ' || dropped_count || ' old partition(s)' || E'\n' || result;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION drop_old_partitions IS 
'Drops partitions older than specified months for data retention policy.
USE WITH CAUTION - this permanently deletes data!';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
-- Grant execute on functions to application user (adjust as needed)
-- GRANT EXECUTE ON FUNCTION create_future_partitions TO your_app_user;
-- GRANT EXECUTE ON FUNCTION check_missing_partitions TO your_app_user;
-- GRANT EXECUTE ON FUNCTION list_partitions TO your_app_user;

-- ============================================================================
-- Usage Examples
-- ============================================================================
-- 1. Check for missing partitions:
--    SELECT check_missing_partitions();
--
-- 2. Create partitions for next 12 months:
--    SELECT create_future_partitions(12);
--
-- 3. List all partitions:
--    SELECT * FROM list_partitions();
--
-- 4. Drop partitions older than 24 months:
--    SELECT drop_old_partitions(24);
-- ============================================================================
