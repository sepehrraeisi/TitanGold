-- ===========================================================================
-- TitanGold - Add balance_usd column to portfolios
-- Date: 2025-12-27
-- Purpose: Fix portfolio value calculation error
-- ===========================================================================

-- Add balance_usd column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'portfolios' 
        AND column_name = 'balance_usd'
    ) THEN
        ALTER TABLE portfolios 
        ADD COLUMN balance_usd NUMERIC(20, 8) DEFAULT 0;
        
        COMMENT ON COLUMN portfolios.balance_usd IS 'Current portfolio balance in USD';
        
        -- Update existing portfolios to copy total_value to balance_usd
        UPDATE portfolios SET balance_usd = COALESCE(total_value, 0);
        
        RAISE NOTICE 'Added balance_usd column to portfolios table';
    ELSE
        RAISE NOTICE 'balance_usd column already exists';
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_portfolios_balance_usd ON portfolios(balance_usd) WHERE balance_usd > 0;

COMMENT ON TABLE portfolios IS 'User portfolios with balance tracking';
