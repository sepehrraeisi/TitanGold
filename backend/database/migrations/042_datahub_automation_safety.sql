-- DH-AUTOMATION-ROUTING-P2: safety, auditability, and retry metadata

ALTER TABLE datahub_automation_queue
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retry_count INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(100);

ALTER TABLE datahub_automation_queue
  DROP CONSTRAINT IF EXISTS datahub_automation_queue_retry_count_check;

ALTER TABLE datahub_automation_queue
  ADD CONSTRAINT datahub_automation_queue_retry_count_check
    CHECK (retry_count >= 0 AND max_retry_count >= 1 AND retry_count <= max_retry_count);

ALTER TABLE datahub_automation_executions
  DROP CONSTRAINT IF EXISTS datahub_automation_executions_status_check;

ALTER TABLE datahub_automation_executions
  ADD CONSTRAINT datahub_automation_executions_status_check
    CHECK (status IN ('sent', 'failed', 'dry_run', 'blocked', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_automation_queue_pending_claim
  ON datahub_automation_queue (priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_automation_executions_status_created
  ON datahub_automation_executions (status, created_at DESC);

