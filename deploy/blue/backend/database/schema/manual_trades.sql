-- Manual Trades Table
CREATE TABLE IF NOT EXISTS manual_trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    asset VARCHAR(20) NOT NULL,
    pair VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    pnl DECIMAL(20, 8) DEFAULT 0,
    pnl_percent DECIMAL(10, 4) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled', 'failed')),
    stop_loss_percent DECIMAL(5, 2),
    take_profit_percent DECIMAL(5, 2),
    order_id VARCHAR(100),
    confidence DECIMAL(5, 2),
    executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_trades_user_id ON manual_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_trades_executed_at ON manual_trades(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_trades_status ON manual_trades(status);
CREATE INDEX IF NOT EXISTS idx_manual_trades_pair ON manual_trades(pair);

-- Manual Trading Strategies Table
CREATE TABLE IF NOT EXISTS manual_trading_strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    performance DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name_key)
);

-- Index for strategies
CREATE INDEX IF NOT EXISTS idx_manual_trading_strategies_user_id ON manual_trading_strategies(user_id);

-- User Balances Table (for demo mode)
CREATE TABLE IF NOT EXISTS user_balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    USDT DECIMAL(20, 8) DEFAULT 0,
    BTC DECIMAL(20, 8) DEFAULT 0,
    ETH DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for balances
CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances(user_id);

