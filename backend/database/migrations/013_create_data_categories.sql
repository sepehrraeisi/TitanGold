-- Migration: 013_create_data_categories.sql
-- Task: TASK-DF-002 - Create data_categories table
-- Description: Table to persist data categories for the Data Hub
-- Date: 2026-02-03

CREATE TABLE IF NOT EXISTS data_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(50),
  icon VARCHAR(100),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_categories_name ON data_categories(name);

-- Comments
COMMENT ON TABLE data_categories IS 'Stored categories for classifying data sources and collected data';
COMMENT ON COLUMN data_categories.name IS 'Unique display name for the category';
COMMENT ON COLUMN data_categories.color IS 'Hex or CSS color code for UI display';
COMMENT ON COLUMN data_categories.icon IS 'Icon identifier for UI display';
