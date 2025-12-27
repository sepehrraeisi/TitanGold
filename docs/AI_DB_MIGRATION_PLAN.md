# AI DB Migration Plan

**Status**: 9/9 Tables Complete ✅  
**Date**: 2025-12-27

---

## Completed Tables (9/9) ✅

### 1. ai_providers (16 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE ai_providers (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
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
CREATE INDEX idx_ai_providers_enabled ON ai_providers(is_enabled, priority);
```

**UI Features**: SettingsTab → AI Providers management  
**Seed Data**: 5 providers (OpenRouter, OpenAI, Gemini, DeepSeek, Claude)

---

### 2. ai_jobs (32 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY,
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
CREATE INDEX idx_ai_jobs_user_status ON ai_jobs(user_id, status, created_at DESC);
CREATE INDEX idx_ai_jobs_type_status ON ai_jobs(job_type, status);
```

**UI Features**: 
- POST /api/ai-agents/chat
- POST /api/scenarios/generate
- POST /api/training/sessions

---

### 3. engine_runs (24 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE engine_runs (
    id UUID PRIMARY KEY,
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
CREATE INDEX idx_engine_runs_user_type ON engine_runs(user_id, run_type, started_at DESC);
```

**UI Features**: 
- GET /api/trading-engine/runs
- GET /api/trading-engine/stats
- MonitoringTab performance metrics

---

### 4. market_snapshots (32 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE market_snapshots (
    id UUID PRIMARY KEY,
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
CREATE INDEX idx_market_snapshots_symbol_time ON market_snapshots(exchange, symbol, timeframe, timestamp DESC);
CREATE INDEX idx_market_snapshots_timestamp ON market_snapshots(timestamp DESC);
```

**UI Features**: 
- DataHubTab → Market Data display
- Backtest/Scenario data source
- Technical indicator caching

---

### 5. signals (40 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE signals (
    id UUID PRIMARY KEY,
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
CREATE INDEX idx_signals_symbol_type ON signals(symbol, signal_type, created_at DESC);
CREATE INDEX idx_signals_processed ON signals(is_processed, created_at);
CREATE INDEX idx_signals_source ON signals(source, created_at DESC);
```

**UI Features**: 
- GET /api/signals (pending)
- DataHubTab signals display
- Artemis decision input

---

### 6. scenario_runs (32 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE scenario_runs (
    id UUID PRIMARY KEY,
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
CREATE INDEX idx_scenario_runs_scenario ON scenario_runs(scenario_id, started_at DESC);
CREATE INDEX idx_scenario_runs_user_status ON scenario_runs(user_id, status);
```

**UI Features**: 
- POST /api/scenarios/:id/backtest
- ScenariosTab results display

---

### 7. telegram_channels (64 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE telegram_channels (
    id UUID PRIMARY KEY,
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
```

**UI Features**: 
- GET /api/telegram/channels (pending)
- DataHubTab → Telegram sources

**Seed Data**: 1 test channel

---

### 8. telegram_messages (40 KB) ✅
**Migration**: `migrations/20251227_create_ai_missing_tables.sql`  
**Commit**: 21242d0

```sql
CREATE TABLE telegram_messages (
    id UUID PRIMARY KEY,
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
```

**UI Features**: 
- GET /api/telegram/messages (pending)
- POST /api/telegram/messages/analyze (pending)
- DataHubTab → Message feed

---

### 9. backtest_results (NEW) ✅
**Migration**: `migrations/20251227_create_backtest_results.sql`  
**Commit**: f10dbd7

```sql
CREATE TABLE backtest_results (
    id UUID PRIMARY KEY,
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
CREATE INDEX idx_backtest_results_user ON backtest_results(user_id, created_at DESC);
CREATE INDEX idx_backtest_results_scenario ON backtest_results(scenario_id);
CREATE INDEX idx_backtest_results_status ON backtest_results(status, created_at DESC);
CREATE INDEX idx_backtest_results_symbol ON backtest_results(symbol, timeframe);
CREATE INDEX idx_backtest_results_roi ON backtest_results(roi_percentage DESC) WHERE roi_percentage IS NOT NULL;
```

**UI Features**: 
- GET /api/backtest/results
- GET /api/backtest/results/:id
- BacktestingTab results display

---

## Migration Summary

### Executed Migrations
1. ✅ `20251227_create_ai_missing_tables.sql` (Commit: 21242d0)
   - 8 tables: ai_providers, ai_jobs, engine_runs, market_snapshots, signals, scenario_runs, telegram_channels, telegram_messages
   - Seed data: 5 AI providers, 1 test Telegram channel

2. ✅ `20251227_add_balance_usd_column.sql` (Commit: f10dbd7)
   - Added balance_usd to portfolios table
   - Fixed portfolio calculation errors

3. ✅ `20251227_create_backtest_results.sql` (Commit: pending)
   - backtest_results table for test execution results

### Total Database Size
- AI Module Tables: ~280 KB
- Total Tables: 39 (30 existing + 9 new)

---

## Verification

```bash
# Check all AI tables exist
psql -h localhost -p 5433 -U postgres -d titangold_db -c "
SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('ai_providers', 'ai_jobs', 'engine_runs', 'market_snapshots', 
                     'signals', 'scenario_runs', 'telegram_channels', 'telegram_messages',
                     'backtest_results')
ORDER BY tablename;"
```

**Expected Output**: 9 rows showing all tables with sizes

---

## Next Steps

All tables created and ready. No additional DB migrations needed for current endpoint backlog.
