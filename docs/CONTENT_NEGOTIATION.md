# API Content Negotiation & Export Formats

**Task:** API-005  
**Date:** 2026-01-31  
**Status:** ✅ COMPLETE

---

## Overview

TitanGold API supports multiple response formats via content negotiation. Clients can request data in JSON (default) or CSV format for easy export and analysis.

---

## Supported Formats

### 1. JSON (Default)
**Content-Type:** `application/json`

Standard format for all API responses. Used for programmatic access and UI display.

**Example Request:**
```bash
curl -H "Accept: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -X POST https://api.titangold.com/api/v1/ai-agents/:id/run \
     -d '{"symbol": "BTCUSDT", "timeframe": "1h"}'
```

**Example Response:**
```json
{
  "ok": true,
  "agent_key": "technical",
  "signal": "BUY",
  "confidence": 85,
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "indicators": [
    {
      "indicatorId": "RSI",
      "value": 65,
      "signal": "buy",
      "weight": 70
    },
    {
      "indicatorId": "MACD",
      "value": 0.5,
      "signal": "buy",
      "weight": 80
    }
  ],
  "timestamp": "2024-01-31T09:00:00Z"
}
```

### 2. CSV (Export)
**Content-Type:** `text/csv`

Tabular format for data export, spreadsheet analysis, and archival. Automatically triggers file download in browsers.

**Example Request:**
```bash
curl -H "Accept: text/csv" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -X POST https://api.titangold.com/api/v1/ai-agents/:id/run \
     -d '{"symbol": "BTCUSDT", "timeframe": "1h"}' \
     -o agent-result.csv
```

**Example Response:**
```csv
# TitanGold Agent Analysis Export
# Agent: technical
# Timestamp: 2024-01-31T09:00:00Z
# Symbol: BTCUSDT
# Timeframe: 1h

## Summary
Metric,Value
Signal,"BUY"
Confidence,85

## Indicators
Indicator ID,Value,Signal,Weight
RSI,65,"buy",70
MACD,0.5,"buy",80

## Reasoning
"Strong bullish momentum with high volume support"
```

---

## Usage Examples

### JavaScript/TypeScript

```typescript
// JSON format (default)
const jsonResponse = await fetch('/api/v1/ai-agents/:id/run', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ symbol: 'BTCUSDT', timeframe: '1h' })
});

const data = await jsonResponse.json();
console.log(data.signal, data.confidence);

// CSV format (export)
const csvResponse = await fetch('/api/v1/ai-agents/:id/run', {
  method: 'POST',
  headers: {
    'Accept': 'text/csv',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ symbol: 'BTCUSDT', timeframe: '1h' })
});

const csvData = await csvResponse.text();
// Download as file
const blob = new Blob([csvData], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'agent-result.csv';
a.click();
```

### Python

```python
import requests

# JSON format (default)
response = requests.post(
    'https://api.titangold.com/api/v1/ai-agents/:id/run',
    headers={
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}'
    },
    json={'symbol': 'BTCUSDT', 'timeframe': '1h'}
)

data = response.json()
print(f"Signal: {data['signal']}, Confidence: {data['confidence']}")

# CSV format (export)
csv_response = requests.post(
    'https://api.titangold.com/api/v1/ai-agents/:id/run',
    headers={
        'Accept': 'text/csv',
        'Authorization': f'Bearer {token}'
    },
    json={'symbol': 'BTCUSDT', 'timeframe': '1h'}
)

# Save to file
with open('agent-result.csv', 'w') as f:
    f.write(csv_response.text)

# Or process with pandas
import pandas as pd
import io

# Skip comment lines and find data sections
lines = csv_response.text.split('\n')
for i, line in enumerate(lines):
    if line.startswith('Indicator ID,'):
        # Found indicators section
        indicators_start = i
        break

# Read indicators as DataFrame
df = pd.read_csv(io.StringIO('\n'.join(lines[indicators_start:])))
print(df)
```

### cURL

```bash
# JSON format (default)
curl -H "Accept: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST https://api.titangold.com/api/v1/ai-agents/:id/run \
     -d '{"symbol": "BTCUSDT", "timeframe": "1h"}'

# CSV format (export to file)
curl -H "Accept: text/csv" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST https://api.titangold.com/api/v1/ai-agents/:id/run \
     -d '{"symbol": "BTCUSDT", "timeframe": "1h"}' \
     -o agent-result-$(date +%s).csv
```

---

## CSV Format Specification

### General Structure

CSV exports use a hierarchical structure with comment headers and data sections:

1. **Header Section** (lines starting with `#`)
   - Agent metadata
   - Analysis timestamp
   - Symbol and timeframe

2. **Summary Section** (`## Summary`)
   - Signal (BUY/SELL/NEUTRAL)
   - Confidence score (0-100)
   - Optional: Accuracy, Price Target

3. **Indicators Section** (`## Indicators`)
   - Indicator ID
   - Value
   - Signal (buy/sell/neutral)
   - Weight (importance score)

4. **Reasoning Section** (`## Reasoning`)
   - Text explanation of the analysis

5. **Metadata Section** (`## Metadata`)
   - Source (real/mock)
   - Version
   - Execution time

### Agent-Specific Sections

#### Arbitrage Agent

```csv
## Arbitrage Opportunities
Exchange Pair,Profit BPS,Volume USDT,Buy Price,Sell Price,Type
"Binance→Coinbase",15,10000,50000,50075,"spot"
```

#### Fundamental Agent

```csv
## Fundamental Scores
Category,Score
"total",75
"macro",80
"funding",70
"onchain",75
"news",72
```

### CSV Field Escaping

- Fields containing commas, quotes, or newlines are enclosed in double quotes
- Double quotes within fields are escaped as `""`
- Example: `"This ""quote"" is escaped"`

---

## Endpoints Supporting CSV Export

| Endpoint | Method | Supports CSV |
|----------|--------|--------------|
| `/api/v1/ai-agents/:id/run` | POST | ✅ Yes |
| `/api/v1/ai-agents/:id/run-v2` | POST | ✅ Yes |
| `/api/v1/ai-agents` | GET | ❌ No (list format) |
| `/api/v1/ai-agents/:id/details` | GET | 🔜 Future |

---

## Response Headers

### JSON Response Headers
```http
Content-Type: application/json
X-API-Version: 1
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706698800
```

### CSV Response Headers
```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="agent-result-1706698800.csv"
X-API-Version: 1
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706698800
```

---

## Best Practices

### 1. Use JSON for Real-Time Applications
- Lower overhead
- Easier parsing
- Better for programmatic access
- Ideal for UI/dashboard integration

### 2. Use CSV for Data Analysis
- Excel/Sheets compatibility
- Easy archival
- Batch processing
- Historical analysis
- Regulatory compliance

### 3. Content Negotiation
Always specify the `Accept` header explicitly:
```javascript
// Good
headers: { 'Accept': 'text/csv' }

// Avoid relying on defaults
headers: {} // Defaults to JSON, but be explicit
```

### 4. File Naming Convention
When saving CSV exports, use descriptive filenames:
```javascript
const filename = `${agentKey}-${symbol}-${timeframe}-${timestamp}.csv`;
// Example: technical-BTCUSDT-1h-1706698800.csv
```

### 5. Handling Large Exports
For large datasets, use streaming:
```javascript
const response = await fetch(url, { headers: { 'Accept': 'text/csv' } });
const reader = response.body.getReader();
const decoder = new TextDecoder();

let csv = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  csv += decoder.decode(value, { stream: true });
}
```

---

## Error Handling

### Unsupported Format
If a format is not supported, the API returns JSON with an error:

```json
{
  "ok": false,
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "Requested format not supported for this endpoint"
  }
}
```

### Conversion Errors
If CSV conversion fails, a minimal CSV is returned:

```csv
Error converting data to CSV
```

Check server logs for details.

---

## Implementation Details

### Middleware
Content negotiation is implemented via the `contentNegotiation` middleware:

```javascript
import { contentNegotiation } from '../middleware/contentNegotiation.js';

router.post('/:id/run', 
  authenticate, 
  contentNegotiation(['json', 'csv']),  // Enable CSV export
  rateLimit({ limit: 15, windowMs: 60000 }), 
  handler
);
```

### Manual Conversion
For custom CSV generation:

```javascript
import { toCSV } from '../middleware/contentNegotiation.js';

const csv = toCSV(agentResult, agentKey);
res.set('Content-Type', 'text/csv');
res.send(csv);
```

---

## Testing

### Unit Tests
```bash
# Run content negotiation tests
npm test -- backend/__tests__/middleware/contentNegotiation.test.js
```

### Integration Tests
```bash
# Test CSV export from agent run
curl -H "Accept: text/csv" \
     -H "Authorization: Bearer $TOKEN" \
     -X POST http://localhost:5001/api/v1/ai-agents/:id/run \
     -d '{"symbol": "BTCUSDT"}' \
     | head -20
```

---

## Status

**✅ PRODUCTION-READY**

- Content negotiation middleware implemented
- CSV export for agent results
- Unit tests: 24 passing
- Documentation complete
- API routes updated

---

## Related Documentation

- [API Versioning](./API_VERSIONING.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [OpenAPI Documentation](./OPENAPI_DOCUMENTATION.md)

---

**Last Updated:** 2026-01-31  
**Task:** API-005  
**Middleware:** `backend/middleware/contentNegotiation.js`  
**Tests:** `backend/__tests__/middleware/contentNegotiation.test.js`
