# 📡 Telegram Data API Documentation

## Overview

The Telegram Data API provides comprehensive access to processed Telegram messages, agent impacts, news events, and real-time statistics from the TitanGold data pipeline.

**Base URL**: `http://localhost:5002/api/v1/telegram`

**Version**: 1.0.0  
**Last Updated**: 2026-02-16

---

## 🔑 Authentication

Most endpoints require Bearer token authentication.

```bash
# Login to get token
curl -X POST http://localhost:5002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'

# Use token in requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5002/api/v1/telegram/agents/summary
```

**Public Endpoints** (no auth required):
- `GET /health`
- `GET /agents/summary`
- `GET /categories/summary`

---

## 📊 Endpoints

### 1. Health Check

Check Telegram services health and pipeline status.

**Endpoint**: `GET /health`  
**Auth**: None

**Response**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-02-16T22:45:03.799Z",
  "database": {
    "connected": true,
    "totalMessages": 2858
  },
  "pipeline": {
    "total_messages": "2745",
    "processed_count": "2745",
    "pending_count": "0",
    "failed_count": "0",
    "actionable_count": "527",
    "signal_count": "0",
    "avg_processing_time_ms": "5.38",
    "channels_with_data": "43"
  }
}
```

**Example**:
```bash
curl http://localhost:5002/api/v1/telegram/health
```

---

### 2. Agents Summary

Overview of all 15 AI agents with message counts and impact statistics.

**Endpoint**: `GET /agents/summary`  
**Auth**: None (can be enabled)

**Query Parameters**:
- `timeRange` (number, default: 24) - Time range in hours

**Response**:
```json
{
  "success": true,
  "timeRange": 24,
  "agents": [
    {
      "agent_key": "trend",
      "agent_name": "Trend Agent",
      "total_messages": "220",
      "action_required_count": "0",
      "critical_count": "0",
      "high_count": "1",
      "average_impact": "0.48545454545454545455",
      "last_message_at": "2026-02-16T22:45:52.455Z",
      "top_event_categories": ["MARKET_DATA", "FOREX_CURRENCY", "PRECIOUS_METALS"],
      "top_news_categories": ["forex", "gold", "crypto"]
    },
    {
      "agent_key": "technical",
      "agent_name": "Technical Analysis Agent",
      "total_messages": "219",
      "action_required_count": "0",
      "critical_count": "0",
      "high_count": "1",
      "average_impact": "0.48538812785388127854",
      "last_message_at": "2026-02-16T22:45:52.455Z",
      "top_event_categories": ["CRYPTO_BLOCKCHAIN", "FOREX_CURRENCY", "MARKET_DATA"],
      "top_news_categories": ["crypto", "forex", "gold"]
    }
  ],
  "systemStats": {
    "total_processed_messages": "236",
    "total_agent_impacts": "1108",
    "active_channels": "4",
    "avg_impact_score": "0.43149819494584837545",
    "total_actions_required": "0",
    "last_processed_at": "2026-02-16T22:45:52.455Z"
  }
}
```

**Example**:
```bash
curl "http://localhost:5002/api/v1/telegram/agents/summary?timeRange=48"
```

---

### 3. Agent Feed

Get filtered messages for a specific agent.

**Endpoint**: `GET /agents/:agentKey/feed`  
**Auth**: Required

**Valid Agent Keys**:
- `technical` - Technical Analysis
- `risk` - Risk Management
- `sentiment` - Sentiment Analysis
- `pattern` - Pattern Recognition
- `price_prediction` - Price Prediction
- `arbitrage` - Arbitrage Opportunities
- `portfolio` - Portfolio Allocation
- `liquidity` - Liquidity Analysis
- `trend` - Trend Analysis
- `optimization` - Optimization
- `order` - Order Management
- `fundamental` - Fundamental Analysis
- `market_intelligence` - Market Intelligence
- `volume` - Volume Analysis
- `timing` - Timing Analysis

**Query Parameters**:
- `limit` (number, default: 50, max: 200) - Messages per page
- `offset` (number, default: 0) - Pagination offset
- `minImpact` (number, default: 0, range: 0-1) - Minimum impact score
- `categories` (string) - Comma-separated event categories
- `timeRange` (number, default: 24) - Time range in hours
- `requiresAction` (boolean) - Filter by action requirement

**Response**:
```json
{
  "success": true,
  "agent": "technical",
  "data": [
    {
      "id": "uuid",
      "message_id": 12345,
      "channel_id": "uuid",
      "channel_username": "ontimecrypt",
      "channel_title": "Ontime Bitcoin",
      "cleaned_text": "BTC price analysis...",
      "original_text": "💰 BTC price analysis...",
      "detected_language": "en",
      "sentiment": "neutral",
      "news_type": "market_update",
      "importance_level": "medium",
      "mentioned_assets": ["BTC", "BITCOIN"],
      "extracted_prices": [{"asset": "BTC", "value": 45000, "currency": "USD"}],
      "extracted_dates": ["2026-02-16T12:00:00Z"],
      "keywords": ["bitcoin", "price", "analysis"],
      "hashtags": ["#BTC", "#crypto"],
      "telegram_created_at": "2026-02-16T12:00:00Z",
      "created_at": "2026-02-16T12:01:23Z",
      "impact_score": "0.85",
      "event_category": "CRYPTO_BLOCKCHAIN",
      "relevance_reasoning": ["Price movement detected", "Technical indicators present"],
      "requires_action": false,
      "action_type": null,
      "confidence_score": "0.92",
      "processing_notes": null,
      "impact_recorded_at": "2026-02-16T12:01:25Z"
    }
  ],
  "pagination": {
    "total": 219,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "filters": {
    "minImpact": 0,
    "categories": null,
    "timeRange": 24,
    "requiresAction": null
  }
}
```

**Examples**:
```bash
# Get technical agent feed
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/agents/technical/feed?limit=10&minImpact=0.7"

# Filter by categories
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/agents/sentiment/feed?categories=GEOPOLITICAL,POLITICAL"

# Get action-required messages
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/agents/risk/feed?requiresAction=true"
```

---

### 4. Breaking News

Get high-impact, time-sensitive news events.

**Endpoint**: `GET /breaking-news`  
**Auth**: Required

**Query Parameters**:
- `limit` (number, default: 20, max: 100)
- `minImpact` (number, default: 0.7, range: 0-1)
- `categories` (string) - Comma-separated categories
- `severity` (string) - Filter by severity (`high`, `medium`, `low`)

**Response**:
```json
{
  "success": true,
  "count": 5,
  "minImpact": 0.7,
  "data": [
    {
      "id": "uuid",
      "message_id": 67890,
      "channel_id": "uuid",
      "channel_username": "BBCPersian",
      "channel_title": "BBC Persian",
      "cleaned_text": "Breaking: Major economic policy change...",
      "sentiment": "negative",
      "news_type": "breaking",
      "importance_level": "critical",
      "mentioned_assets": ["USD", "GOLD"],
      "extracted_prices": [],
      "telegram_created_at": "2026-02-16T10:30:00Z",
      "created_at": "2026-02-16T10:31:45Z",
      "primary_category": "GEOPOLITICAL",
      "sub_category": "POLICY_CHANGE",
      "regions": ["MIDDLE_EAST", "GLOBAL"],
      "affected_entities": ["Central Bank", "Government"],
      "affected_markets": ["FOREX", "COMMODITIES"],
      "affected_assets": ["USD", "GOLD", "OIL"],
      "market_impact_level": "high",
      "event_urgency": "critical",
      "source_reliability": "0.95",
      "event_type": "policy_announcement",
      "affected_agents_count": 8,
      "top_affected_agents": [
        {
          "agent_key": "risk",
          "impact_score": "0.95",
          "requires_action": true
        },
        {
          "agent_key": "fundamental",
          "impact_score": "0.90",
          "requires_action": true
        }
      ]
    }
  ],
  "filters": {
    "categories": null,
    "severity": null
  }
}
```

**Example**:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/breaking-news?minImpact=0.8&severity=high"
```

---

### 5. Recent Events

Get latest categorized news events.

**Endpoint**: `GET /events/recent`  
**Auth**: Required

**Query Parameters**:
- `limit` (number, default: 50, max: 100)
- `categories` (string) - Comma-separated categories
- `timeRange` (number, default: 24) - Time range in hours

**15 Event Categories**:
1. `MARKET_DATA` - Market prices, volumes, indicators
2. `ECONOMIC_INDICATORS` - GDP, inflation, employment
3. `GEOPOLITICAL` - International relations, conflicts
4. `POLITICAL` - Domestic politics, elections
5. `SANCTIONS_EMBARGO` - Trade restrictions
6. `ENERGY_COMMODITIES` - Oil, gas, energy
7. `CRYPTO_BLOCKCHAIN` - Cryptocurrency news
8. `FOREX_CURRENCY` - Foreign exchange
9. `PRECIOUS_METALS` - Gold, silver, metals
10. `SOCIAL_UNREST` - Protests, riots
11. `NATURAL_DISASTERS` - Earthquakes, floods
12. `CORPORATE_BUSINESS` - Company news
13. `TECHNOLOGY` - Tech developments
14. `FINANCIAL_CRISIS` - Banking, debt crisis
15. `TRADE_COMMERCE` - Trade agreements, tariffs

**Response**:
```json
{
  "success": true,
  "count": 13,
  "timeRange": 24,
  "data": [
    {
      "primary_category": "GEOPOLITICAL",
      "sub_category": "CONFLICT",
      "regions": ["MIDDLE_EAST"],
      "market_impact_level": "high",
      "event_urgency": "critical",
      "event_type": "military_action",
      "cleaned_text": "Event description...",
      "sentiment": "negative",
      "telegram_created_at": "2026-02-16T08:00:00Z",
      "channel_title": "BBC Persian",
      "affected_agents_count": 6
    }
  ]
}
```

**Example**:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/events/recent?categories=GEOPOLITICAL,POLITICAL&timeRange=48"
```

---

### 6. Categories Summary

Get message distribution across all 15 categories.

**Endpoint**: `GET /categories/summary`  
**Auth**: None (can be enabled)

**Query Parameters**:
- `timeRange` (number, default: 24) - Time range in hours

**Response**:
```json
{
  "success": true,
  "timeRange": 24,
  "categories": [
    {
      "primary_category": "GEOPOLITICAL",
      "message_count": "10",
      "high_impact_count": "3",
      "medium_impact_count": "5",
      "low_impact_count": "2",
      "breaking_count": "1",
      "avg_reliability": "0.85",
      "channel_count": "3",
      "affected_agents_count": "8",
      "latest_message_at": "2026-02-16T10:30:00Z"
    },
    {
      "primary_category": "MARKET_DATA",
      "message_count": "1",
      "high_impact_count": "0",
      "medium_impact_count": "1",
      "low_impact_count": "0",
      "breaking_count": "0",
      "avg_reliability": "0.80",
      "channel_count": "1",
      "affected_agents_count": "5",
      "latest_message_at": "2026-02-15T22:15:00Z"
    }
  ],
  "totals": {
    "total_messages": "236",
    "total_channels": "4",
    "total_agents_affected": "10"
  }
}
```

**Example**:
```bash
curl "http://localhost:5002/api/v1/telegram/categories/summary?timeRange=168"
```

---

### 7. Category Timeline

Get historical timeline for a specific category.

**Endpoint**: `GET /categories/:category/timeline`  
**Auth**: Required

**Query Parameters**:
- `timeRange` (number, default: 168) - Time range in hours (default: 7 days)
- `interval` (string, default: `hour`) - Time bucket interval (`hour`, `day`)

**Response**:
```json
{
  "success": true,
  "category": "GEOPOLITICAL",
  "timeRange": 168,
  "interval": "hour",
  "data": [
    {
      "time_bucket": "2026-02-16T10:00:00Z",
      "message_count": "5",
      "avg_urgency": null,
      "high_impact_count": "2",
      "sentiments": ["negative", "neutral"],
      "affected_agents": "3"
    },
    {
      "time_bucket": "2026-02-16T09:00:00Z",
      "message_count": "3",
      "avg_urgency": null,
      "high_impact_count": "1",
      "sentiments": ["neutral"],
      "affected_agents": "2"
    }
  ]
}
```

**Example**:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/categories/CRYPTO_BLOCKCHAIN/timeline?interval=day&timeRange=720"
```

---

### 8. Real-time Stats

Get live processing stats and collector health.

**Endpoint**: `GET /stats/real-time`  
**Auth**: Required

**Response**:
```json
{
  "success": true,
  "timestamp": "2026-02-16T12:00:00Z",
  "pipeline": {
    "total_messages": "2745",
    "processed_count": "2745",
    "pending_count": "0",
    "failed_count": "0",
    "actionable_count": "527",
    "signal_count": "0",
    "avg_processing_time_ms": "5.38",
    "channels_with_data": "43"
  },
  "collector": {
    "active_channels": "10",
    "messages_collected": "150",
    "last_message_at": "2026-02-16T11:59:45Z"
  },
  "processor": {
    "messages_processed": "145",
    "avg_processing_delay_ms": "1250.5",
    "channels_processed": "10"
  },
  "agentActivity": [
    {
      "agent_key": "technical",
      "new_impacts": "25",
      "avg_impact": "0.52",
      "actions_required": "0"
    },
    {
      "agent_key": "trend",
      "new_impacts": "24",
      "avg_impact": "0.50",
      "actions_required": "0"
    }
  ]
}
```

**Example**:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5002/api/v1/telegram/stats/real-time"
```

---

### 9. Mark Messages as Processed

Mark messages as processed by a specific agent.

**Endpoint**: `POST /agents/:agentKey/mark-processed`  
**Auth**: Required

**Request Body**:
```json
{
  "message_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response**:
```json
{
  "success": true,
  "agent": "technical",
  "marked_count": 3,
  "processed_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message_ids":["abc-123","def-456"]}' \
  "http://localhost:5002/api/v1/telegram/agents/technical/mark-processed"
```

---

## 🔄 Rate Limiting

- **Read operations**: Limited by `readRateLimiter` middleware
- **Write operations**: Limited by `writeRateLimiter` middleware

Default limits (configurable):
- Read: 100 requests per 15 minutes
- Write: 20 requests per 15 minutes

---

## 📝 Response Format

All endpoints return JSON with a consistent structure:

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  // ... additional fields
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

---

## 🛠️ Database Schema

### Tables Used:
- `telegram_messages` - Raw Telegram messages
- `processed_telegram_messages` - Processed and enriched messages
- `telegram_agent_impacts` - Agent-specific impact records
- `telegram_news_events` - Categorized news events
- `telegram_channels` - Channel metadata

### Views Used:
- `telegram_agent_feed` - Aggregated agent statistics
- `telegram_pipeline_stats` - Real-time pipeline metrics

---

## 📊 Current System Status

**Latest Stats** (as of 2026-02-16):
- **Total Messages**: 2,858
- **Processed Messages**: 2,745 (96.1%)
- **Actionable Messages**: 527 (19.2%)
- **Active Channels**: 43
- **Active Agents**: 10
- **Agent Impacts**: 1,108
- **Average Processing Time**: 5.38ms per message

---

## 🚀 Next Steps

1. ✅ Complete schema alignment for all endpoints
2. 🔄 Add WebSocket support for real-time updates
3. 🔄 Implement GraphQL API layer
4. 🔄 Add advanced filtering and search
5. 🔄 Implement caching layer (Redis)
6. 🔄 Add API usage analytics
7. 🔄 Create Swagger/OpenAPI documentation

---

## 📞 Support

For issues or questions, contact the development team or check the main TitanGold documentation.

**Repository**: https://github.com/sepehrraeisi/TitanGold  
**Documentation**: See `TELEGRAM_*.md` files in the repository
