-- TitanGold Professional Database Schema
-- PostgreSQL 14+

-- Enable UUID extensions (uuid-ossp for uuid_generate_v4; pgcrypto for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'user', -- user, admin, trader, vip
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    refresh_token TEXT UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PORTFOLIO & ASSETS
-- ============================================================================

CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_value DECIMAL(20, 8) DEFAULT 0,
    base_currency VARCHAR(10) DEFAULT 'USD',
    is_main BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, name)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
    avg_buy_price DECIMAL(20, 8),
    current_price DECIMAL(20, 8),
    total_value DECIMAL(20, 8),
    profit_loss DECIMAL(20, 8),
    profit_loss_percentage DECIMAL(10, 4),
    asset_type VARCHAR(50), -- crypto, stock, forex, commodity
    exchange VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- TRADING
-- ============================================================================

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL, -- buy, sell
    type VARCHAR(50) NOT NULL, -- market, limit, stop_loss, take_profit
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, filled, partial, cancelled, rejected
    amount DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    filled_amount DECIMAL(20, 8) DEFAULT 0,
    avg_filled_price DECIMAL(20, 8),
    total_cost DECIMAL(20, 8),
    fee DECIMAL(20, 8) DEFAULT 0,
    fee_currency VARCHAR(10),
    exchange VARCHAR(100) NOT NULL,
    order_id VARCHAR(255),
    strategy_id UUID,
    ai_agent_id UUID,
    executed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE trade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    filled_amount DECIMAL(20, 8),
    price DECIMAL(20, 8),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AI AGENTS & TRAINING
-- ============================================================================

CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_key VARCHAR(50), -- Unique identifier for agent type (technical, risk, sentiment, etc.)
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- technical_analysis, risk_management, sentiment, pattern, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'idle', -- idle, active, training, error
    performance_score DECIMAL(5, 2) DEFAULT 0,
    total_decisions INTEGER DEFAULT 0,
    successful_decisions INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 2) DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE,
    config JSONB DEFAULT '{}'::jsonb,
    model_version VARCHAR(50),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT ai_agents_agent_key_unique UNIQUE (agent_key)
);

CREATE TABLE ai_training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
    session_name VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL, -- supervised, reinforcement, transfer, custom
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    dataset_size INTEGER DEFAULT 0,
    epochs INTEGER DEFAULT 0,
    current_epoch INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 2) DEFAULT 0,
    loss DECIMAL(10, 6),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    config JSONB DEFAULT '{}'::jsonb,
    results JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE ai_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    decision_type VARCHAR(100) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    confidence DECIMAL(5, 2),
    was_successful BOOLEAN,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- ARTEMIS SYSTEM
-- ============================================================================

CREATE TABLE artemis_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    mode VARCHAR(50) DEFAULT 'demo', -- demo, real
    strategy VARCHAR(100) DEFAULT 'mixture_of_experts',
    active_learning BOOLEAN DEFAULT TRUE,
    total_decisions INTEGER DEFAULT 0,
    successful_decisions INTEGER DEFAULT 0,
    overall_accuracy DECIMAL(5, 2) DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE trading_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy_type VARCHAR(100) NOT NULL,
    risk_level VARCHAR(50) NOT NULL, -- low, medium, high
    target_profit DECIMAL(10, 2),
    stop_loss DECIMAL(10, 2),
    time_frame VARCHAR(50),
    symbols TEXT[], -- array of trading symbols
    conditions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT FALSE,
    is_backtested BOOLEAN DEFAULT FALSE,
    backtest_results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA HUB & SOURCES
-- ============================================================================

CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- api, webhook, rss, telegram, web_crawler
    url TEXT,
    category VARCHAR(100),
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
    health_status VARCHAR(50) DEFAULT 'healthy',
    last_fetch_at TIMESTAMP WITH TIME ZONE,
    fetch_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    credentials JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE data_hub_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    data_size INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- NOTIFICATIONS & ALERTS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- trade, alert, system, ai
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'normal', -- low, normal, high, urgent
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    condition_type VARCHAR(100) NOT NULL, -- price_above, price_below, volume_spike, etc.
    condition_value DECIMAL(20, 8) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- FAVORITES & WATCHLISTS
-- ============================================================================
-- Canonical favorites model (aligned with 004_create_favorites_tables.sql /
-- Production): SERIAL id + asset_id. Stale UUID-only favorites representation
-- is NOT authoritative.

CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    UNIQUE (user_id, asset_id)
);

CREATE TABLE favorite_alerts (
    id SERIAL PRIMARY KEY,
    favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
    target_price DECIMAL(20, 8) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP,
    triggered_price DECIMAL(20, 8),
    notify_telegram BOOLEAN DEFAULT true,
    notify_browser BOOLEAN DEFAULT true,
    notify_email BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_target_price CHECK (target_price > 0)
);

CREATE TABLE watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(watchlist_id, symbol)
);

-- ============================================================================
-- SETTINGS & CONFIGURATION
-- ============================================================================

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(50) DEFAULT 'dark',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(100) DEFAULT 'UTC',
    currency VARCHAR(10) DEFAULT 'USD',
    notifications JSONB DEFAULT '{}'::jsonb,
    trading_preferences JSONB DEFAULT '{}'::jsonb,
    api_keys JSONB DEFAULT '{}'::jsonb, -- encrypted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- EXCHANGE CONNECTIONS
-- ============================================================================

CREATE TABLE exchange_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exchange VARCHAR(100) NOT NULL,
    api_key TEXT NOT NULL, -- encrypted
    api_secret TEXT NOT NULL, -- encrypted
    api_passphrase TEXT, -- encrypted (for some exchanges)
    is_active BOOLEAN DEFAULT TRUE,
    is_testnet BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, exchange)
);

-- ============================================================================
-- WALLET CONNECTIONS (DeFi)
-- ============================================================================

CREATE TABLE wallet_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    chain VARCHAR(50) NOT NULL, -- ethereum, bsc, polygon, etc.
    wallet_type VARCHAR(50), -- metamask, walletconnect, etc.
    is_active BOOLEAN DEFAULT TRUE,
    last_balance_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, address, chain)
);

CREATE TABLE defi_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallet_connections(id) ON DELETE CASCADE,
    protocol VARCHAR(100) NOT NULL,
    position_type VARCHAR(50) NOT NULL, -- staking, lending, liquidity_pool, etc.
    token_symbol VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    value_usd DECIMAL(20, 2),
    apy DECIMAL(10, 2),
    rewards_earned DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- LOGS & AUDIT
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(50) NOT NULL, -- info, warning, error, critical
    category VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Sessions
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- Portfolios & Assets
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_assets_portfolio_id ON assets(portfolio_id);
CREATE INDEX idx_assets_symbol ON assets(symbol);

-- Trades
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_portfolio_id ON trades(portfolio_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_exchange ON trades(exchange);

-- AI Agents
CREATE INDEX idx_ai_agents_type ON ai_agents(type);
CREATE INDEX idx_ai_agents_status ON ai_agents(status);
CREATE INDEX idx_ai_training_sessions_agent_id ON ai_training_sessions(agent_id);
CREATE INDEX idx_ai_training_sessions_status ON ai_training_sessions(status);
CREATE INDEX idx_ai_decisions_agent_id ON ai_decisions(agent_id);
CREATE INDEX idx_ai_decisions_user_id ON ai_decisions(user_id);
CREATE INDEX idx_ai_decisions_created_at ON ai_decisions(created_at DESC);

-- Trading Scenarios
CREATE INDEX idx_scenarios_user_id ON trading_scenarios(user_id);
CREATE INDEX idx_scenarios_is_active ON trading_scenarios(is_active);

-- Data Sources
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_status ON data_sources(status);
CREATE INDEX idx_data_hub_logs_source_id ON data_hub_logs(source_id);
CREATE INDEX idx_data_hub_logs_created_at ON data_hub_logs(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Alerts
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_symbol ON alerts(symbol);
CREATE INDEX idx_alerts_is_active ON alerts(is_active);

-- Favorites & Watchlists (aligned with 004 + Production)
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_asset_id ON favorites(asset_id);
CREATE INDEX idx_favorites_user_asset ON favorites(user_id, asset_id);
CREATE INDEX idx_favorites_symbol ON favorites(symbol);
CREATE INDEX idx_alerts_favorite_id ON favorite_alerts(favorite_id);
CREATE INDEX idx_alerts_active ON favorite_alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_favorite_alerts_user_id ON favorite_alerts(user_id);
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

-- Exchange & Wallet
CREATE INDEX idx_exchange_connections_user_id ON exchange_connections(user_id);
CREATE INDEX idx_wallet_connections_user_id ON wallet_connections(user_id);
CREATE INDEX idx_defi_positions_user_id ON defi_positions(user_id);
CREATE INDEX idx_defi_positions_wallet_id ON defi_positions(wallet_id);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_training_sessions_updated_at BEFORE UPDATE ON ai_training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_artemis_state_updated_at BEFORE UPDATE ON artemis_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trading_scenarios_updated_at BEFORE UPDATE ON trading_scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON watchlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exchange_connections_updated_at BEFORE UPDATE ON exchange_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallet_connections_updated_at BEFORE UPDATE ON wallet_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_defi_positions_updated_at BEFORE UPDATE ON defi_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TELEGRAM PIPELINE CORE TABLES
-- ============================================================================
-- Canonical CREATE provenance historically lived OUTSIDE the runner-discovered
-- path `backend/database/migrations/`:
--   - backend/migrations/20251227_create_ai_missing_tables.sql
--       (telegram_channels, telegram_messages)
--   - database/migrations/telegram_data_pipeline_schema.sql
--       (processed_telegram_messages)
--   - database/migrations/telegram_enhanced_pipeline_v2.sql
--       (telegram_agent_impacts, telegram_news_events)
-- Numbered migrations 035/037/040/044/045/047/052 are INDEX-ONLY and require
-- these tables. Included here so schema.sql bootstrap + migrate:up can execute
-- those index migrations without inventing a new migration identity during R4.
-- Later runner migration 20260216_add_priority_error_tracking.sql adds
-- priority/error columns to telegram_channels (after 055 by numeric order).
-- Production-only account_id (orphan 20260213_add_telegram_accounts.sql) is
-- NOT bootstrapped here — not required by 035–055 and remains OUT_OF_SCOPE.

CREATE TABLE telegram_channels (
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

CREATE INDEX idx_telegram_channels_active ON telegram_channels(is_active, quality_score DESC);

CREATE TABLE telegram_messages (
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

CREATE INDEX idx_telegram_messages_channel ON telegram_messages(channel_id, telegram_created_at DESC);
CREATE INDEX idx_telegram_messages_processed ON telegram_messages(is_processed);
CREATE UNIQUE INDEX idx_telegram_messages_unique ON telegram_messages(message_id, channel_id);

CREATE TABLE processed_telegram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_message_id UUID NOT NULL REFERENCES telegram_messages(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES telegram_channels(id),
    language VARCHAR(10),
    cleaned_text TEXT,
    keywords TEXT[],
    hashtags TEXT[],
    urls TEXT[],
    mentioned_assets TEXT[],
    mentioned_currencies TEXT[],
    extracted_prices JSONB,
    extracted_dates TIMESTAMP[],
    extracted_numbers DECIMAL[],
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    emotion_tags TEXT[],
    news_type VARCHAR(50),
    news_category VARCHAR(50),
    importance_level VARCHAR(20),
    is_actionable BOOLEAN DEFAULT false,
    signal_type VARCHAR(30),
    signal_strength DECIMAL(3,2),
    target_assets TEXT[],
    risk_level VARCHAR(20),
    readability_score DECIMAL(3,2),
    spam_probability DECIMAL(3,2),
    is_duplicate BOOLEAN DEFAULT false,
    quality_flags TEXT[],
    processing_status VARCHAR(30) DEFAULT 'pending',
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Enhanced categorization columns (telegram_enhanced_pipeline_v2)
    event_category VARCHAR(50),
    event_sub_category VARCHAR(50),
    geopolitical_relevance BOOLEAN DEFAULT false,
    market_impact_level VARCHAR(20),
    affected_agents TEXT[],
    agent_impact_summary JSONB
);

CREATE INDEX idx_processed_messages_channel ON processed_telegram_messages(channel_id);
CREATE INDEX idx_processed_messages_status ON processed_telegram_messages(processing_status);
CREATE INDEX idx_processed_messages_created ON processed_telegram_messages(created_at DESC);

CREATE TABLE telegram_agent_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_message_id UUID NOT NULL REFERENCES processed_telegram_messages(id) ON DELETE CASCADE,
    agent_key VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100),
    impact_score DECIMAL(3,2) NOT NULL,
    impact_type VARCHAR(30),
    confidence DECIMAL(3,2),
    relevance_reasons TEXT[],
    extracted_signals JSONB,
    priority_level VARCHAR(20),
    requires_action BOOLEAN DEFAULT false,
    action_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_by_agent_at TIMESTAMP,
    CONSTRAINT unique_message_agent UNIQUE(processed_message_id, agent_key)
);

CREATE INDEX idx_agent_impacts_agent_key ON telegram_agent_impacts(agent_key);
CREATE INDEX idx_agent_impacts_created ON telegram_agent_impacts(created_at DESC);

CREATE TABLE telegram_news_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_message_id UUID NOT NULL REFERENCES processed_telegram_messages(id) ON DELETE CASCADE,
    primary_category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    event_type VARCHAR(50),
    countries TEXT[],
    regions TEXT[],
    cities TEXT[],
    people_mentioned TEXT[],
    organizations TEXT[],
    events_referenced TEXT[],
    affected_markets TEXT[],
    affected_assets TEXT[],
    market_impact_level VARCHAR(20),
    is_breaking BOOLEAN DEFAULT false,
    is_developing BOOLEAN DEFAULT false,
    event_urgency VARCHAR(20),
    source_reliability DECIMAL(3,2),
    is_verified BOOLEAN DEFAULT false,
    verification_sources TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_news_events_primary_cat ON telegram_news_events(primary_category);
CREATE INDEX idx_news_events_created ON telegram_news_events(created_at DESC);

-- ============================================================================
-- MONITORING LOG TABLES
-- ============================================================================
-- Canonical DDL provenance: backend/setup_monitoring_tables.mjs
-- (operational IF NOT EXISTS setup). These tables are NOT created by
-- numbered migrations 001–055. Included here so schema.sql bootstrap
-- + migrate:up can reproduce monitoring surfaces without inventing a
-- new migration identity during R4.

CREATE TABLE request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_request_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX idx_request_logs_status ON request_logs(status);
CREATE INDEX idx_request_logs_path ON request_logs(path);

CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert Artemis initial state
INSERT INTO artemis_state (status, mode, strategy, active_learning) 
VALUES ('active', 'demo', 'mixture_of_experts', TRUE);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('maintenance_mode', '"false"'::jsonb, 'System maintenance mode'),
('max_trades_per_day', '100'::jsonb, 'Maximum trades per user per day'),
('default_trading_fee', '0.001'::jsonb, 'Default trading fee percentage');

-- Comment current database only (do not hardcode titangold_db — that would
-- mutate Production catalog when applied from a disposable DB session).
DO $$
BEGIN
  EXECUTE format(
    'COMMENT ON DATABASE %I IS %L',
    current_database(),
    'TitanGold Professional Trading Autopilot Database'
  );
END $$;
