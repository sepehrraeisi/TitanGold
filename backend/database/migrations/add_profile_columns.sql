-- Add missing Profile columns to users table
-- Migration: add_profile_columns.sql
-- Date: 2025-12-22

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);

-- Add comments for documentation
COMMENT ON COLUMN users.job_title IS 'User job title/position (e.g., Trader, Analyst, Manager)';
COMMENT ON COLUMN users.timezone IS 'User timezone in IANA format (e.g., Asia/Tehran, America/New_York)';
COMMENT ON COLUMN users.location IS 'User location (city, country)';
