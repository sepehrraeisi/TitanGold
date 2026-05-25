-- GAP-019: Automation queue, schedule, execution history
-- Date: 2026-05-24

CREATE TABLE IF NOT EXISTS datahub_automation_schedule (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT false,
  interval_minutes INTEGER NOT NULL DEFAULT 15,
  max_items_per_run INTEGER NOT NULL DEFAULT 5,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO datahub_automation_schedule (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS datahub_automation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES datahub_automation_topics(id) ON DELETE CASCADE,
  publisher_id UUID NOT NULL REFERENCES telegram_publishers(id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  agent_id VARCHAR(120),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  priority SMALLINT NOT NULL DEFAULT 2,
  payload_preview TEXT,
  category VARCHAR(120),
  data_type VARCHAR(80),
  quality_score INTEGER,
  normalized_status VARCHAR(32),
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT datahub_automation_queue_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_queue_record_publisher_pending
  ON datahub_automation_queue (record_id, publisher_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_automation_queue_status_created
  ON datahub_automation_queue (status, created_at DESC);

CREATE TABLE IF NOT EXISTS datahub_automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_item_id UUID REFERENCES datahub_automation_queue(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES datahub_automation_topics(id) ON DELETE SET NULL,
  publisher_id UUID REFERENCES telegram_publishers(id) ON DELETE SET NULL,
  record_id UUID,
  agent_id VARCHAR(120),
  status VARCHAR(32) NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  payload_preview TEXT,
  latency_ms INTEGER,
  publisher_history_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT datahub_automation_executions_status_check
    CHECK (status IN ('sent', 'failed', 'dry_run'))
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_created
  ON datahub_automation_executions (created_at DESC);

COMMENT ON TABLE datahub_automation_queue IS 'Pending/processing publish jobs for DataHub automation';
COMMENT ON TABLE datahub_automation_executions IS 'Auditable dispatch history for automation';
