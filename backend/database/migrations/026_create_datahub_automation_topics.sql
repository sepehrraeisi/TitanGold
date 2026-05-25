-- GAP-018: DataHub automation topics (separate from topic_routing_rules)
-- Date: 2026-05-24

CREATE TABLE IF NOT EXISTS datahub_automation_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  topic_key VARCHAR(120) NOT NULL,
  source_type VARCHAR(80) NOT NULL DEFAULT 'pipeline',
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  publish_targets JSONB NOT NULL DEFAULT '{"publisherIds":[]}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority SMALLINT NOT NULL DEFAULT 2,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT datahub_automation_topics_topic_key_unique UNIQUE (topic_key)
);

CREATE INDEX IF NOT EXISTS idx_datahub_automation_topics_active
  ON datahub_automation_topics (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_datahub_automation_topics_priority
  ON datahub_automation_topics (priority DESC, updated_at DESC);

COMMENT ON TABLE datahub_automation_topics IS 'DataHub automation execution/publishing rules (not global topic_routing_rules)';
