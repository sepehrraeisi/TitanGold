-- =====================================================
-- Telegram Data Pipeline Database Schema
-- Purpose: Process raw Telegram messages into structured trading data
-- Date: 2026-02-16
-- =====================================================

-- Table 1: Processed Telegram Messages
-- Stores enriched and analyzed messages
CREATE TABLE IF NOT EXISTS processed_telegram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source Reference
    raw_message_id UUID NOT NULL REFERENCES telegram_messages(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES telegram_channels(id),
    
    -- Content Analysis
    language VARCHAR(10),  -- 'fa', 'en', 'ar', etc.
    cleaned_text TEXT,     -- Text without emojis, URLs, hashtags
    keywords TEXT[],       -- Extracted keywords
    hashtags TEXT[],       -- Extracted hashtags
    urls TEXT[],           -- Extracted URLs
    
    -- Entity Extraction
    mentioned_assets TEXT[],       -- ['BTC', 'ETH', 'GOLD', 'USDT', 'DOLLAR']
    mentioned_currencies TEXT[],   -- ['USD', 'IRR', 'EUR', 'AED']
    extracted_prices JSONB,        -- {asset: price, currency: 'USD'}
    extracted_dates TIMESTAMP[],   -- Important dates mentioned
    extracted_numbers DECIMAL[],   -- Key numbers/statistics
    
    -- Sentiment Analysis
    sentiment VARCHAR(20),         -- 'positive', 'negative', 'neutral', 'mixed'
    sentiment_score DECIMAL(3,2),  -- -1.0 to 1.0
    confidence_score DECIMAL(3,2), -- 0.0 to 1.0
    emotion_tags TEXT[],           -- ['fear', 'greed', 'excitement', 'concern']
    
    -- News Classification
    news_type VARCHAR(50),         -- 'market_update', 'price_alert', 'analysis', 'news', 'educational'
    news_category VARCHAR(50),     -- 'crypto', 'forex', 'gold', 'economic', 'political'
    importance_level VARCHAR(20),  -- 'critical', 'high', 'medium', 'low'
    is_actionable BOOLEAN DEFAULT false,  -- Can trigger trading decisions
    
    -- Trading Signals
    signal_type VARCHAR(30),       -- 'buy', 'sell', 'hold', 'alert', null
    signal_strength DECIMAL(3,2),  -- 0.0 to 1.0
    target_assets TEXT[],          -- Assets affected by this signal
    risk_level VARCHAR(20),        -- 'high', 'medium', 'low'
    
    -- Quality Metrics
    readability_score DECIMAL(3,2),  -- 0.0 to 1.0
    spam_probability DECIMAL(3,2),   -- 0.0 to 1.0
    is_duplicate BOOLEAN DEFAULT false,
    quality_flags TEXT[],            -- ['low_quality', 'incomplete', 'unclear']
    
    -- Processing Metadata
    processing_status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_duration_ms INTEGER,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_messages_channel ON processed_telegram_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_status ON processed_telegram_messages(processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_messages_created ON processed_telegram_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_messages_sentiment ON processed_telegram_messages(sentiment);
CREATE INDEX IF NOT EXISTS idx_processed_messages_importance ON processed_telegram_messages(importance_level);
CREATE INDEX IF NOT EXISTS idx_processed_messages_signal ON processed_telegram_messages(signal_type) WHERE signal_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processed_messages_actionable ON processed_telegram_messages(is_actionable) WHERE is_actionable = true;

-- Full-text search index for keywords
CREATE INDEX IF NOT EXISTS idx_processed_messages_keywords_gin ON processed_telegram_messages USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_processed_messages_assets_gin ON processed_telegram_messages USING GIN(mentioned_assets);

-- Table 2: Price Movements
-- Tracks extracted price information
CREATE TABLE IF NOT EXISTS telegram_price_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_message_id UUID REFERENCES processed_telegram_messages(id) ON DELETE CASCADE,
    
    asset_symbol VARCHAR(20) NOT NULL,  -- 'BTC', 'GOLD', 'USD', etc.
    price DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    price_type VARCHAR(20),  -- 'current', 'target', 'support', 'resistance'
    
    change_percent DECIMAL(10,2),
    change_direction VARCHAR(10),  -- 'up', 'down', 'stable'
    timeframe VARCHAR(20),  -- '1h', '24h', '7d', '1m'
    
    source_confidence DECIMAL(3,2),  -- How confident we are in this extraction
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_movements_asset ON telegram_price_movements(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_price_movements_created ON telegram_price_movements(created_at DESC);

-- Table 3: Trading Signals
-- Actionable trading signals extracted from messages
CREATE TABLE IF NOT EXISTS telegram_trading_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_message_id UUID REFERENCES processed_telegram_messages(id) ON DELETE CASCADE,
    
    signal_type VARCHAR(30) NOT NULL,  -- 'buy', 'sell', 'hold', 'alert'
    asset_symbol VARCHAR(20) NOT NULL,
    entry_price DECIMAL(20,8),
    target_price DECIMAL(20,8),
    stop_loss DECIMAL(20,8),
    
    strength DECIMAL(3,2),  -- 0.0 to 1.0
    confidence DECIMAL(3,2),  -- 0.0 to 1.0
    risk_reward_ratio DECIMAL(10,2),
    
    timeframe VARCHAR(20),
    valid_until TIMESTAMP,
    
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'executed', 'expired', 'cancelled'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trading_signals_asset ON telegram_trading_signals(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_trading_signals_type ON telegram_trading_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_trading_signals_status ON telegram_trading_signals(status);
CREATE INDEX IF NOT EXISTS idx_trading_signals_created ON telegram_trading_signals(created_at DESC);

-- Table 4: Sentiment Trends
-- Aggregate sentiment analysis over time
CREATE TABLE IF NOT EXISTS telegram_sentiment_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    asset_symbol VARCHAR(20),
    channel_id UUID REFERENCES telegram_channels(id),
    
    timeframe VARCHAR(20) NOT NULL,  -- '1h', '6h', '24h'
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    
    message_count INTEGER,
    positive_count INTEGER,
    negative_count INTEGER,
    neutral_count INTEGER,
    
    avg_sentiment_score DECIMAL(3,2),
    sentiment_volatility DECIMAL(3,2),
    dominant_sentiment VARCHAR(20),
    
    top_keywords TEXT[],
    trending_topics TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sentiment_trends_asset ON telegram_sentiment_trends(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_sentiment_trends_time ON telegram_sentiment_trends(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_trends_channel ON telegram_sentiment_trends(channel_id);

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Update processed_telegram_messages.updated_at
CREATE TRIGGER update_processed_messages_updated_at
    BEFORE UPDATE ON processed_telegram_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update telegram_trading_signals.updated_at
CREATE TRIGGER update_trading_signals_updated_at
    BEFORE UPDATE ON telegram_trading_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View: Real-time Processing Stats
CREATE OR REPLACE VIEW telegram_pipeline_stats AS
SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE processing_status = 'completed') as processed_count,
    COUNT(*) FILTER (WHERE processing_status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE is_actionable = true) as actionable_count,
    COUNT(*) FILTER (WHERE signal_type IS NOT NULL) as signal_count,
    AVG(processing_duration_ms) as avg_processing_time_ms,
    COUNT(DISTINCT channel_id) as channels_with_data
FROM processed_telegram_messages
WHERE created_at > NOW() - INTERVAL '24 hours';

-- View: Top Assets by Mention
CREATE OR REPLACE VIEW telegram_top_mentioned_assets AS
SELECT 
    asset,
    COUNT(*) as mention_count,
    AVG(sentiment_score) as avg_sentiment,
    COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_mentions,
    COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_mentions
FROM processed_telegram_messages,
    UNNEST(mentioned_assets) as asset
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY asset
ORDER BY mention_count DESC
LIMIT 20;

-- Grant permissions (adjust user as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- =====================================================
-- Migration complete!
-- Next: Build processing service to populate these tables
-- =====================================================
