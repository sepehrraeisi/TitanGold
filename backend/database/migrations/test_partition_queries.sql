-- ============================================================================
-- Test Queries for Partitioned ai_decisions Table
-- Task: DATABASE-001
-- Date: 2026-01-06
-- ============================================================================
--
-- This file contains test queries to verify partition functionality and
-- performance after migration.
-- ============================================================================

\echo '============================================================================'
\echo 'Test 1: Count total rows'
\echo '============================================================================'
SELECT COUNT(*) as total_rows FROM ai_decisions;

\echo ''
\echo '============================================================================'
\echo 'Test 2: Verify partition pruning (EXPLAIN ANALYZE)'
\echo '============================================================================'
\echo 'Query: SELECT from current month partition'
EXPLAIN ANALYZE
SELECT * FROM ai_decisions 
WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'
LIMIT 10;

\echo ''
\echo '============================================================================'
\echo 'Test 3: Insert new record'
\echo '============================================================================'
INSERT INTO ai_decisions (
    id,
    agent_id,
    user_id,
    decision_type,
    input_data,
    output_data,
    confidence,
    was_successful,
    execution_time_ms,
    metadata
) VALUES (
    uuid_generate_v4(),
    uuid_generate_v4(),
    uuid_generate_v4(),
    'test_partition_insert',
    '{"test": "partition_test"}'::jsonb,
    '{"result": "success"}'::jsonb,
    0.95,
    true,
    123,
    '{"partition_test": true}'::jsonb
)
RETURNING id, decision_type, created_at;

\echo ''
\echo '============================================================================'
\echo 'Test 4: Aggregation across partitions'
\echo '============================================================================'
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as decision_count,
    AVG(confidence) as avg_confidence,
    AVG(execution_time_ms) as avg_execution_time
FROM ai_decisions 
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC
LIMIT 12;

\echo ''
\echo '============================================================================'
\echo 'Test 5: Query by agent_id (index test)'
\echo '============================================================================'
EXPLAIN ANALYZE
SELECT 
    decision_type,
    confidence,
    created_at
FROM ai_decisions 
WHERE agent_id = (SELECT agent_id FROM ai_decisions LIMIT 1)
LIMIT 10;

\echo ''
\echo '============================================================================'
\echo 'Test 6: Query by user_id (index test)'
\echo '============================================================================'
EXPLAIN ANALYZE
SELECT 
    decision_type,
    confidence,
    created_at
FROM ai_decisions 
WHERE user_id = (SELECT user_id FROM ai_decisions LIMIT 1)
LIMIT 10;

\echo ''
\echo '============================================================================'
\echo 'Test 7: Date range query (multi-partition scan)'
\echo '============================================================================'
EXPLAIN ANALYZE
SELECT 
    COUNT(*) as decisions,
    DATE_TRUNC('day', created_at) as day
FROM ai_decisions 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

\echo ''
\echo '============================================================================'
\echo 'Test 8: JSONB query on metadata (GIN index test)'
\echo '============================================================================'
EXPLAIN ANALYZE
SELECT 
    id,
    decision_type,
    metadata
FROM ai_decisions 
WHERE metadata @> '{"cached": true}'::jsonb
LIMIT 10;

\echo ''
\echo '============================================================================'
\echo 'Test 9: List all partitions with row counts'
\echo '============================================================================'
SELECT * FROM list_partitions();

\echo ''
\echo '============================================================================'
\echo 'Test 10: Check partition health'
\echo '============================================================================'
SELECT check_missing_partitions();

\echo ''
\echo '============================================================================'
\echo 'Test 11: Verify data integrity (compare with old table if exists)'
\echo '============================================================================'
DO $$
DECLARE
    old_exists BOOLEAN;
    old_count INTEGER := 0;
    new_count INTEGER;
BEGIN
    -- Check if old table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ai_decisions_old'
    ) INTO old_exists;
    
    IF old_exists THEN
        SELECT COUNT(*) INTO old_count FROM ai_decisions_old;
        SELECT COUNT(*) INTO new_count FROM ai_decisions;
        
        IF old_count = new_count THEN
            RAISE NOTICE '✅ Data integrity verified: % rows in both tables', new_count;
        ELSE
            RAISE WARNING '⚠️  Row count mismatch: old=% vs new=%', old_count, new_count;
        END IF;
    ELSE
        SELECT COUNT(*) INTO new_count FROM ai_decisions;
        RAISE NOTICE 'ℹ️  ai_decisions_old not found (may have been dropped). Current rows: %', new_count;
    END IF;
END $$;

\echo ''
\echo '============================================================================'
\echo 'Test 12: Performance benchmark - Recent data query'
\echo '============================================================================'
\timing on
SELECT 
    decision_type,
    COUNT(*) as count,
    AVG(confidence) as avg_confidence
FROM ai_decisions 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY decision_type;
\timing off

\echo ''
\echo '============================================================================'
\echo 'Test 13: Performance benchmark - Older data query'
\echo '============================================================================'
\timing on
SELECT 
    decision_type,
    COUNT(*) as count,
    AVG(confidence) as avg_confidence
FROM ai_decisions 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY decision_type;
\timing off

\echo ''
\echo '============================================================================'
\echo 'Test Complete - Summary'
\echo '============================================================================'
SELECT 
    'Total Records' as metric,
    COUNT(*)::TEXT as value
FROM ai_decisions
UNION ALL
SELECT 
    'Date Range',
    MIN(created_at)::TEXT || ' to ' || MAX(created_at)::TEXT
FROM ai_decisions
UNION ALL
SELECT
    'Partitions Count',
    COUNT(DISTINCT tableoid)::TEXT
FROM ai_decisions;

\echo ''
\echo '✅ All tests completed!'
\echo ''
