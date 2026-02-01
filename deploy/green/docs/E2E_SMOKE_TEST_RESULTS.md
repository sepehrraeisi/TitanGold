# TitanGold E2E Smoke Tests

**Date**: 2025-12-27 14:04:28 UTC
**Server**: http://localhost:5002

---

## Test 1: Health Endpoint

### Request:
```bash
curl -s http://localhost:5002/api/health
```

### Response:
```json
{
  "status": "ok",
  "service": "titan-backend",
  "timestamp": "2025-12-27T14:04:28.089Z",
  "version": "1.0.0",
  "commit": "f10dbd7",
  "uptime": 30.718802566,
  "memory": {
    "used": 593,
    "total": 625,
    "unit": "MB"
  },
  "node": "v20.19.5",
  "env": "production"
}
```

**Status Code**: 200
**Result**: ✅ PASS

---

## Test 2: Ready Endpoint (DB Check)

### Request:
```bash
curl -s http://localhost:5002/api/ready
```

### Response:
```json
{
  "status": "ok",
  "service": "titan-backend",
  "timestamp": "2025-12-27T14:04:28.362Z",
  "version": "1.0.0",
  "commit": "f10dbd7",
  "uptime": 30.991069714,
  "memory": {
    "used": 403,
    "total": 517,
    "unit": "MB"
  },
  "node": "v20.19.5",
  "env": "production"
}
```

**Status Code**: 200
**Result**: ✅ PASS

---

## Test 3: Artemis Logs (Protected Endpoint)

### Request:
```bash
curl -s http://localhost:5002/api/artemis/logs
```

### Response:
```json
{
  "error": "No token provided"
}
```

**Status Code**: 401
**Result**: ✅ PASS (Authentication required)

---

## Test 4: DataHub Stats (Protected Endpoint)

### Request:
```bash
curl -s http://localhost:5002/api/data-sources/stats
```

### Response:
```json
{
  "error": "No token provided"
}
```

**Status Code**: 401
**Result**: ✅ PASS (Authentication required)

---

## Test 5: Scenarios List (Protected Endpoint)

### Request:
```bash
curl -s http://localhost:5002/api/scenarios
```

### Response:
```json
{
  "error": "No token provided"
}
```

**Status Code**: 401
**Result**: ✅ PASS (Authentication required)

---

## Test 6: Backtest Results (Protected Endpoint)

### Request:
```bash
curl -s http://localhost:5002/api/backtest/results
```

### Response:
```json
{
  "error": "No token provided"
}
```

**Status Code**: 401
**Result**: ✅ PASS (Authentication required)

---

## Test 7: Health Status Detailed

### Request:
```bash
curl -s http://localhost:5002/api/health/status
```

### Response:
```json
{
  "service": "titan-backend",
  "timestamp": "2025-12-27T14:04:29.035Z",
  "version": "1.0.0",
  "commit": "f10dbd7",
  "uptime": 32,
  "memory": {
    "rss": 720670720,
    "heapTotal": 561909760,
    "heapUsed": 499845168,
    "external": 36338409,
    "arrayBuffers": 32774426
  },
  "cpu": {
    "user": 25326752,
    "system": 3105195
  },
  "node": "v20.19.5",
  "env": "production",
  "pid": 984239,
  "database": {
    "users": "4",
    "connections": "0",
    "favorites": "3",
    "alerts": "0"
  }
}
```

**Status Code**: 200
**Result**: ✅ PASS

---

## Test Summary

| Test | Endpoint | Expected | Actual | Result |
|------|----------|----------|--------|--------|
| 1 | GET /api/health | 200 | 200 | ✅ |
| 2 | GET /api/ready | 200 | 200 | ✅ |
| 3 | GET /api/artemis/logs | 401 | 401 | ✅ |
| 4 | GET /api/data-sources/stats | 401 | 401 | ✅ |
| 5 | GET /api/scenarios | 401 | 401 | ✅ |
| 6 | GET /api/backtest/results | 401 | 401 | ✅ |
| 7 | GET /api/health/status | 200 | 200 | ✅ |

**Total**: 7 passed, 0 failed out of 7 tests

**Overall Result**: ✅ ALL TESTS PASSED
