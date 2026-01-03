# Arbitrage Scanner Backend Endpoint Plan

## Endpoint: POST /api/ai-agents/:id/scan-arbitrage

### Request:
```json
{
  "exchanges": ["mexc"],
  "symbols": ["BTCUSDT", "ETHUSDT"],
  "minSpreadPct": 0.2,
  "scanMode": "spot" // or "triangular" or "spot-perp"
}
```

### Response:
```json
{
  "ok": true,
  "scan": {
    "timestamp": "2026-01-03T...",
    "opportunities": [
      {
        "id": "uuid",
        "type": "triangular",
        "exchange": "mexc",
        "symbols": ["BTC/USDT", "ETH/USDT", "ETH/BTC"],
        "expectedProfitBps": 25,
        "netProfitUSDT": 12.50,
        "riskScore": 45,
        "notionalUSDT": 5000,
        "executionTimeMs": 120
      }
    ],
    "exchangesChecked": ["mexc"],
    "symbolsChecked": ["BTCUSDT", "ETHUSDT"],
    "avgRiskScore": 45,
    "netProfitPotentialUSDT": 12.50
  }
}
```

### Implementation Steps:
1. Create MEXC proxy endpoints
2. Implement scan logic in backend
3. Store results in ai_decisions table
4. Return real-time opportunities

