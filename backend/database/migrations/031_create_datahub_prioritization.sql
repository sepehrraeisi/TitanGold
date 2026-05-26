-- Migration: 031_create_datahub_prioritization.sql
-- GAP-030: DataHub Advanced - Smart Prioritization (preview + manual apply)
-- v3.0: data_sources only; no cron; no auto-apply

-- Settings (singleton-ish; enforce at most 1 row via unique index on a constant)
CREATE TABLE IF NOT EXISTS datahub_prioritization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key SMALLINT NOT NULL DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    factor_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    tier_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_datahub_prioritization_settings_singleton
    ON datahub_prioritization_settings (singleton_key);

-- Per-source last preview (+ override + audit)
CREATE TABLE IF NOT EXISTS datahub_source_priorities (
    source_id UUID PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
    calculated_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (calculated_score >= 0 AND calculated_score <= 100),
    suggested_tier VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (suggested_tier IN ('low', 'medium', 'high', 'critical')),
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- manual override (explicit, never silent)
    override_score NUMERIC(5,2) CHECK (override_score IS NULL OR (override_score >= 0 AND override_score <= 100)),
    override_note TEXT,
    overridden_by UUID REFERENCES users(id) ON DELETE SET NULL,
    overridden_at TIMESTAMPTZ,
    -- timestamps
    last_preview_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_applied_at TIMESTAMPTZ,
    last_applied_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_datahub_source_priorities_tier_score
    ON datahub_source_priorities (suggested_tier, calculated_score DESC);

-- Preview/apply run history
CREATE TABLE IF NOT EXISTS datahub_prioritization_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('preview', 'apply')),
    source_count INTEGER NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datahub_prioritization_runs_created_at
    ON datahub_prioritization_runs (created_at DESC);

-- data_sources fields written ONLY on apply (but column presence is needed for UI + API)
ALTER TABLE data_sources
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    ADD COLUMN IF NOT EXISTS priority_score NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (priority_score >= 0 AND priority_score <= 100),
    ADD COLUMN IF NOT EXISTS priority_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_data_sources_priority_updated_at
    ON data_sources (priority_updated_at DESC)
    WHERE is_active = TRUE;

