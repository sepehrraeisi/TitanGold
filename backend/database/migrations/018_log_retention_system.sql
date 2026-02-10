-- Migration: 018_log_retention_system.sql
-- Task: TASK-DF-007 - Add log retention
-- Description: System to automatically prune old logs and collected data
-- Date: 2026-02-03

BEGIN;

-- 1. Create Log Retention Policies table
CREATE TABLE IF NOT EXISTS log_retention_policies (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) UNIQUE NOT NULL,
    retention_days INTEGER NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE log_retention_policies IS 'Manages retention periods for different types of log/temporary data';

-- 2. Insert Default Policies
INSERT INTO log_retention_policies (category, retention_days, description) VALUES
('data_hub_logs', 30, 'Execution logs for Data Hub fetchers'),
('system_logs', 14, 'System-level operational logs'),
('audit_logs', 90, 'User activity and configuration change logs'),
('collected_data', 60, 'Raw and normalized data from sources')
ON CONFLICT (category) DO UPDATE SET 
    retention_days = EXCLUDED.retention_days,
    description = EXCLUDED.description;

-- 3. Central Pruning Function
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
                -- Collected data uses collected_at for retention
                DELETE FROM collected_data WHERE collected_at < NOW() - (policy.retention_days || ' days')::INTERVAL;
                GET DIAGNOSTICS v_deleted = ROW_COUNT;
            
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

COMMENT ON FUNCTION prune_logs IS 'Executes log pruning based on defined retention policies';

-- 4. Central Maintenance Function (integrates existing archival if available)
CREATE OR REPLACE FUNCTION run_log_retention_maintenance()
RETURNS JSONB AS $$
DECLARE
    pruning_results JSONB := '[]'::jsonb;
    result RECORD;
    summary JSONB;
BEGIN
    -- Run pruning
    FOR result IN SELECT * FROM prune_logs() LOOP
        summary := jsonb_build_object(
            'category', result.category,
            'deleted', result.deleted_count,
            'time_ms', result.execution_time_ms
        );
        pruning_results := pruning_results || summary;
    END LOOP;

    -- Return full summary
    RETURN jsonb_build_object(
        'timestamp', NOW(),
        'pruning', pruning_results,
        'status', 'completed'
    );
END;
$$ LANGUAGE plpgsql;

COMMIT;
