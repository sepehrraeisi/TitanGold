-- Add backup codes column to users table for 2FA recovery
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]';

-- Optional comment for documentation
COMMENT ON COLUMN users.two_factor_backup_codes IS 
'Encrypted backup codes for 2FA recovery. Each code can be used only once.';
