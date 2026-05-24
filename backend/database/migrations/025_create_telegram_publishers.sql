-- GAP-016: Telegram Publisher persistence (DataHub Advanced)
-- Date: 2026-05-24

CREATE TABLE IF NOT EXISTS telegram_publishers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  channel_username VARCHAR(255),
  channel_title VARCHAR(255),
  bot_token_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  language VARCHAR(20) DEFAULT 'en',
  template TEXT DEFAULT '',
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS publisher_delivery_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES telegram_publishers(id) ON DELETE CASCADE,
  content_type VARCHAR(100),
  content_summary TEXT,
  status VARCHAR(50) NOT NULL,
  telegram_message_id VARCHAR(100),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_publishers_active
  ON telegram_publishers (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_publisher_history_publisher_id
  ON publisher_delivery_history (publisher_id);

CREATE INDEX IF NOT EXISTS idx_publisher_history_created_at
  ON publisher_delivery_history (created_at DESC);

COMMENT ON TABLE telegram_publishers IS 'Output Telegram channels for DataHub signal publishing';
COMMENT ON TABLE publisher_delivery_history IS 'Delivery/test/dry-run history per publisher';
