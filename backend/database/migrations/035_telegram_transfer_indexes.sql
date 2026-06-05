-- Migration: 035_telegram_transfer_indexes.sql
-- DH-PIPELINE-P0-ARCH-1: speed up unprocessed telegram message selection + dedupe safety
-- Idempotent — index-only, no column changes

-- Partial index for backlog selection (is_processed = false ORDER BY telegram_created_at)
CREATE INDEX IF NOT EXISTS idx_telegram_messages_unprocessed_created
    ON telegram_messages (telegram_created_at ASC NULLS LAST, created_at ASC)
    WHERE is_processed = false;

-- Prevent duplicate telegram message inserts per source (expression index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_collected_data_telegram_msg_dedupe
    ON collected_data (source_id, ((raw_data->>'telegram_message_id')))
    WHERE raw_data ? 'telegram_message_id';
