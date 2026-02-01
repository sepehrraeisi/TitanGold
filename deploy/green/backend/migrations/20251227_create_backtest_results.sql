-- ===========================================================================
-- TitanGold - Backtest Results Table
-- Date: 2025-12-27
-- Purpose: Store backtest execution results
-- ===========================================================================

CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES trading_scenarios(id) ON DELETE SET NULL,
    strategy_name VARCHAR(200),
    symbol VARCHAR(50),
    exchange VARCHAR(50),
    timeframe VARCHAR(20),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    initial_capital DECIMAL(20, 8) NOT NULL,
    final_capital DECIMAL(20, 8),
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2),
    total_profit DECIMAL(20, 8) DEFAULT 0,
    total_loss DECIMAL(20, 8) DEFAULT 0,
    net_profit DECIMAL(20, 8),
    roi_percentage DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    profit_factor DECIMAL(10, 4),
    average_win DECIMAL(20, 8),
    average_loss DECIMAL(20, 8),
    largest_win DECIMAL(20, 8),
    largest_loss DECIMAL(20, 8),
    trades_data JSONB,
    equity_curve JSONB,
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backtest_results_user ON backtest_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_results_scenario ON backtest_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_status ON backtest_results(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_results_symbol ON backtest_results(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_backtest_results_roi ON backtest_results(roi_percentage DESC) WHERE roi_percentage IS NOT NULL;

COMMENT ON TABLE backtest_results IS 'Backtest execution results and performance metrics';
COMMENT ON COLUMN backtest_results.trades_data IS 'Array of trade objects with entry/exit details';
COMMENT ON COLUMN backtest_results.equity_curve IS 'Time series of portfolio value over backtest period';
