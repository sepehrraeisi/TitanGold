-- =====================================================
-- Enhanced Telegram Data Pipeline for 15 AI Agents
-- Purpose: Multi-category news processing + Agent impact assessment
-- Date: 2026-02-16
-- Version: 2.0.0
-- =====================================================

-- Table: Agent Impact Mapping
-- Links processed messages to affected agents
CREATE TABLE IF NOT EXISTS telegram_agent_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_message_id UUID NOT NULL REFERENCES processed_telegram_messages(id) ON DELETE CASCADE,
    
    -- Agent identification
    agent_key VARCHAR(50) NOT NULL,  -- e.g., 'technical', 'sentiment', 'risk'
    agent_name VARCHAR(100),
    
    -- Impact assessment
    impact_score DECIMAL(3,2) NOT NULL,  -- 0.0 to 1.0
    impact_type VARCHAR(30),  -- 'direct', 'indirect', 'cascading'
    confidence DECIMAL(3,2),  -- 0.0 to 1.0
    
    -- Relevance factors
    relevance_reasons TEXT[],  -- Why this message affects this agent
    extracted_signals JSONB,   -- Agent-specific signals from message
    
    -- Priority & urgency
    priority_level VARCHAR(20),  -- 'critical', 'high', 'medium', 'low'
    requires_action BOOLEAN DEFAULT false,
    action_type VARCHAR(50),  -- 'update_model', 'trigger_analysis', 'alert', etc.
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_by_agent_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT unique_message_agent UNIQUE(processed_message_id, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_impacts_agent_key ON telegram_agent_impacts(agent_key);
CREATE INDEX IF NOT EXISTS idx_agent_impacts_impact_score ON telegram_agent_impacts(impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_impacts_priority ON telegram_agent_impacts(priority_level);
CREATE INDEX IF NOT EXISTS idx_agent_impacts_created ON telegram_agent_impacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_impacts_action ON telegram_agent_impacts(requires_action) WHERE requires_action = true;

-- Table: News Event Categories (Enhanced)
-- Comprehensive categorization system
CREATE TABLE IF NOT EXISTS telegram_news_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_message_id UUID NOT NULL REFERENCES processed_telegram_messages(id) ON DELETE CASCADE,
    
    -- Main categorization
    primary_category VARCHAR(50) NOT NULL,  -- See categories below
    sub_category VARCHAR(50),
    event_type VARCHAR(50),
    
    -- Geographic context
    countries TEXT[],  -- ['Iran', 'USA', 'Russia', etc.]
    regions TEXT[],    -- ['Middle East', 'Europe', etc.]
    cities TEXT[],
    
    -- Entity extraction
    people_mentioned TEXT[],      -- Leaders, politicians, analysts
    organizations TEXT[],          -- Companies, institutions, governments
    events_referenced TEXT[],      -- Specific events (sanctions, wars, summits)
    
    -- Market impact
    affected_markets TEXT[],       -- ['forex', 'crypto', 'gold', 'stocks']
    affected_assets TEXT[],        -- ['USD', 'BTC', 'GOLD', 'OIL']
    market_impact_level VARCHAR(20),  -- 'severe', 'high', 'moderate', 'low'
    
    -- Time sensitivity
    is_breaking BOOLEAN DEFAULT false,
    is_developing BOOLEAN DEFAULT false,
    event_urgency VARCHAR(20),     -- 'immediate', 'short_term', 'medium_term', 'long_term'
    
    -- Verification
    source_reliability DECIMAL(3,2),  -- 0.0 to 1.0
    is_verified BOOLEAN DEFAULT false,
    verification_sources TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_events_primary_cat ON telegram_news_events(primary_category);
CREATE INDEX IF NOT EXISTS idx_news_events_impact ON telegram_news_events(market_impact_level);
CREATE INDEX IF NOT EXISTS idx_news_events_breaking ON telegram_news_events(is_breaking) WHERE is_breaking = true;
CREATE INDEX IF NOT EXISTS idx_news_events_created ON telegram_news_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_countries_gin ON telegram_news_events USING GIN(countries);
CREATE INDEX IF NOT EXISTS idx_news_events_assets_gin ON telegram_news_events USING GIN(affected_assets);

-- Add new columns to processed_telegram_messages for enhanced categorization
ALTER TABLE processed_telegram_messages 
ADD COLUMN IF NOT EXISTS event_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS event_sub_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS geopolitical_relevance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS market_impact_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS affected_agents TEXT[],
ADD COLUMN IF NOT EXISTS agent_impact_summary JSONB;

-- View: Agent Feed Dashboard
-- Real-time view of messages per agent
CREATE OR REPLACE VIEW telegram_agent_feed AS
SELECT 
    ai.agent_key,
    ai.agent_name,
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE ai.requires_action = true) as action_required_count,
    COUNT(*) FILTER (WHERE ai.priority_level = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE ai.priority_level = 'high') as high_count,
    AVG(ai.impact_score) as avg_impact_score,
    MAX(ai.created_at) as last_message_at,
    array_agg(DISTINCT pm.event_category) FILTER (WHERE pm.event_category IS NOT NULL) as event_categories,
    array_agg(DISTINCT pm.news_category) as news_categories
FROM telegram_agent_impacts ai
JOIN processed_telegram_messages pm ON ai.processed_message_id = pm.id
WHERE ai.created_at > NOW() - INTERVAL '24 hours'
GROUP BY ai.agent_key, ai.agent_name
ORDER BY avg_impact_score DESC;

-- View: Multi-Category News Summary
-- Breakdown by all categories
CREATE OR REPLACE VIEW telegram_news_category_summary AS
SELECT 
    event_category,
    news_category,
    COUNT(*) as message_count,
    COUNT(*) FILTER (WHERE is_actionable = true) as actionable_count,
    COUNT(*) FILTER (WHERE importance_level = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE geopolitical_relevance = true) as geopolitical_count,
    AVG(sentiment_score) as avg_sentiment,
    array_agg(DISTINCT mentioned_assets[1:3]) as top_assets  -- First 3 assets only
FROM processed_telegram_messages
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_category, news_category
ORDER BY message_count DESC;

-- View: Breaking News Monitor
-- Real-time breaking news across all categories
CREATE OR REPLACE VIEW telegram_breaking_news AS
SELECT 
    pm.id,
    pm.cleaned_text,
    pm.event_category,
    pm.news_category,
    ne.is_breaking,
    ne.is_developing,
    ne.event_urgency,
    ne.market_impact_level,
    ne.affected_markets,
    ne.affected_assets,
    ne.countries,
    pm.importance_level,
    pm.sentiment,
    pm.affected_agents,
    pm.created_at
FROM processed_telegram_messages pm
LEFT JOIN telegram_news_events ne ON pm.id = ne.processed_message_id
WHERE (ne.is_breaking = true OR pm.importance_level IN ('critical', 'high'))
    AND pm.created_at > NOW() - INTERVAL '6 hours'
ORDER BY pm.created_at DESC;

-- View: Agent-Specific Message Queue
-- Function to get messages for a specific agent
CREATE OR REPLACE FUNCTION get_agent_messages(
    p_agent_key VARCHAR,
    p_hours_back INTEGER DEFAULT 24,
    p_min_impact DECIMAL DEFAULT 0.5,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    message_id UUID,
    cleaned_text TEXT,
    event_category VARCHAR,
    news_category VARCHAR,
    sentiment VARCHAR,
    importance_level VARCHAR,
    impact_score DECIMAL,
    requires_action BOOLEAN,
    relevance_reasons TEXT[],
    extracted_signals JSONB,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.id,
        pm.cleaned_text,
        pm.event_category,
        pm.news_category,
        pm.sentiment,
        pm.importance_level,
        ai.impact_score,
        ai.requires_action,
        ai.relevance_reasons,
        ai.extracted_signals,
        pm.created_at
    FROM processed_telegram_messages pm
    JOIN telegram_agent_impacts ai ON pm.id = ai.processed_message_id
    WHERE ai.agent_key = p_agent_key
        AND pm.created_at > NOW() - INTERVAL '1 hour' * p_hours_back
        AND ai.impact_score >= p_min_impact
    ORDER BY ai.impact_score DESC, pm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- NEWS CATEGORY TAXONOMY
-- =====================================================

/*
PRIMARY CATEGORIES (event_category):

1. MARKET_DATA
   - Price movements, volume, liquidity
   - Technical indicators
   - Market depth, order book

2. ECONOMIC_INDICATORS
   - GDP, inflation, employment
   - Central bank decisions
   - Interest rates, monetary policy

3. GEOPOLITICAL
   - Wars, conflicts, military actions
   - International relations
   - Territorial disputes

4. POLITICAL
   - Elections, government changes
   - Policy decisions, regulations
   - Political instability

5. SANCTIONS_EMBARGO
   - Economic sanctions
   - Trade restrictions
   - Asset freezes

6. ENERGY_COMMODITIES
   - Oil, gas prices
   - Energy policy
   - Supply/demand

7. CRYPTO_BLOCKCHAIN
   - Crypto regulations
   - Blockchain news
   - DeFi, NFT updates

8. FOREX_CURRENCY
   - Exchange rates
   - Currency interventions
   - Forex policy

9. PRECIOUS_METALS
   - Gold, silver prices
   - Mining news
   - Central bank reserves

10. SOCIAL_UNREST
    - Protests, demonstrations
    - Social movements
    - Civil disorder

11. NATURAL_DISASTERS
    - Earthquakes, floods
    - Climate events
    - Supply disruptions

12. CORPORATE_BUSINESS
    - Company earnings
    - Mergers, acquisitions
    - Business announcements

13. TECHNOLOGY
    - Tech innovations
    - Cybersecurity
    - Digital transformation

14. FINANCIAL_CRISIS
    - Bank failures
    - Debt crises
    - Systemic risks

15. TRADE_COMMERCE
    - Trade agreements
    - Import/export data
    - Supply chain

*/

-- =====================================================
-- Migration Complete!
-- Next: Update messageProcessor.js to use new schema
-- =====================================================
