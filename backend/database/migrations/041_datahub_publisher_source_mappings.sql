-- DH-TELEGRAM-PUBLISHER-P2: source-to-publisher mappings and richer history

CREATE TABLE IF NOT EXISTS datahub_publisher_source_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  publisher_id UUID NOT NULL REFERENCES telegram_publishers(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  template_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, publisher_id)
);

CREATE INDEX IF NOT EXISTS idx_publisher_source_mappings_source
  ON datahub_publisher_source_mappings (source_id)
  WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_publisher_source_mappings_publisher
  ON datahub_publisher_source_mappings (publisher_id)
  WHERE is_enabled = true;

ALTER TABLE publisher_delivery_history
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_publisher_history_source_id
  ON publisher_delivery_history (source_id);

CREATE INDEX IF NOT EXISTS idx_publisher_history_status_created
  ON publisher_delivery_history (status, created_at DESC);

COMMENT ON TABLE datahub_publisher_source_mappings IS 'Allowed DataHub source to Telegram publisher output channel mappings';
