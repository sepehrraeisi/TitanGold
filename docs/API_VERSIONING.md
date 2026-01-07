# API Versioning

**Task:** API-001  
**Date:** 2026-01-07  
**Status:** ✅ COMPLETE

---

## Overview

All TitanGold API endpoints are now versioned with `/api/v1/` prefix. This enables future API evolution without breaking existing clients.

---

## API Version

**Current Version:** `v1`

The API version is included in every response via the `X-API-Version` header.

```http
X-API-Version: 1
```

---

## Endpoint Structure

### Versioned Endpoints (Recommended)

All new clients should use versioned endpoints:

```
/api/v1/{resource}
```

**Examples:**
- `/api/v1/auth/login`
- `/api/v1/users/me`
- `/api/v1/portfolios`
- `/api/v1/ai-agents`
- `/api/v1/trades`

### Legacy Endpoints (Backward Compatible)

For backward compatibility, legacy endpoints without version prefix are automatically redirected:

```
/api/{resource}  →  /api/v1/{resource}
```

**Redirect Behavior:**
- **GET requests:** HTTP 301 (Permanent Redirect) - cacheable
- **POST/PUT/DELETE:** HTTP 308 (Permanent Redirect) - preserves request method
- **Query parameters:** Preserved during redirect

**Examples:**
```http
GET  /api/users          → 301 → /api/v1/users
POST /api/auth/login     → 308 → /api/v1/auth/login
GET  /api/trades?limit=10 → 301 → /api/v1/trades?limit=10
```

### Unversioned Endpoints

Some endpoints remain unversioned for stability:

- `/health` - Health check endpoint
- `/api/docs` - API documentation
- `/api/docs.json` - OpenAPI specification
- `/uploads/*` - Static file uploads

---

## Response Headers

All API responses include the version header:

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-API-Version: 1
...
```

---

## Client Migration Guide

### Step 1: Update Base URL

**Before:**
```javascript
const API_BASE = 'https://api.titangold.com/api';
```

**After:**
```javascript
const API_BASE = 'https://api.titangold.com/api/v1';
```

### Step 2: Update API Calls

**JavaScript/TypeScript:**

```typescript
// Before
fetch('/api/users')

// After
fetch('/api/v1/users')
```

**Axios:**

```javascript
// Before
axios.get('/api/portfolios')

// After
axios.get('/api/v1/portfolios')
```

### Step 3: Check Version Header (Optional)

```javascript
const response = await fetch('/api/v1/users');
const apiVersion = response.headers.get('X-API-Version');
console.log('API Version:', apiVersion); // "1"
```

---

## Migration Timeline

### Phase 1: Soft Launch (Current)
- ✅ All routes support `/api/v1/` prefix
- ✅ Legacy routes redirect to versioned routes
- ✅ No breaking changes
- ✅ All existing clients continue working

### Phase 2: Client Updates (Recommended)
- Update frontend to use `/api/v1/` endpoints
- Update mobile apps
- Update third-party integrations
- Update documentation

### Phase 3: Deprecation Notice (Future)
- Add deprecation warnings to legacy endpoints
- Announce timeline for legacy endpoint removal
- Provide migration support

### Phase 4: Legacy Removal (Future v2)
- Remove automatic redirects
- Legacy endpoints return 410 Gone
- Only versioned endpoints remain

---

## Version Detection

### Check Current Version

```bash
curl -I https://api.titangold.com/api/v1/health
```

```http
HTTP/1.1 200 OK
X-API-Version: 1
...
```

### Programmatic Detection

```javascript
async function getApiVersion() {
  const response = await fetch('/api/v1/health');
  return response.headers.get('X-API-Version');
}
```

---

## Breaking Changes Policy

### Version 1 (Current)
No breaking changes will be introduced to v1 endpoints. All changes will be:
- Additive (new fields, new endpoints)
- Backward compatible
- Optional features

### Version 2 (Future)
When breaking changes are needed:
- New version will be released as `/api/v2/`
- v1 endpoints will remain available
- Deprecation timeline will be announced
- Migration guide will be provided

---

## API Endpoints by Version

### Version 1 (Current)

**Authentication:**
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

**Users:**
- `GET /api/v1/users/me`
- `PUT /api/v1/users/me`
- `GET /api/v1/users/:id`

**Portfolios:**
- `GET /api/v1/portfolios`
- `POST /api/v1/portfolios`
- `GET /api/v1/portfolios/:id`
- `PUT /api/v1/portfolios/:id`
- `DELETE /api/v1/portfolios/:id`

**AI Agents:**
- `GET /api/v1/ai-agents`
- `POST /api/v1/ai-agents/run`
- `GET /api/v1/ai-agents/:id`
- `PUT /api/v1/ai-agents/:id`

**Trades:**
- `GET /api/v1/trades`
- `POST /api/v1/trades`
- `GET /api/v1/trades/:id`

**Market Data:**
- `GET /api/v1/market/symbols`
- `GET /api/v1/market/ticker/:symbol`
- `GET /api/v1/market/candles/:symbol`

*...and many more endpoints*

---

## Frontend Integration

### React/Next.js Example

**Create API Client:**

```typescript
// services/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const API_VERSION = 'v1';

export const api = {
  baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
  
  get: async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(`${api.baseURL}${endpoint}`, {
      ...options,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    return response.json();
  },
  
  post: async (endpoint: string, data?: any, options?: RequestInit) => {
    const response = await fetch(`${api.baseURL}${endpoint}`, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  // ... put, delete methods
};
```

**Usage:**

```typescript
// Get user profile
const user = await api.get('/users/me');

// Create trade
const trade = await api.post('/trades', {
  symbol: 'BTCUSDT',
  side: 'BUY',
  amount: 0.1
});
```

---

## Testing

### Unit Tests

```javascript
describe('API Versioning', () => {
  it('should add X-API-Version header to all responses', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.headers['x-api-version']).toBe('1');
  });
  
  it('should redirect legacy /api/ routes to /api/v1/', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('/api/v1/users');
  });
  
  it('should preserve query parameters in redirect', async () => {
    const response = await request(app).get('/api/trades?limit=10');
    expect(response.headers.location).toBe('/api/v1/trades?limit=10');
  });
});
```

---

## Troubleshooting

### Issue: Double /api/v1/ in URL

**Problem:**
```
/api/v1/api/v1/users
```

**Cause:** Client already includes `/api/v1/` in base URL

**Solution:** Update client base URL to exclude version:
```javascript
// Wrong
const base = '/api/v1';
fetch(`${base}/api/v1/users`);

// Correct
const base = '/api/v1';
fetch(`${base}/users`);
```

### Issue: 301/308 Redirects Causing Issues

**Problem:** Some HTTP clients don't follow redirects automatically

**Solution:** Update to versioned endpoints:
```javascript
// Before
fetch('/api/users')

// After
fetch('/api/v1/users')
```

### Issue: CORS on Redirected Requests

**Problem:** CORS headers missing after redirect

**Solution:** Use versioned endpoints directly to avoid redirect

---

## Implementation Details

### Middleware Order

```javascript
app.use(requestContextMiddleware);
app.use(performanceMiddleware);
app.use(addVersionHeader);        // Add X-API-Version header
app.use(legacyRedirect);           // Redirect /api/* to /api/v1/*
app.use(requestLogger);
// ... other middleware
```

### Files Modified

1. **`backend/server.js`** - Updated routes to use `/api/v1/` prefix
2. **`backend/middleware/apiVersion.js`** - New versioning middleware
3. **`docs/API_VERSIONING.md`** - This documentation

---

## Future Versions

### Planned for v2
- GraphQL endpoint
- Batch request support
- Enhanced filtering and pagination
- Webhook improvements
- Real-time subscriptions

### Backward Compatibility Promise
- v1 endpoints will remain available for at least 12 months after v2 release
- Deprecation warnings will be added 6 months before removal
- Migration guides will be provided

---

## Status

**✅ PRODUCTION-READY**

- All routes versioned with `/api/v1/`
- Legacy redirects functional
- Version header added to all responses
- Documentation complete
- No breaking changes to existing clients

---

**Last Updated:** 2026-01-07  
**Task:** API-001  
**Version:** 1
