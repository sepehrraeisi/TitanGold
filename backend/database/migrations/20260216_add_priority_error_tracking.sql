-- ============================================================================
-- Migration: Add Priority and Error Tracking to telegram_channels
-- Date: 2026-02-16
-- Phase: 2.1 - Enhanced Monitoring
-- ============================================================================
--
-- Purpose:
--   Add priority levels and error tracking to telegram_channels table
--   to enable:
--   1. Priority-based polling (high priority channels polled more frequently)
--   2. Error tracking (detect persistent failures)
--   3. Better monitoring and alerts
--
-- New Fields:
--   - priority: Importance level (high/normal/low)
--   - last_error: Last error message
--   - last_error_at: When the last error occurred
--   - error_count: Consecutive error count
--   - consecutive_success_count: Consecutive success count (for recovery tracking)
--
-- ============================================================================

BEGIN;

-- Add priority field (high/normal/low)
-- Default is 'normal' for existing channels
ALTER TABLE telegram_channels 
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low'));

-- Add error tracking fields
ALTER TABLE telegram_channels 
ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL;

ALTER TABLE telegram_channels 
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP DEFAULT NULL;

ALTER TABLE telegram_channels 
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

ALTER TABLE telegram_channels 
ADD COLUMN IF NOT EXISTS consecutive_success_count INTEGER DEFAULT 0;

-- Add index on priority for faster queries
CREATE INDEX IF NOT EXISTS idx_telegram_channels_priority ON telegram_channels(priority);

-- Add index on error_count for monitoring queries
CREATE INDEX IF NOT EXISTS idx_telegram_channels_error_count ON telegram_channels(error_count);

-- Add composite index for priority + error monitoring
CREATE INDEX IF NOT EXISTS idx_telegram_channels_priority_errors 
ON telegram_channels(priority, error_count) 
WHERE is_active = true;

-- Update existing channels to have default priority
UPDATE telegram_channels 
SET priority = 'normal' 
WHERE priority IS NULL;

-- Add comment to table
COMMENT ON COLUMN telegram_channels.priority IS 'Channel importance level: high (poll every 1-2 min), normal (poll every 5-10 min), low (poll every 15-30 min)';

COMMENT ON COLUMN telegram_channels.last_error IS 'Last error message encountered during polling';

COMMENT ON COLUMN telegram_channels.last_error_at IS 'Timestamp of last error';

COMMENT ON COLUMN telegram_channels.error_count IS 'Number of consecutive errors (resets on success)';

COMMENT ON COLUMN telegram_channels.consecutive_success_count IS 'Number of consecutive successes (for recovery tracking)';

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check new columns exist
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'telegram_channels' 
AND column_name IN ('priority', 'last_error', 'last_error_at', 'error_count', 'consecutive_success_count')
ORDER BY ordinal_position;

-- Check indexes
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'telegram_channels' 
AND indexname LIKE '%priority%' OR indexname LIKE '%error%';

-- Sample data check
SELECT 
    id,
    username,
    priority,
    error_count,
    last_error,
    last_error_at,
    consecutive_success_count
FROM telegram_channels 
LIMIT 5;

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Set a channel as high priority
-- UPDATE telegram_channels 
-- SET priority = 'high' 
-- WHERE username = 'bbcpersian';

-- Record an error
-- UPDATE telegram_channels 
-- SET 
--   last_error = 'TIMEOUT: Connection timed out after 30s',
--   last_error_at = NOW(),
--   error_count = error_count + 1,
--   consecutive_success_count = 0
-- WHERE id = 'channel-uuid';

-- Record a success (clears error count)
-- UPDATE telegram_channels 
-- SET 
--   error_count = 0,
--   last_error = NULL,
--   last_error_at = NULL,
--   consecutive_success_count = consecutive_success_count + 1,
--   last_synced_at = NOW()
-- WHERE id = 'channel-uuid';

-- Find channels with persistent errors
-- SELECT 
--   username,
--   title,
--   priority,
--   error_count,
--   last_error,
--   last_error_at
-- FROM telegram_channels 
-- WHERE error_count >= 3 
-- AND is_active = true
-- ORDER BY priority DESC, error_count DESC;

-- Find high-priority channels that haven't synced recently
-- SELECT 
--   username,
--   title,
--   priority,
--   last_synced_at,
--   NOW() - last_synced_at AS time_since_sync
-- FROM telegram_channels 
-- WHERE priority = 'high' 
-- AND is_active = true
-- AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL '10 minutes')
-- ORDER BY last_synced_at ASC NULLS FIRST;
