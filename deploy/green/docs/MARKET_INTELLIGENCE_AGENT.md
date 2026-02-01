# Market Intelligence Agent

**BACKEND-012: Implement Market Intelligence Agent**

## Overview

The Market Intelligence Agent aggregates comprehensive market data from multiple sources to provide actionable intelligence for cryptocurrency trading decisions. It combines news sentiment, on-chain metrics, and macroeconomic indicators to generate holistic market analysis.

## Features

### 1. News Aggregation
- **Sources**: CryptoPanic, NewsAPI.org
- **Capabilities**:
  - Real-time news fetching
  - Sentiment analysis from article votes
  - Trending topic extraction
  - Source deduplication
  - 15-minute caching

### 2. On-Chain Metrics
- **Sources**: Glassnode, CoinGecko, Blockchain.info
- **Metrics**:
  - Active addresses and network activity
  - Market capitalization and volume
  - Supply metrics (circulating, total, max)
  - Community engagement (Twitter, Reddit)
  - Developer activity (commits, PRs)
  - Network health (hash rate, difficulty for BTC)
- **Analysis**:
  - Trend detection (up/down/flat)
  - Volume ratio analysis
  - Developer activity assessment
  - Community growth tracking
- **Caching**: 30-minute TTL

### 3. Macro Indicators
- **Indicators**: DXY (US Dollar Index), VIX (Volatility Index), S&P 500, Gold
- **Source**: Alpha Vantage API
- **Analysis**:
  - Risk sentiment (risk-on/risk-off/neutral)
  - Market regime identification
  - Correlation analysis with crypto
  - Volatility assessment
- **Caching**: 60-minute TTL

### 4. Anomaly Detection
- Volume spikes (>100% increase)
- Price volatility (>10% 24h change)
- Network activity anomalies
- Severity classification (low/medium/high)

### 5. Market Intelligence Report
- Comprehensive sentiment analysis
- Market condition assessment
- Signal aggregation
- Risk and opportunity identification
- Trading recommendations with confidence scores

## API Reference

### Main Agent Function

```javascript
import { run } from './services/agents/market_intelligence.js';

const result = await run({
  userId: 'user-123',
  symbol: 'BTC/USDT',
  timeframe: '24h',
  config: {
    includeNews: true,
    includeOnChain: true,
    includeMacro: true,
    detectAnomalies: true,
    generateSummary: true,
    newsLimit: 20
  }
});
```

**Parameters:**
- `userId` (string): User identifier
- `symbol` (string): Trading pair (e.g., 'BTC/USDT', 'ETH/USDT')
- `timeframe` (string): Analysis timeframe ('1h', '24h', '7d', '30d')
- `config` (object): Optional configuration
  - `includeNews` (boolean): Fetch news data (default: true)
  - `includeOnChain` (boolean): Fetch on-chain metrics (default: true)
  - `includeMacro` (boolean): Fetch macro indicators (default: true)
  - `detectAnomalies` (boolean): Run anomaly detection (default: true)
  - `generateSummary` (boolean): Generate text summary (default: true)
  - `newsLimit` (number): Maximum news articles (default: 20)

**Return Value:**

```javascript
{
  agent_key: 'market_intelligence',
  symbol: 'BTC/USDT',
  timeframe: '24h',
  
  // Core data from sources
  data: {
    news: { ... },      // News articles and sentiment
    onchain: { ... },   // On-chain metrics and analysis
    macro: { ... },     // Macro indicators and analysis
    anomalies: [ ... ]  // Detected anomalies
  },
  
  // Comprehensive analysis
  analysis: {
    sentiment: {
      overall: 'positive',  // positive/negative/neutral
      news: 0.5,            // -1 to 1
      onchain: 'positive',  // positive/negative/neutral
      macro: 'risk-on',     // risk-on/risk-off/neutral
      confidence: 0.8       // 0 to 1
    },
    market_conditions: {
      trend: 'neutral',      // up/down/neutral
      volatility: 'moderate', // low/moderate/high
      volume: 'normal',      // low/normal/high
      risk_appetite: 'neutral'
    },
    signals: [ ... ],        // Array of market signals
    risks: [ ... ],          // Array of risk factors
    opportunities: [ ... ],  // Array of opportunities
    assessment: 'bullish'    // bullish/bearish/neutral
  },
  
  // Human-readable summary
  summary: "Market Intelligence Report for BTC/USDT...",
  
  // Trading recommendation
  recommendation: {
    action: 'BUY',           // BUY/SELL/HOLD
    confidence: 75,          // 0-100
    rationale: [ ... ],      // Array of reasons
    risk_level: 'medium',    // low/medium/high
    position_sizing: 'normal' // minimal/conservative/normal/aggressive
  },
  
  // Overall confidence
  confidence: 75,  // 0-100
  
  // Metadata
  metadata: {
    execution_time_ms: 1250,
    data_sources: { news: true, onchain: true, macro: true },
    data_freshness: { ... },
    anomalies_detected: 0,
    agent_version: '1.0.0'
  },
  
  timestamp: '2026-01-07T12:00:00Z'
}
```

### News API

```javascript
import { fetchNews, searchNews } from './services/newsAPI.js';

// Fetch aggregated news
const news = await fetchNews('BTC/USDT', {
  timeframe: '24h',
  limit: 20,
  useCache: true
});

// Search news
const results = await searchNews('Bitcoin regulation', {
  limit: 10,
  from: '2026-01-01',
  to: '2026-01-07',
  sortBy: 'publishedAt'
});
```

### On-Chain API

```javascript
import { fetchOnChainMetrics, detectAnomalies } from './services/onChainAPI.js';

// Fetch metrics
const metrics = await fetchOnChainMetrics('BTC/USDT', {
  useCache: true
});

// Detect anomalies
const anomalies = detectAnomalies(currentMetrics, historicalMetrics);
```

### Macro API

```javascript
import { fetchMacroIndicators } from './services/macroAPI.js';

const macro = await fetchMacroIndicators({
  useCache: true
});
```

## Environment Variables

Required API keys (set in `.env`):

```bash
# News sources
CRYPTOPANIC_API_KEY=your_cryptopanic_key
NEWSAPI_KEY=your_newsapi_key

# On-chain metrics
GLASSNODE_API_KEY=your_glassnode_key  # Optional

# Macro indicators
ALPHA_VANTAGE_API_KEY=your_alphavantage_key
```

## Data Sources

### CryptoPanic
- **URL**: https://cryptopanic.com/
- **Rate Limit**: Varies by plan
- **Data**: Crypto-specific news with community sentiment
- **Free Tier**: Yes

### NewsAPI
- **URL**: https://newsapi.org/
- **Rate Limit**: 1000 requests/day (free)
- **Data**: General news and crypto coverage
- **Free Tier**: Yes

### Glassnode
- **URL**: https://glassnode.com/
- **Rate Limit**: Varies by plan
- **Data**: Premium on-chain analytics
- **Free Tier**: Limited

### CoinGecko
- **URL**: https://coingecko.com/
- **Rate Limit**: 50 calls/minute (free)
- **Data**: Market data, supply metrics, community stats
- **Free Tier**: Yes

### Blockchain.info
- **URL**: https://blockchain.info/
- **Rate Limit**: No strict limit
- **Data**: Bitcoin-specific network metrics
- **Free Tier**: Yes

### Alpha Vantage
- **URL**: https://www.alphavantage.co/
- **Rate Limit**: 5 calls/minute, 500 calls/day (free)
- **Data**: Traditional market indicators
- **Free Tier**: Yes

## Analysis Components

### Sentiment Analysis
- Aggregates sentiment from multiple sources
- Weighs news votes, on-chain health, macro regime
- Produces overall sentiment score (-1 to 1)
- Confidence based on data availability

### Market Conditions
- **Trend**: Derived from price changes and technical indicators
- **Volatility**: Based on VIX and price volatility
- **Volume**: Ratio of volume to market cap
- **Risk Appetite**: From macro indicators (VIX, S&P 500)

### Signal Generation
- Positive signals (bullish indicators)
- Warning signals (bearish or concerning indicators)
- Anomaly signals (unusual activity)
- Source tracking for each signal

### Risk Assessment
- Market risk factors
- Technical warnings
- Macro headwinds
- Anomaly-based risks

### Opportunity Identification
- Bullish signals
- Positive macro environment
- Strong on-chain metrics
- Favorable sentiment

## Trading Recommendations

### Recommendation Logic

1. **BUY** (confidence ≥60%):
   - Bullish assessment
   - Positive sentiment + opportunities
   - Favorable macro environment
   
2. **SELL** (confidence ≥60%):
   - Bearish assessment
   - Negative sentiment + risks
   - Unfavorable macro environment
   
3. **HOLD** (all other cases):
   - Neutral assessment
   - Low confidence
   - Mixed signals

### Position Sizing
- **Minimal**: Neutral/uncertain conditions
- **Conservative**: High risk environment or bearish with low confidence
- **Normal**: Standard bullish conditions
- **Aggressive**: High confidence bullish environment

### Risk Level
- **Low**: Few/no risks, stable conditions
- **Medium**: Normal market conditions
- **High**: Multiple risk factors, high volatility

## Performance

- **Average Execution Time**: 1-3 seconds
- **Cache Hit Rate**: 60-80% (varies by timeframe)
- **Data Freshness**: 
  - News: 15 minutes
  - On-chain: 30 minutes
  - Macro: 60 minutes

## Error Handling

The agent is designed with graceful degradation:
- Missing API keys → Skip that data source
- API errors → Log and continue with available data
- Partial data → Generate analysis with confidence adjustment
- No data → Return neutral assessment

## Testing

### Unit Tests
```bash
# News API tests
npm test -- __tests__/services/newsAPI.test.js

# On-chain API tests
npm test -- __tests__/services/onChainAPI.test.js

# Macro API tests
npm test -- __tests__/services/macroAPI.test.js
```

### Integration Tests
```bash
npm test -- __tests__/integration/marketIntelligenceAgent.test.js
```

## Usage Examples

### Basic Usage

```javascript
import { run } from './services/agents/market_intelligence.js';

// Get market intelligence for BTC
const intelligence = await run({
  userId: 'user-123',
  symbol: 'BTC/USDT',
  timeframe: '24h'
});

console.log('Assessment:', intelligence.analysis.assessment);
console.log('Recommendation:', intelligence.recommendation.action);
console.log('Confidence:', intelligence.confidence);
console.log('\nSummary:\n', intelligence.summary);
```

### Custom Configuration

```javascript
// News-only analysis (fast)
const newsIntel = await run({
  userId: 'user-123',
  symbol: 'ETH/USDT',
  timeframe: '24h',
  config: {
    includeNews: true,
    includeOnChain: false,
    includeMacro: false,
    detectAnomalies: false
  }
});

// Comprehensive analysis (slower but complete)
const fullIntel = await run({
  userId: 'user-123',
  symbol: 'BTC/USDT',
  timeframe: '7d',
  config: {
    includeNews: true,
    includeOnChain: true,
    includeMacro: true,
    detectAnomalies: true,
    generateSummary: true,
    newsLimit: 50
  }
});
```

### Integration with Trading System

```javascript
import { run } from './services/agents/market_intelligence.js';

async function makeTrading Decision(userId, symbol) {
  // Get market intelligence
  const intel = await run({ userId, symbol, timeframe: '24h' });
  
  // Check confidence threshold
  if (intel.confidence < 60) {
    console.log('Low confidence - no action');
    return;
  }
  
  // Execute based on recommendation
  if (intel.recommendation.action === 'BUY') {
    // Calculate position size based on risk
    const baseSize = 1000; // USD
    const multiplier = {
      'minimal': 0.25,
      'conservative': 0.5,
      'normal': 1.0,
      'aggressive': 1.5
    }[intel.recommendation.position_sizing];
    
    const positionSize = baseSize * multiplier;
    
    console.log(`BUY ${symbol}: $${positionSize}`);
    console.log(`Rationale:`, intel.recommendation.rationale);
    
    // Place order...
  } else if (intel.recommendation.action === 'SELL') {
    console.log(`SELL ${symbol}`);
    console.log(`Rationale:`, intel.recommendation.rationale);
    
    // Close position...
  }
}
```

## Troubleshooting

### "API key not configured" warnings
- Set required environment variables in `.env`
- The agent will continue with available data sources

### Low confidence scores
- Ensure all API keys are configured
- Check that APIs are responding (not rate-limited)
- Consider longer timeframes for more data

### Stale data
- Clear caches: `clearCache()` in each API module
- Reduce cache TTL if needed
- Check API rate limits

### Incorrect sentiments
- Verify news sources are returning relevant articles
- Check CryptoPanic filters and NewsAPI queries
- Review sentiment calculation weights

## Limitations

1. **API Rate Limits**: Free tiers have strict limits
2. **Data Latency**: Caching introduces 15-60 minute delays
3. **Sentiment Accuracy**: News sentiment is approximate
4. **API Dependencies**: Requires external services
5. **Cost**: Premium features (Glassnode) require paid plans

## Future Enhancements

1. **Additional Sources**:
   - Twitter/X API integration
   - Reddit sentiment
   - Discord/Telegram community data
   
2. **ML Models**:
   - Sentiment classification models
   - Anomaly detection improvements
   - Price prediction integration
   
3. **Real-time Features**:
   - WebSocket support for live data
   - Push notifications for anomalies
   - Streaming sentiment analysis
   
4. **Advanced Analytics**:
   - Historical correlation analysis
   - Multi-asset portfolio intelligence
   - Sector rotation detection

## Support

For issues or questions:
1. Check logs for error details
2. Verify API keys and rate limits
3. Review documentation
4. Contact development team

## Related Agents

- **BACKEND-005**: Sentiment Analysis Agent
- **BACKEND-009**: Trend Detection Agent
- **BACKEND-007**: Price Prediction Agent
- **BACKEND-006**: Pattern Recognition Agent

## License

Copyright © 2026 TitanGold. All rights reserved.
