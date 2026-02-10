-- Migration: 014_create_data_queue.sql
-- Task: TASK-DF-003 - Create data_queue table
-- Description: Queue table for data processing pipeline
-- Date: 2026-02-03

CREATE TABLE IF NOT EXISTS data_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  data_id UUID NOT NULL REFERENCES collected_data(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_queue_status ON data_queue(status);
CREATE INDEX IF NOT EXISTS idx_data_queue_scheduled_at ON data_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_data_queue_source_id ON data_queue(source_id);

-- Comments
COMMENT ON TABLE data_queue IS 'Queue for processing collected data through the AI pipeline';
COMMENT ON COLUMN data_queue.priority IS 'Processing priority (lower number = higher priority)';
COMMENT ON COLUMN data_queue.attempts IS 'Current number of processing attempts';
COMMENT ON COLUMN data_queue.status IS 'Queue status: pending, processing, completed, or failed';
