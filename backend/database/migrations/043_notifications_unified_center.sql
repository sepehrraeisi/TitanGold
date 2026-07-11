-- DH-NOTIFICATIONS-SETTINGS-P2: unified, safe personal notification center

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  browser_enabled BOOLEAN NOT NULL DEFAULT false,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  do_not_disturb_enabled BOOLEAN NOT NULL DEFAULT false,
  frequency_level VARCHAR(10) NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_frequency_check
    CHECK (frequency_level IN ('low', 'normal', 'high'))
);

ALTER TABLE notification_history
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20),
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS message_preview TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_id UUID NULL REFERENCES data_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publisher_id UUID NULL REFERENCES telegram_publishers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_masked TEXT,
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE notification_history
SET
  channel = COALESCE(channel, data->>'channel', 'system'),
  message_type = COALESCE(message_type, type),
  message_preview = COALESCE(message_preview, LEFT(message, 500)),
  status = COALESCE(status, 'sent'),
  metadata = COALESCE(metadata, data, '{}'::jsonb)
WHERE channel IS NULL
   OR message_type IS NULL
   OR message_preview IS NULL
   OR status IS NULL;

ALTER TABLE notification_history
  ALTER COLUMN channel SET DEFAULT 'system',
  ALTER COLUMN message_type SET DEFAULT 'system',
  ALTER COLUMN status SET DEFAULT 'sent',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_history_channel_check'
  ) THEN
    ALTER TABLE notification_history
      ADD CONSTRAINT notification_history_channel_check
      CHECK (channel IN ('telegram', 'browser', 'email', 'system', 'in_app', 'push', 'sms'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_history_status_check'
  ) THEN
    ALTER TABLE notification_history
      ADD CONSTRAINT notification_history_status_check
      CHECK (status IN ('dry_run', 'sent', 'failed', 'blocked', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated_at
  ON notification_preferences(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_status_created
  ON notification_history(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_source_created
  ON notification_history(source_id, created_at DESC)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_history_publisher_created
  ON notification_history(publisher_id, created_at DESC)
  WHERE publisher_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_notification_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_preferences_timestamp ON notification_preferences;
CREATE TRIGGER trigger_update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_timestamp();
