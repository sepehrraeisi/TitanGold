# API Rate Limiting

**Task:** API-004  
**Date:** 2026-01-07  
**Status:** ✅ COMPLETE

---

## Overview

All TitanGold API endpoints are protected by rate limiting to ensure fair usage and system stability. Rate limit information is included in response headers for every request.

---

## Rate Limit Headers

Every API response includes the following rate limit headers:

### `X-RateLimit-Limit`

**Description:** Maximum number of requests allowed in the current time window.

**Type:** Integer

**Example:**
```http
X-RateLimit-Limit: 100
```

### `X-RateLimit-Remaining`

**Description:** Number of requests remaining in the current time window.

**Type:** Integer (0 or greater)

**Example:**
```http
X-RateLimit-Remaining: 95
```

**Note:** When this reaches `0`, the next request will be rate limited (HTTP 429).

### `X-RateLimit-Reset`

**Description:** Unix timestamp (in seconds) when the rate limit window will reset.

**Type:** Integer (Unix timestamp in seconds)

**Example:**
```http
X-RateLimit-Reset: 1704638400
```

**Convert to human-readable time:**
```javascript
const resetTime = new Date(resetTimestamp * 1000);
console.log(resetTime.toISOString());
// "2024-01-07T12:00:00.000Z"
```

---

## Complete Response Example

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-API-Version: 1
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704638400

{
  "ok": true,
  "data": { ... }
}
```

---

## Rate Limit Exceeded (HTTP 429)

When you exceed the rate limit, the API returns HTTP 429 with rate limit information in both headers and body:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704638400

{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Max 100 requests per 60s",
    "details": {
      "limit": 100,
      "windowSeconds": 60,
      "resetAt": "2024-01-07T12:00:00.000Z"
    }
  }
}
```

---

## Rate Limit Configuration

### Default Limits

| Endpoint Type | Requests | Time Window |
|--------------|----------|-------------|
| Authentication | 5 | 60 seconds |
| General API | 100 | 60 seconds |
| Market Data | 200 | 60 seconds |
| Trading | 50 | 60 seconds |

### Environment Variables

Rate limits can be configured via environment variables:

```bash
# Maximum requests per window
RATE_LIMIT_MAX=100

# Time window in milliseconds
RATE_LIMIT_WINDOW_MS=60000
```

---

## Client Implementation

### JavaScript/TypeScript

```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  resetDate: Date;
}

async function fetchWithRateLimit(url: string): Promise<Response> {
  const response = await fetch(url);
  
  // Extract rate limit headers
  const rateLimit: RateLimitInfo = {
    limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0'),
    remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
    reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0'),
    resetDate: new Date(
      parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000
    ),
  };
  
  console.log('Rate Limit Info:', rateLimit);
  
  // Check if approaching limit
  if (rateLimit.remaining < 10) {
    console.warn(`⚠️ Approaching rate limit: ${rateLimit.remaining} requests remaining`);
  }
  
  // Handle rate limit exceeded
  if (response.status === 429) {
    const waitTime = rateLimit.resetDate.getTime() - Date.now();
    console.error(`❌ Rate limited. Retry after ${Math.ceil(waitTime / 1000)}s`);
    throw new Error(`Rate limited. Retry after ${rateLimit.resetDate.toISOString()}`);
  }
  
  return response;
}
```

### Python

```python
import time
from datetime import datetime
import requests

class RateLimitError(Exception):
    def __init__(self, reset_at):
        self.reset_at = reset_at
        super().__init__(f"Rate limited. Retry after {reset_at}")

def fetch_with_rate_limit(url):
    response = requests.get(url)
    
    # Extract rate limit headers
    rate_limit = {
        'limit': int(response.headers.get('X-RateLimit-Limit', 0)),
        'remaining': int(response.headers.get('X-RateLimit-Remaining', 0)),
        'reset': int(response.headers.get('X-RateLimit-Reset', 0)),
    }
    
    print(f"Rate Limit: {rate_limit['remaining']}/{rate_limit['limit']}")
    
    # Check if approaching limit
    if rate_limit['remaining'] < 10:
        print(f"⚠️ Approaching rate limit: {rate_limit['remaining']} requests remaining")
    
    # Handle rate limit exceeded
    if response.status_code == 429:
        reset_time = datetime.fromtimestamp(rate_limit['reset'])
        wait_seconds = (reset_time - datetime.now()).total_seconds()
        print(f"❌ Rate limited. Retry after {wait_seconds:.0f}s")
        raise RateLimitError(reset_time)
    
    return response
```

### cURL

```bash
# Make request and show headers
curl -i https://api.titangold.com/api/v1/trades

# Extract rate limit headers
curl -s -D - https://api.titangold.com/api/v1/trades | grep -i "X-RateLimit"
```

**Output:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704638400
```

---

## Best Practices

### 1. Monitor Rate Limit Headers

Always check the `X-RateLimit-Remaining` header to avoid hitting the limit:

```javascript
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Approaching rate limit, slow down requests');
}
```

### 2. Implement Exponential Backoff

When rate limited, wait before retrying:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const resetTime = error.headers.get('X-RateLimit-Reset');
        const waitTime = (resetTime * 1000) - Date.now();
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### 3. Cache Responses

Reduce API calls by caching responses:

```javascript
const cache = new Map();

async function fetchWithCache(url, ttl = 60000) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

### 4. Use Batch Endpoints

When available, use batch endpoints to reduce request count:

```javascript
// Instead of multiple requests
const trades1 = await fetch('/api/v1/trades/1');
const trades2 = await fetch('/api/v1/trades/2');
const trades3 = await fetch('/api/v1/trades/3');

// Use batch endpoint
const trades = await fetch('/api/v1/trades/batch?ids=1,2,3');
```

### 5. Respect Rate Limits

Calculate time until reset and pause requests:

```javascript
function getTimeUntilReset(resetTimestamp) {
  const now = Math.floor(Date.now() / 1000);
  const secondsUntilReset = resetTimestamp - now;
  return Math.max(0, secondsUntilReset);
}

// Before making request
const resetTime = response.headers.get('X-RateLimit-Reset');
if (response.headers.get('X-RateLimit-Remaining') === '0') {
  const waitTime = getTimeUntilReset(parseInt(resetTime));
  console.log(`Waiting ${waitTime}s for rate limit reset`);
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
}
```

---

## Rate Limit by User vs IP

Rate limits are applied based on:

1. **Authenticated Users:** Rate limit per user ID (recommended)
2. **Unauthenticated Requests:** Rate limit per IP address

**Recommendation:** Always authenticate to get individual rate limits instead of sharing IP-based limits.

---

## Testing Rate Limits

### Test Rate Limit Headers

```bash
# Check headers are present
curl -i http://localhost:5001/api/v1/health | grep X-RateLimit

# Expected output:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1704638400
```

### Test Rate Limit Enforcement

```bash
# Exceed rate limit with rapid requests
for i in {1..105}; do
  curl -s http://localhost:5001/api/v1/health > /dev/null
  echo "Request $i"
done

# Request 101+ should return 429
```

### Automated Test

```javascript
describe('Rate Limiting', () => {
  it('should include rate limit headers in response', async () => {
    const response = await request(app).get('/api/v1/health');
    
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
    
    expect(parseInt(response.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
    expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    expect(parseInt(response.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
  });
  
  it('should return 429 when rate limit exceeded', async () => {
    // Make requests until rate limited
    const limit = 100;
    for (let i = 0; i <= limit; i++) {
      const response = await request(app).get('/api/v1/health');
      
      if (response.status === 429) {
        expect(response.body.error.code).toBe('RATE_LIMITED');
        expect(response.headers['x-ratelimit-remaining']).toBe('0');
        return;
      }
    }
  });
});
```

---

## Troubleshooting

### Rate Limit Headers Not Showing

**Problem:** Headers missing from response

**Causes:**
1. Rate limiter middleware not applied to route
2. Redis connection failed (fail-open mode)
3. Middleware error

**Solution:** Check middleware configuration in `backend/server.js`

### Rate Limit Too Restrictive

**Problem:** Hitting rate limit too quickly

**Solutions:**
1. Increase `RATE_LIMIT_MAX` environment variable
2. Increase `RATE_LIMIT_WINDOW_MS` environment variable
3. Implement request caching
4. Use batch endpoints
5. Authenticate to get individual rate limits

### Rate Limit Reset Time Incorrect

**Problem:** Reset time in the past or far future

**Cause:** Server time synchronization issue

**Solution:** Ensure server time is synchronized with NTP

### Different Limits Per Endpoint

**Problem:** Some endpoints have different limits

**Explanation:** Different endpoint types have different rate limits:
- Auth endpoints: Stricter limits (5/min)
- Trading endpoints: Moderate limits (50/min)
- Market data: Higher limits (200/min)

---

## Implementation Details

### Redis-backed Rate Limiting

Rate limits use Redis sorted sets for distributed rate limiting across multiple server instances:

```javascript
// Key format: ratelimit:{userId or IP}
// Sorted set with timestamp as score
// Sliding window algorithm
```

### Fallback to In-Memory

If Redis is unavailable, the system falls back to in-memory rate limiting:
- Rate limits enforced per server instance
- Not shared across instances
- Automatic when Redis connection fails

---

## Status

**✅ PRODUCTION-READY**

- Rate limit headers added to all API responses
- Three standard headers: Limit, Remaining, Reset
- Updated on every request
- Works with both Redis and in-memory backends
- Comprehensive documentation provided

---

## Related Documentation

- [API Versioning](./API_VERSIONING.md)
- [OpenAPI Documentation](./OPENAPI_DOCUMENTATION.md)
- [Backend API Inventory](./BACKEND_API_INVENTORY.md)

---

**Last Updated:** 2026-01-07  
**Task:** API-004  
**Middleware:** `backend/middleware/rateLimit.js`
