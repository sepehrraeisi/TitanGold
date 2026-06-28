-- Migration: 043_datahub_archiving_p2_safety.sql
-- DH-DATA-ARCHIVING-P2: partition date parsing, batch limits, restore duplicate guard

-- Fix partition list date parsing (FROM/TO bounds)
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
        c.relname::TEXT AS partition_name,
        (regexp_match(pg_get_expr(c.relpartbound, c.oid, true), 'FROM \(''([^'']+)''\) TO'))[1]::TEXT AS start_date,
        (regexp_match(pg_get_expr(c.relpartbound, c.oid, true), 'TO \(''([^'']+)''\)'))[1]::TEXT AS end_date,
        (SELECT COUNT(*)::BIGINT FROM ai_decisions_archive WHERE tableoid = c.oid::regclass) AS row_count,
        pg_size_pretty(pg_relation_size(c.oid))::TEXT AS size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relispartition = true
      AND c.relname LIKE 'ai_decisions_archive_%'
      AND n.nspname = 'public'
    ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

-- Batch-limited archive (default max 5000 rows per call)
CREATE OR REPLACE FUNCTION archive_old_decisions(
    days_old INTEGER DEFAULT 90,
    max_rows INTEGER DEFAULT 5000
)
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
    v_limit INTEGER := GREATEST(1, LEAST(COALESCE(max_rows, 5000), 50000));
BEGIN
    start_time := clock_timestamp();
    cutoff_date := CURRENT_TIMESTAMP - (days_old || ' days')::INTERVAL;

    SELECT COUNT(*) INTO v_records_archived
    FROM ai_decisions
    WHERE created_at < cutoff_date;

    IF v_records_archived = 0 THEN
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

    SELECT EXTRACT(YEAR FROM MIN(created_at))::INTEGER INTO required_year
    FROM ai_decisions
    WHERE created_at < cutoff_date;

    IF required_year IS NOT NULL THEN
        PERFORM create_archive_partition(required_year);
    END IF;

    WITH candidates AS (
        SELECT id, agent_id, user_id, decision_type, input_data,
               output_data, confidence, was_successful, execution_time_ms,
               created_at, metadata
        FROM ai_decisions
        WHERE created_at < cutoff_date
        ORDER BY created_at
        LIMIT v_limit
    ),
    moved_records AS (
        DELETE FROM ai_decisions d
        USING candidates c
        WHERE d.id = c.id
        RETURNING d.id, d.agent_id, d.user_id, d.decision_type, d.input_data,
                  d.output_data, d.confidence, d.was_successful, d.execution_time_ms,
                  d.created_at, d.metadata
    ),
    inserted_records AS (
        INSERT INTO ai_decisions_archive (
            id, agent_id, user_id, decision_type, input_data,
            output_data, confidence, was_successful, execution_time_ms,
            created_at, metadata
        )
        SELECT id, agent_id, user_id, decision_type, input_data,
               output_data, confidence, was_successful, execution_time_ms,
               created_at, metadata
        FROM moved_records
        RETURNING id, created_at
    )
    SELECT COUNT(*)::INTEGER, MIN(created_at), MAX(created_at)
    INTO v_records_archived, v_oldest_date, v_newest_date
    FROM inserted_records;

    v_execution_time_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER;

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

-- Restore with duplicate guard (fails if active row with same id exists)
CREATE OR REPLACE FUNCTION restore_from_archive(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    max_rows INTEGER DEFAULT 5000
)
RETURNS INTEGER AS $$
DECLARE
    records_restored INTEGER;
    duplicate_count INTEGER;
    v_limit INTEGER := GREATEST(1, LEAST(COALESCE(max_rows, 5000), 50000));
BEGIN
    SELECT COUNT(*)::INTEGER INTO duplicate_count
    FROM ai_decisions_archive a
    INNER JOIN ai_decisions d ON d.id = a.id
    WHERE a.created_at >= start_date AND a.created_at < end_date;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'RESTORE_DUPLICATE_CONFLICT: % archived record(s) already exist in ai_decisions', duplicate_count;
    END IF;

    WITH candidates AS (
        SELECT id, agent_id, user_id, decision_type, input_data,
               output_data, confidence, was_successful, execution_time_ms,
               created_at, metadata
        FROM ai_decisions_archive
        WHERE created_at >= start_date AND created_at < end_date
        ORDER BY created_at
        LIMIT v_limit
    ),
    moved_records AS (
        DELETE FROM ai_decisions_archive a
        USING candidates c
        WHERE a.id = c.id AND a.created_at = c.created_at
        RETURNING a.id, a.agent_id, a.user_id, a.decision_type, a.input_data,
                  a.output_data, a.confidence, a.was_successful, a.execution_time_ms,
                  a.created_at, a.metadata
    )
    INSERT INTO ai_decisions (
        id, agent_id, user_id, decision_type, input_data,
        output_data, confidence, was_successful, execution_time_ms,
        created_at, metadata
    )
    SELECT id, agent_id, user_id, decision_type, input_data,
           output_data, confidence, was_successful, execution_time_ms,
           created_at, metadata
    FROM moved_records;

    GET DIAGNOSTICS records_restored = ROW_COUNT;
    RETURN records_restored;
END;
$$ LANGUAGE plpgsql;
