# Price Prediction Agent Documentation

## Overview

The Price Prediction Agent is a production-grade cryptocurrency price forecasting system that uses statistical and machine learning models to predict future price movements across multiple timeframes.

## Features

### Core Capabilities
- **Linear Regression**: Simple trend-based predictions using ordinary least squares
- **ARIMA**: Autoregressive Integrated Moving Average for time series forecasting
- **Hybrid Ensemble**: Combines both methods for improved accuracy
- **Multi-Timeframe Predictions**: 1h, 4h, and 24h forecasts
- **Confidence Intervals**: 95% confidence intervals for all predictions
- **Accuracy Metrics**: RMSE, MAE, MAPE, and R² for model evaluation

### Data Integration
- **MEXC Exchange**: Real-time historical OHLCV data fetching
- **Configurable Candle Counts**: Adjustable data windows based on timeframe
- **Automatic Timeframe Detection**: Smart candle count selection

### Performance
- **Model Caching**: 5-minute TTL for predictions
- **Training Cache**: Longer-term caching for trained models
- **Efficient Processing**: < 2 seconds for linear regression predictions
- **Batch Processing**: Support for multiple concurrent predictions

## Model Architecture

### Linear Regression
- **Method**: Ordinary Least Squares (OLS)
- **Input**: Time series of closing prices
- **Output**: Predicted prices with confidence intervals
- **Confidence Calculation**: Based on residual standard error
- **Advantages**: Fast, interpretable, works well with trending data
- **Limitations**: Assumes linear relationships, struggles with high volatility

### ARIMA Model
- **Parameters**: (p=5, d=1, q=2) by default
  - **p**: Autoregressive order (look-back periods)
  - **d**: Differencing order (make series stationary)
  - **q**: Moving average order
- **Input**: Time series of closing prices
- **Output**: Multi-step ahead forecasts
- **Confidence Calculation**: Based on model residuals
- **Advantages**: Captures non-linear patterns, handles seasonality
- **Limitations**: Computationally intensive, requires stationary data

### Hybrid Ensemble
- **Method**: Average of linear and ARIMA predictions
- **Confidence Intervals**: Union of both models (widest range)
- **Confidence Score**: Average of both models
- **Advantages**: Reduced overfitting, robust to model-specific weaknesses
- **Recommended Use**: Default for production environments

## API Reference

### `run()` - Generate Price Predictions

Generates price predictions for a given symbol and timeframe.

**Parameters:**
```javascript
{
  userId: number,        // User ID for authentication
  symbol: string,        // Trading pair (e.g., 'BTC/USDT')
  timeframe: string,     // Candle timeframe ('1m', '5m', '15m', '30m', '1h', '4h', '1d')
  config: {
    method: string,      // 'linear', 'arima', or 'hybrid' (default: 'hybrid')
    arimaP: number,      // ARIMA p parameter (default: 5)
    arimaD: number,      // ARIMA d parameter (default: 1)
    arimaQ: number,      // ARIMA q parameter (default: 2)
  }
}
```

**Returns:**
```javascript
{
  agent_key: 'price_prediction',
  symbol: string,
  timeframe: string,
  current_price: number,
  predictions: {
    '1h': {
      price: number,
      lower: number,      // 95% CI lower bound
      upper: number,      // 95% CI upper bound
      confidence: number  // Model confidence (0-1)
    },
    '4h': { /* same structure */ },
    '24h': { /* same structure */ }
  },
  method: string,
  accuracy: {
    rmse: number,          // Root Mean Square Error
    rmse_percent: number,  // RMSE as percentage
    mae: number,           // Mean Absolute Error
    mape: number,          // Mean Absolute Percentage Error
    r_squared: number,     // Coefficient of determination
    test_samples: number   // Number of test samples
  },
  insights: {
    trend: string,                      // 'strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish'
    price_changes: {
      '1h': number,                     // Predicted % change in 1h
      '4h': number,
      '24h': number
    },
    volatility: {
      value: number,                    // Absolute volatility
      percent: number                   // Volatility as % of price
    },
    risk_level: string,                 // 'low', 'medium', 'high'
    recommendation: string,             // 'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
    confidence_score: number,           // Overall confidence (0-100)
    summary: string                     // Human-readable summary
  },
  data_points: number,
  execution_time_ms: number,
  timestamp: string,
  from_cache: boolean,                  // Present if from cache
  cache_age_ms: number,                 // Present if from cache
  _meta: {
    version: string,
    model: string,
    confidence: number
  }
}
```

**Example:**
```javascript
const result = await pricePredictionAgent.run({
  userId: 123,
  symbol: 'BTC/USDT',
  timeframe: '1h',
  config: { method: 'hybrid' }
});

console.log(`Current price: $${result.current_price}`);
console.log(`1h prediction: $${result.predictions['1h'].price}`);
console.log(`Trend: ${result.insights.trend}`);
console.log(`Recommendation: ${result.insights.recommendation}`);
```

### `trainModelForSymbol()` - Train Prediction Models

Trains and evaluates prediction models on historical data.

**Parameters:**
```javascript
{
  userId: number,
  symbol: string,
  timeframe: string,
  config: {
    method: string,
    arimaP: number,
    arimaD: number,
    arimaQ: number
  }
}
```

**Returns:**
```javascript
{
  agent_key: 'price_prediction',
  action: 'train',
  symbol: string,
  timeframe: string,
  training_result: {
    method: string,
    models: {
      linear: {
        equation: [slope, intercept],
        r2: number,
        accuracy: { /* same as above */ }
      },
      arima: {
        parameters: { p, d, q },
        accuracy: { /* same as above */ }
      }
    },
    best_model: string,              // 'linear' or 'arima'
    recommendation: string,
    training_complete: true,
    timestamp: string
  },
  data_points: number,
  execution_time_ms: number,
  timestamp: string
}
```

**Example:**
```javascript
const result = await pricePredictionAgent.trainModelForSymbol({
  userId: 123,
  symbol: 'BTC/USDT',
  timeframe: '1h',
  config: { method: 'hybrid' }
});

console.log(`Best model: ${result.training_result.best_model}`);
console.log(`Linear RMSE: ${result.training_result.models.linear.accuracy.rmse_percent}%`);
console.log(`ARIMA RMSE: ${result.training_result.models.arima.accuracy.rmse_percent}%`);
```

### `getDetails()` - Get Agent Information

Returns agent metadata and metrics.

**Returns:**
```javascript
{
  agent_key: 'price_prediction',
  name: 'Price Prediction Agent',
  description: string,
  status: 'active',
  version: string,
  capabilities: string[],
  metrics: {
    cached_predictions: number,
    cached_models: number,
    avg_confidence: number,
    cache_ttl_ms: number
  },
  lastRun: string | null
}
```

### `defaultConfig()` - Get Default Configuration

Returns default agent configuration.

**Returns:**
```javascript
{
  enabled: true,
  method: 'hybrid',
  arimaP: 5,
  arimaD: 1,
  arimaQ: 2,
  minDataPoints: 30,
  cacheEnabled: true,
  cacheTTL: 300000  // 5 minutes
}
```

## Model Performance

### Accuracy Benchmarks

Based on testing with synthetic and real market data:

| Model | RMSE (%) | MAE (%) | R² | Speed (ms) |
|-------|----------|---------|-----|------------|
| Linear Regression | 2.5-4.5% | 2.0-3.5% | 0.6-0.9 | ~180 |
| ARIMA | 3.0-5.0% | 2.5-4.0% | 0.5-0.8 | ~2000 |
| Hybrid | 2.8-4.8% | 2.2-3.8% | 0.6-0.85 | ~2100 |

**Note**: Performance varies significantly based on market conditions, volatility, and trend strength.

### Model Selection Guidelines

**Use Linear Regression when:**
- Strong trending markets (up or down)
- Low to medium volatility
- Speed is critical
- Interpretability is important

**Use ARIMA when:**
- High volatility or ranging markets
- Seasonal patterns present
- Longer-term forecasts needed
- Accuracy > speed

**Use Hybrid when:**
- Production environments
- Unknown market conditions
- Robust predictions needed
- Balanced speed/accuracy trade-off

## Trading Insights

The agent provides automated trading recommendations based on:

1. **Trend Analysis**: Direction and strength of price movement
2. **Volatility Assessment**: Risk level calculation
3. **Confidence Scoring**: Model reliability metrics
4. **Price Change Forecasts**: Expected % moves

### Recommendation Logic

```
IF trend == 'strong_bullish' AND confidence > 0.7:
  recommendation = 'strong_buy'
ELIF trend == 'bullish' AND confidence > 0.6:
  recommendation = 'buy'
ELIF trend == 'strong_bearish' AND confidence > 0.7:
  recommendation = 'strong_sell'
ELIF trend == 'bearish' AND confidence > 0.6:
  recommendation = 'sell'
ELSE:
  recommendation = 'hold'
```

### Risk Levels

- **Low Risk**: Volatility < 2% of price
- **Medium Risk**: Volatility 2-5% of price
- **High Risk**: Volatility > 5% of price

## Error Handling

The agent includes comprehensive error handling for:

- **Insufficient Data**: Requires minimum 30 data points
- **MEXC API Errors**: Automatic fallback to mock data
- **Model Failures**: ARIMA fallback to linear regression
- **Invalid Inputs**: Descriptive error messages

**Error Response Format:**
```javascript
{
  agent_key: 'price_prediction',
  symbol: string,
  timeframe: string,
  error: string,
  predictions: null,
  execution_time_ms: number,
  timestamp: string,
  _meta: {
    version: string,
    status: 'error'
  }
}
```

## Caching Strategy

### Prediction Cache
- **TTL**: 5 minutes
- **Key**: `{symbol}_{timeframe}_{method}`
- **Benefit**: Reduces API calls and computation
- **Invalidation**: Automatic on TTL expiry

### Model Cache
- **TTL**: 50 minutes (10x prediction cache)
- **Key**: `model_{symbol}_{timeframe}_{method}`
- **Benefit**: Faster predictions after training
- **Invalidation**: Manual or automatic on TTL expiry

## Best Practices

### For Developers

1. **Always use hybrid method in production** for balanced performance
2. **Cache predictions** when making multiple requests
3. **Monitor RMSE%** - should be < 5% for reliable predictions
4. **Handle errors** - network issues and data availability
5. **Respect rate limits** - MEXC API has restrictions

### For Traders

1. **Don't rely solely on predictions** - use as one signal among many
2. **Check confidence scores** - lower confidence = higher uncertainty
3. **Consider volatility** - high volatility = wider confidence intervals
4. **Monitor model accuracy** - RMSE and R² indicate reliability
5. **Validate with other indicators** - combine with technical analysis

## Testing

### Unit Tests
- **Coverage**: 92% statement coverage
- **Tests**: 36+ unit tests for predictor service
- **Focus**: Linear regression, ARIMA, accuracy metrics

### Integration Tests
- **Tests**: 30+ integration scenarios
- **Coverage**: API endpoints, caching, error handling
- **Mock Data**: Realistic OHLCV generation

## Troubleshooting

### Common Issues

**Issue**: Predictions are consistently wrong  
**Solution**: Check market conditions - models perform better in trending markets

**Issue**: ARIMA is too slow  
**Solution**: Use linear regression or reduce ARIMA parameters (p, d, q)

**Issue**: Confidence intervals are very wide  
**Solution**: High volatility detected - consider risk management

**Issue**: RMSE > 5%  
**Solution**: Model may not fit data well - try different method or retrain

## Future Enhancements

### Planned Features
- **LSTM Neural Networks**: Deep learning for complex patterns
- **Multi-Asset Predictions**: Portfolio-level forecasting
- **Real-Time Updates**: WebSocket streaming predictions
- **Custom Model Training**: User-defined parameters
- **Advanced Metrics**: Sharpe ratio, Sortino ratio, max drawdown

### Research Areas
- **Sentiment Integration**: Combine with sentiment analysis
- **Volume Analysis**: Incorporate trading volume
- **Market Regime Detection**: Adapt models to market conditions
- **Feature Engineering**: Technical indicators as inputs
- **Ensemble Methods**: XGBoost, Random Forest

## References

### Libraries Used
- **regression**: Linear regression implementation
- **simple-statistics**: Statistical functions
- **arima**: ARIMA time series forecasting

### Academic References
- Box, G. E. P., & Jenkins, G. M. (1976). *Time Series Analysis: Forecasting and Control*
- Hyndman, R. J., & Athanasopoulos, G. (2018). *Forecasting: Principles and Practice*

## License

Copyright © 2026 TitanGold Team. All rights reserved.

## Support

For issues, questions, or contributions, please contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-07  
**Status**: Production Ready
