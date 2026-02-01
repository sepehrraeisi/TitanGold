-- Trading Engine Tables for 24/7 Automated Trading

-- Trading Engine Configuration
CREATE TABLE IF NOT EXISTS trading_engine_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Trades Table (Enhanced)
CREATE TABLE IF NOT EXISTS trades (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type VARCHAR(50) NOT NULL, -- 'arbitrage', 'price_movement', 'volume_spike', 'pattern', etc.
    entry_price DECIMAL(20, 8) NOT NULL,
    exit_price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'closed', 'failed', 'cancelled')),
    order_id VARCHAR(255),
    exit_order_id VARCHAR(255),
    exit_reason VARCHAR(100),
    profit DECIMAL(20, 8) DEFAULT 0,
    profit_percent DECIMAL(10, 4) DEFAULT 0,
    opportunity_data JSONB,
    agent_signals JSONB, -- Signals from AI agents
    artemis_decision JSONB, -- Decision from Artemis
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading Opportunities Queue (for tracking)
CREATE TABLE IF NOT EXISTS trading_opportunities (
    id VARCHAR(255) PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    confidence DECIMAL(5, 2) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    opportunity_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'executed', 'rejected', 'expired')),
    trade_id VARCHAR(255) REFERENCES trades(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Trading Statistics
CREATE TABLE IF NOT EXISTS trading_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_opportunities INTEGER DEFAULT 0,
    executed_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    failed_trades INTEGER DEFAULT 0,
    total_profit DECIMAL(20, 8) DEFAULT 0,
    daily_profit DECIMAL(20, 8) DEFAULT 0,
    daily_loss DECIMAL(20, 8) DEFAULT 0,
    max_drawdown DECIMAL(10, 4) DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    avg_profit_per_trade DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON trading_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON trading_opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON trading_opportunities(created_at);

-- Insert default trading engine configuration
INSERT INTO trading_engine_config (id, config) 
VALUES (1, '{
    "enabled": true,
    "mode": "demo",
    "maxPositions": 20,
    "riskLimits": {
        "maxPositionSize": 0.1,
        "maxDailyLoss": 0.05,
        "maxDrawdown": 0.15,
        "minConfidence": 75
    },
    "scanners": {
        "arbitrage": {
            "enabled": true,
            "interval": 2000,
            "minProfitPercent": 0.5
        },
        "priceMovement": {
            "enabled": true,
            "interval": 5000,
            "minChangePercent": 2
        },
        "volumeSpike": {
            "enabled": true,
            "interval": 10000,
            "minVolumeMultiplier": 2
        },
        "pattern": {
            "enabled": true,
            "interval": 30000
        }
    },
    "exchanges": {
        "mexc": {
            "enabled": true,
            "testnet": true
        }
    }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

