-- ============================================================================
-- Archive Maintenance Functions
-- Task: DATABASE-003
-- Date: 2026-01-07
-- ============================================================================
--
-- This file contains functions for managing the ai_decisions archive:
-- - archive_old_decisions: Move old records to archive
-- - restore_from_archive: Restore archived records
-- - check_archive_health: Monitor archive system health
-- - create_archive_partition: Create new archive partitions
-- ============================================================================

-- ============================================================================
-- Function: Create Archive Partition
-- ============================================================================

CREATE OR REPLACE FUNCTION create_archive_partition(year INTEGER)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
    result TEXT := '';
BEGIN
    partition_name := 'ai_decisions_archive_' || year::TEXT;
    start_date := (year || '-01-01')::DATE;
    end_date := ((year + 1) || '-01-01')::DATE;
    
    -- Check if partition already exists
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
        AND n.nspname = 'public'
    ) THEN
        RETURN '⏭️  Partition ' || partition_name || ' already exists';
    END IF;
    
    -- Create partition
    EXECUTE format(
        'CREATE TABLE %I PARTITION OF ai_decisions_archive FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
    
    RETURN '✅ Created partition: ' || partition_name || ' [' || start_date || ' to ' || end_date || ']';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_archive_partition IS 
'Creates a yearly partition for ai_decisions_archive if it does not exist';

-- ============================================================================
-- Function: Archive Old Decisions
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_old_decisions(days_old INTEGER DEFAULT 90)
RETURNS TABLE (
    records_archived INTEGER,
    oldest_date TIMESTAMP WITH TIME ZONE,
    newest_date TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER
) AS $$
DECLARE
    start_time TIMESTAMP;
    cutoff_date TIMESTAMP WITH TIME ZONE;
    v_records_archived INTEGER := 0;
    v_oldest_date TIMESTAMP WITH TIME ZONE;
    v_newest_date TIMESTAMP WITH TIME ZONE;
    v_execution_time_ms INTEGER;
    required_year INTEGER;
BEGIN
    start_time := clock_timestamp();
    cutoff_date := CURRENT_TIMESTAMP - (days_old || ' days')::INTERVAL;
    
    RAISE NOTICE '📋 Starting archival process...';
    RAISE NOTICE '   Cutoff date: % (> % days old)', cutoff_date, days_old;
    
    -- Check if any records need archiving
    SELECT COUNT(*) INTO v_records_archived
    FROM ai_decisions
    WHERE created_at < cutoff_date;
    
    IF v_records_archived = 0 THEN
        RAISE NOTICE '✅ No records to archive (all newer than % days)', days_old;
        
        -- Log empty run
        INSERT INTO ai_decisions_archive_stats (
            archive_date, records_archived, execution_time_ms, success
        ) VALUES (
            CURRENT_DATE, 0, 
            EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER, 
            TRUE
        );
        
        RETURN QUERY SELECT 0, NULL::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE, 
                            EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER;
        RETURN;
    END IF;
    
    RAISE NOTICE '   Found % records to archive', v_records_archived;
    
    -- Ensure archive partition exists for the year we're archiving to
    SELECT EXTRACT(YEAR FROM MIN(created_at))::INTEGER INTO required_year
    FROM ai_decisions
    WHERE created_at < cutoff_date;
    
    IF required_year IS NOT NULL THEN
        PERFORM create_archive_partition(required_year);
    END IF;
    
    -- Move records to archive (DELETE + INSERT in CTE for atomicity)
    WITH moved_records AS (
        DELETE FROM ai_decisions
        WHERE created_at < cutoff_date
        RETURNING 
            id, agent_id, user_id, decision_type, input_data, 
            output_data, confidence, was_successful, execution_time_ms, 
            created_at, metadata
    ),
    inserted_records AS (
        INSERT INTO ai_decisions_archive (
            id, agent_id, user_id, decision_type, input_data,
            output_data, confidence, was_successful, execution_time_ms,
            created_at, metadata
        )
        SELECT 
            id, agent_id, user_id, decision_type, input_data,
            output_data, confidence, was_successful, execution_time_ms,
            created_at, metadata
        FROM moved_records
        RETURNING id, created_at
    )
    SELECT 
        COUNT(*)::INTEGER,
        MIN(created_at),
        MAX(created_at)
    INTO v_records_archived, v_oldest_date, v_newest_date
    FROM inserted_records;
    
    v_execution_time_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER;
    
    RAISE NOTICE '✅ Archived % records in %ms', v_records_archived, v_execution_time_ms;
    RAISE NOTICE '   Date range: % to %', v_oldest_date, v_newest_date;
    
    -- Log statistics
    INSERT INTO ai_decisions_archive_stats (
        archive_date, records_archived, oldest_record_date,
        newest_record_date, execution_time_ms, success
    ) VALUES (
        CURRENT_DATE, v_records_archived, v_oldest_date,
        v_newest_date, v_execution_time_ms, TRUE
    );
    
    RETURN QUERY SELECT v_records_archived, v_oldest_date, v_newest_date, v_execution_time_ms;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log failure
        INSERT INTO ai_decisions_archive_stats (
            archive_date, records_archived, execution_time_ms, 
            success, error_message
        ) VALUES (
            CURRENT_DATE, 0,
            EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER,
            FALSE, SQLERRM
        );
        
        RAISE EXCEPTION 'Archive failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_decisions IS 
'Moves ai_decisions older than specified days to archive table. 
Automatically creates required partitions and logs execution statistics.';

-- ============================================================================
-- Function: Restore from Archive
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_from_archive(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER AS $$
DECLARE
    records_restored INTEGER;
BEGIN
    RAISE NOTICE '📋 Restoring archived records...';
    RAISE NOTICE '   Date range: % to %', start_date, end_date;
    
    -- Move records back to active table
    WITH moved_records AS (
        DELETE FROM ai_decisions_archive
        WHERE created_at >= start_date AND created_at < end_date
        RETURNING 
            id, agent_id, user_id, decision_type, input_data,
            output_data, confidence, was_successful, execution_time_ms,
            created_at, metadata
    )
    INSERT INTO ai_decisions (
        id, agent_id, user_id, decision_type, input_data,
        output_data, confidence, was_successful, execution_time_ms,
        created_at, metadata
    )
    SELECT 
        id, agent_id, user_id, decision_type, input_data,
        output_data, confidence, was_successful, execution_time_ms,
        created_at, metadata
    FROM moved_records;
    
    GET DIAGNOSTICS records_restored = ROW_COUNT;
    
    RAISE NOTICE '✅ Restored % records', records_restored;
    
    RETURN records_restored;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION restore_from_archive IS 
'Restores archived ai_decisions back to active table for specified date range';

-- ============================================================================
-- Function: Check Archive Health
-- ============================================================================

CREATE OR REPLACE FUNCTION check_archive_health()
RETURNS TABLE (
    status TEXT,
    active_records BIGINT,
    archived_records BIGINT,
    oldest_active_date TIMESTAMP WITH TIME ZONE,
    last_archive_date DATE,
    last_archive_success BOOLEAN,
    days_since_last_archive INTEGER,
    records_pending_archive BIGINT
) AS $$
DECLARE
    v_status TEXT := 'OK';
    v_active_records BIGINT;
    v_archived_records BIGINT;
    v_oldest_active TIMESTAMP WITH TIME ZONE;
    v_last_archive_date DATE;
    v_last_success BOOLEAN;
    v_days_since INTEGER;
    v_pending BIGINT;
BEGIN
    -- Count active records
    SELECT COUNT(*), MIN(created_at)
    INTO v_active_records, v_oldest_active
    FROM ai_decisions;
    
    -- Count archived records
    SELECT COUNT(*)
    INTO v_archived_records
    FROM ai_decisions_archive;
    
    -- Get last archive stats
    SELECT archive_date, success
    INTO v_last_archive_date, v_last_success
    FROM ai_decisions_archive_stats
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Calculate days since last archive
    IF v_last_archive_date IS NOT NULL THEN
        v_days_since := (CURRENT_DATE - v_last_archive_date)::INTEGER;
    ELSE
        v_days_since := NULL;
    END IF;
    
    -- Count records pending archive (>90 days old)
    SELECT COUNT(*)
    INTO v_pending
    FROM ai_decisions
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    -- Determine status
    IF v_last_archive_date IS NOT NULL AND v_last_archive_date < CURRENT_DATE - INTERVAL '32 days' THEN
        v_status := 'WARNING: Archive not run in >30 days';
    ELSIF v_last_success = FALSE THEN
        v_status := 'ERROR: Last archive failed';
    ELSIF v_pending > 0 THEN
        v_status := 'WARNING: ' || v_pending || ' records need archiving';
    ELSE
        v_status := 'OK';
    END IF;
    
    RETURN QUERY SELECT 
        v_status,
        v_active_records,
        v_archived_records,
        v_oldest_active,
        v_last_archive_date,
        COALESCE(v_last_success, TRUE),
        v_days_since,
        v_pending;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_archive_health IS 
'Health check for archival system - returns status, statistics, and alerts';

-- ============================================================================
-- Function: List Archive Partitions
-- ============================================================================

CREATE OR REPLACE FUNCTION list_archive_partitions()
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
        SUBSTRING(pg_get_expr(c.relpartbound, c.oid, true) FROM '''([^'']+)''')::TEXT as start_date,
        SUBSTRING(pg_get_expr(c.relpartbound, c.oid, true) FROM '''([^'']+)''[^'']*''([^'']+)''')::TEXT as end_date,
        (SELECT COUNT(*) FROM ai_decisions_archive WHERE tableoid = c.oid::regclass) as row_count,
        pg_size_pretty(pg_relation_size(c.oid)) as size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
    AND c.relispartition = true
    AND c.relname LIKE 'ai_decisions_archive_%'
    AND n.nspname = 'public'
    ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION list_archive_partitions IS 
'Lists all ai_decisions_archive partitions with row counts and sizes';

-- ============================================================================
-- Grant Permissions (adjust as needed)
-- ============================================================================
-- GRANT EXECUTE ON FUNCTION archive_old_decisions TO your_app_user;
-- GRANT EXECUTE ON FUNCTION restore_from_archive TO your_app_user;
-- GRANT EXECUTE ON FUNCTION check_archive_health TO your_app_user;

-- ============================================================================
-- Usage Examples
-- ============================================================================
-- 
-- 1. Archive old decisions:
--    SELECT * FROM archive_old_decisions(90);
--
-- 2. Check health:
--    SELECT * FROM check_archive_health();
--
-- 3. Restore specific date range:
--    SELECT restore_from_archive('2024-06-01', '2024-07-01');
--
-- 4. List archive partitions:
--    SELECT * FROM list_archive_partitions();
--
-- 5. Create partition for specific year:
--    SELECT create_archive_partition(2027);
--
-- ============================================================================
