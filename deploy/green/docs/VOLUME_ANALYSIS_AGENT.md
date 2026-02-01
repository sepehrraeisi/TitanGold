# Volume Analysis Agent

**BACKEND-013: Implement Volume Analysis Agent**

## Overview

The Volume Analysis Agent provides comprehensive volume-based technical analysis for cryptocurrency trading. It calculates key volume indicators, detects anomalies, and generates trading signals based on volume patterns.

## Features

### 1. On-Balance Volume (OBV)
- **Calculation**: Cumulative volume flow tracking based on price direction
- **Divergence Detection**: Identifies bullish/bearish divergences between price and volume
- **Trend Analysis**: Determines if volume is accumulating (bullish) or distributing (bearish)
- **Signal Generation**: Provides actionable signals based on OBV patterns

### 2. Volume Weighted Average Price (VWAP)
- **Calculation**: Volume-weighted average price - institutional benchmark
- **Position Analysis**: Determines if price is above/below/at VWAP
- **Deviation Tracking**: Measures percentage deviation from VWAP
- **Signal Generation**: Identifies potential mean reversion opportunities

### 3. Volume Profile
- **Price Distribution**: Shows volume distribution across price levels
- **Point of Control (POC)**: Identifies price level with highest volume
- **Value Area**: Calculates range containing 70% of volume
- **Position Analysis**: Determines if current price is above/below/in value area

### 4. Volume Spike Detection
- **Anomaly Detection**: Identifies unusual volume activity (>2x average)
- **Severity Classification**: Classifies spikes as medium/high severity
- **Direction Analysis**: Determines if spikes are bullish/bearish/neutral
- **Pressure Calculation**: Measures buying vs selling pressure

### 5. Trading Signals
- **Multi-Indicator Signals**: Combines all volume indicators
- **Confidence Scoring**: 0-100 confidence score for recommendations
- **Signal Rationale**: Detailed reasoning for each signal
- **Overall Recommendation**: BUY/SELL/HOLD with supporting evidence

## API Reference

### Main Agent Function

```javascript
import { run } from './services/agents/volume.js';

const result = await run({
  userId: 'user-123',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  config: {
    dataLimit: 100,        // Number of candles to analyze
    profileBins: 20,       // Volume profile resolution
    spikeThreshold: 2.0,   // Volume spike threshold (2x = 200%)
    useCache: true         // Enable result caching
  }
});
```

**Parameters:**
- `userId` (string): User identifier
- `symbol` (string): Trading pair (e.g., 'BTC/USDT', 'ETH/USDT')
- `timeframe` (string): Candle timeframe ('1h', '4h', '1d', etc.)
- `config` (object): Optional configuration
  - `dataLimit` (number): Number of candles to fetch (default: 100)
  - `profileBins` (number): Volume profile bins (default: 20)
  - `spikeThreshold` (number): Spike detection threshold (default: 2.0)
  - `useCache` (boolean): Enable caching (default: true)

**Return Value:**

```javascript
{
  agent_key: 'volume',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  
  // On-Balance Volume
  obv: {
    current: 125000,        // Current OBV value
    trend: 'up',            // up/down/flat
    divergence: {
      type: 'bullish',      // bullish/bearish/none
      strength: 'strong'    // strong/medium/weak
    },
    signal: {
      type: 'bullish',
      reason: 'OBV trending up - accumulation',
      strength: 'medium'
    }
  },
  
  // VWAP
  vwap: {
    current: 50125.50,      // Current VWAP
    currentPrice: 50200.00, // Current price
    position: 'above',      // above/below/at
    deviation: 0.15,        // % deviation
    signal: {
      type: 'bullish',
      reason: 'Price above VWAP - bullish momentum',
      strength: 'weak'
    }
  },
  
  // Volume Profile
  volume_profile: {
    pointOfControl: {
      price: 50100.00,      // POC price level
      volume: 15000         // Volume at POC
    },
    valueAreaHigh: 50300.00,
    valueAreaLow: 49900.00,
    currentPrice: 50200.00,
    position: 'in_value',   // above_value/below_value/in_value
    nearPOC: false,
    topLevels: [            // Top 5 volume levels
      { price: 50100, volume: 15000, trades: 245 },
      { price: 50200, volume: 14500, trades: 238 },
      // ...
    ]
  },
  
  // Volume Spikes
  volume_spikes: {
    avgVolume: 1000,        // Average volume
    currentVolume: 2500,    // Current volume
    volumeRatio: 2.5,       // Current/average ratio
    isSpike: true,          // Spike detected
    recentSpikes: 2,        // Spikes in last 10 candles
    totalSpikes: 5,         // Total spikes
    volumeTrend: 'increasing', // increasing/decreasing/stable
    buyingPressure: 15000,  // Buy volume
    sellingPressure: 8000   // Sell volume
  },
  
  // Trading Recommendation
  trading_recommendation: {
    action: 'BUY',          // BUY/SELL/HOLD
    confidence: 75,         // 0-100
    signals: [
      {
        indicator: 'OBV',
        signal: 'BUY',
        reason: 'OBV trending up - accumulation',
        strength: 'medium'
      },
      // ... more signals
    ],
    summary: {
      buySignals: 4,
      sellSignals: 1,
      neutralSignals: 0,
      totalSignals: 5
    }
  },
  
  // Human-readable summary
  summary: "Volume Analysis for BTC/USDT\n\n...",
  
  // Metadata
  metadata: {
    dataPoints: 100,
    executionTime: 250,
    cacheKey: 'BTC/USDT_1h',
    timestamp: '2026-01-07T14:00:00Z',
    agent_version: '1.0.0'
  },
  
  timestamp: '2026-01-07T14:00:00Z'
}
```

## Volume Indicators Explained

### On-Balance Volume (OBV)

**Theory:**
OBV is a momentum indicator that uses volume flow to predict changes in price. It's based on the principle that volume precedes price.

**Calculation:**
- If close > previous close: OBV = Previous OBV + Volume
- If close < previous close: OBV = Previous OBV - Volume
- If close = previous close: OBV = Previous OBV

**Interpretation:**
- **Rising OBV**: Buying pressure, potential uptrend
- **Falling OBV**: Selling pressure, potential downtrend
- **Divergence**: When OBV and price move in opposite directions, signaling potential reversal

**Trading Signals:**
- Bullish: OBV rising while price consolidates
- Bearish: OBV falling while price rises
- Confirmation: OBV confirms price trend

### Volume Weighted Average Price (VWAP)

**Theory:**
VWAP represents the average price a security has traded at throughout the day, based on both volume and price. Institutional traders use VWAP as a benchmark.

**Calculation:**
```
VWAP = Σ(Typical Price × Volume) / Σ(Volume)
Typical Price = (High + Low + Close) / 3
```

**Interpretation:**
- **Price above VWAP**: Bullish sentiment, buyers in control
- **Price below VWAP**: Bearish sentiment, sellers in control
- **Large deviation**: Mean reversion opportunity

**Trading Signals:**
- Buy: Price touches VWAP from above (support)
- Sell: Price touches VWAP from below (resistance)
- Breakout: Strong move away from VWAP

### Volume Profile

**Theory:**
Volume Profile displays trading activity over specified price levels, showing where the most volume has been traded.

**Key Levels:**
- **Point of Control (POC)**: Price level with highest volume - acts as magnet
- **Value Area**: Range containing 70% of volume - fair value zone
- **High/Low Volume Nodes**: Support and resistance levels

**Interpretation:**
- Price gravitates toward POC
- Value Area defines fair value
- Prices outside Value Area are considered "unfair" and tend to revert

**Trading Signals:**
- Buy: Price below Value Area Low (oversold)
- Sell: Price above Value Area High (overbought)
- Consolidation: Price near POC

### Volume Spike Detection

**Theory:**
Unusual volume spikes indicate significant market interest and often precede major price moves.

**Detection:**
- Compare current volume to rolling average
- Threshold: typically 2x-3x average
- Classify severity and direction

**Interpretation:**
- **Bullish Spike**: High volume on up move - strong buying
- **Bearish Spike**: High volume on down move - strong selling
- **Climax Volume**: Extreme volume may signal exhaustion

**Trading Signals:**
- Follow the spike: Momentum continuation
- Fade the spike: Reversal play (advanced)

## Usage Examples

### Basic Analysis

```javascript
import { run } from './services/agents/volume.js';

// Simple analysis with defaults
const analysis = await run({
  userId: 'user-123',
  symbol: 'BTC/USDT',
  timeframe: '1h'
});

console.log('Signal:', analysis.trading_recommendation.action);
console.log('Confidence:', analysis.trading_recommendation.confidence);
console.log('\nSummary:\n', analysis.summary);
```

### Custom Configuration

```javascript
// High-resolution volume profile
const highRes = await run({
  userId: 'user-123',
  symbol: 'ETH/USDT',
  timeframe: '4h',
  config: {
    dataLimit: 200,      // More data
    profileBins: 50,     // Higher resolution
    spikeThreshold: 2.5, // Stricter spike detection
    useCache: false      // Fresh data
  }
});
```

### Integration with Trading System

```javascript
import { run } from './services/agents/volume.js';

async function volumeBasedTrading(userId, symbol) {
  const analysis = await run({ userId, symbol, timeframe: '1h' });
  
  // Check volume confirmation
  const hasVolumeSpike = analysis.volume_spikes.isSpike;
  const obvTrend = analysis.obv.trend;
  const action = analysis.trading_recommendation.action;
  const confidence = analysis.trading_recommendation.confidence;
  
  if (confidence >= 70 && hasVolumeSpike && action === 'BUY') {
    console.log(`🚀 Strong BUY signal with volume confirmation`);
    console.log(`OBV Trend: ${obvTrend}`);
    console.log(`Volume Ratio: ${analysis.volume_spikes.volumeRatio.toFixed(2)}x`);
    
    // Place order logic here
    return { action: 'BUY', size: 'full' };
  }
  
  if (confidence >= 60 && action !== 'HOLD') {
    console.log(`⚠️ Moderate ${action} signal`);
    return { action, size: 'partial' };
  }
  
  console.log(`⏸️ No action - confidence too low (${confidence})`);
  return { action: 'HOLD', size: 0 };
}
```

## Performance

- **Average Execution**: 100-300ms
- **Cache TTL**: 5 minutes
- **Data Requirements**: Minimum 20 candles, recommended 100+
- **Memory Usage**: ~5MB per analysis (100 candles)

## Testing

### Unit Tests
```bash
# Run volume analyzer tests
npm test -- __tests__/services/volumeAnalyzer.test.js --coverage

# Expected: 33 tests, >95% coverage
```

### Integration Tests
```bash
# Run volume agent tests
npm test -- __tests__/integration/volumeAgent.test.js

# Expected: 39 tests, full workflow coverage
```

## Troubleshooting

### Low Confidence Scores
- **Cause**: Mixed signals from indicators
- **Solution**: Wait for clearer market conditions or reduce position size

### No Volume Spikes Detected
- **Cause**: Threshold too high or low volume market
- **Solution**: Adjust `spikeThreshold` config (try 1.5-2.5 range)

### VWAP Always Shows Neutral
- **Cause**: Price staying close to VWAP
- **Solution**: This is normal in ranging markets, look for breakouts

### Volume Profile POC Not Meaningful
- **Cause**: Too few bins or choppy price action
- **Solution**: Increase `profileBins` (30-50) or use longer timeframe

## Best Practices

1. **Combine with Price Action**: Volume confirms price, use together
2. **Multiple Timeframes**: Check 1h, 4h, and 1d for confluence
3. **Wait for Confirmation**: High volume + clear signal = better trades
4. **Respect Value Area**: Prices outside value area tend to revert
5. **Watch for Divergences**: OBV divergence is powerful reversal signal

## Limitations

1. **Volume Quality**: Crypto volume can be manipulated (wash trading)
2. **Exchange-Specific**: Volume varies significantly between exchanges
3. **Lagging Indicator**: OBV and VWAP lag price action
4. **False Signals**: Volume spikes don't guarantee price follow-through
5. **Market Conditions**: Works best in trending markets, less effective in choppy conditions

## References

- Technical Analysis of Financial Markets by John Murphy
- Trading Volume: An Explanation by Richard Arms
- Market Profile by J. Peter Steidlmayer

## Related Agents

- **BACKEND-009**: Trend Detection Agent (trend confirmation)
- **BACKEND-006**: Pattern Recognition Agent (chart patterns)
- **BACKEND-007**: Price Prediction Agent (price targets)
- **BACKEND-011**: Order Management Agent (execution)

## License

Copyright © 2026 TitanGold. All rights reserved.
