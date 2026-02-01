-- Liquidity Agent Database Schema
-- Phase 1: Foundation

-- ============================================================================
-- Table: agent_settings_liquidity
-- Purpose: User-specific liquidity agent configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_settings_liquidity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic settings
    enabled BOOLEAN DEFAULT true,
    mode VARCHAR(10) DEFAULT 'demo' CHECK (mode IN ('demo', 'live')),
    
    -- Symbols to monitor
    symbols TEXT[] DEFAULT ARRAY['BTCUSDT', 'ETHUSDT'],
    
    -- Depth levels to analyze (as percentages)
    depth_levels DECIMAL[] DEFAULT ARRAY[0.1, 0.5, 1.0, 2.0],
    
    -- Slippage thresholds
    slippage_thresholds JSONB DEFAULT '{
        "low": 0.1,
        "medium": 0.5,
        "high": 1.0
    }'::jsonb,
    
    -- Alert rules
    alert_rules JSONB DEFAULT '{
        "spread_threshold": 0.05,
        "depth_min": 100000,
        "slippage_max": 0.5
    }'::jsonb,
    
    -- Integrations
    integrations JSONB DEFAULT '{
        "shareWithArtemis": true,
        "syncWithRisk": true,
        "syncWithPortfolio": true,
        "forwardToDashboard": true
    }'::jsonb,
    
    -- Alert channels
    alert_channels JSONB DEFAULT '{
        "dashboard": true,
        "email": false,
        "telegram": false
    }'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id)
);

-- ============================================================================
-- Table: agent_runs_liquidity
-- Purpose: Individual liquidity scan results
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_runs_liquidity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Scan details
    symbol VARCHAR(20) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    latency_ms INTEGER,
    
    -- Raw data
    orderbook_snapshot JSONB,
    
    -- Computed metrics
    liquidity_metrics JSONB DEFAULT '{}'::jsonb,
    slippage_metrics JSONB DEFAULT '{}'::jsonb,
    capital_flow JSONB DEFAULT '{}'::jsonb,
    
    -- Summary scores
    liquidity_score DECIMAL(5,2),
    risk_level VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high')),
    
    -- Alerts triggered
    alerts_triggered JSONB DEFAULT '[]'::jsonb,
    
    -- Error tracking
    error_message TEXT,
    
    -- Indexes for fast queries
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_runs_user_id ON agent_runs_liquidity(user_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_runs_symbol ON agent_runs_liquidity(symbol);
CREATE INDEX IF NOT EXISTS idx_liquidity_runs_created_at ON agent_runs_liquidity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_runs_status ON agent_runs_liquidity(status);

-- ============================================================================
-- Table: agent_metrics_liquidity
-- Purpose: Aggregated metrics per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_metrics_liquidity (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Counters
    total_scans INTEGER DEFAULT 0,
    successful_scans INTEGER DEFAULT 0,
    failed_scans INTEGER DEFAULT 0,
    
    -- Time tracking
    active_hours DECIMAL(10,2) DEFAULT 0,
    first_scan_at TIMESTAMP,
    last_scan_at TIMESTAMP,
    
    -- Performance metrics (averages)
    avg_liquidity_score DECIMAL(5,2),
    avg_spread DECIMAL(8,6),
    avg_depth_100k DECIMAL(15,2),
    avg_depth_500k DECIMAL(15,2),
    avg_slippage_100k DECIMAL(8,6),
    avg_slippage_500k DECIMAL(8,6),
    
    -- Alert stats
    total_alerts INTEGER DEFAULT 0,
    alerts_by_type JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Trigger: Update agent_metrics_liquidity on new run
-- ============================================================================
CREATE OR REPLACE FUNCTION update_liquidity_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        INSERT INTO agent_metrics_liquidity (
            user_id,
            total_scans,
            successful_scans,
            first_scan_at,
            last_scan_at,
            avg_liquidity_score,
            updated_at
        ) VALUES (
            NEW.user_id,
            1,
            1,
            NEW.created_at,
            NEW.created_at,
            NEW.liquidity_score,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            total_scans = agent_metrics_liquidity.total_scans + 1,
            successful_scans = agent_metrics_liquidity.successful_scans + 1,
            last_scan_at = NEW.created_at,
            avg_liquidity_score = (
                COALESCE(agent_metrics_liquidity.avg_liquidity_score, 0) * agent_metrics_liquidity.successful_scans +
                COALESCE(NEW.liquidity_score, 0)
            ) / (agent_metrics_liquidity.successful_scans + 1),
            updated_at = NOW();
    ELSIF NEW.status = 'failed' THEN
        INSERT INTO agent_metrics_liquidity (
            user_id,
            total_scans,
            failed_scans,
            first_scan_at,
            last_scan_at,
            updated_at
        ) VALUES (
            NEW.user_id,
            1,
            1,
            NEW.created_at,
            NEW.created_at,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            total_scans = agent_metrics_liquidity.total_scans + 1,
            failed_scans = agent_metrics_liquidity.failed_scans + 1,
            last_scan_at = NEW.created_at,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_update_liquidity_metrics ON agent_runs_liquidity;
CREATE TRIGGER trg_update_liquidity_metrics
    AFTER INSERT OR UPDATE OF status ON agent_runs_liquidity
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'failed'))
    EXECUTE FUNCTION update_liquidity_metrics();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE agent_settings_liquidity IS 'User configuration for liquidity agent';
COMMENT ON TABLE agent_runs_liquidity IS 'Individual liquidity scan results';
COMMENT ON TABLE agent_metrics_liquidity IS 'Aggregated metrics per user';

-- ============================================================================
-- Grant permissions (adjust as needed)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON agent_settings_liquidity TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE ON agent_runs_liquidity TO your_app_role;
-- GRANT SELECT, UPDATE ON agent_metrics_liquidity TO your_app_role;
