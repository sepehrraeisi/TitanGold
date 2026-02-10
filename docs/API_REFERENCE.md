# TitanGold API Reference

**Version**: 1.0  
**Base URL**: `/api/v1`  
**Last Updated**: 2026-02-08

## Table of Contents
- [Authentication](#authentication)
- [Data Sources](#data-sources)
- [Data Categories](#data-categories)
- [Collected Data](#collected-data)

---

## Authentication

All API endpoints (except `/health`) require authentication using JWT Bearer tokens.

**Header Format:**
```http
Authorization: Bearer <your-jwt-token>
```

### Get Authentication Token
See [OPENAPI_DOCUMENTATION.md](./OPENAPI_DOCUMENTATION.md) for authentication endpoints.

---

## Data Sources

Manage external data sources for the Data Hub.

### List Data Sources
```http
GET /api/v1/data-sources
```

**Query Parameters:**
- `limit` (integer, optional): Number of results per page (1-100, default: 10)
- `offset` (integer, optional): Number of results to skip (≥0, default: 0)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Example API",
      "type": "api",
      "url": "https://api.example.com",
      "category_id": "uuid",
      "is_active": true,
      "priority": 1,
      "created_at": "2026-02-08T12:00:00.000Z",
      "updated_at": "2026-02-08T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

> **Note**: Soft-deleted sources (where `is_active = false`) are **excluded** from this list by default.

---

### Create Data Source
```http
POST /api/v1/data-sources
```

**Request Body:**
```json
{
  "name": "Example API",
  "type": "api",
  "url": "https://api.example.com",
  "category_id": "uuid",
  "is_active": true,
  "priority": 1,
  "config": {},
  "credentials": {
    "api_key": "secret"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "Example API",
  "type": "api",
  "url": "https://api.example.com",
  "category_id": "uuid",
  "is_active": true,
  "priority": 1,
  "created_at": "2026-02-08T12:00:00.000Z",
  "updated_at": "2026-02-08T12:00:00.000Z"
}
```

> **Security**: Credentials are automatically encrypted before storage.

---

### Update Data Source
```http
PUT /api/v1/data-sources/:id
```

**Request Body:**
```json
{
  "name": "Updated API Name",
  "url": "https://api.updated.com",
  "is_active": true,
  "priority": 2
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Updated API Name",
  "url": "https://api.updated.com",
  "is_active": true,
  "priority": 2,
  "updated_at": "2026-02-08T12:30:00.000Z"
}
```

---

### Delete Data Source

The DELETE endpoint supports two modes: **soft delete** (default) and **hard delete**.

#### Soft Delete (Default)
```http
DELETE /api/v1/data-sources/:id
```

**Behavior:**
- Sets `is_active = false` on the data source
- Record remains in database
- Excluded from GET /api/v1/data-sources lists
- Can be restored using the restore endpoint
- Automatically purged after 30 days (configurable)

**Response (204 No Content)**

**Example:**
```bash
curl -X DELETE http://localhost:5002/api/v1/data-sources/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

#### Hard Delete (Permanent)
```http
DELETE /api/v1/data-sources/:id?permanent=true
```

**Behavior:**
- **Permanently** removes the data source from database
- **Cannot be undone**
- All associated data remains intact (collected_data, logs)

**Query Parameters:**
- `permanent` (boolean, optional): Set to `true` for permanent deletion

**Response (204 No Content)**

**Example:**
```bash
curl -X DELETE "http://localhost:5002/api/v1/data-sources/123e4567-e89b-12d3-a456-426614174000?permanent=true" \
  -H "Authorization: Bearer <token>"
```

**Error Responses:**
- `404 Not Found`: Data source doesn't exist
- `400 Bad Request`: Invalid UUID format
- `401 Unauthorized`: Missing or invalid authentication token

> **⚠️ Warning**: Hard deletes are permanent and cannot be undone. Use with caution.

---

### Restore Soft-Deleted Data Source
```http
PATCH /api/v1/data-sources/:id/restore
```

**Behavior:**
- Sets `is_active = true` on a soft-deleted data source
- Makes the source visible in GET lists again
- Only works on soft-deleted sources

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Restored API",
  "is_active": true,
  "updated_at": "2026-02-08T13:00:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Data source doesn't exist
- `400 Bad Request`: Source is already active (not soft-deleted)
- `401 Unauthorized`: Missing or invalid authentication token

**Example:**
```bash
curl -X PATCH http://localhost:5002/api/v1/data-sources/123e4567-e89b-12d3-a456-426614174000/restore \
  -H "Authorization: Bearer <token>"
```

---

## Data Categories

Organize data sources into categories.

### List Categories
```http
GET /api/v1/data-categories
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "Market Data",
    "description": "Real-time market data sources",
    "color": "#3B82F6",
    "icon": "chart-line",
    "created_at": "2026-02-08T12:00:00.000Z"
  }
]
```

### Create Category
```http
POST /api/v1/data-categories
```

**Request Body:**
```json
{
  "name": "Market Data",
  "description": "Real-time market data sources",
  "color": "#3B82F6",
  "icon": "chart-line"
}
```

**Response (201 Created)**

---

## Collected Data

Access and filter collected data from all sources.

### List Collected Data
```http
GET /api/v1/data-sources/collected
```

**Query Parameters:**
- `limit` (integer, optional): Results per page (1-100, default: 10)
- `offset` (integer, optional): Results to skip (≥0, default: 0)
- `status` (string, optional): Filter by status (`pending`, `processed`, `error`)
- `source_id` (UUID, optional): Filter by data source ID
- `start_date` (ISO 8601, optional): Filter by collection date (inclusive)
- `end_date` (ISO 8601, optional): Filter by collection date (inclusive)

**Validation Rules:**
- `limit` must be between 1 and 100
- `offset` must be ≥ 0
- `status` must be one of: `pending`, `processed`, `error`
- `start_date` and `end_date` must be valid ISO 8601 dates
- `end_date` must be after `start_date`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "source_id": "uuid",
      "raw_data": {"key": "value"},
      "status": "processed",
      "collected_at": "2026-02-08T12:00:00.000Z",
      "created_at": "2026-02-08T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

**Example Requests:**

Filter by status:
```bash
curl "http://localhost:5002/api/v1/data-sources/collected?status=processed" \
  -H "Authorization: Bearer <token>"
```

Filter by date range:
```bash
curl "http://localhost:5002/api/v1/data-sources/collected?start_date=2026-02-01T00:00:00Z&end_date=2026-02-08T23:59:59Z" \
  -H "Authorization: Bearer <token>"
```

Filter by source:
```bash
curl "http://localhost:5002/api/v1/data-sources/collected?source_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters (e.g., limit > 100, invalid date format, end_date before start_date)
- `401 Unauthorized`: Missing or invalid authentication token

---

### Get Single Collected Data Record
```http
GET /api/v1/data-sources/collected/:id
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "source_id": "uuid",
  "raw_data": {"key": "value"},
  "status": "processed",
  "collected_at": "2026-02-08T12:00:00.000Z",
  "created_at": "2026-02-08T12:00:00.000Z",
  "source": {
    "id": "uuid",
    "name": "Example API",
    "type": "api"
  }
}
```

**Error Responses:**
- `404 Not Found`: Record doesn't exist
- `400 Bad Request`: Invalid UUID format
- `401 Unauthorized`: Missing or invalid authentication token

---

## Error Responses

All endpoints return consistent error responses:

### Validation Error (400)
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "limit",
        "message": "Number must be less than or equal to 100",
        "code": "too_big",
        "location": "query"
      }
    ]
  }
}
```

### Authentication Error (401)
```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Not Found Error (404)
```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

---

## Rate Limiting

All API endpoints are rate-limited. See [RATE_LIMITING.md](./RATE_LIMITING.md) for details.

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704638400
```

---

## Interactive Documentation

For interactive API exploration and testing, visit:
```
http://localhost:5002/api/docs
```

See [OPENAPI_DOCUMENTATION.md](./OPENAPI_DOCUMENTATION.md) for more information.

---

**Last Updated**: 2026-02-08  
**Maintainer**: TitanGold Backend Team
