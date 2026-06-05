-- Migration: 036_collected_data_pending_index.sql
-- DH-NORMALIZATION-P0-WORKER-1: speed up pending row selection for normalization worker
-- Idempotent — index-only

CREATE INDEX IF NOT EXISTS idx_collected_data_pending_collected
    ON collected_data (collected_at ASC)
    WHERE status = 'pending';
