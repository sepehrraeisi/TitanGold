-- Migration: 040_telegram_processed_at_index.sql
-- DH-PERFORMANCE-P3: speed up pipeline backlog throughput calculation
-- Idempotent — index-only, no data changes

CREATE INDEX IF NOT EXISTS idx_telegram_messages_processed_at_recent
    ON telegram_messages (processed_at DESC)
    WHERE is_processed = true;
