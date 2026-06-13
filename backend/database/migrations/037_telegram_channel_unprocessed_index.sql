-- Migration: 037_telegram_channel_unprocessed_index.sql
-- DH-PIPELINE-P2-SNAPSHOT-PERF-1: per-channel backlog counts for pipeline enrichment
-- Idempotent — index-only

CREATE INDEX IF NOT EXISTS idx_telegram_messages_channel_unprocessed
    ON telegram_messages (channel_id, telegram_created_at ASC NULLS LAST, created_at ASC)
    WHERE is_processed = false;
