-- Migration: 012_create_collected_data.sql
-- Task: TASK-DF-001 - Create collected_data table
-- Description: Table to store actual data collected from sources (RSS, API, Telegram, etc.)
-- Date: 2026-02-03

CREATE TABLE IF NOT EXISTS collected_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  raw_data JSONB NOT NULL,
  normalized_data JSONB,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processed', 'error'
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collected_data_source_id ON collected_data(source_id);
CREATE INDEX IF NOT EXISTS idx_collected_data_status ON collected_data(status);
CREATE INDEX IF NOT EXISTS idx_collected_data_collected_at ON collected_data(collected_at DESC);

-- Comments
COMMENT ON TABLE collected_data IS 'Actual data collected from various sources before and after normalization';
COMMENT ON COLUMN collected_data.raw_data IS 'Original data as received from the source';
COMMENT ON COLUMN collected_data.normalized_data IS 'Data transformed into a standard format for AI agents';
COMMENT ON COLUMN collected_data.status IS 'Processing status: pending, processed, or error';
