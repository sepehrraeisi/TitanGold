-- ============================================================================
-- Favorites System Database Schema
-- ============================================================================
-- Creates tables for user favorite crypto assets with real-time tracking
-- and price alerts functionality
--
-- R4: Idempotent for schema.sql-first bootstrap.
-- Do NOT DROP existing favorites tables (schema/bootstrap may already own them).
-- Index names align with Production (idx_favorite_alerts_user_id, not
-- idx_alerts_user_id which belongs to the alerts table).
-- ============================================================================

-- ============================================================================
-- Table: favorites
-- ============================================================================
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Asset Information
    asset_id VARCHAR(50) NOT NULL,        -- e.g., "BTCUSDT", "ETHUSDT"
    symbol VARCHAR(20) NOT NULL,          -- e.g., "BTC", "ETH"
    name VARCHAR(100) NOT NULL,           -- e.g., "Bitcoin", "Ethereum"
    
    -- Metadata
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    
    -- Indexing
    UNIQUE (user_id, asset_id)            -- Prevent duplicate favorites
);

-- ============================================================================
-- Table: favorite_alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS favorite_alerts (
    id SERIAL PRIMARY KEY,
    favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Alert Configuration
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
    target_price DECIMAL(20, 8) NOT NULL,
    
    -- Alert Status
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP,
    triggered_price DECIMAL(20, 8),
    
    -- Notification Settings
    notify_telegram BOOLEAN DEFAULT true,
    notify_browser BOOLEAN DEFAULT true,
    notify_email BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Validation
    CONSTRAINT valid_target_price CHECK (target_price > 0)
);

-- ============================================================================
-- Indexes for Performance (IF NOT EXISTS for schema-first bootstrap)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_asset_id ON favorites(asset_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_asset ON favorites(user_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_favorite_id ON favorite_alerts(favorite_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON favorite_alerts(is_active) WHERE is_active = true;
-- Production-aligned name (do not collide with alerts.idx_alerts_user_id)
CREATE INDEX IF NOT EXISTS idx_favorite_alerts_user_id ON favorite_alerts(user_id);

-- ============================================================================
-- Triggers for Automatic Timestamp Updates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_favorite_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_favorite_alert_timestamp ON favorite_alerts;
CREATE TRIGGER trigger_update_favorite_alert_timestamp
    BEFORE UPDATE ON favorite_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_favorite_alert_timestamp();

-- ============================================================================
-- Functions for Common Operations
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_favorites_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM favorites WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_alerts_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) 
            FROM favorite_alerts 
            WHERE user_id = p_user_id AND is_active = true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_asset_favorited(p_user_id UUID, p_asset_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM favorites 
        WHERE user_id = p_user_id AND asset_id = p_asset_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE username = 'testuser2' LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO favorites (user_id, asset_id, symbol, name) 
        VALUES 
            (v_user_id, 'BTCUSDT', 'BTC', 'Bitcoin'),
            (v_user_id, 'ETHUSDT', 'ETH', 'Ethereum'),
            (v_user_id, 'BNBUSDT', 'BNB', 'Binance Coin')
        ON CONFLICT (user_id, asset_id) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- Views for Analytics
-- ============================================================================

CREATE OR REPLACE VIEW user_favorites_summary AS
SELECT 
    f.id,
    f.user_id,
    f.asset_id,
    f.symbol,
    f.name,
    f.added_at,
    f.last_viewed_at,
    f.view_count,
    COUNT(fa.id) AS total_alerts,
    COUNT(fa.id) FILTER (WHERE fa.is_active = true) AS active_alerts
FROM favorites f
LEFT JOIN favorite_alerts fa ON f.id = fa.favorite_id
GROUP BY f.id;

-- ============================================================================
-- Migration Complete
-- ============================================================================
