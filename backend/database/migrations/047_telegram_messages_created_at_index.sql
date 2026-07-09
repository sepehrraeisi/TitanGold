-- Migration: 047_telegram_messages_created_at_index.sql
-- DH-HEALTH-MONITORING-P2: speed up 1h telegram intake count for health monitoring
-- Idempotent — index-only, no data changes

CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at_recent
    ON telegram_messages (created_at DESC);
