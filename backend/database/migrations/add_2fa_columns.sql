-- Add 2FA columns to users table
-- This migration adds two_factor_secret, two_factor_temp_secret, and two_factor_enabled columns

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_temp_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

COMMENT ON COLUMN users.two_factor_secret IS 'Base32 encoded secret for TOTP (Time-based One-Time Password)';
COMMENT ON COLUMN users.two_factor_temp_secret IS 'Temporary secret during 2FA setup (before verification)';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';

