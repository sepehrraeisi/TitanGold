-- Migration: Add agent_key column to ai_agents table
-- Purpose: Enable UI-Backend contract via standardized agent identifiers
-- Date: 2026-01-03

-- Step 1: Add agent_key column
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS agent_key VARCHAR(50);

-- Step 2: Backfill agent_key based on existing type/name
-- Map known types to standard agent_keys
UPDATE ai_agents 
SET agent_key = CASE
    -- Technical Analysis
    WHEN LOWER(type) LIKE '%technical%' OR LOWER(name) LIKE '%technical%' THEN 'technical'
    
    -- Risk Management
    WHEN LOWER(type) LIKE '%risk%' OR LOWER(name) LIKE '%risk%' THEN 'risk'
    
    -- Sentiment Analysis
    WHEN LOWER(type) LIKE '%sentiment%' OR LOWER(name) LIKE '%sentiment%' THEN 'sentiment'
    
    -- Pattern Recognition
    WHEN LOWER(type) LIKE '%pattern%' OR LOWER(name) LIKE '%pattern%' THEN 'pattern'
    
    -- Price Prediction
    WHEN LOWER(type) LIKE '%price%' OR LOWER(name) LIKE '%price%' OR LOWER(name) LIKE '%predict%' THEN 'price_prediction'
    
    -- Arbitrage
    WHEN LOWER(type) LIKE '%arbitrage%' OR LOWER(name) LIKE '%arbitrage%' THEN 'arbitrage'
    
    -- Portfolio Management
    WHEN LOWER(type) LIKE '%portfolio%' OR LOWER(name) LIKE '%portfolio%' THEN 'portfolio'
    
    -- Liquidity Analysis
    WHEN LOWER(type) LIKE '%liquidity%' OR LOWER(name) LIKE '%liquidity%' THEN 'liquidity'
    
    -- Trend Detection
    WHEN LOWER(type) LIKE '%trend%' OR LOWER(name) LIKE '%trend%' THEN 'trend'
    
    -- Optimization
    WHEN LOWER(type) LIKE '%optimiz%' OR LOWER(name) LIKE '%optimiz%' THEN 'optimization'
    
    -- Order Management
    WHEN LOWER(type) LIKE '%order%' OR LOWER(name) LIKE '%order%' THEN 'order'
    
    -- Fundamental Analysis
    WHEN LOWER(type) LIKE '%fundamental%' OR LOWER(name) LIKE '%fundamental%' THEN 'fundamental'
    
    -- Market Intelligence
    WHEN LOWER(type) LIKE '%market%' OR LOWER(type) LIKE '%intelligence%' OR LOWER(name) LIKE '%market%intel%' THEN 'market_intelligence'
    
    -- Volume Analysis
    WHEN LOWER(type) LIKE '%volume%' OR LOWER(name) LIKE '%volume%' THEN 'volume'
    
    -- Timing
    WHEN LOWER(type) LIKE '%timing%' OR LOWER(name) LIKE '%timing%' THEN 'timing'
    
    -- Default: keep null (will be handled by seed script)
    ELSE NULL
END
WHERE agent_key IS NULL;

-- Step 3: Add unique constraint on agent_key (only for non-null values)
-- First, create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_agent_key_unique 
ON ai_agents(agent_key) 
WHERE agent_key IS NOT NULL;

-- Step 4: Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_agents_agent_key 
ON ai_agents(agent_key);

-- Step 5: Log any unmapped agents (for manual review)
DO $$
DECLARE
    unmapped_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmapped_count
    FROM ai_agents
    WHERE agent_key IS NULL;
    
    IF unmapped_count > 0 THEN
        RAISE WARNING 'Found % agents without agent_key - these will be handled by seed script', unmapped_count;
    ELSE
        RAISE NOTICE 'All existing agents successfully mapped to agent_keys';
    END IF;
END $$;

-- Step 6: Add comment for documentation
COMMENT ON COLUMN ai_agents.agent_key IS 'Unique identifier for agent type (technical, risk, sentiment, etc.) - used by UI and API routing';

-- Migration complete
-- Next step: Run seed script (A2) to ensure all 15 agents exist
