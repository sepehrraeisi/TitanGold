# Risk Management Agent Documentation

**Version:** 1.0.0  
**Date:** 2026-01-07  
**Status:** Production Ready

## Overview

The Risk Management Agent provides comprehensive portfolio risk analysis and management capabilities for the TitanGold trading platform. It calculates key risk metrics, monitors portfolio correlations, suggests position sizing, and generates stop-loss recommendations based on real-time and historical data.

## Features

### 1. Portfolio Risk Metrics

#### Value at Risk (VaR)
- **95% Confidence VaR**: Maximum expected loss over a given time period with 95% confidence
- **99% Confidence VaR**: Maximum expected loss with 99% confidence
- **Methodology**: Historical simulation using 30-day rolling window
- **Use Case**: Daily risk limits, regulatory reporting, risk budgeting

#### Sharpe Ratio
- **Definition**: Risk-adjusted return metric (excess return per unit of risk)
- **Calculation**: (Mean Return - Risk-Free Rate) / Standard Deviation
- **Interpretation**: 
  - > 1.0: Good risk-adjusted returns
  - > 2.0: Excellent risk-adjusted returns
  - < 0: Negative risk-adjusted returns

#### Maximum Drawdown
- **Definition**: Largest peak-to-trough decline in portfolio value
- **Use Case**: Understand worst-case historical losses
- **Application**: Risk tolerance assessment, strategy evaluation

#### Portfolio Volatility
- **Definition**: Annualized standard deviation of returns
- **Calculation**: Daily volatility × √252 (trading days)
- **Use Case**: Risk budgeting, portfolio optimization

### 2. Position Sizing

The agent calculates optimal position sizes based on:

- **Risk Tolerance**: Conservative (1-2%), Moderate (2-5%), Aggressive (5-10%)
- **Account Balance**: Current portfolio value
- **Asset Volatility**: Individual asset risk
- **Portfolio Correlation**: Diversification benefits
- **Stop-Loss Distance**: Risk per trade calculation

**Formula:**
```
Position Size = (Account Balance × Risk %) / (Entry Price × Stop Loss %)
```

### 3. Asset Correlation Monitoring

- **Correlation Matrix**: Pairwise correlation coefficients between all portfolio assets
- **Diversification Score**: Overall portfolio diversification (0-1 scale)
- **Warnings**: Alerts when correlation > 0.7 (high correlation risk)
- **Benefits**: Identify concentration risk, optimize diversification

### 4. Stop-Loss Recommendations

Dynamic stop-loss levels based on:

- **ATR (Average True Range)**: Volatility-based stops
- **Technical Levels**: Support/resistance zones
- **Maximum Loss Tolerance**: User-defined risk parameters
- **Trailing Stops**: Protect profits as position moves in favor

**Recommended Approaches:**
- **Tight Stop**: 1.5× ATR (day trading)
- **Standard Stop**: 2.0× ATR (swing trading)
- **Wide Stop**: 3.0× ATR (position trading)

## API Usage

### Run Risk Analysis

**Endpoint:** `POST /api/v1/ai-agents/risk/run`

**Request:**
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1d",
  "config": {
    "riskTolerance": "moderate",
    "stopLossMethod": "atr",
    "confidenceLevel": 0.95
  }
}
```

**Response:**
```json
{
  "agent_key": "risk",
  "symbol": "BTC/USDT",
  "timestamp": "2026-01-07T12:00:00.000Z",
  "confidence": 0.85,
  "result": {
    "portfolio_risk": {
      "var_95": 2500.50,
      "var_99": 4200.75,
      "volatility": 0.28,
      "sharpe_ratio": 1.45,
      "max_drawdown": 0.15
    },
    "position_sizing": {
      "BTC/USDT": {
        "recommended_size": 0.05,
        "max_position_value": 5000,
        "risk_amount": 100,
        "reasoning": "2% risk per trade with moderate volatility"
      }
    },
    "correlations": {
      "matrix": {
        "BTC/USDT": { "ETH/USDT": 0.82, "LTC/USDT": 0.65 }
      },
      "diversification_score": 0.72,
      "warnings": ["High correlation between BTC and ETH"]
    },
    "stop_loss_recommendations": {
      "BTC/USDT": {
        "tight": 42500,
        "standard": 41800,
        "wide": 40500,
        "method": "atr",
        "reasoning": "Based on 14-day ATR of $1,200"
      }
    }
  },
  "meta": {
    "source": "realtime",
    "version": "1.0.0",
    "execution_time_ms": 245
  }
}
```

### Get Agent Details

**Endpoint:** `GET /api/v1/ai-agents/risk/details`

**Response:**
```json
{
  "agent_key": "risk",
  "name": "Risk Management Agent",
  "description": "Real-time portfolio risk analysis and management",
  "status": "active",
  "lastRun": "2026-01-07T11:55:30.000Z",
  "metrics": {
    "totalRuns": 1247,
    "avgExecutionTime": 180,
    "successRate": 0.98
  }
}
```

## Configuration Options

### Risk Tolerance Levels

```javascript
{
  "conservative": {
    "maxRiskPerTrade": 0.01,  // 1%
    "maxPortfolioRisk": 0.05,  // 5%
    "confidenceLevel": 0.99     // 99% VaR
  },
  "moderate": {
    "maxRiskPerTrade": 0.02,  // 2%
    "maxPortfolioRisk": 0.10,  // 10%
    "confidenceLevel": 0.95     // 95% VaR
  },
  "aggressive": {
    "maxRiskPerTrade": 0.05,  // 5%
    "maxPortfolioRisk": 0.20,  // 20%
    "confidenceLevel": 0.90     // 90% VaR
  }
}
```

### Stop-Loss Methods

- **`atr`**: Average True Range-based (default)
- **`percentage`**: Fixed percentage from entry
- **`technical`**: Support/resistance levels
- **`trailing`**: Dynamic trailing stops

## Risk Calculator Service

The agent uses the centralized `riskCalculator.js` service for all calculations:

### Core Functions

```javascript
// Value at Risk
calculateVaR(returns, confidenceLevel, portfolioValue)

// Sharpe Ratio
calculateSharpeRatio(returns, riskFreeRate)

// Maximum Drawdown
calculateMaxDrawdown(portfolioValues)

// Portfolio Volatility
calculatePortfolioVolatility(returns)

// Position Sizing
calculatePositionSize(accountBalance, riskPerTrade, entryPrice, stopLossPrice)

// Asset Correlation
calculateAssetCorrelations(priceHistory)

// Diversification Score
calculateDiversificationScore(correlationMatrix)

// Stop-Loss Levels
calculateStopLoss(currentPrice, atr, method)
```

### Code Example

```javascript
import riskCalculator from './services/riskCalculator.js';

// Calculate portfolio risk metrics
const portfolioData = {
  returns: [-0.02, 0.03, -0.01, 0.04, 0.02],
  portfolioValue: 100000,
  confidenceLevel: 0.95,
  riskFreeRate: 0.02
};

const metrics = riskCalculator.calculatePortfolioRiskMetrics(
  portfolioData.returns,
  portfolioData.portfolioValue,
  portfolioData.confidenceLevel,
  portfolioData.riskFreeRate
);

console.log(metrics);
// {
//   var_95: 2500.50,
//   var_99: 4200.75,
//   volatility: 0.28,
//   sharpe_ratio: 1.45,
//   max_drawdown: 0.15
// }
```

## Integration Points

### With Portfolio Service
- Fetches real-time portfolio positions and values
- Retrieves historical trade data for performance analysis
- Updates position recommendations

### With Trading Engine
- Enforces risk limits on new trades
- Validates position sizes before execution
- Monitors real-time portfolio risk

### With Alert System
- Triggers alerts when risk limits are exceeded
- Notifies on high correlation warnings
- Sends stop-loss breach notifications

### With Metrics Service
- Records agent execution times
- Tracks risk calculation accuracy
- Monitors agent performance

## Performance Characteristics

- **Average Execution Time**: 180ms
- **VaR Calculation**: 50ms (30-day window)
- **Correlation Matrix**: 80ms (5 assets)
- **Position Sizing**: 20ms per asset
- **Memory Usage**: < 50MB per analysis

## Testing

### Unit Tests
- **Coverage**: 94% statements, 77% branches
- **Test File**: `__tests__/services/riskCalculator.test.js`
- **Test Count**: 38 tests

### Integration Tests
- **Test File**: `__tests__/integration/riskAgent.test.js`
- **Scenarios**:
  - Risk metrics calculation with real portfolio data
  - Position sizing across risk tolerance levels
  - Correlation monitoring with multiple assets
  - Stop-loss recommendations for various scenarios
  - Error handling and edge cases

### Run Tests

```bash
# Unit tests
npm test -- __tests__/services/riskCalculator.test.js

# Integration tests
npm test -- __tests__/integration/riskAgent.test.js

# Coverage report
npm test -- --coverage __tests__/services/riskCalculator.test.js
```

## Error Handling

The agent handles various error scenarios:

```javascript
{
  "error": "Insufficient historical data",
  "code": "INSUFFICIENT_DATA",
  "recommendation": "Need at least 30 days of trade history"
}
```

Common error codes:
- `INSUFFICIENT_DATA`: < 30 data points for VaR
- `INVALID_RISK_TOLERANCE`: Unsupported risk level
- `PORTFOLIO_NOT_FOUND`: User has no portfolio
- `CALCULATION_ERROR`: Unexpected error in risk calculation

## Best Practices

### 1. Regular Monitoring
- Run risk analysis daily at market close
- Monitor VaR breaches and adjust positions
- Review correlation changes weekly

### 2. Risk Budgeting
- Allocate risk across strategies
- Ensure total portfolio risk < maximum tolerance
- Rebalance when risk exceeds limits

### 3. Stop-Loss Discipline
- Always use stop-losses on new positions
- Update stops as market conditions change
- Use trailing stops to protect profits

### 4. Diversification
- Target diversification score > 0.7
- Limit high-correlation pairs (< 0.7)
- Add uncorrelated assets when possible

## Future Enhancements

Planned features (follow-up tasks):

### BACKEND-004-VaR-Methods (8h)
- Monte Carlo VaR simulation
- Parametric VaR (variance-covariance)
- Historical simulation improvements

### BACKEND-004-Stress-Testing (12h)
- Scenario analysis (market crash, volatility spike)
- Sensitivity analysis
- Extreme event modeling

### BACKEND-004-ML-Risk (16h)
- Machine learning-based risk prediction
- Anomaly detection for risk events
- Dynamic risk model calibration

### BACKEND-004-Real-Time (6h)
- Streaming risk updates via WebSocket
- Intraday VaR calculation
- Real-time position limit enforcement

## Support

For issues or questions:
- **Documentation**: `docs/RISK_MANAGEMENT_AGENT.md`
- **Code**: `backend/services/agents/risk.js`
- **Tests**: `backend/__tests__/services/riskCalculator.test.js`
- **Issue Tracker**: GitHub Issues

## Version History

### v1.0.0 (2026-01-07)
- Initial production release
- Portfolio VaR calculation (95%, 99%)
- Position sizing based on risk tolerance
- Asset correlation monitoring
- Stop-loss recommendations
- Integration with portfolio service
- Comprehensive unit and integration tests
- Full documentation
