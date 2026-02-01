-- ============================================================================
-- TitanGold User Preferences System
-- ============================================================================
-- Purpose: Enterprise-grade user preferences storage with:
--   - Multi-device sync support
--   - Version control and audit trail
--   - Atomic updates with optimistic locking
--   - Efficient JSONB indexing
--   - Automatic conflict resolution
-- 
-- Author: TitanGold Development Team
-- Date: 2025-12-22
-- Version: 1.0.0
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- 1. USER PREFERENCES TABLE
-- ============================================================================
-- Stores all user preferences in normalized JSONB format
-- Supports versioning, conflict resolution, and audit trail

CREATE TABLE IF NOT EXISTS user_preferences (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Preference data (structured JSONB for flexibility)
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Versioning & Conflict Resolution
    version INTEGER NOT NULL DEFAULT 1,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_source VARCHAR(50), -- 'web', 'mobile', 'api', etc.
    
    -- Metadata
    device_fingerprint VARCHAR(255), -- For multi-device tracking
    ip_address INET,
    user_agent TEXT,
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    -- Soft delete support
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT user_preferences_user_id_unique UNIQUE(user_id),
    CONSTRAINT user_preferences_version_positive CHECK (version > 0)
);

-- Create indexes for optimal performance
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_user_preferences_updated_at ON user_preferences(updated_at DESC);
CREATE INDEX idx_user_preferences_version ON user_preferences(user_id, version);
CREATE INDEX idx_user_preferences_sync ON user_preferences(user_id, last_sync_at) WHERE is_deleted = FALSE;

-- GIN index for JSONB queries (supports advanced queries)
CREATE INDEX idx_user_preferences_jsonb ON user_preferences USING GIN (preferences jsonb_path_ops);

-- Partial index for active preferences only
CREATE INDEX idx_user_preferences_active ON user_preferences(user_id, updated_at) 
    WHERE is_deleted = FALSE;

-- ============================================================================
-- 2. PREFERENCE CATEGORIES TABLE
-- ============================================================================
-- Defines preference categories and their schemas for validation

CREATE TABLE IF NOT EXISTS preference_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- JSON Schema for validation
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Default values
    default_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Access control
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    required_role VARCHAR(50), -- 'admin', 'trader', 'user', etc.
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT preference_categories_name_format CHECK (category_name ~ '^[a-z][a-z0-9_]*$')
);

-- Insert default categories
INSERT INTO preference_categories (category_name, display_name, description, default_values, schema) VALUES
    ('theme', 'Theme Settings', 'Visual theme and appearance preferences', 
     '{"mode": "dark", "color": "blue", "fontSize": "medium", "animations": true}'::jsonb,
     '{"type": "object", "properties": {"mode": {"type": "string", "enum": ["light", "dark"]}}}'::jsonb),
    
    ('language', 'Language & Locale', 'Language, timezone, and regional settings',
     '{"language": "en", "timezone": "UTC", "dateFormat": "YYYY-MM-DD", "currency": "USD"}'::jsonb,
     '{"type": "object", "required": ["language"]}'::jsonb),
    
    ('notifications', 'Notification Preferences', 'How and when to receive notifications',
     '{"email": true, "push": true, "telegram": false, "sound": true}'::jsonb,
     '{"type": "object"}'::jsonb),
    
    ('trading', 'Trading Preferences', 'Default trading settings and risk parameters',
     '{"defaultLeverage": 1, "confirmOrders": true, "autoRefresh": true}'::jsonb,
     '{"type": "object"}'::jsonb),
    
    ('wallet', 'Wallet Preferences', 'Wallet connection and security preferences',
     '{"autoConnect": false, "showBalance": true, "confirmTransactions": true}'::jsonb,
     '{"type": "object"}'::jsonb),
    
    ('security', 'Security Settings', 'Security and privacy preferences',
     '{"twoFactorEnabled": false, "sessionTimeout": 3600, "ipWhitelist": []}'::jsonb,
     '{"type": "object"}'::jsonb),
    
    ('dashboard', 'Dashboard Layout', 'Dashboard customization and widget preferences',
     '{"layout": "default", "widgets": [], "refreshInterval": 30}'::jsonb,
     '{"type": "object"}'::jsonb),
    
    ('api', 'API Settings', 'API keys and integration settings',
     '{"exchanges": {}, "rateLimits": {}}'::jsonb,
     '{"type": "object"}'::jsonb)
ON CONFLICT (category_name) DO NOTHING;

CREATE INDEX idx_preference_categories_name ON preference_categories(category_name) WHERE is_active = TRUE;

-- ============================================================================
-- 3. PREFERENCE CHANGE HISTORY TABLE
-- ============================================================================
-- Audit trail for all preference changes (for rollback and analysis)

CREATE TABLE IF NOT EXISTS preference_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Change details
    category VARCHAR(100),
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'merge')),
    
    -- Values
    old_values JSONB,
    new_values JSONB,
    diff JSONB, -- Computed diff for easy analysis
    
    -- Version tracking
    old_version INTEGER,
    new_version INTEGER,
    
    -- Context
    sync_source VARCHAR(50),
    device_fingerprint VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    reason TEXT, -- Optional reason for change
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Performance optimization
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for history queries
CREATE INDEX idx_preference_history_user_id ON preference_change_history(user_id, changed_at DESC);
CREATE INDEX idx_preference_history_category ON preference_change_history(user_id, category, changed_at DESC);
CREATE INDEX idx_preference_history_version ON preference_change_history(user_id, new_version);
CREATE INDEX idx_preference_history_active ON preference_change_history(user_id, changed_at DESC) 
    WHERE is_archived = FALSE;

-- ============================================================================
-- 4. USER PREFERENCE CACHE TABLE
-- ============================================================================
-- In-memory cache for frequently accessed preferences (optional)

CREATE TABLE IF NOT EXISTS user_preference_cache (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL,
    version INTEGER NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    
    CONSTRAINT cache_version_positive CHECK (version > 0)
);

CREATE INDEX idx_preference_cache_expires ON user_preference_cache(expires_at);

-- ============================================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Trigger function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Increment version on update
CREATE OR REPLACE FUNCTION increment_preference_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    NEW.last_sync_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Log changes to history
CREATE OR REPLACE FUNCTION log_preference_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val VARCHAR(20);
BEGIN
    IF TG_OP = 'INSERT' THEN
        change_type_val = 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        change_type_val = 'update';
    ELSIF TG_OP = 'DELETE' THEN
        change_type_val = 'delete';
    END IF;

    INSERT INTO preference_change_history (
        user_id,
        change_type,
        old_values,
        new_values,
        old_version,
        new_version,
        sync_source,
        device_fingerprint,
        ip_address,
        changed_by
    ) VALUES (
        COALESCE(NEW.user_id, OLD.user_id),
        change_type_val,
        OLD.preferences,
        NEW.preferences,
        OLD.version,
        NEW.version,
        NEW.sync_source,
        NEW.device_fingerprint,
        NEW.ip_address,
        NEW.updated_by
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Invalidate cache on update
CREATE OR REPLACE FUNCTION invalidate_preference_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM user_preference_cache WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_user_preferences_timestamp ON user_preferences;
CREATE TRIGGER trigger_update_user_preferences_timestamp
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_timestamp();

DROP TRIGGER IF EXISTS trigger_increment_preference_version ON user_preferences;
CREATE TRIGGER trigger_increment_preference_version
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION increment_preference_version();

DROP TRIGGER IF EXISTS trigger_log_preference_change ON user_preferences;
CREATE TRIGGER trigger_log_preference_change
    AFTER INSERT OR UPDATE OR DELETE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION log_preference_change();

DROP TRIGGER IF EXISTS trigger_invalidate_preference_cache ON user_preferences;
CREATE TRIGGER trigger_invalidate_preference_cache
    AFTER UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_preference_cache();

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function: Get user preferences with fallback to defaults
CREATE OR REPLACE FUNCTION get_user_preferences(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    defaults JSONB := '{}'::jsonb;
BEGIN
    -- Get category defaults
    SELECT jsonb_object_agg(category_name, default_values)
    INTO defaults
    FROM preference_categories
    WHERE is_active = TRUE;

    -- Get user preferences and merge with defaults
    SELECT COALESCE(preferences, '{}'::jsonb) || defaults
    INTO result
    FROM user_preferences
    WHERE user_id = p_user_id AND is_deleted = FALSE;

    -- Return defaults if no user preferences found
    RETURN COALESCE(result, defaults);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Merge preferences (for conflict resolution)
CREATE OR REPLACE FUNCTION merge_preferences(
    p_user_id UUID,
    p_new_prefs JSONB,
    p_client_version INTEGER,
    p_sync_source VARCHAR
)
RETURNS TABLE(success BOOLEAN, merged_prefs JSONB, new_version INTEGER, conflict BOOLEAN) AS $$
DECLARE
    current_version INTEGER;
    current_prefs JSONB;
    merged JSONB;
    has_conflict BOOLEAN := FALSE;
BEGIN
    -- Get current state
    SELECT version, preferences
    INTO current_version, current_prefs
    FROM user_preferences
    WHERE user_id = p_user_id AND is_deleted = FALSE
    FOR UPDATE; -- Lock row for update

    -- Check for version conflict
    IF current_version != p_client_version THEN
        has_conflict := TRUE;
        -- Simple merge strategy: newer values win (can be made more sophisticated)
        merged := current_prefs || p_new_prefs;
    ELSE
        merged := current_prefs || p_new_prefs;
    END IF;

    -- Update preferences
    UPDATE user_preferences
    SET 
        preferences = merged,
        sync_source = p_sync_source,
        updated_at = NOW()
    WHERE user_id = p_user_id AND is_deleted = FALSE;

    -- Return result
    RETURN QUERY SELECT TRUE, merged, current_version + 1, has_conflict;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean old history (for maintenance)
CREATE OR REPLACE FUNCTION archive_old_preference_history(days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE preference_change_history
    SET is_archived = TRUE, archived_at = NOW()
    WHERE changed_at < (NOW() - (days || ' days')::INTERVAL)
      AND is_archived = FALSE;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: User preferences with metadata
CREATE OR REPLACE VIEW v_user_preferences AS
SELECT 
    up.user_id,
    u.username,
    u.email,
    up.preferences,
    up.version,
    up.last_sync_at,
    up.sync_source,
    up.device_fingerprint,
    up.updated_at,
    up.created_at,
    (SELECT COUNT(*) FROM preference_change_history WHERE user_id = up.user_id) as change_count
FROM user_preferences up
JOIN users u ON up.user_id = u.id
WHERE up.is_deleted = FALSE;

-- View: Recent preference changes
CREATE OR REPLACE VIEW v_recent_preference_changes AS
SELECT 
    pch.id,
    pch.user_id,
    u.username,
    pch.category,
    pch.change_type,
    pch.new_values,
    pch.sync_source,
    pch.changed_at
FROM preference_change_history pch
JOIN users u ON pch.user_id = u.id
WHERE pch.is_archived = FALSE
ORDER BY pch.changed_at DESC;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions (adjust based on your security model)
GRANT SELECT, INSERT, UPDATE ON user_preferences TO postgres;
GRANT SELECT ON preference_categories TO postgres;
GRANT INSERT ON preference_change_history TO postgres;
GRANT SELECT, DELETE ON user_preference_cache TO postgres;

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_preferences IS 'Stores user preferences with versioning and multi-device sync support';
COMMENT ON TABLE preference_categories IS 'Defines available preference categories and their validation schemas';
COMMENT ON TABLE preference_change_history IS 'Audit trail for all preference changes';
COMMENT ON TABLE user_preference_cache IS 'Optional cache layer for frequently accessed preferences';

COMMENT ON COLUMN user_preferences.version IS 'Optimistic locking version number, incremented on each update';
COMMENT ON COLUMN user_preferences.sync_source IS 'Source of the last update (web, mobile, api, etc.)';
COMMENT ON COLUMN user_preferences.device_fingerprint IS 'Device identification for multi-device tracking';

-- ============================================================================
-- 10. MIGRATION: Transfer existing data from user_settings
-- ============================================================================

-- Migrate existing user_settings to new user_preferences table
INSERT INTO user_preferences (user_id, preferences, sync_source, created_at, updated_at)
SELECT 
    user_id,
    jsonb_build_object(
        'theme', COALESCE(theme, 'dark'),
        'language', COALESCE(language, 'en'),
        'timezone', COALESCE(timezone, 'UTC'),
        'currency', COALESCE(currency, 'USD'),
        'notifications', COALESCE(notifications, '{}'::jsonb),
        'trading', COALESCE(trading_preferences, '{}'::jsonb),
        'api', jsonb_build_object('keys', COALESCE(api_keys, '{}'::jsonb))
    ) as preferences,
    'migration' as sync_source,
    created_at,
    updated_at
FROM user_settings
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences WHERE user_preferences.user_id = user_settings.user_id
);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Print success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ User Preferences System created successfully!';
    RAISE NOTICE '📊 Tables: user_preferences, preference_categories, preference_change_history, user_preference_cache';
    RAISE NOTICE '🔧 Functions: get_user_preferences, merge_preferences, archive_old_preference_history';
    RAISE NOTICE '👁️  Views: v_user_preferences, v_recent_preference_changes';
    RAISE NOTICE '🚀 System is ready for production use!';
END $$;
