-- Migration: 045_telegram_agent_feed_indexes.sql
-- DH-TELEGRAM-COLLECTOR-P7: agent feed — agent-first time-range index
-- Idempotent — index-only, no data changes

CREATE INDEX IF NOT EXISTS idx_agent_impacts_agent_created
    ON telegram_agent_impacts (agent_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_impacts_agent_priority_created
    ON telegram_agent_impacts (agent_key, priority_level, created_at DESC);
