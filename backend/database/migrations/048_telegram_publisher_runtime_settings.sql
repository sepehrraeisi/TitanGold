-- DH-TELEGRAM-PUBLISHER-P3: persistent runtime delivery mode (DB source of truth)

CREATE TABLE IF NOT EXISTS telegram_publisher_runtime_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  mode TEXT NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run', 'live_test', 'live')),
  is_live_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_test_expires_at TIMESTAMPTZ NULL,
  live_test_remaining_sends INTEGER NOT NULL DEFAULT 0,
  changed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  changed_by_email TEXT NULL,
  changed_by_name TEXT NULL,
  reason TEXT NOT NULL DEFAULT 'Initial default — dry-run safest mode',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_publisher_runtime_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_mode TEXT NULL CHECK (old_mode IS NULL OR old_mode IN ('dry_run', 'live_test', 'live')),
  new_mode TEXT NOT NULL CHECK (new_mode IN ('dry_run', 'live_test', 'live')),
  changed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'mode_changed',
    'live_test_started',
    'live_test_consumed',
    'live_test_expired',
    'live_enabled',
    'dry_run_enabled',
    'emergency_override_active'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_publisher_runtime_audit_created
  ON telegram_publisher_runtime_audit (created_at DESC);

INSERT INTO telegram_publisher_runtime_settings (id, mode, is_live_enabled, reason)
VALUES ('default', 'dry_run', FALSE, 'Initial default — dry-run safest mode')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE telegram_publisher_runtime_settings IS 'Singleton runtime delivery mode for Telegram Publisher (survives restarts)';
COMMENT ON TABLE telegram_publisher_runtime_audit IS 'Audit trail for Telegram Publisher runtime mode changes and live_test lifecycle';
