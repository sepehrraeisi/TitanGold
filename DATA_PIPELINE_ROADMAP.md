# 📊 Data Pipeline Roadmap - TitanGold Trading System

## 🎯 Current Status (2026-02-16)

### ✅ Phase 1: Telegram Collector - **COMPLETED** ✅
**Status:** 🟢 **FULLY OPERATIONAL**

#### Achievements:
- ✅ **Priority-based polling system:**
  - HIGH: 1 minute interval (trading-critical channels)
  - NORMAL: 3 minutes interval (standard news)
  - LOW: 5 minutes interval (less important)

- ✅ **Data Collection:**
  - **939 messages** successfully collected
  - **10 channels** actively polling
  - **100% success rate** (10/10 channels successful, 0 failures)
  - **Date range:** 2026-01-25 to 2026-02-16 (real-time data)
  - **Polling cycle:** ~0.9 seconds

- ✅ **Technical Fixes:**
  - Unix timestamp → PostgreSQL TIMESTAMP conversion
  - Session management (account: +989384556010)
  - Error handling for date/time fields
  - Batch processing (50 messages per channel)

#### Database Tables:
```sql
-- Active tables
telegram_channels    -- 43 channels, 10 active
telegram_messages    -- 939 messages stored
telegram_accounts    -- 2 accounts (1 active, 1 disabled)
telegram_sessions    -- Session management
```

#### API Endpoints:
```
✅ GET  /api/telegram-collector/health
✅ GET  /api/telegram-collector/collector-channels
✅ PATCH /api/telegram-collector/collector-channels/:id
✅ POST /api/telegram-collector/channels/:id/force-sync
```

---

## 🚀 Phase 2: Data Pipeline - **NEXT STAGE**

### 🎯 Objective
Transform raw Telegram messages into structured, actionable trading intelligence:
- **Extract:** Price data, entities, keywords
- **Transform:** Clean text, detect language, analyze sentiment
- **Load:** Store in analytical tables for AI agents

### 📋 Current Pipeline UI
**Location:** https://titan.zala.ir/?view=ai → AI Center → Data Hub → Pipeline

**Features:**
- ✅ Data Preparation & Screening
- ✅ Snapshot History
- ✅ Filter by categories and sources
- ✅ View last 6 normalized records
- ⚠️ **Currently NOT processing telegram_messages**

### 🛠️ Required Implementations

#### 1. **Message Processing Service** 🔄
**Priority:** 🔴 HIGH

**Functionality:**
```typescript
// Process telegram_messages → processed_news
interface TelegramMessageProcessor {
  // Extract meaningful data
  extractPrices(text: string): Price[];
  extractEntities(text: string): Entity[];
  extractKeywords(text: string): string[];
  
  // Sentiment analysis
  analyzeSentiment(text: string): SentimentScore;
  
  // Classification
  classifyNewsType(text: string): NewsType;
  detectImportance(text: string): ImportanceLevel;
  
  // Language detection
  detectLanguage(text: string): 'fa' | 'en' | 'ar';
}
```

**Database Schema:**
```sql
-- New table: processed_telegram_messages
CREATE TABLE processed_telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_message_id UUID NOT NULL REFERENCES telegram_messages(id),
  
  -- Extracted data
  prices JSONB,                    -- [{currency: 'USD', buy: 160100, sell: 159900, unit: 'IRR'}]
  entities JSONB,                  -- [{type: 'CURRENCY', value: 'دلار'}, {type: 'DATE', value: '2026-02-16'}]
  keywords TEXT[],                 -- ['دلار', 'طلا', 'سکه', 'قیمت']
  
  -- Analysis results
  sentiment_score DECIMAL(3,2),   -- -1.0 to 1.0
  sentiment_type VARCHAR(20),     -- 'positive', 'negative', 'neutral'
  sentiment_intensity DECIMAL(3,2), -- 0.0 to 1.0
  
  -- Classification
  news_type VARCHAR(50),          -- 'price_update', 'market_news', 'analysis', 'forecast'
  importance_level VARCHAR(20),   -- 'critical', 'high', 'medium', 'low'
  language VARCHAR(5),            -- 'fa', 'en', 'ar'
  
  -- Text processing
  cleaned_text TEXT,              -- Emoji-free, normalized text
  text_length INT,
  word_count INT,
  
  -- Metadata
  processing_status VARCHAR(20) DEFAULT 'pending',
  processing_error TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_telegram_message UNIQUE(telegram_message_id)
);

-- Indexes for performance
CREATE INDEX idx_processed_messages_sentiment ON processed_telegram_messages(sentiment_type, sentiment_score DESC);
CREATE INDEX idx_processed_messages_importance ON processed_telegram_messages(importance_level);
CREATE INDEX idx_processed_messages_news_type ON processed_telegram_messages(news_type);
CREATE INDEX idx_processed_messages_processed_at ON processed_telegram_messages(processed_at DESC);
CREATE INDEX idx_processed_messages_status ON processed_telegram_messages(processing_status);
```

#### 2. **Price Extraction Service** 💰
**Priority:** 🔴 HIGH

**Functionality:**
```typescript
interface PriceExtractor {
  // Detect currency mentions
  detectCurrencies(text: string): Currency[];
  
  // Extract price patterns
  extractPrices(text: string): {
    currency: string;
    buy: number;
    sell: number;
    unit: string;
    timestamp: Date;
  }[];
  
  // Pattern matching
  patterns: {
    farsiNumbers: /[۰-۹]+/g,
    currencies: /دلار|یورو|درهم|پوند|لیر/g,
    prices: /(?:خرید|فروش)[:\s]*([۰-۹,]+)/g
  }
}
```

**Database Schema:**
```sql
CREATE TABLE price_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_message_id UUID REFERENCES processed_telegram_messages(id),
  
  currency VARCHAR(10),           -- 'USD', 'EUR', 'AED', 'GBP'
  currency_fa VARCHAR(50),        -- 'دلار', 'یورو', 'درهم'
  
  buy_price DECIMAL(15,2),
  sell_price DECIMAL(15,2),
  mid_price DECIMAL(15,2),        -- (buy + sell) / 2
  spread DECIMAL(15,2),           -- sell - buy
  
  price_unit VARCHAR(10),         -- 'IRR', 'IQD'
  
  price_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_price_movements_currency ON price_movements(currency, price_timestamp DESC);
CREATE INDEX idx_price_movements_timestamp ON price_movements(price_timestamp DESC);
```

#### 3. **Sentiment Analysis Service** 😊😐😢
**Priority:** 🟡 MEDIUM

**Functionality:**
```typescript
interface SentimentAnalyzer {
  // Analyze message sentiment
  analyze(text: string): {
    score: number;        // -1.0 (very negative) to 1.0 (very positive)
    type: 'positive' | 'negative' | 'neutral';
    intensity: number;    // 0.0 (weak) to 1.0 (strong)
    confidence: number;   // 0.0 to 1.0
  };
  
  // Keyword-based sentiment
  positiveKeywords: string[];  // ['رشد', 'افزایش', 'بهبود', 'مثبت']
  negativeKeywords: string[];  // ['کاهش', 'افت', 'ریزش', 'منفی']
}
```

**Database Schema:**
```sql
CREATE TABLE sentiment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_message_id UUID REFERENCES processed_telegram_messages(id),
  
  sentiment_score DECIMAL(3,2),
  sentiment_type VARCHAR(20),
  intensity DECIMAL(3,2),
  confidence DECIMAL(3,2),
  
  detected_keywords JSONB,        -- {positive: [...], negative: [...]}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sentiment_type ON sentiment_scores(sentiment_type, sentiment_score DESC);
```

#### 4. **Trading Signal Generator** 📈
**Priority:** 🟡 MEDIUM

**Functionality:**
```typescript
interface SignalGenerator {
  // Generate trading signals
  generateSignals(processedMessages: ProcessedMessage[]): TradingSignal[];
  
  // Signal types
  signals: {
    PRICE_SPIKE: 'sudden price increase',
    PRICE_DROP: 'sudden price decrease',
    HIGH_VOLATILITY: 'unusual price movement',
    SENTIMENT_SHIFT: 'sentiment change detected',
    NEWS_ALERT: 'important news detected'
  }
}
```

**Database Schema:**
```sql
CREATE TABLE trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id UUID REFERENCES processed_telegram_messages(id),
  
  signal_type VARCHAR(50),        -- 'PRICE_SPIKE', 'PRICE_DROP', 'SENTIMENT_SHIFT'
  signal_strength DECIMAL(3,2),   -- 0.0 to 1.0
  confidence DECIMAL(3,2),        -- 0.0 to 1.0
  
  currency VARCHAR(10),
  price_change DECIMAL(10,2),     -- Absolute change
  price_change_pct DECIMAL(5,2),  -- Percentage change
  
  recommendation VARCHAR(20),     -- 'BUY', 'SELL', 'HOLD', 'WAIT'
  risk_level VARCHAR(20),         -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  
  metadata JSONB,                 -- Additional signal data
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signals_type ON trading_signals(signal_type, created_at DESC);
CREATE INDEX idx_signals_currency ON trading_signals(currency, created_at DESC);
CREATE INDEX idx_signals_recommendation ON trading_signals(recommendation);
```

---

## 🎯 Implementation Strategy

### Option 1: Enhance Existing Pipeline ✅ (Recommended)
**Advantages:**
- ✅ UI already exists
- ✅ Infrastructure ready
- ✅ Minimal changes required

**Steps:**
1. Add Telegram message processor to existing pipeline
2. Update PipelinePanel.tsx to show telegram_messages stats
3. Create processing service that runs every minute
4. Add new tables (processed_telegram_messages, price_movements, etc.)

### Option 2: Create New Telegram Processor ⚠️
**Advantages:**
- 🔸 Independent service
- 🔸 Specialized for Telegram data

**Disadvantages:**
- ❌ Duplicate code
- ❌ More complexity
- ❌ Extra maintenance

---

## 📊 Integration with AI Agents

### Current AI Agents:
```typescript
// Available in titan-engine/src/agents/
- TrendAgent         // Market trend analysis
- RiskAgent          // Risk assessment
- PositionAgent      // Position management
- PricePredictionAgent  // Price forecasting
```

### Data Flow:
```
telegram_messages 
  → processed_telegram_messages (sentiment, entities, keywords)
  → price_movements (extracted prices)
  → sentiment_scores (sentiment analysis)
  → trading_signals (actionable signals)
  → AI Agents (TrendAgent, PricePredictionAgent, etc.)
  → Trading Decisions
```

---

## 🔄 Automation & Scheduling

### Recommended Schedule:
```javascript
// Processing intervals
{
  "messageProcessor": "every 1 minute",    // Process new telegram_messages
  "priceExtractor": "every 1 minute",     // Extract prices from processed messages
  "sentimentAnalyzer": "every 3 minutes", // Analyze sentiment
  "signalGenerator": "every 5 minutes",   // Generate trading signals
  "pipelineSnapshot": "every 15 minutes"  // Update pipeline UI
}
```

### PM2 Configuration:
```javascript
// ecosystem.config.js
{
  name: 'telegram-message-processor',
  script: './telegram-collector/dist/services/messageProcessor.js',
  instances: 1,
  exec_mode: 'fork',
  cron_restart: '*/1 * * * *',  // Every minute
  env: {
    NODE_ENV: 'production',
    DB_HOST: 'localhost',
    DB_PORT: '5433',
    DB_NAME: 'titangold_db'
  }
}
```

---

## 🎯 Success Metrics

### Phase 2 Goals:
- [ ] **Processing Rate:** 100% of telegram_messages processed within 2 minutes
- [ ] **Price Extraction:** 95%+ accuracy for price detection
- [ ] **Sentiment Analysis:** 85%+ accuracy for Farsi text
- [ ] **Signal Generation:** 10+ trading signals per hour
- [ ] **Latency:** < 30 seconds from message → signal

### KPIs:
```typescript
interface PipelineKPIs {
  messagesProcessed: number;      // Total processed
  processingRate: number;         // Messages per minute
  priceExtractionRate: number;    // Successful extractions / total
  sentimentAccuracy: number;      // Correct classifications / total
  signalsGenerated: number;       // Trading signals created
  avgProcessingTime: number;      // Milliseconds
  errorRate: number;              // Failed / total
}
```

---

## 📚 Related Documentation

- ✅ [TELEGRAM_DEPLOYMENT_COMPLETE.md](./TELEGRAM_DEPLOYMENT_COMPLETE.md) - Phase 1 completion
- ✅ [TELEGRAM_MONITORING_PHASE1.md](./TELEGRAM_MONITORING_PHASE1.md) - Monitoring system
- ✅ [TELEGRAM_LOGIN_GUIDE.md](./TELEGRAM_LOGIN_GUIDE.md) - Authentication guide
- ✅ [TELEGRAM_ADD_NEW_CHANNELS.md](./TELEGRAM_ADD_NEW_CHANNELS.md) - Channel management

---

## 🚀 Next Steps

### Immediate Actions (This Week):
1. **Create Message Processor Service**
   ```bash
   cd telegram-collector/src/services
   touch messageProcessor.ts
   # Implement processor logic
   ```

2. **Create Database Tables**
   ```bash
   psql -U postgres -d titangold_db -h localhost -p 5433
   # Run CREATE TABLE scripts
   ```

3. **Update Pipeline UI**
   ```bash
   # Edit: components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx
   # Add: Telegram messages processing stats
   ```

4. **Setup PM2 Automation**
   ```bash
   pm2 start ecosystem.config.js --only telegram-message-processor
   ```

5. **Test End-to-End**
   ```bash
   # Verify: Telegram → Processing → Trading Signals
   npm run test:e2e
   ```

---

## 🎊 Conclusion

**Telegram Collector is READY** ✅  
**939 messages** waiting for processing  
**Data Pipeline is the NEXT STAGE** 🚀

Transform raw Telegram data into actionable trading intelligence!

---

**Last Updated:** 2026-02-16  
**Status:** Phase 1 Complete ✅ | Phase 2 Ready to Start 🚀  
**Git Commit:** `4862ab5` - Unix timestamp fix deployed
