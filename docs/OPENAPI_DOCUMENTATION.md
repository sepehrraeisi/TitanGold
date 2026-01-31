# OpenAPI 3.0 Documentation

**Task**: API-003  
**Status**: Complete  
**Last Updated**: 2026-01-07

## Overview

TitanGold API now has comprehensive OpenAPI 3.0.3 documentation auto-generated from code. The documentation is accessible via Swagger UI and provides interactive API exploration.

---

## Accessing the Documentation

### Swagger UI (Interactive)
```
http://localhost:5002/api/docs
```

Features:
- **Interactive API Explorer**: Test endpoints directly from your browser
- **Authentication Support**: Persist JWT tokens for authenticated requests
- **Request/Response Examples**: See sample payloads for all endpoints
- **Try It Out**: Execute API calls and see real responses
- **Filter**: Search and filter endpoints by tags

### OpenAPI JSON Spec
```
http://localhost:5002/api/docs.json
```

Download the raw OpenAPI 3.0.3 specification in JSON format for:
- Import into Postman, Insomnia, or other API clients
- Code generation (client SDKs)
- API testing tools integration
- Custom documentation generation

---

## Documented Endpoints

### Authentication (5 endpoints)
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with credentials
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout and invalidate token
- `GET /api/v1/auth/me` - Get current user profile

### AI Agents (5 endpoints)
- `GET /api/v1/ai-agents` - List AI agents with filters
- `POST /api/v1/ai-agents` - Create new AI agent
- `GET /api/v1/ai-agents/{id}` - Get agent details
- `PUT /api/v1/ai-agents/{id}` - Update agent configuration
- `DELETE /api/v1/ai-agents/{id}` - Delete agent
- `POST /api/v1/ai-agents/{id}/analyze` - Run analysis
- `POST /api/v1/ai-agents/{id}/chat` - Chat with agent

### Portfolios (2 endpoints)
- `GET /api/v1/portfolios` - List portfolios
- `POST /api/v1/portfolios` - Create portfolio

### Trades (2 endpoints)
- `GET /api/v1/trades` - List trades with filters
- `POST /api/v1/trades` - Create trade order

### Users (1 endpoint)
- `GET /api/v1/users` - List users (admin only)

### Health (1 endpoint)
- `GET /health` - API health check

**Total**: 18+ documented endpoints

---

## Key Features

### 1. Request Schema Validation
All request payloads are validated using Zod schemas. The OpenAPI spec reflects these validation rules:
- Required vs optional fields
- Data types and formats
- Min/max lengths
- Enum values
- Pattern matching (regex)

Example from spec:
```json
{
  "email": {
    "type": "string",
    "format": "email",
    "description": "Valid email address"
  }
}
```

### 2. Response Examples
Every endpoint includes:
- Success response schemas (200, 201)
- Error response schemas (400, 401, 403, 404, 500)
- Example values for quick reference

### 3. Authentication Documentation
- JWT Bearer token scheme documented
- Security requirements specified per endpoint
- Token refresh flow explained
- Example Authorization header format

### 4. Comprehensive Descriptions
- API overview and usage guidelines
- Rate limiting information
- Versioning strategy
- Error response formats
- Validation error structure

### 5. Interactive Testing
Swagger UI allows you to:
1. Click "Authorize" button
2. Enter your JWT token
3. Try out any authenticated endpoint
4. See real responses

---

## Using the Documentation

### Step 1: Authenticate
1. Open http://localhost:5002/api/docs
2. Find `POST /api/v1/auth/login` endpoint
3. Click "Try it out"
4. Enter credentials:
   ```json
   {
     "username": "your_username",
     "password": "your_password"
   }
   ```
5. Click "Execute"
6. Copy the `token` from the response
7. Click the "Authorize" button at the top
8. Enter: `Bearer <your-token>`
9. Click "Authorize"

### Step 2: Explore Endpoints
Now you can test any authenticated endpoint:
1. Scroll to any endpoint (e.g., `GET /api/v1/ai-agents`)
2. Click "Try it out"
3. Fill in parameters (if any)
4. Click "Execute"
5. View the response

### Step 3: View Schemas
- Expand any endpoint to see:
  - Request body schema
  - Query parameters
  - Response schemas
  - Examples

---

## Schema Components

The OpenAPI spec defines reusable components:

### Security Schemes
- **bearerAuth**: JWT Bearer token authentication

### Schemas
- **ErrorResponse**: Standard error format
- **ValidationErrorResponse**: Field-level validation errors
- **RegisterRequest**: User registration payload
- **LoginRequest**: Login credentials
- **AuthResponse**: Authentication response with tokens
- **CreateAgentRequest**: AI agent creation
- **AnalyzeRequest**: Analysis request
- **ChatRequest**: Agent chat message
- **CreatePortfolioRequest**: Portfolio creation
- **CreateTradeRequest**: Trade creation

---

## Implementation Details

### Auto-Generation
The OpenAPI spec is **auto-generated from code**:
- Based on Zod validation schemas (from API-002)
- Synchronized with actual validation rules
- No manual maintenance required
- Always reflects current API structure

### Code Location
```
backend/openapi.js - OpenAPI 3.0.3 specification
backend/server.js - Swagger UI setup
backend/schemas/* - Zod schemas (source of truth)
```

### Swagger UI Configuration
```javascript
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'TitanGold API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,  // Remember JWT token
    displayRequestDuration: true, // Show response times
    filter: true,                 // Enable search/filter
    tryItOutEnabled: true,        // Enable "Try it out" by default
  },
}));
```

---

## Validation Error Format

All validation errors follow this structure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address",
        "code": "invalid_string",
        "location": "body"
      },
      {
        "field": "password",
        "message": "String must contain at least 6 character(s)",
        "code": "too_small",
        "location": "body"
      }
    ]
  }
}
```

Field locations:
- `body` - Request body
- `query` - Query parameters
- `params` - URL path parameters

---

## Rate Limiting

API rate limits are documented:
- **Limit**: 100-500 requests per window (configurable via `RATE_LIMIT_MAX`)
- **Window**: 60 seconds (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Scope**: Per authenticated user ID or IP address
- **Headers**: Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704638400
```

For detailed information including client implementation examples, best practices, and troubleshooting, see:

📖 **[Rate Limiting Documentation](./RATE_LIMITING.md)**

Documented in the OpenAPI info section.

---

## Versioning

The API uses URL versioning:
- Current version: **v1**
- Base URL: `/api/v1/*`
- Legacy URLs (`/api/*`) redirect to `/api/v1/*`

This is documented in the description.

---

## External Documentation

The OpenAPI spec includes links to:
- Full documentation: https://docs.titangold.com
- API support email: api@titangold.com

---

## Importing to API Clients

### Postman
1. Open Postman
2. Click "Import"
3. Choose "Link"
4. Enter: `http://localhost:5002/api/docs.json`
5. Click "Import"
6. All endpoints will be available in Postman

### Insomnia
1. Open Insomnia
2. Click "Create" → "Import From" → "URL"
3. Enter: `http://localhost:5002/api/docs.json`
4. Click "Import"

### Curl
```bash
# Download spec
curl http://localhost:5002/api/docs.json > openapi.json

# View endpoint list
cat openapi.json | jq '.paths | keys'

# View specific endpoint
cat openapi.json | jq '.paths["/api/v1/auth/login"]'
```

---

## Generating Client SDKs

Use OpenAPI Generator to create client SDKs:

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:5002/api/docs.json \
  -g typescript-axios \
  -o ./clients/typescript

# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:5002/api/docs.json \
  -g python \
  -o ./clients/python

# Generate Go client
openapi-generator-cli generate \
  -i http://localhost:5002/api/docs.json \
  -g go \
  -o ./clients/go
```

---

## Troubleshooting

### Issue: Swagger UI not loading
**Solution**: Check that server is running on port 5002:
```bash
curl http://localhost:5002/health
```

### Issue: "Authorize" button not working
**Solution**: 
1. Make sure you're using the format: `Bearer <token>`
2. Don't include quotes around the token
3. Copy token from login response

### Issue: Examples not showing
**Solution**: Examples are included in the spec. Refresh the browser or clear cache.

### Issue: Some endpoints missing
**Solution**: This is v1 documentation. Additional endpoints will be added in future updates. Current coverage:
- Authentication: 100%
- AI Agents: 100% (core CRUD + actions)
- Portfolios: 50% (CRUD endpoints, more coming)
- Trades: 50% (CRUD endpoints, more coming)
- Users: 30% (admin endpoints only)

---

## Future Enhancements

### Planned (API-003 Follow-ups)
1. **DOCS-007**: Add remaining endpoint documentation
   - Portfolio management endpoints
   - Trade execution endpoints
   - Notification endpoints
   - Settings endpoints
   - Export endpoints

2. **DOCS-008**: Add request/response examples for all fields
   - More comprehensive examples
   - Edge case examples
   - Error scenario examples

3. **DOCS-009**: Add webhook documentation
   - Webhook endpoint schemas
   - Event payload structures
   - Signature verification

4. **DOCS-010**: Add WebSocket documentation
   - WebSocket connection flow
   - Message formats
   - Event subscriptions

5. **FRONTEND-007**: Generate TypeScript types from OpenAPI
   - Auto-generate frontend types
   - Sync with backend schemas

---

## Testing Commands

```bash
# Test OpenAPI spec loads
node -c backend/openapi.js

# View spec info
curl -s http://localhost:5002/api/docs.json | jq '.info'

# Count documented endpoints
curl -s http://localhost:5002/api/docs.json | jq '.paths | keys | length'

# List all tags
curl -s http://localhost:5002/api/docs.json | jq '.tags[].name'

# View authentication scheme
curl -s http://localhost:5002/api/docs.json | jq '.components.securitySchemes'

# Validate OpenAPI spec
npx @apidevtools/swagger-cli validate http://localhost:5002/api/docs.json
```

---

## Support

For questions or issues with the API documentation:
- Email: api@titangold.com
- GitHub Issues: https://github.com/sepehrraeisi/TitanGold/issues
- Slack: #api-support

---

**Last Updated**: 2026-01-07  
**Task**: API-003  
**Maintainer**: TitanGold Backend Team
