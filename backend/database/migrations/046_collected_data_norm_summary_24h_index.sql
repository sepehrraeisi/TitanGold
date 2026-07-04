-- Migration: 046_collected_data_norm_summary_24h_index.sql
-- DH-DATA-PIPELINE-PX: speed up 24h normalization summary counts
-- Note: non-concurrent index build (project runner does not support CONCURRENTLY)

CREATE INDEX IF NOT EXISTS idx_collected_data_norm_summary_24h
    ON collected_data (processed_at DESC)
    WHERE status IN ('processed', 'error');
