-- Migration: 044_telegram_analytics_indexes.sql
-- DH-TELEGRAM-COLLECTOR-P5: speed up analytics joins and agent aggregations
-- Idempotent — index-only, no data changes

CREATE INDEX IF NOT EXISTS idx_news_events_processed_message_id
    ON telegram_news_events (processed_message_id);

CREATE INDEX IF NOT EXISTS idx_agent_impacts_created_agent
    ON telegram_agent_impacts (created_at DESC, agent_key);

CREATE INDEX IF NOT EXISTS idx_news_events_created_category
    ON telegram_news_events (created_at DESC, primary_category);
