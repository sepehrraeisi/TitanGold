/**
 * OpenAPI 3.0 Specification Generator
 * Task: API-003
 * 
 * Generates comprehensive OpenAPI documentation for TitanGold API
 * Auto-generated from Zod schemas with request/response examples
 */

import dotenv from 'dotenv';
dotenv.config();

const serverUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${process.env.PORT || 5002}`;

// ============================================================================
// OPENAPI 3.0.3 SPECIFICATION
// ============================================================================

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TitanGold API',
    version: '1.0.0',
    description: `
# TitanGold Professional Trading API

Welcome to the TitanGold API documentation. This API provides comprehensive endpoints for:

- **Authentication**: User registration, login, and token management
- **AI Agents**: Create and manage AI-powered trading agents
- **Portfolios**: Manage investment portfolios
- **Trades**: Execute and track trades
- **Users**: User management (admin only)

## Authentication

Most endpoints require authentication using JWT Bearer tokens. To authenticate:

1. Register a new account at \`POST /api/v1/auth/register\` or login at \`POST /api/v1/auth/login\`
2. Include the token in the \`Authorization\` header: \`Bearer <your-token>\`
3. The token expires after 7 days (default)

## Rate Limiting

API requests are rate-limited to 500 requests per 15-minute window per IP address.
GET requests and health checks are exempt from rate limiting.

## Versioning

The API uses URL versioning. All endpoints are prefixed with \`/api/v1/\`.
Legacy endpoints (\`/api/*\`) automatically redirect to the versioned endpoints.

## Error Responses

All errors follow a consistent format:

\`\`\`json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
\`\`\`

### Validation Errors

Validation errors include field-level details:

\`\`\`json
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
      }
    ]
  }
}
\`\`\`

## Request Validation

All request payloads are validated using Zod schemas. See the schema definitions
in the request body sections for exact validation rules.

## Support

For API support, please contact: api@titangold.com
    `,
    contact: {
      name: 'TitanGold API Support',
      email: 'api@titangold.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: serverUrl,
      description: 'Current server',
    },
    {
      url: 'http://localhost:5002',
      description: 'Local development',
    },
    {
      url: 'https://api.titangold.com',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management. Includes registration, login, logout, and token refresh operations.',
    },
    {
      name: 'AI Agents',
      description: 'AI-powered trading agents for technical analysis, sentiment analysis, pattern recognition, and automated trading decisions.',
    },
    {
      name: 'Portfolios',
      description: 'Investment portfolio management. Create, update, and track multiple portfolios with real-time valuations.',
    },
    {
      name: 'Trades',
      description: 'Trade execution and history. Place orders, track executions, and view trade history.',
    },
    {
      name: 'Users',
      description: 'User management operations (admin only). List, update, and delete user accounts.',
    },
    {
      name: 'Health',
      description: 'API health and status checks. Monitor service availability and database connectivity.',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token obtained from /api/v1/auth/login or /api/v1/auth/register',
      },
    },
    schemas: {
      // Common response schemas
      ErrorResponse: {
        type: 'object',
        required: ['ok', 'error'],
        properties: {
          ok: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Error code identifier',
                example: 'INVALID_CREDENTIALS',
              },
              message: {
                type: 'string',
                description: 'Human-readable error message',
                example: 'Invalid email or password',
              },
              details: {
                description: 'Additional error details',
              },
            },
          },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['ok', 'error'],
        properties: {
          ok: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            required: ['code', 'message', 'details'],
            properties: {
              code: {
                type: 'string',
                enum: ['VALIDATION_ERROR'],
              },
              message: {
                type: 'string',
                example: 'Request validation failed',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                      description: 'Path to the invalid field',
                      example: 'email',
                    },
                    message: {
                      type: 'string',
                      description: 'Error message for this field',
                      example: 'Invalid email address',
                    },
                    code: {
                      type: 'string',
                      description: 'Zod error code',
                      example: 'invalid_string',
                    },
                    location: {
                      type: 'string',
                      description: 'Location of the field',
                      enum: ['body', 'query', 'params'],
                      example: 'body',
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Auth schemas
      RegisterRequest: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Valid email address',
            example: 'user@example.com',
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 50,
            pattern: '^[a-zA-Z0-9_-]+$',
            description: 'Username (letters, numbers, hyphens, underscores only)',
            example: 'johndoe',
          },
          password: {
            type: 'string',
            minLength: 6,
            maxLength: 128,
            description: 'Password (min 6 characters)',
            example: 'SecurePassword123',
          },
          fullName: {
            type: 'string',
            maxLength: 255,
            description: 'Full name (optional)',
            example: 'John Doe',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            description: 'Username or email address',
            example: 'johndoe',
          },
          password: {
            type: 'string',
            description: 'Account password',
            example: 'SecurePassword123',
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              email: {
                type: 'string',
                format: 'email',
                example: 'user@example.com',
              },
              username: {
                type: 'string',
                example: 'johndoe',
              },
              full_name: {
                type: 'string',
                example: 'John Doe',
              },
              role: {
                type: 'string',
                example: 'user',
              },
            },
          },
          token: {
            type: 'string',
            description: 'JWT access token (expires in 7 days)',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token (expires in 30 days)',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
      // Agent schemas
      CreateAgentRequest: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Agent name',
            example: 'BTC Technical Analyzer',
          },
          type: {
            type: 'string',
            enum: ['technical', 'sentiment', 'pattern', 'price_prediction', 'arbitrage', 'portfolio', 'liquidity', 'risk', 'fundamental', 'market_timing'],
            description: 'Agent type',
            example: 'technical',
          },
          config: {
            type: 'object',
            description: 'Agent-specific configuration',
            example: { indicators: ['RSI', 'MACD'], timeframe: '1h' },
          },
          is_enabled: {
            type: 'boolean',
            default: true,
            description: 'Whether the agent is enabled',
            example: true,
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata',
            example: {},
          },
        },
      },
      AnalyzeRequest: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: {
            type: 'string',
            pattern: '^[A-Z0-9]{3,20}(\\/[A-Z0-9]{3,20})?$',
            description: 'Trading symbol (e.g., BTC/USDT)',
            example: 'BTC/USDT',
          },
          timeframe: {
            type: 'string',
            enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
            default: '1h',
            description: 'Timeframe for analysis',
            example: '1h',
          },
          exchange: {
            type: 'string',
            default: 'binance',
            description: 'Exchange name',
            example: 'binance',
          },
          config: {
            type: 'object',
            description: 'Analysis-specific configuration',
          },
        },
      },
      ChatRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 4000,
            description: 'Message to send to the agent',
            example: 'What is the current trend for BTC/USDT?',
          },
          context: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                example: 'BTC/USDT',
              },
              timeframe: {
                type: 'string',
                example: '1h',
              },
              conversationId: {
                type: 'string',
                format: 'uuid',
                description: 'Conversation ID for context',
              },
            },
          },
        },
      },
      // Portfolio schemas
      CreatePortfolioRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Portfolio name',
            example: 'My Crypto Portfolio',
          },
          description: {
            type: 'string',
            maxLength: 1000,
            description: 'Portfolio description',
            example: 'Long-term cryptocurrency holdings',
          },
          baseCurrency: {
            type: 'string',
            minLength: 3,
            maxLength: 3,
            default: 'USD',
            description: 'Base currency (3-letter code)',
            example: 'USD',
          },
          isMain: {
            type: 'boolean',
            default: false,
            description: 'Whether this is the main portfolio',
            example: false,
          },
          isPublic: {
            type: 'boolean',
            default: false,
            description: 'Whether this portfolio is public',
            example: false,
          },
        },
      },
      // Trade schemas
      CreateTradeRequest: {
        type: 'object',
        required: ['portfolioId', 'symbol', 'type', 'quantity', 'exchange'],
        properties: {
          portfolioId: {
            type: 'string',
            format: 'uuid',
            description: 'Portfolio ID',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          symbol: {
            type: 'string',
            pattern: '^[A-Z0-9]{3,20}(\\/[A-Z0-9]{3,20})?$',
            description: 'Trading symbol',
            example: 'BTC/USDT',
          },
          type: {
            type: 'string',
            enum: ['buy', 'sell', 'swap'],
            description: 'Trade type',
            example: 'buy',
          },
          quantity: {
            type: 'number',
            minimum: 0,
            exclusiveMinimum: true,
            description: 'Quantity to trade',
            example: 0.5,
          },
          price: {
            type: 'number',
            minimum: 0,
            exclusiveMinimum: true,
            description: 'Price (for limit orders)',
            example: 45000,
          },
          orderType: {
            type: 'string',
            enum: ['market', 'limit', 'stop_loss', 'stop_limit'],
            default: 'market',
            description: 'Order type',
            example: 'market',
          },
          limitPrice: {
            type: 'number',
            description: 'Limit price (required for limit orders)',
            example: 45000,
          },
          stopPrice: {
            type: 'number',
            description: 'Stop price (required for stop orders)',
            example: 44000,
          },
          exchange: {
            type: 'string',
            description: 'Exchange name',
            example: 'binance',
          },
          notes: {
            type: 'string',
            maxLength: 1000,
            description: 'Trade notes',
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check API and database health status. This endpoint is always accessible without authentication.',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    api: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', example: '2024-01-07T10:00:00.000Z' },
                    uptime: { type: 'number', example: 12345 },
                    database: { type: 'string', example: 'connected' },
                  },
                },
              },
            },
          },
          503: {
            description: 'Service is degraded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'degraded' },
                    database: { type: 'string', example: 'disconnected' },
                    dbError: { type: 'string', example: 'Connection timeout' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        description: 'Create a new user account. Returns JWT tokens for immediate authentication.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: {
            description: 'Validation error or user already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        description: 'Authenticate with username/email and password to obtain JWT tokens.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'Invalid credentials or inactive account',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  ok: false,
                  error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid credentials',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Obtain new access and refresh tokens using a valid refresh token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: {
                    type: 'string',
                    description: 'Valid refresh token',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Invalid or expired refresh token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout user',
        description: 'Invalidate the current session token.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Logged out successfully' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Retrieve the authenticated user profile including settings.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'User profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    username: { type: 'string' },
                    full_name: { type: 'string' },
                    phone: { type: 'string', nullable: true },
                    avatar_url: { type: 'string', nullable: true },
                    role: { type: 'string' },
                    created_at: { type: 'string' },
                    last_login_at: { type: 'string', nullable: true },
                    theme: { type: 'string', nullable: true },
                    language: { type: 'string', nullable: true },
                    currency: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/ai-agents': {
      get: {
        tags: ['AI Agents'],
        summary: 'List AI agents',
        description: 'Retrieve a paginated list of AI agents with optional filtering by type, status, and sorting.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'type',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['technical', 'sentiment', 'pattern', 'price_prediction', 'arbitrage', 'portfolio', 'liquidity', 'risk', 'fundamental', 'market_timing'],
            },
            description: 'Filter by agent type',
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['active', 'paused', 'archived'],
            },
            description: 'Filter by agent status',
          },
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            description: 'Number of items per page',
          },
          {
            name: 'offset',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 0,
              default: 0,
            },
            description: 'Number of items to skip',
          },
          {
            name: 'sortBy',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['name', 'created_at', 'performance_score', 'last_active_at'],
              default: 'created_at',
            },
            description: 'Sort by field',
          },
          {
            name: 'sortOrder',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
            description: 'Sort order',
          },
        ],
        responses: {
          200: {
            description: 'List of agents',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    agents: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'agent-123' },
                          name: { type: 'string', example: 'BTC Technical Analyzer' },
                          type: { type: 'string', example: 'technical' },
                          status: { type: 'string', example: 'active' },
                          performance_score: { type: 'number', example: 0.85 },
                          created_at: { type: 'string', example: '2024-01-01T00:00:00Z' },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        limit: { type: 'integer', example: 50 },
                        offset: { type: 'integer', example: 0 },
                        total: { type: 'integer', example: 125 },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['AI Agents'],
        summary: 'Create AI agent',
        description: 'Create a new AI agent with specified configuration. The agent will be immediately available for analysis.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAgentRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Agent created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    agent: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'agent-456' },
                        name: { type: 'string', example: 'BTC Technical Analyzer' },
                        type: { type: 'string', example: 'technical' },
                        status: { type: 'string', example: 'active' },
                        config: { type: 'object' },
                        created_at: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/ai-agents/{id}': {
      get: {
        tags: ['AI Agents'],
        summary: 'Get AI agent',
        description: 'Retrieve details of a specific AI agent including performance metrics.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Agent ID (UUID or agent-<number> format)',
            example: 'agent-123',
          },
        ],
        responses: {
          200: {
            description: 'Agent details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    agent: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string' },
                        status: { type: 'string' },
                        config: { type: 'object' },
                        performance_score: { type: 'number', nullable: true },
                        total_decisions: { type: 'integer' },
                        successful_decisions: { type: 'integer' },
                        created_at: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          404: {
            description: 'Agent not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      put: {
        tags: ['AI Agents'],
        summary: 'Update AI agent',
        description: 'Update an existing AI agent configuration. At least one field must be provided.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Agent ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 255 },
                  type: { type: 'string', enum: ['technical', 'sentiment', 'pattern', 'price_prediction', 'arbitrage', 'portfolio', 'liquidity', 'risk', 'fundamental', 'market_timing'] },
                  status: { type: 'string', enum: ['active', 'paused', 'archived'] },
                  config: { type: 'object' },
                  is_enabled: { type: 'boolean' },
                  metadata: { type: 'object' },
                },
                minProperties: 1,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Agent updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    agent: { type: 'object' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          404: {
            description: 'Agent not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['AI Agents'],
        summary: 'Delete AI agent',
        description: 'Delete an AI agent permanently. This action cannot be undone.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Agent ID',
          },
        ],
        responses: {
          200: {
            description: 'Agent deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Agent deleted successfully' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Agent not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/ai-agents/{id}/analyze': {
      post: {
        tags: ['AI Agents'],
        summary: 'Run agent analysis',
        description: 'Execute analysis using the specified AI agent on a given symbol and timeframe.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Agent ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AnalyzeRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Analysis completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    analysis: {
                      type: 'object',
                      properties: {
                        symbol: { type: 'string', example: 'BTC/USDT' },
                        timeframe: { type: 'string', example: '1h' },
                        confidence: { type: 'number', example: 0.85 },
                        signal: { type: 'string', example: 'bullish' },
                        indicators: {
                          type: 'array',
                          items: { type: 'object' },
                          example: [{ name: 'RSI', value: 65 }, { name: 'MACD', value: 'bullish' }],
                        },
                        timestamp: { type: 'string', example: '2024-01-07T10:00:00Z' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          404: {
            description: 'Agent not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/ai-agents/{id}/chat': {
      post: {
        tags: ['AI Agents'],
        summary: 'Chat with agent',
        description: 'Send a message to the AI agent and receive a conversational response.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Agent ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Chat response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    response: { type: 'string', example: 'Based on current indicators, BTC/USDT shows bullish momentum...' },
                    conversationId: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/portfolios': {
      get: {
        tags: ['Portfolios'],
        summary: 'List portfolios',
        description: 'Retrieve all portfolios for the authenticated user.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
        ],
        responses: {
          200: {
            description: 'List of portfolios',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    portfolios: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          base_currency: { type: 'string' },
                          is_main: { type: 'boolean' },
                          total_value: { type: 'number' },
                          created_at: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Portfolios'],
        summary: 'Create portfolio',
        description: 'Create a new portfolio.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePortfolioRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Portfolio created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    portfolio: { type: 'object' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/trades': {
      get: {
        tags: ['Trades'],
        summary: 'List trades',
        description: 'Retrieve trade history with optional filters.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'symbol', in: 'query', schema: { type: 'string' }, description: 'Filter by symbol' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'executed', 'cancelled', 'failed'] }, description: 'Filter by status' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['buy', 'sell', 'swap'] }, description: 'Filter by type' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: 'List of trades',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    trades: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          symbol: { type: 'string' },
                          type: { type: 'string' },
                          quantity: { type: 'number' },
                          price: { type: 'number' },
                          status: { type: 'string' },
                          created_at: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Trades'],
        summary: 'Create trade',
        description: 'Create a new trade order.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTradeRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Trade created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    trade: { type: 'object' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (Admin)',
        description: 'Retrieve all users. Requires admin role.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'user', 'trader'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 255 }, description: 'Search by username or email' },
        ],
        responses: {
          200: {
            description: 'List of users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    users: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          email: { type: 'string' },
                          username: { type: 'string' },
                          role: { type: 'string' },
                          is_active: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: {
            description: 'Forbidden - Admin access required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  security: [],
  externalDocs: {
    description: 'Full API Documentation',
    url: 'https://docs.titangold.com',
  },
};

export default openApiSpec;
