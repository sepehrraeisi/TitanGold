# Sentiment Analysis Agent Documentation

**Version:** 1.0.0  
**Date:** 2026-01-07  
**Status:** Production Ready

## Overview

The Sentiment Analysis Agent provides comprehensive market sentiment analysis by aggregating data from multiple sources including social media (Twitter/X), community discussions (Reddit), and news outlets (CryptoPanic, NewsAPI). It calculates sentiment scores, detects trending topics, and provides sentiment trend analysis to help traders gauge market mood.

## Features

### 1. Multi-Source Sentiment Analysis

The agent fetches and analyzes sentiment from three primary sources:

#### Twitter/X Sentiment
- Real-time social media sentiment analysis
- Processes up to 100 recent tweets per request
- Filters for English language and removes retweets
- Analyzes tweet text for positive/negative sentiment
- Considers engagement metrics (likes, retweets)

#### Reddit Sentiment
- Community discussion analysis from crypto-focused subreddits
- Default subreddits: CryptoCurrency, Bitcoin, CryptoMarkets, ethtrader
- Processes post titles and content
- Weights sentiment by upvote count (higher upvotes = more influence)
- Analyzes up to 100 posts per subreddit

#### News Sentiment
- News article sentiment analysis
- Supports two providers:
  - **CryptoPanic**: Crypto-specific news aggregator (primary)
  - **NewsAPI**: General news API (fallback)
- Analyzes article titles and descriptions
- Adjusts scores based on community votes (CryptoPanic)

### 2. Aggregate Sentiment Scoring

Combines sentiment from all sources using weighted average:

**Default Weights:**
- Twitter: 30%
- Reddit: 35%
- News: 35%

**Sentiment Scale:** -1.0 to +1.0
- **+0.4 to +1.0**: Very Bullish
- **+0.1 to +0.4**: Bullish
- **-0.1 to +0.1**: Neutral
- **-0.4 to -0.1**: Bearish
- **-1.0 to -0.4**: Very Bearish

### 3. Trending Topic Detection

- Extracts keywords from all sentiment sources
- Ranks topics by mention frequency
- Weights by engagement (upvotes, likes)
- Returns top 20 trending keywords
- Filters common stop words

### 4. Sentiment Trends

Analyzes sentiment changes over time:
- **Last 24 hours**: Short-term sentiment
- **Last 7 days**: Medium-term sentiment
- **Trend Direction**: Bullish, Bearish, or Neutral
- **Change Magnitude**: Quantifies sentiment shift

### 5. Rate Limit Management

Built-in rate limiting for each source:
- **Twitter**: 50 requests per 15 minutes
- **Reddit**: 60 requests per minute
- **News**: 100 requests per day

Automatically tracks and enforces limits to prevent API quota exhaustion.

### 6. Intelligent Caching

- **Cache TTL**: 5 minutes
- **Cache Keys**: Symbol + timeframe combination
- Reduces API calls and improves response time
- Automatic cache invalidation
- Manual cache clearing available

## API Usage

### Run Sentiment Analysis

**Endpoint:** `POST /api/v1/ai-agents/sentiment/run`

**Request:**
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1d",
  "config": {
    "weights": {
      "twitter": 0.3,
      "reddit": 0.35,
      "news": 0.35
    },
    "includeTopics": true,
    "includeTrends": true
  }
}
```

**Response:**
```json
{
  "agent_key": "sentiment",
  "symbol": "BTC/USDT",
  "timestamp": "2026-01-07T12:00:00.000Z",
  "confidence": 0.92,
  "result": {
    "aggregate_sentiment": 0.45,
    "sentiment_label": "very_bullish",
    "sources": {
      "twitter": {
        "sentiment": 0.38,
        "count": 87,
        "weight": 0.3,
        "mock": false
      },
      "reddit": {
        "sentiment": 0.52,
        "count": 45,
        "weight": 0.35,
        "mock": false
      },
      "news": {
        "sentiment": 0.44,
        "count": 23,
        "weight": 0.35,
        "mock": false
      }
    },
    "trending_topics": [
      { "keyword": "bull", "count": 45 },
      { "keyword": "rally", "count": 38 },
      { "keyword": "breakthrough", "count": 32 }
    ],
    "sentiment_trends": {
      "last_24h": 0.45,
      "last_7d": 0.22,
      "trend": "bullish",
      "change": 0.23
    },
    "recommendation": "Strong positive sentiment detected. Consider long positions with appropriate risk management. Sentiment is rapidly improving - potential momentum opportunity. Trending: bull, rally, breakthrough."
  },
  "meta": {
    "source": "realtime",
    "version": "1.0.0",
    "execution_time_ms": 245,
    "sources_available": 3,
    "rate_limits": {
      "twitter": { "requests": 5, "maxRequests": 50, "remaining": 45, "resetIn": 897 },
      "reddit": { "requests": 12, "maxRequests": 60, "remaining": 48, "resetIn": 52 },
      "news": { "requests": 3, "maxRequests": 100, "remaining": 97, "resetIn": 86387 }
    }
  }
}
```

### Get Agent Details

**Endpoint:** `GET /api/v1/ai-agents/sentiment/details`

**Response:**
```json
{
  "agent_key": "sentiment",
  "name": "Sentiment Analysis Agent",
  "description": "Analyzes market sentiment from Twitter, Reddit, and news sources",
  "status": "active",
  "version": "1.0.0",
  "capabilities": [
    "Social media sentiment analysis (Twitter/X)",
    "Community discussion analysis (Reddit)",
    "News sentiment analysis (CryptoPanic, NewsAPI)",
    "Aggregate sentiment scoring (-1 to +1)",
    "Trending topic detection",
    "Sentiment trend analysis (24h, 7d)",
    "Rate limit handling",
    "Multi-source data fusion"
  ],
  "configuration": {
    "sources": ["twitter", "reddit", "news"],
    "default_weights": {
      "twitter": 0.3,
      "reddit": 0.35,
      "news": 0.35
    },
    "timeframes": ["1h", "24h", "7d"],
    "cache_ttl": "5 minutes"
  },
  "rate_limits": { ... }
}
```

## Configuration

### Environment Variables

```bash
# Optional API Keys (agent works without them using mock data)

# Twitter/X API
TWITTER_API_KEY=your_twitter_api_key
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# News APIs
CRYPTOPANIC_API_KEY=your_cryptopanic_api_key
NEWS_API_KEY=your_newsapi_key

# Reddit: No API key required (public data)
```

### Agent Configuration

```javascript
{
  "enabled": true,
  "threshold": 0.6,
  "weights": {
    "twitter": 0.3,    // 30% weight
    "reddit": 0.35,    // 35% weight
    "news": 0.35       // 35% weight
  },
  "includeTopics": true,   // Include trending topics
  "includeTrends": true,   // Include sentiment trends
  "sources": {
    "twitter": {
      "enabled": true,
      "maxResults": 100
    },
    "reddit": {
      "enabled": true,
      "subreddits": ["CryptoCurrency", "Bitcoin", "CryptoMarkets", "ethtrader"],
      "limit": 100
    },
    "news": {
      "enabled": true,
      "source": "cryptopanic"  // or "newsapi"
    }
  }
}
```

## Sentiment Sources and Weights

### Why These Weights?

The default weights were chosen based on several factors:

**Twitter (30%)**
- High volume but variable quality
- Can be influenced by bots/spam
- Real-time but sometimes reactionary
- Lower weight to reduce noise

**Reddit (35%)**
- More thoughtful, discussion-based
- Community upvoting filters quality
- Less bot activity than Twitter
- Weighted by engagement (upvotes)
- Slightly higher weight for quality

**News (35%)**
- Professional journalism/analysis
- Fact-checked and edited
- Less frequent but higher quality
- Often leads market sentiment
- Equal highest weight with Reddit

### Customizing Weights

You can customize weights based on your trading style:

**Day Traders** (fast-moving sentiment):
```javascript
{
  "twitter": 0.5,   // Higher for real-time signals
  "reddit": 0.3,    // Moderate community input
  "news": 0.2       // Lower for slower news cycle
}
```

**Swing Traders** (balanced approach):
```javascript
{
  "twitter": 0.3,
  "reddit": 0.35,
  "news": 0.35      // Default balanced weights
}
```

**Position Traders** (fundamental focus):
```javascript
{
  "twitter": 0.2,   // Lower for noise reduction
  "reddit": 0.3,    // Moderate community sentiment
  "news": 0.5       // Higher for fundamental analysis
}
```

## Sentiment Score Interpretation

### Score Ranges

| Score Range | Label | Interpretation | Trading Implication |
|-------------|-------|----------------|---------------------|
| +0.7 to +1.0 | Extreme Bullish | Euphoria, possible overheating | Consider taking profits, watch for reversal |
| +0.4 to +0.7 | Very Bullish | Strong positive sentiment | Favorable for long positions |
| +0.1 to +0.4 | Bullish | Moderately positive | Good for long entries |
| -0.1 to +0.1 | Neutral | No clear direction | Wait for clearer signals |
| -0.4 to -0.1 | Bearish | Moderately negative | Exercise caution |
| -0.7 to -0.4 | Very Bearish | Strong negative sentiment | Consider defensive positions |
| -1.0 to -0.7 | Extreme Bearish | Fear/panic, possible bottom | Potential contrarian opportunity |

### Confidence Levels

The agent calculates confidence based on data availability:

- **3 sources available**: 0.92+ confidence (high)
- **2 sources available**: 0.72 confidence (medium)
- **1 source available**: 0.50 confidence (low)

Higher confidence means more reliable sentiment scores.

## Rate Limiting Details

### Twitter/X API
- **Limit**: 50 requests per 15-minute window
- **Reset**: Rolling window (resets 15 minutes after first request)
- **Exceeded**: Returns cached/mock data
- **Monitoring**: Check `rate_limits.twitter` in response

### Reddit API
- **Limit**: 60 requests per minute
- **Reset**: Rolling 60-second window
- **No Auth Required**: Public data access
- **Rate Friendly**: Respectful 1-second delays between subreddit requests

### News APIs

**CryptoPanic:**
- **Limit**: 100 requests per day (free tier)
- **Reset**: Daily at midnight UTC
- **Crypto-Specific**: Best for cryptocurrency sentiment

**NewsAPI:**
- **Limit**: 100 requests per day (developer tier)
- **Reset**: Daily at midnight UTC
- **General News**: Broader news coverage

### Rate Limit Status

Check current rate limits:
```javascript
import sentimentAPI from './services/sentimentAPI.js';

const status = sentimentAPI.getRateLimitStatus();
console.log(status);
// {
//   twitter: { requests: 12, maxRequests: 50, remaining: 38, resetIn: 754 },
//   reddit: { requests: 5, maxRequests: 60, remaining: 55, resetIn: 42 },
//   news: { requests: 8, maxRequests: 100, remaining: 92, resetIn: 65234 }
// }
```

## Caching Strategy

### Cache Behavior

- **TTL**: 5 minutes
- **Keys**: `{source}_{symbol}_{timeframe}`
- **Automatic**: Transparent to API users
- **Benefits**: Reduced API calls, faster responses, rate limit protection

### Cache Example

```javascript
// First request: Fetches from APIs (slow)
await sentimentAgent.run({ symbol: 'BTC/USDT', timeframe: '24h' });
// Execution time: ~2-3 seconds

// Second request within 5 minutes: Returns from cache (fast)
await sentimentAgent.run({ symbol: 'BTC/USDT', timeframe: '24h' });
// Execution time: ~50ms
```

### Manual Cache Control

```javascript
import sentimentAPI from './services/sentimentAPI.js';

// Clear all cached sentiment data
sentimentAPI.clearCache();
```

## Text Sentiment Analysis

The agent uses the `sentiment` npm library for natural language processing:

### Algorithm

1. **Tokenization**: Breaks text into words
2. **Lexicon Matching**: Matches words against sentiment dictionary
3. **Score Calculation**: Sums positive and negative word scores
4. **Normalization**: Scales to -1 to +1 range

### Example

```javascript
import sentimentAPI from './services/sentimentAPI.js';

const result = sentimentAPI.analyzeTextSentiment('Bitcoin is amazing! Great investment opportunity!');

console.log(result);
// {
//   score: 0.72,              // Normalized score (-1 to +1)
//   comparative: 0.18,        // Score per word
//   tokens: ['bitcoin', 'is', 'amazing', ...],
//   positive: ['amazing', 'great', 'opportunity'],
//   negative: [],
//   rawScore: 7               // Raw sentiment score
// }
```

### Limitations

- English language only
- Context-blind (doesn't understand sarcasm)
- Fixed lexicon (doesn't learn)
- Neutral on unknown words

## Performance Characteristics

### Execution Times

| Operation | Average Time | Notes |
|-----------|--------------|-------|
| Twitter fetch | 800ms | With API key |
| Reddit fetch | 1200ms | Multiple subreddits |
| News fetch | 600ms | CryptoPanic/NewsAPI |
| Aggregate sentiment | 2500ms | All sources parallel |
| Trending topics | 2800ms | Includes keyword extraction |
| Sentiment trends | 5000ms | Two timeframe analyses |
| Cached response | 50ms | Cache hit |

### Resource Usage

- **Memory**: <100MB per analysis
- **CPU**: Single-threaded, non-blocking
- **Network**: 3-6 API calls per analysis (parallel)
- **Database**: No direct database access

### Scalability

- **Concurrent Requests**: 20+ simultaneous analyses
- **Cache Effectiveness**: ~70% cache hit rate (5-min TTL)
- **Rate Limit Protection**: Automatic fallback to mock/cached data

## Error Handling

### Graceful Degradation

The agent handles errors gracefully:

1. **API Failure**: Falls back to mock data
2. **Rate Limit**: Returns cached or mock data
3. **Network Timeout**: Uses last known good data
4. **Invalid Response**: Skips source, continues with others

### Error Response Format

```json
{
  "agent_key": "sentiment",
  "symbol": "BTC/USDT",
  "error": "Unable to fetch sentiment data",
  "result": {
    "aggregate_sentiment": 0,
    "sentiment_label": "unknown",
    "recommendation": "Unable to generate recommendation due to error"
  }
}
```

### Common Error Codes

- `RATE_LIMIT_EXCEEDED`: Source rate limit reached
- `API_KEY_MISSING`: Required API key not configured
- `NETWORK_ERROR`: Connection timeout or failure
- `INVALID_RESPONSE`: Unexpected API response format

## Testing

### Unit Tests

**File:** `backend/__tests__/services/sentimentAPI.test.js`  
**Coverage:** 51% statements, 41% branches

**Test Categories:**
- Text sentiment analysis (7 tests)
- Twitter sentiment fetching (4 tests)
- Reddit sentiment fetching (4 tests)
- News sentiment fetching (4 tests)
- Aggregate sentiment calculation (5 tests)
- Trending topic detection (3 tests)
- Sentiment trends (4 tests)
- Rate limiting (4 tests)
- Caching (3 tests)
- Edge cases (4 tests)

### Integration Tests

**File:** `backend/__tests__/integration/sentimentAgent.test.js`  
**Test Count:** 30+ comprehensive tests

**Scenarios:**
- Agent run with real API integration
- Configuration handling (custom weights, optional features)
- Multiple symbol analysis
- Error handling and graceful degradation
- Performance and concurrent requests
- Confidence calculation
- Sentiment label assignment

### Run Tests

```bash
# Unit tests
npm test -- __tests__/services/sentimentAPI.test.js

# Integration tests
npm test -- __tests__/integration/sentimentAgent.test.js

# Coverage report
npm test -- __tests__/services/sentimentAPI.test.js --coverage
```

## Best Practices

### 1. Use Appropriate Timeframes

- **Intraday trading**: 1h or 24h sentiment
- **Swing trading**: 24h and 7d sentiment
- **Position trading**: 7d and 30d sentiment (custom)

### 2. Consider Confidence Levels

- Only trade on high confidence (3 sources, 0.9+)
- Be cautious with low confidence (<0.6)
- Cross-reference with technical indicators

### 3. Watch for Extreme Sentiment

- Extreme bullish (+0.7+): Possible overheating, consider taking profits
- Extreme bearish (-0.7-): Possible bottom, contrarian opportunity
- Rapid shifts: Important trend changes

### 4. Monitor Trending Topics

- Track emerging narratives
- Identify catalysts (regulations, adoption, tech updates)
- Correlate with price action

### 5. Combine with Other Agents

Sentiment works best combined with:
- **Technical Analysis**: Confirm sentiment with chart patterns
- **Risk Management**: Size positions based on sentiment strength
- **Fundamental Analysis**: Validate sentiment with fundamentals

## Example Workflows

### Daily Sentiment Check

```javascript
const result = await sentimentAgent.run({
  userId: 1,
  symbol: 'BTC/USDT',
  timeframe: '24h',
  config: {
    includeTopics: true,
    includeTrends: true
  }
});

if (result.result.aggregate_sentiment > 0.4) {
  console.log('Strong bullish sentiment - Consider long positions');
} else if (result.result.aggregate_sentiment < -0.4) {
  console.log('Strong bearish sentiment - Exercise caution');
}
```

### Multi-Symbol Analysis

```javascript
const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const results = await Promise.all(
  symbols.map(symbol => 
    sentimentAgent.run({ userId: 1, symbol, timeframe: '24h', config: {} })
  )
);

// Compare sentiment across symbols
results.forEach(r => {
  console.log(`${r.symbol}: ${r.result.sentiment_label} (${r.result.aggregate_sentiment.toFixed(2)})`);
});
```

### Trend Change Detection

```javascript
const trends = await sentimentAPI.getSentimentTrends('BTC/USDT');

if (trends.trend === 'bullish' && trends.change > 0.2) {
  console.log('Sentiment rapidly improving - Momentum opportunity');
} else if (trends.trend === 'bearish' && trends.change < -0.2) {
  console.log('Sentiment deteriorating - Risk of further decline');
}
```

## Troubleshooting

### Mock Data Instead of Real Data

**Cause:** API keys not configured  
**Solution:** Set environment variables for Twitter, CryptoPanic, or NewsAPI

### Rate Limit Errors

**Cause:** Too many requests in short time  
**Solution:** Increase cache TTL, reduce request frequency, or upgrade API tier

### Low Confidence Scores

**Cause:** Missing API keys, network errors  
**Solution:** Configure all API keys, check network connectivity

### Slow Response Times

**Cause:** All sources fetched without cache  
**Solution:** Enable caching (default), use shorter timeframes

## Future Enhancements

### Planned Features

1. **BACKEND-005-ML-Sentiment** (16h, P2)
   - Machine learning sentiment classification
   - Fine-tuned models for crypto context
   - Sarcasm and context detection

2. **BACKEND-005-Historical-Sentiment** (12h, P2)
   - Historical sentiment database
   - Backtest sentiment strategies
   - Sentiment correlation with price

3. **BACKEND-005-Real-Time-Stream** (10h, P2)
   - WebSocket sentiment streaming
   - Real-time sentiment updates
   - Alert on sentiment shifts

4. **BACKEND-005-Extended-Sources** (8h, P3)
   - Additional sources (Telegram, Discord, YouTube)
   - Influencer sentiment tracking
   - Whale wallet sentiment

## Support

For issues or questions:
- **Documentation**: `docs/SENTIMENT_ANALYSIS_AGENT.md`
- **Code**: `backend/services/agents/sentiment.js`, `backend/services/sentimentAPI.js`
- **Tests**: `backend/__tests__/services/sentimentAPI.test.js`
- **Issue Tracker**: GitHub Issues

## Version History

### v1.0.0 (2026-01-07)
- Initial production release
- Twitter/X sentiment analysis
- Reddit community sentiment
- News sentiment (CryptoPanic, NewsAPI)
- Aggregate sentiment scoring (-1 to +1)
- Trending topic detection
- Sentiment trends (24h, 7d)
- Rate limit handling
- 5-minute caching
- Comprehensive unit and integration tests
- Full documentation
