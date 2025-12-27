-- ===========================================================================
-- TitanGold AI Module - Missing Tables Migration
-- Date: 2025-12-27
-- Purpose: Create all missing tables for AI functionality
-- ===========================================================================

-- 1. AI Providers (External AI services configuration)
CREATE TABLE IF NOT EXISTS ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(500),
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 30,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled ON ai_providers(is_enabled, priority);

-- 2. AI Jobs (Async AI processing jobs)
CREATE TABLE IF NOT EXISTS ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES ai_providers(id) ON DELETE SET NULL,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_status ON ai_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type_status ON ai_jobs(job_type, status);

-- 3. Engine Runs (Trading engine execution history)
CREATE TABLE IF NOT EXISTS engine_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'running',
    total_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    failed_trades INTEGER DEFAULT 0,
    total_profit_loss DECIMAL(20, 8) DEFAULT 0,
    roi_percentage DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    config JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_engine_runs_user_type ON engine_runs(user_id, run_type, started_at DESC);

-- 4. Market Snapshots (Historical market data caching)
CREATE TABLE IF NOT EXISTS market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(20) NOT NULL,
    open_price DECIMAL(20, 8),
    high_price DECIMAL(20, 8),
    low_price DECIMAL(20, 8),
    close_price DECIMAL(20, 8),
    volume DECIMAL(20, 8),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    indicators JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_symbol_time ON market_snapshots(exchange, symbol, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_timestamp ON market_snapshots(timestamp DESC);

-- 5. Signals (Trading signals from various sources)
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL,
    source_id VARCHAR(200),
    signal_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50),
    confidence DECIMAL(5, 2),
    price DECIMAL(20, 8),
    target_price DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    timeframe VARCHAR(20),
    reasoning TEXT,
    metadata JSONB,
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol_type ON signals(symbol, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_processed ON signals(is_processed, created_at);
CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source, created_at DESC);

-- 6. Scenario Runs (Backtest and simulation results)
CREATE TABLE IF NOT EXISTS scenario_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID REFERENCES trading_scenarios(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_type VARCHAR(50) DEFAULT 'backtest',
    status VARCHAR(50) DEFAULT 'pending',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    initial_capital DECIMAL(20, 8),
    final_capital DECIMAL(20, 8),
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2),
    profit_loss DECIMAL(20, 8),
    roi_percentage DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    results_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_scenario_runs_scenario ON scenario_runs(scenario_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_user_status ON scenario_runs(user_id, status);

-- 7. Telegram Channels (Monitored Telegram channels for signals)
CREATE TABLE IF NOT EXISTS telegram_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(200),
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    subscriber_count INTEGER,
    quality_score INTEGER DEFAULT 50,
    config JSONB,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_channels_active ON telegram_channels(is_active, quality_score DESC);

-- 8. Telegram Messages (Collected messages from channels)
CREATE TABLE IF NOT EXISTS telegram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id BIGINT NOT NULL,
    channel_id UUID REFERENCES telegram_channels(id) ON DELETE CASCADE,
    sender_id BIGINT,
    sender_username VARCHAR(200),
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    has_media BOOLEAN DEFAULT false,
    media_url TEXT,
    extracted_signals JSONB,
    sentiment_score DECIMAL(5, 2),
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    telegram_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_channel ON telegram_messages(channel_id, telegram_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_processed ON telegram_messages(is_processed);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_messages_unique ON telegram_messages(message_id, channel_id);

-- ===========================================================================
-- Seed Data
-- ===========================================================================

-- Insert default AI providers
INSERT INTO ai_providers (name, display_name, provider_type, api_endpoint, is_enabled, priority, config)
VALUES
    ('openrouter', 'OpenRouter', 'llm', 'https://openrouter.ai/api/v1', true, 1, '{"models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"]}'),
    ('openai', 'OpenAI', 'llm', 'https://api.openai.com/v1', true, 2, '{"models": ["gpt-4-turbo", "gpt-3.5-turbo"]}'),
    ('gemini', 'Google Gemini', 'multimodal', 'https://generativelanguage.googleapis.com/v1', true, 3, '{"models": ["gemini-pro", "gemini-pro-vision"]}'),
    ('deepseek', 'DeepSeek', 'llm', 'https://api.deepseek.com/v1', false, 4, '{"models": ["deepseek-chat"]}'),
    ('claude', 'Anthropic Claude', 'llm', 'https://api.anthropic.com/v1', true, 5, '{"models": ["claude-3-opus", "claude-3-sonnet"]}')
ON CONFLICT (name) DO NOTHING;

-- Insert example Telegram channel
INSERT INTO telegram_channels (channel_id, username, title, category, is_active, is_verified, quality_score, config)
VALUES
    (-1001234567890, '@crypto_signals_test', 'Test Crypto Signals', 'signals', false, false, 50, '{"keywords": ["BUY", "SELL", "LONG", "SHORT"]}')
ON CONFLICT (channel_id) DO NOTHING;

COMMENT ON TABLE ai_providers IS 'External AI service providers configuration';
COMMENT ON TABLE ai_jobs IS 'Async AI processing jobs queue and history';
COMMENT ON TABLE engine_runs IS 'Trading engine execution runs and statistics';
COMMENT ON TABLE market_snapshots IS 'Cached historical market data for analysis';
COMMENT ON TABLE signals IS 'Trading signals from various sources';
COMMENT ON TABLE scenario_runs IS 'Backtest and simulation execution results';
COMMENT ON TABLE telegram_channels IS 'Monitored Telegram channels for signal collection';
COMMENT ON TABLE telegram_messages IS 'Collected messages from Telegram channels';
