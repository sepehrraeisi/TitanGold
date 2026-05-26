-- GAP-028: Auto Discovery (suggestion-only, admin approval)

CREATE TABLE IF NOT EXISTS datahub_discovery_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO datahub_discovery_settings (id, enabled) VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS datahub_discovery_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    pattern TEXT NOT NULL,
    source_kind VARCHAR(20) NOT NULL DEFAULT 'website'
        CHECK (source_kind IN ('api', 'rss', 'website', 'telegram')),
    category VARCHAR(100) NOT NULL DEFAULT 'uncategorized',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datahub_discovery_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'failed')),
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    added_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS datahub_discovery_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
    suggested_name VARCHAR(255) NOT NULL,
    suggested_type VARCHAR(20) NOT NULL
        CHECK (suggested_type IN ('api', 'rss', 'web', 'telegram')),
    suggested_url TEXT NOT NULL,
    host_key VARCHAR(512) NOT NULL,
    path_key VARCHAR(1024) NOT NULL DEFAULT '/',
    title_key VARCHAR(512),
    category VARCHAR(100) NOT NULL DEFAULT 'uncategorized',
    priority_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
    discovery_source VARCHAR(30) NOT NULL
        CHECK (discovery_source IN ('crawler', 'telegram', 'known_sources', 'rule')),
    rule_id UUID REFERENCES datahub_discovery_rules(id) ON DELETE SET NULL,
    scan_id UUID REFERENCES datahub_discovery_scans(id) ON DELETE SET NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    duplicate_of_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    duplicate_of_suggestion_id UUID REFERENCES datahub_discovery_suggestions(id) ON DELETE SET NULL,
    duplicate_reason TEXT,
    duplicate_confidence NUMERIC(5,2),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note TEXT,
    created_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_suggestions_status
    ON datahub_discovery_suggestions (status, priority_score DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_discovery_suggestions_host
    ON datahub_discovery_suggestions (host_key, path_key)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_suggestions_pending_host_path
    ON datahub_discovery_suggestions (host_key, path_key, suggested_type)
    WHERE status = 'pending' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_datahub_discovery_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_datahub_discovery_rules_updated_at ON datahub_discovery_rules;
CREATE TRIGGER trg_datahub_discovery_rules_updated_at
    BEFORE UPDATE ON datahub_discovery_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_datahub_discovery_rules_updated_at();

CREATE OR REPLACE FUNCTION update_datahub_discovery_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_datahub_discovery_suggestions_updated_at ON datahub_discovery_suggestions;
CREATE TRIGGER trg_datahub_discovery_suggestions_updated_at
    BEFORE UPDATE ON datahub_discovery_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION update_datahub_discovery_suggestions_updated_at();
