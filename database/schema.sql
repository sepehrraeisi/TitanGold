-- TitanGold Professional Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    type VARCHAR(50), -- crypto, stock, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, symbol)
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

-- Favorites & Watchlists
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_symbol ON favorites(symbol);
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

COMMENT ON DATABASE titangold_db IS 'TitanGold Professional Trading Autopilot Database';
