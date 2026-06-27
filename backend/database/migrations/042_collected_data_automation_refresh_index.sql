-- Migration: 042_collected_data_automation_refresh_index.sql
-- DH-AUTOMATION-ROUTING-P4: speed up automation queue refresh candidate scan
-- Idempotent index-only change

CREATE INDEX IF NOT EXISTS idx_collected_data_automation_candidates
    ON collected_data (processed_at DESC NULLS LAST)
    WHERE status = 'processed' AND normalized_data IS NOT NULL;
