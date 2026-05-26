-- GAP-026: DataHub web/RSS crawlers + run history

CREATE TABLE IF NOT EXISTS datahub_crawlers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('website', 'rss')),
    start_url TEXT NOT NULL,
    max_depth INTEGER NOT NULL DEFAULT 0 CHECK (max_depth >= 0 AND max_depth <= 5),
    max_pages_per_run INTEGER NOT NULL DEFAULT 50 CHECK (max_pages_per_run >= 1 AND max_pages_per_run <= 500),
    schedule_interval VARCHAR(20) NOT NULL DEFAULT '5min'
        CHECK (schedule_interval IN ('realtime', '1min', '5min', '15min', '30min', '1hour', 'daily')),
    respect_robots BOOLEAN NOT NULL DEFAULT TRUE,
    render_js BOOLEAN NOT NULL DEFAULT FALSE,
    selectors JSONB NOT NULL DEFAULT '{}'::jsonb,
    timeout_ms INTEGER NOT NULL DEFAULT 600000 CHECK (timeout_ms >= 5000 AND timeout_ms <= 3600000),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    next_run_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datahub_crawler_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crawler_id UUID NOT NULL REFERENCES datahub_crawlers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    trigger_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (trigger_type IN ('manual', 'schedule')),
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    items_ingested INTEGER NOT NULL DEFAULT 0,
    items_blocked INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datahub_crawlers_source
    ON datahub_crawlers (source_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_datahub_crawlers_enabled_next
    ON datahub_crawlers (is_enabled, next_run_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_datahub_crawler_runs_crawler
    ON datahub_crawler_runs (crawler_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_datahub_crawlers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_datahub_crawlers_updated_at ON datahub_crawlers;
CREATE TRIGGER trg_datahub_crawlers_updated_at
    BEFORE UPDATE ON datahub_crawlers
    FOR EACH ROW
    EXECUTE FUNCTION update_datahub_crawlers_updated_at();
