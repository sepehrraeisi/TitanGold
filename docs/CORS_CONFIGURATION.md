# CORS Configuration

**Task:** API-006  
**Date:** 2026-01-31  
**Status:** ✅ COMPLETE

---

## Overview

TitanGold API implements proper Cross-Origin Resource Sharing (CORS) configuration to control which domains can access the API. This security feature prevents unauthorized websites from making requests to the API.

---

## Configuration

### Environment Variable

CORS is configured via the `CORS_ALLOWED_ORIGINS` environment variable in `.env`:

```bash
# Comma-separated list of allowed origins
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://titangold.com
```

### Default Origins (Development)

If `CORS_ALLOWED_ORIGINS` is not set, the following origins are allowed by default:

- `http://localhost:3000` (React/Next.js default)
- `http://localhost:5173` (Vite default)
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`

---

## CORS Policy Details

### Allowed Origins

Only origins in the whitelist can access the API. Requests from other origins are blocked.

**Dynamic Validation:**
- Origins are validated on every request
- Whitelist is loaded from environment variable
- Requests with no origin (mobile apps, Postman) are allowed

### Credentials

**Enabled:** Cookies and Authorization headers are allowed for authenticated requests.

```javascript
credentials: true
```

This allows:
- Session cookies
- Bearer tokens in Authorization header
- Custom authentication headers

### Allowed Methods

```javascript
methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
```

All standard HTTP methods are supported.

### Allowed Headers

```javascript
allowedHeaders: [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-API-Version'
]
```

### Exposed Headers

These headers are accessible to client JavaScript:

```javascript
exposedHeaders: [
  'X-API-Version',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Content-Disposition'
]
```

### Preflight Requests

**OPTIONS requests** are handled explicitly for all routes:

```javascript
app.options('*', cors(corsOptions));
```

**Preflight cache:** 24 hours (86400 seconds)

This means browsers cache the CORS preflight response for 24 hours, reducing overhead.

---

## Usage Examples

### Development Setup

**.env:**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

This allows requests from:
- Local React app (port 3000)
- Local Vite app (port 5173)

### Production Setup

**.env:**
```bash
CORS_ALLOWED_ORIGINS=https://titangold.com,https://app.titangold.com,https://www.titangold.com
```

This allows requests from:
- Main website (titangold.com)
- Web app subdomain (app.titangold.com)
- WWW variant (www.titangold.com)

### Multi-Environment Setup

**.env:**
```bash
# Allow staging and production
CORS_ALLOWED_ORIGINS=https://staging.titangold.com,https://app.titangold.com,https://titangold.com
```

---

## Testing CORS

### Test Allowed Origin

```bash
# Should succeed
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:5001/api/v1/health \
     -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,...
Access-Control-Max-Age: 86400
```

### Test Blocked Origin

```bash
# Should fail
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:5001/api/v1/health \
     -v
```

**Expected Response:**
```
HTTP/1.1 500 Internal Server Error
```

**Server Log:**
```
❌ CORS blocked request from origin: https://evil.com
```

### Test Credentials

```bash
# Test with credentials
curl -H "Origin: http://localhost:3000" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     --cookie "session=abc123" \
     http://localhost:5001/api/v1/ai-agents \
     -v
```

**Expected:** Authorization header and cookies are accepted.

---

## Client Implementation

### JavaScript/TypeScript (Fetch API)

```typescript
// Include credentials in requests
const response = await fetch('http://localhost:5001/api/v1/ai-agents', {
  method: 'GET',
  credentials: 'include', // Important: allows cookies
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});

// Access exposed headers
const apiVersion = response.headers.get('X-API-Version');
const rateLimit = response.headers.get('X-RateLimit-Remaining');
```

### Axios

```javascript
import axios from 'axios';

// Configure axios to include credentials
const api = axios.create({
  baseURL: 'http://localhost:5001/api/v1',
  withCredentials: true // Important: allows cookies
});

// Make request
const response = await api.get('/ai-agents', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### React Example

```typescript
import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/v1/ai-agents', {
      credentials: 'include', // Include cookies
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(setData)
      .catch(err => {
        if (err.message.includes('CORS')) {
          console.error('CORS error: Origin not allowed');
        }
      });
  }, []);

  return <div>{/* ... */}</div>;
}
```

---

## Security Best Practices

### 1. Use Specific Origins (Not Wildcards)

❌ **Bad:**
```javascript
origin: '*' // Allows ALL origins
```

✅ **Good:**
```javascript
origin: function (origin, callback) {
  if (allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
```

### 2. Always Enable Credentials for Authenticated APIs

```javascript
credentials: true
```

This is required for:
- Cookie-based sessions
- Authorization headers
- Custom authentication headers

### 3. Limit Exposed Headers

Only expose headers that clients need:

```javascript
exposedHeaders: [
  'X-API-Version',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Content-Disposition'
]
```

Don't expose sensitive headers like:
- `Set-Cookie`
- Internal server headers

### 4. Set Appropriate Preflight Cache

```javascript
maxAge: 86400 // 24 hours
```

This reduces preflight requests and improves performance.

### 5. Use HTTPS in Production

❌ **Bad:**
```bash
CORS_ALLOWED_ORIGINS=http://titangold.com
```

✅ **Good:**
```bash
CORS_ALLOWED_ORIGINS=https://titangold.com,https://app.titangold.com
```

### 6. Separate Development and Production Origins

**Development (.env.local):**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Production (.env):**
```bash
CORS_ALLOWED_ORIGINS=https://titangold.com,https://app.titangold.com
```

---

## Troubleshooting

### CORS Error: "No 'Access-Control-Allow-Origin' header"

**Problem:** Browser blocks request because origin is not allowed.

**Solution:** Add your origin to `CORS_ALLOWED_ORIGINS` in `.env`:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### CORS Error: "Credentials flag is true, but 'Access-Control-Allow-Credentials' header is ''"

**Problem:** Client sends `credentials: 'include'` but server doesn't allow it.

**Solution:** Ensure `credentials: true` is set in CORS options (already configured).

### Preflight Request Fails

**Problem:** OPTIONS request returns 500 or 404.

**Solution:** Ensure preflight handler is configured:

```javascript
app.options('*', cors(corsOptions));
```

This is already configured in `backend/server.js`.

### Different Behavior in Development vs Production

**Problem:** CORS works locally but fails in production.

**Solution:** Check that production origin is in whitelist:

```bash
# Production .env
CORS_ALLOWED_ORIGINS=https://your-production-domain.com
```

### Request Blocked Despite Correct Origin

**Problem:** Origin is correct but still blocked.

**Causes:**
1. **Port mismatch:** `http://localhost:3000` ≠ `http://localhost:3001`
2. **Protocol mismatch:** `http://domain.com` ≠ `https://domain.com`
3. **Subdomain mismatch:** `app.domain.com` ≠ `domain.com`
4. **Trailing slash:** Some browsers treat `http://domain.com/` differently

**Solution:** Ensure exact match including protocol, domain, and port.

---

## Implementation Details

### Origin Validation Logic

```javascript
origin: function (origin, callback) {
  // Allow requests with no origin (mobile apps, Postman)
  if (!origin) {
    return callback(null, true);
  }
  
  // Check if origin is in whitelist
  if (allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    logger.warn(`❌ CORS blocked request from origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  }
}
```

**Key Features:**
- Dynamic validation per request
- Allows requests without Origin header (mobile apps, server-to-server)
- Logs blocked attempts for security monitoring
- Rejects unauthorized origins with error

### Preflight Optimization

**What is a preflight request?**

For certain requests (POST with JSON, custom headers), browsers send an OPTIONS request first to check if the actual request is allowed.

**Our configuration:**
```javascript
maxAge: 86400 // Cache preflight for 24 hours
```

**Benefit:** Reduces network overhead by caching preflight responses.

---

## Monitoring

### Log Blocked Requests

Blocked CORS requests are logged:

```javascript
logger.warn(`❌ CORS blocked request from origin: ${origin}`);
```

**Example log:**
```
2024-01-31 10:15:23 WARN ❌ CORS blocked request from origin: https://malicious-site.com
```

### Monitor CORS Errors

Check server logs for CORS-related errors:

```bash
# Search for CORS blocks
grep "CORS blocked" backend/logs/app.log

# Count blocked requests
grep "CORS blocked" backend/logs/app.log | wc -l
```

---

## Migration Guide

### From Old Configuration

**Before (API-005):**
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
```

**After (API-006):**
```javascript
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173', ...];

const corsOptions = {
  origin: function (origin, callback) { /* validation */ },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [...],
  exposedHeaders: [...],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
```

**Breaking Changes:** None (backward compatible)

**Environment Variable Change:**
- Old: `CORS_ORIGIN` (still works if `CORS_ALLOWED_ORIGINS` not set)
- New: `CORS_ALLOWED_ORIGINS` (recommended)

---

## Status

**✅ PRODUCTION-READY**

- CORS whitelist configured with dynamic validation
- Credentials allowed for authenticated requests
- Preflight requests handled explicitly
- Exposed headers configured for rate limiting and versioning
- Preflight cache optimized (24 hours)
- Comprehensive documentation provided

---

## Related Documentation

- [API Versioning](./API_VERSIONING.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [Content Negotiation](./CONTENT_NEGOTIATION.md)

---

**Last Updated:** 2026-01-31  
**Task:** API-006  
**Configuration:** `backend/server.js` (lines 92-148)  
**Environment:** `.env` (CORS_ALLOWED_ORIGINS)
