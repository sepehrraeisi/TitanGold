-- Migration: 039_datahub_priority_tier.sql
-- DH-SMARTPRIORITY-P2: Add tier column without touching legacy integer priority.

ALTER TABLE data_sources
    ADD COLUMN IF NOT EXISTS priority_tier VARCHAR(20)
        CHECK (priority_tier IS NULL OR priority_tier IN ('low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_data_sources_priority_tier
    ON data_sources (priority_tier)
    WHERE is_active = TRUE AND priority_tier IS NOT NULL;

COMMENT ON COLUMN data_sources.priority IS 'Legacy scheduler queue weight (integer 1–10). Not written by Smart Prioritization apply.';
COMMENT ON COLUMN data_sources.priority_tier IS 'Smart Prioritization tier (low/medium/high/critical). Written on manual apply only.';
COMMENT ON COLUMN data_sources.priority_score IS 'Smart Prioritization score 0–100. Written on manual apply only.';
