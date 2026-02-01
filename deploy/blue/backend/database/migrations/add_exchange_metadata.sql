-- Add permissions and account_info columns to exchange_connections table
-- Migration: add_exchange_metadata.sql

-- Add permissions column (JSON array for API key permissions)
ALTER TABLE exchange_connections 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- Add account_info column (JSON object for account details)
ALTER TABLE exchange_connections 
ADD COLUMN IF NOT EXISTS account_info JSONB DEFAULT '{}'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_exchange_connections_permissions 
ON exchange_connections USING GIN (permissions);

-- Create index for account_info
CREATE INDEX IF NOT EXISTS idx_exchange_connections_account_info 
ON exchange_connections USING GIN (account_info);

-- Add comment
COMMENT ON COLUMN exchange_connections.permissions IS 'API key permissions (e.g., ["spot", "trading", "deposits", "withdrawals"])';
COMMENT ON COLUMN exchange_connections.account_info IS 'Account information from exchange (e.g., balance, currencies)';
