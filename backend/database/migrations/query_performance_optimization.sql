-- Migration: Query Performance Optimization (DATABASE-007)
-- Date: 2026-01-31
-- Description: Add indexes to optimize common slow queries

-- ============================================================================
-- AI Agents Table Indexes
-- ============================================================================

-- Index for agent lookup by agent_key (used frequently)
CREATE INDEX IF NOT EXISTS idx_ai_agents_agent_key 
ON ai_agents(agent_key) 
WHERE is_enabled = true;

-- Index for agent status filtering
CREATE INDEX IF NOT EXISTS idx_ai_agents_status_enabled 
ON ai_agents(status, is_enabled);

-- Index for agent ordering by name
CREATE INDEX IF NOT EXISTS idx_ai_agents_name 
ON ai_agents(name);

-- Index for last active agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_last_active 
ON ai_agents(last_active_at DESC NULLS LAST);

-- ============================================================================
-- AI Decisions Table Indexes
-- ============================================================================

-- Composite index for decisions by agent and time
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent_created 
ON ai_decisions(agent_id, created_at DESC);

-- Index for decisions by user
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user_created 
ON ai_decisions(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Index for successful decisions
CREATE INDEX IF NOT EXISTS idx_ai_decisions_successful 
ON ai_decisions(was_successful, created_at DESC) 
WHERE was_successful = true;

-- Index for decision type analysis
CREATE INDEX IF NOT EXISTS idx_ai_decisions_type 
ON ai_decisions(decision_type, created_at DESC);

-- ============================================================================
-- Request Logs / Error Logs (optional — table may not exist on greenfield)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_request_logs_duration ON request_logs(duration_ms DESC) WHERE duration_ms > 100;
    CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status, created_at DESC) WHERE status >= 400;
    CREATE INDEX IF NOT EXISTS idx_request_logs_path_created ON request_logs(path, created_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'error_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_error_logs_context ON error_logs(context, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- User Table Indexes
-- ============================================================================

-- Index for email lookup (used in auth)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Index for username lookup
CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username);

-- ============================================================================
-- Portfolios Table Indexes
-- ============================================================================

-- Index for user portfolios
CREATE INDEX IF NOT EXISTS idx_portfolios_user 
ON portfolios(user_id, created_at DESC);

-- Index for active portfolios
CREATE INDEX IF NOT EXISTS idx_portfolios_active 
ON portfolios(is_active, user_id);

-- ============================================================================
-- Trades Table Indexes
-- ============================================================================

-- Composite index for user trades
CREATE INDEX IF NOT EXISTS idx_trades_user_created 
ON trades(user_id, created_at DESC);

-- Index for trade status
CREATE INDEX IF NOT EXISTS idx_trades_status 
ON trades(status, created_at DESC);

-- Index for symbol trading
CREATE INDEX IF NOT EXISTS idx_trades_symbol 
ON trades(symbol, created_at DESC);

-- ============================================================================
-- Artemis State Table Indexes
-- ============================================================================

-- Index for latest Artemis state
CREATE INDEX IF NOT EXISTS idx_artemis_state_created 
ON artemis_state(created_at DESC);

-- ============================================================================
-- Analyze tables for query planner
-- ============================================================================

-- Update statistics for query planner optimization (skip missing tables)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ai_agents', 'ai_decisions', 'request_logs', 'error_logs',
    'users', 'portfolios', 'trades', 'artemis_state'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ANALYZE %I', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Create function to monitor index usage
-- ============================================================================

CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
    schemaname text,
    tablename text,
    indexname text,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    table_size text,
    index_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.indexrelname::text,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        pg_size_pretty(pg_relation_size(s.relid)) AS table_size,
        pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Success
-- ============================================================================

-- Log success
DO $$
BEGIN
    RAISE NOTICE 'DATABASE-007: Query performance indexes created successfully';
END $$;
