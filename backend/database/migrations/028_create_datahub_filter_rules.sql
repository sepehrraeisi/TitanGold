-- GAP-024: DataHub filter rules (blacklist / whitelist)
-- domain | source | keyword · ingestion | publishing | both

CREATE TABLE IF NOT EXISTS datahub_filter_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('blacklist', 'whitelist')),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('domain', 'source', 'keyword')),
    pattern TEXT NOT NULL,
    match_type VARCHAR(20) NOT NULL DEFAULT 'contains'
        CHECK (match_type IN ('exact', 'contains', 'regex')),
    apply_target VARCHAR(20) NOT NULL DEFAULT 'ingestion'
        CHECK (apply_target IN ('ingestion', 'publishing', 'both')),
    action VARCHAR(10) NOT NULL CHECK (action IN ('block', 'allow')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 100,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    last_matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT datahub_filter_rules_action_matches_type CHECK (
        (rule_type = 'blacklist' AND action = 'block')
        OR (rule_type = 'whitelist' AND action = 'allow')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datahub_filter_rules_active_unique
    ON datahub_filter_rules (rule_type, scope, pattern, match_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_datahub_filter_rules_active_lookup
    ON datahub_filter_rules (is_active, apply_target, rule_type)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_datahub_filter_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_datahub_filter_rules_updated_at ON datahub_filter_rules;
CREATE TRIGGER trg_datahub_filter_rules_updated_at
    BEFORE UPDATE ON datahub_filter_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_datahub_filter_rules_updated_at();
