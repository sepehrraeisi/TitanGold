-- Migration: 024_scheduling_and_incremental.sql
-- Task: TASK-BE-015 - Implement crawl scheduling and incremental updates
-- Description: Add columns for scheduling and content hashing to data_sources and collected_data tables
-- Date: 2026-02-09

-- Add columns to data_sources
ALTER TABLE data_sources 
ADD COLUMN IF NOT EXISTS refresh_interval INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS next_fetch_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_content_hash TEXT;

-- Add content_hash to collected_data for deduplication
ALTER TABLE collected_data
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add index for content hashing search
CREATE INDEX IF NOT EXISTS idx_collected_data_content_hash ON collected_data(content_hash);
CREATE INDEX IF NOT EXISTS idx_data_sources_next_fetch_at ON data_sources(next_fetch_at) WHERE is_active = true AND is_enabled = true;

-- Update existing sources to have a default interval if null (e.g., 60 mins)
UPDATE data_sources SET refresh_interval = 60 WHERE refresh_interval IS NULL;
UPDATE data_sources SET next_fetch_at = NOW() WHERE next_fetch_at IS NULL;
