-- Migration: 051_data_retention_60d_telegram.sql
-- 60-day retention for high-growth telegram + collected_data + request_logs
-- Batched deletes to avoid long locks / statement timeouts

BEGIN;

INSERT INTO log_retention_policies (category, retention_days, description) VALUES
('telegram_messages', 60, 'Raw telegram messages (cascades to processed/impacts)'),
('request_logs', 60, 'HTTP/API request logs')
ON CONFLICT (category) DO UPDATE SET
    retention_days = EXCLUDED.retention_days,
    description = EXCLUDED.description,
    is_enabled = TRUE,
    updated_at = NOW();

-- Keep collected_data at 60 days (already seeded in 018; reaffirm)
UPDATE log_retention_policies
SET retention_days = 60,
    is_enabled = TRUE,
    updated_at = NOW(),
    description = 'Raw and normalized data from sources'
WHERE category = 'collected_data';

CREATE OR REPLACE FUNCTION prune_table_by_age(
    p_table text,
    p_time_column text,
    p_days integer,
    p_batch integer DEFAULT 5000,
    p_max_batches integer DEFAULT 400
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_cutoff timestamptz;
    v_deleted integer;
    v_batch_deleted integer;
    v_batches integer := 0;
    v_sql text;
BEGIN
    -- Whitelist only known high-growth tables
    IF p_table NOT IN ('telegram_messages', 'collected_data', 'request_logs') THEN
        RAISE EXCEPTION 'prune_table_by_age: table % not allowed', p_table;
    END IF;
    IF p_time_column NOT IN ('created_at', 'collected_at') THEN
        RAISE EXCEPTION 'prune_table_by_age: column % not allowed', p_time_column;
    END IF;
    IF p_batch < 100 OR p_batch > 50000 THEN
        RAISE EXCEPTION 'prune_table_by_age: invalid batch size';
    END IF;

    v_cutoff := NOW() - (p_days || ' days')::interval;
    v_deleted := 0;

    LOOP
        v_sql := format(
            'WITH doomed AS (
                SELECT id FROM %I
                WHERE %I < $1
                ORDER BY %I
                LIMIT $2
             )
             DELETE FROM %I t
             USING doomed d
             WHERE t.id = d.id',
            p_table, p_time_column, p_time_column, p_table
        );
        EXECUTE v_sql USING v_cutoff, p_batch;
        GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
        v_deleted := v_deleted + v_batch_deleted;
        v_batches := v_batches + 1;
        EXIT WHEN v_batch_deleted = 0;
        EXIT WHEN v_batches >= p_max_batches;
        -- brief yield so concurrent app traffic can proceed
        PERFORM pg_sleep(0.05);
    END LOOP;

    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION prune_table_by_age IS
'Batched age-based DELETE for telegram_messages / collected_data / request_logs';

CREATE OR REPLACE FUNCTION prune_logs()
RETURNS TABLE (
    category TEXT,
    deleted_count INTEGER,
    execution_time_ms INTEGER
) AS $$
DECLARE
    policy RECORD;
    start_time TIMESTAMP;
    v_deleted INTEGER;
    v_exec_time INTEGER;
BEGIN
    FOR policy IN SELECT * FROM log_retention_policies WHERE is_enabled = TRUE LOOP
        start_time := clock_timestamp();
        v_deleted := 0;

        CASE policy.category
            WHEN 'data_hub_logs' THEN
                DELETE FROM data_hub_logs WHERE created_at < NOW() - (policy.retention_days || ' days')::INTERVAL;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;

            WHEN 'system_logs' THEN
                DELETE FROM system_logs WHERE created_at < NOW() - (policy.retention_days || ' days')::INTERVAL;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;

            WHEN 'audit_logs' THEN
                DELETE FROM audit_logs WHERE created_at < NOW() - (policy.retention_days || ' days')::INTERVAL;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;

            WHEN 'collected_data' THEN
                v_deleted := prune_table_by_age('collected_data', 'collected_at', policy.retention_days, 5000, 400);

            WHEN 'telegram_messages' THEN
                -- CASCADE removes processed_telegram_messages + telegram_agent_impacts (+ related)
                v_deleted := prune_table_by_age('telegram_messages', 'created_at', policy.retention_days, 3000, 400);

            WHEN 'request_logs' THEN
                v_deleted := prune_table_by_age('request_logs', 'created_at', policy.retention_days, 8000, 400);

            ELSE
                RAISE NOTICE 'No pruning logic defined for category: %', policy.category;
                CONTINUE;
        END CASE;

        v_exec_time := EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER;

        category := policy.category;
        deleted_count := v_deleted;
        execution_time_ms := v_exec_time;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prune_logs IS 'Executes log/data pruning based on log_retention_policies (batched for large tables)';

COMMIT;
