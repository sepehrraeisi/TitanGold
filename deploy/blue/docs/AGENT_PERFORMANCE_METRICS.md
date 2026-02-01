# Agent Performance Metrics Guide

**Task:** FRONTEND-011 - Add Agent Performance Metrics to UI  
**Version:** 1.0.0  
**Date:** 2026-01-31

## Overview

This guide explains the performance metrics displayed in TitanGold agent control panels, helping users understand agent performance, caching behavior, and optimization opportunities.

---

## Table of Contents

1. [Performance Metrics Overview](#performance-metrics-overview)
2. [Execution Time Metrics](#execution-time-metrics)
3. [Cache Performance](#cache-performance)
4. [Historical Charts](#historical-charts)
5. [Interpreting Metrics](#interpreting-metrics)
6. [Optimization Tips](#optimization-tips)

---

## Performance Metrics Overview

Each agent control panel displays real-time and historical performance metrics to help you monitor and optimize agent behavior.

### Key Metrics Displayed

1. **Execution Time** - How long the agent takes to process requests
2. **Cache Status** - Whether results were served from cache (HIT) or calculated fresh (MISS)
3. **Cache Hit Rate** - Percentage of requests served from cache
4. **Success Rate** - Percentage of successful agent executions
5. **Historical Performance** - Visual charts showing trends over time

---

## Execution Time Metrics

### What is Execution Time?

Execution time measures how long it takes for an agent to process a request and return results. This includes:
- Data fetching from exchanges
- Analysis calculations
- Model inference (if using ML)
- Result formatting

### Execution Time Display

```
┌─────────────────────────┐
│ Execution Time          │
│ 247ms              ⏱️   │
│ Avg: 312ms              │
└─────────────────────────┘
```

### Color Coding

- **Green** (< 1 second): Fast execution, optimal performance
- **Yellow** (1-3 seconds): Acceptable performance, consider optimization
- **Red** (> 3 seconds): Slow execution, optimization recommended

### What Affects Execution Time?

1. **Exchange API Response Time**: Network latency to exchanges
2. **Data Volume**: More candles/data = longer processing
3. **Complexity**: Advanced indicators require more computation
4. **Server Load**: High concurrent requests can slow down processing
5. **Cache Status**: Cache HITs are significantly faster

### Typical Execution Times

| Agent Type | Cached | Uncached |
|------------|--------|----------|
| Technical Analysis | 50-150ms | 200-800ms |
| Sentiment Analysis | 100-300ms | 500-2000ms |
| Pattern Recognition | 150-400ms | 800-3000ms |
| Price Prediction | 200-500ms | 1000-5000ms |
| Risk Management | 50-200ms | 300-1000ms |

---

## Cache Performance

### What is Caching?

Caching stores recently calculated results to avoid redundant computations. When the same analysis is requested again within the cache validity period, the stored result is returned instantly.

### Cache Status Display

```
┌─────────────────────────┐
│ Cache Status            │
│ HIT               ✓     │
│ Hit Rate: 67.3%         │
└─────────────────────────┘
```

or

```
┌─────────────────────────┐
│ Cache Status            │
│ MISS              ⚠     │
│ Hit Rate: 67.3%         │
└─────────────────────────┘
```

### Cache Status Indicators

**HIT (Green ✓)**
- Result was served from cache
- No fresh calculation needed
- Much faster response time (typically 10-100ms)
- No API calls to exchanges

**MISS (Orange ⚠)**
- Fresh calculation required
- Data fetched from exchanges
- Full analysis performed
- Longer response time

### Cache Hit Rate

The cache hit rate shows the percentage of requests served from cache:

- **> 70%**: Excellent cache utilization
- **50-70%**: Good cache performance
- **30-50%**: Moderate cache usage
- **< 30%**: Low cache efficiency, review cache settings

### Cache Validity Periods

Different data types have different cache durations:

| Data Type | Cache Duration | Reason |
|-----------|----------------|--------|
| Market Data (1m) | 30 seconds | Fast-moving data |
| Market Data (5m) | 2 minutes | Medium-speed updates |
| Market Data (1h) | 10 minutes | Slower-moving data |
| Technical Indicators | 5 minutes | Derived calculations |
| Sentiment Data | 15 minutes | Social data aggregation |
| Fundamental Data | 1 hour | Slow-changing metrics |

### Improving Cache Hit Rate

1. **Consistent Timeframes**: Use the same timeframe repeatedly
2. **Common Symbols**: Analyze popular trading pairs
3. **Scheduled Analysis**: Run at regular intervals
4. **Avoid Parameter Changes**: Frequent config changes invalidate cache

---

## Historical Charts

### Execution Time Chart

Shows the last 10 agent executions with execution times:

```
   ┃
ms ┃  █
800┃  █     █
600┃  █  █  █
400┃  █  █  █  █
200┃  █  █  █  █  █  █  █  █  █  █
   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    1  2  3  4  5  6  7  8  9  10
```

**Colors:**
- **Blue bars**: Fast execution (below average)
- **Orange bars**: Slow execution (above average)

**Interpretation:**
- Consistent heights = stable performance
- Increasing trend = performance degrading
- Decreasing trend = performance improving
- Spikes = temporary slowdowns (network, server load)

### Cache Performance Chart

Shows cache status for the last 10 executions:

```
    ┃
100%┃ █     █  █  █     █     █
    ┃ █     █  █  █     █     █
 50%┃ █  ▓  █  █  █  ▓  █  ▓  █
    ┃ █  ▓  █  █  █  ▓  █  ▓  █
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━
    1  2  3  4  5  6  7  8  9  10
```

**Colors:**
- **Green bars (█)**: Cache HIT
- **Gray bars (▓)**: Cache MISS

**Interpretation:**
- Mostly green = excellent cache utilization
- Mixed pattern = normal usage
- Mostly gray = poor cache efficiency

### Success Rate Chart

Shows successful vs failed executions:

```
    ┃
100%┃ █  █  █  █  █  █  █  ▓  █  █
    ┃ █  █  █  █  █  █  █  ▓  █  █
 50%┃ █  █  █  █  █  █  █  ▓  █  █
    ┃ █  █  █  █  █  █  █  ▓  █  █
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    1  2  3  4  5  6  7  8  9  10
```

**Colors:**
- **Green bars (█)**: Successful execution
- **Red bars (▓)**: Failed execution

**Interpretation:**
- All green = stable agent
- Occasional red = temporary issues (acceptable)
- Frequent red = agent configuration or data issues

---

## Interpreting Metrics

### Success Rate

```
┌─────────────────────────┐
│ Success Rate            │
│ 87.3%             📊    │
│ 524 / 600 signals       │
└─────────────────────────┘
```

**Interpretation:**
- **> 90%**: Excellent reliability
- **80-90%**: Good performance
- **70-80%**: Acceptable, monitor for issues
- **< 70%**: Poor performance, needs attention

### Average Confidence

```
┌─────────────────────────┐
│ Avg Confidence          │
│ 76.4%                   │
└─────────────────────────┘
```

The average confidence level of agent signals:
- **> 80%**: High confidence decisions
- **70-80%**: Moderate confidence (normal)
- **60-70%**: Lower confidence (use with caution)
- **< 60%**: Very low confidence (review settings)

### Profit Factor

```
┌─────────────────────────┐
│ Profit Factor           │
│ 2.34                    │
└─────────────────────────┘
```

Ratio of gross profit to gross loss:
- **> 2.0**: Excellent profitability
- **1.5-2.0**: Good profitability
- **1.0-1.5**: Marginal profitability
- **< 1.0**: Losing strategy

### Sharpe Ratio

```
┌─────────────────────────┐
│ Sharpe Ratio            │
│ 1.87                    │
└─────────────────────────┘
```

Risk-adjusted return measure:
- **> 2.0**: Excellent risk-adjusted returns
- **1.0-2.0**: Good risk-adjusted returns
- **0.5-1.0**: Acceptable returns
- **< 0.5**: Poor risk-adjusted returns

### Max Drawdown

```
┌─────────────────────────┐
│ Max Drawdown            │
│ -12.4%                  │
└─────────────────────────┘
```

Maximum peak-to-trough decline:
- **< 10%**: Excellent risk control
- **10-20%**: Moderate risk
- **20-30%**: High risk
- **> 30%**: Very high risk, review strategy

---

## Optimization Tips

### Improving Execution Time

1. **Reduce Data Points**
   - Use fewer candles if possible
   - Reduce indicator periods
   - Example: Instead of 200 candles, use 100

2. **Simplify Analysis**
   - Disable unused indicators
   - Reduce indicator complexity
   - Use faster timeframes when appropriate

3. **Optimize Scheduling**
   - Schedule analysis at off-peak times
   - Avoid concurrent heavy analysis
   - Stagger automated runs

4. **Leverage Caching**
   - Use consistent parameters
   - Schedule regular analysis intervals
   - Avoid frequent configuration changes

### Improving Cache Hit Rate

1. **Consistent Usage Patterns**
   ```javascript
   // Good: Repeated analysis with same parameters
   runAnalysis({ symbol: 'BTCUSDT', timeframe: '1h' });
   // ... time passes
   runAnalysis({ symbol: 'BTCUSDT', timeframe: '1h' }); // Cache HIT
   ```

2. **Avoid Parameter Hopping**
   ```javascript
   // Bad: Constantly changing parameters
   runAnalysis({ timeframe: '1h' });
   runAnalysis({ timeframe: '5m' }); // Cache MISS
   runAnalysis({ timeframe: '15m' }); // Cache MISS
   ```

3. **Use Popular Symbols**
   - Focus on major trading pairs
   - These have higher cache hit rates
   - Shared cache across users

4. **Schedule Regular Analysis**
   - Set up automated runs
   - Use consistent intervals
   - Example: Every 5 minutes for 5m timeframe

### Monitoring Performance Degradation

Watch for these warning signs:

1. **Increasing Execution Times**
   - Check server resources
   - Review recent configuration changes
   - Consider scaling infrastructure

2. **Decreasing Cache Hit Rate**
   - Review usage patterns
   - Check for parameter changes
   - Verify cache configuration

3. **Declining Success Rate**
   - Review market conditions
   - Check for data quality issues
   - Validate agent configuration

4. **Increasing Failures**
   - Check exchange API status
   - Review error logs
   - Verify network connectivity

---

## Troubleshooting

### Slow Execution Times

**Problem**: Agent takes > 3 seconds consistently

**Solutions:**
1. Check exchange API status
2. Reduce data complexity (fewer candles, indicators)
3. Verify server resources (CPU, memory)
4. Check for network latency issues

### Low Cache Hit Rate

**Problem**: Cache hit rate < 30%

**Solutions:**
1. Use consistent parameters
2. Increase cache duration (if appropriate)
3. Schedule regular automated analysis
4. Focus on popular trading pairs

### High Failure Rate

**Problem**: Success rate < 70%

**Solutions:**
1. Review error logs for specific failures
2. Verify exchange connectivity
3. Check data quality
4. Validate agent configuration
5. Review market conditions (extreme volatility)

---

## Best Practices

1. **Monitor Regularly**
   - Check metrics daily
   - Set up alerts for anomalies
   - Track trends over time

2. **Optimize Proactively**
   - Address slow execution before it impacts trading
   - Improve cache hit rates continuously
   - Keep agents updated

3. **Understand Context**
   - Cache misses are normal for new requests
   - Temporary slowdowns can be due to exchange issues
   - Market volatility affects success rates

4. **Document Changes**
   - Track performance before/after configuration changes
   - Record optimization efforts
   - Share learnings with team

---

## Metrics API Response Format

For developers integrating with the API, here's the metrics structure:

```json
{
  "ok": true,
  "executionTime": 247,
  "cached": true,
  "metadata": {
    "cacheKey": "agent:technical:BTCUSDT:1h",
    "timestamp": "2026-01-31T12:00:00Z"
  },
  "metrics": {
    "totalSignals": 600,
    "successfulSignals": 524,
    "winRate": 87.3,
    "averageConfidence": 76.4,
    "profitFactor": 2.34,
    "sharpeRatio": 1.87,
    "maxDrawdown": 12.4
  },
  "historicalPerformance": [
    {
      "timestamp": "2026-01-31T11:50:00Z",
      "executionTime": 312,
      "cached": false,
      "success": true
    }
  ]
}
```

---

## References

- [TitanGold Agent Documentation](./AGENT_DEVELOPMENT.md)
- [Caching Strategy Guide](./CACHE_STRATEGY.md)
- [Performance Tuning Guide](./PERFORMANCE_TUNING.md)

---

**Last Updated:** 2026-01-31  
**Task:** FRONTEND-011 - Add Agent Performance Metrics to UI  
**Status:** Complete
