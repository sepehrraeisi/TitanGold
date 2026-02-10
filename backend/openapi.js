/**
 * OpenAPI 3.0 Specification Generator
 * Task: API-002
 * 
 * Generates comprehensive OpenAPI documentation for TitanGold API
 * Auto-generated from Zod schemas with request/response examples
 */

import dotenv from 'dotenv';
import generateOpenApiSchemas from './utils/schemaRegistry.js';
dotenv.config();

const serverUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${process.env.PORT || 5002}`;

// Generate schemas dynamically from Zod definitions
const generatedSchemas = generateOpenApiSchemas();

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
- **Artemis**: AI Orchestrator state and health
- **Autopilot**: Automated trading supervision
- **Data Hub**: Data source management and collection
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
      description: 'User authentication and session management.',
    },
    {
      name: 'AI Agents',
      description: 'AI-powered trading agents management.',
    },
    {
      name: 'Artemis',
      description: 'AI Orchestrator system.',
    },
    {
      name: 'Autopilot',
      description: 'Automated trading supervision system.',
    },
    {
      name: 'Data Hub',
      description: 'Data source management and collection.',
    },
    {
      name: 'Topic Routing',
      description: 'Automated topic-based data routing to AI agents.',
    },
    {
      name: 'Portfolios',
      description: 'Investment portfolio management.',
    },
    {
      name: 'Trades',
      description: 'Trade execution and history.',
    },
    {
      name: 'Notifications',
      description: 'User notifications and alerts.',
    },
    {
      name: 'Users',
      description: 'User management operations (admin only).',
    },
    {
      name: 'Health',
      description: 'System health checks.',
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
      ...generatedSchemas,
      // Fallback/Custom Manual Schemas
      ErrorResponse: {
        type: 'object',
        required: ['ok', 'error'],
        properties: {
          ok: { type: 'boolean', example: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'ERROR_CODE' },
              message: { type: 'string', example: 'Error message' },
              details: { description: 'Additional error details' },
            },
          },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['ok', 'error'],
        properties: {
          ok: { type: 'boolean', example: false },
          error: {
            type: 'object',
            required: ['code', 'message', 'details'],
            properties: {
              code: { type: 'string', enum: ['VALIDATION_ERROR'] },
              message: { type: 'string', example: 'Request validation failed' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                    location: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    // ============================================
    // AUTHENTICATION
    // ============================================
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: { description: 'User registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } } },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Tokens refreshed' },
          401: { description: 'Invalid refresh token' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Logged out' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } } },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ============================================
    // AI AGENTS
    // ============================================
    '/api/v1/ai-agents': {
      get: {
        tags: ['AI Agents'],
        summary: 'List AI agents',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'List of agents' },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['AI Agents'],
        summary: 'Create AI agent',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAgentRequest' } } },
        },
        responses: {
          201: { description: 'Agent created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Agent' } } } },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/v1/ai-agents/{id}': {
      get: {
        tags: ['AI Agents'],
        summary: 'Get AI agent',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Agent details', content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentDetail' } } } },
          404: { description: 'Agent not found' },
        },
      },
      put: {
        tags: ['AI Agents'],
        summary: 'Update AI agent',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateAgentRequest' } } },
        },
        responses: {
          200: { description: 'Agent updated' },
        },
      },
      delete: {
        tags: ['AI Agents'],
        summary: 'Delete AI agent',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Agent deleted' },
        },
      },
    },
    '/api/v1/ai-agents/{id}/analyze': {
      post: {
        tags: ['AI Agents'],
        summary: 'Run agent analysis',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { symbol: { type: 'string' }, timeframe: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Analysis completed', content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentAnalysis' } } } },
        },
      },
    },
    '/api/v1/ai-agents/{id}/chat': {
      post: {
        tags: ['AI Agents'],
        summary: 'Chat with agent',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Chat response', content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentChatResponse' } } } },
        },
      },
    },

    // ============================================
    // ARTEMIS
    // ============================================
    '/api/v1/artemis/state': {
      get: {
        tags: ['Artemis'],
        summary: 'Get Artemis orchestrator state',
        description: 'Retrieve current mode, strategy, and decision engine status.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Artemis state',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ArtemisState' } } },
          },
        },
      },
    },
    '/api/v1/artemis/health': {
      get: {
        tags: ['Artemis'],
        summary: 'Get Artemis provider health',
        description: 'Check connectivity and quota status of all AI providers.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Health status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ArtemisHealth' } } },
          },
        },
      },
    },

    // ============================================
    // AUTOPILOT
    // ============================================
    '/api/v1/autopilot/status': {
      get: {
        tags: ['Autopilot'],
        summary: 'Get Autopilot status',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AutopilotStatus' } } },
          },
        },
      },
    },
    '/api/v1/autopilot/suggestions': {
      get: {
        tags: ['Autopilot'],
        summary: 'List suggestions',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of suggestions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    suggestions: { type: 'array', items: { $ref: '#/components/schemas/AutopilotSuggestion' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/autopilot/suggestions/{id}/approve': {
      post: {
        tags: ['Autopilot'],
        summary: 'Approve suggestion',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Suggestion approved' },
        },
      },
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List user notifications',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'unreadOnly', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: {
            description: 'List of notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notifications: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          message: { type: 'string' },
                          type: { type: 'string' },
                          is_read: { type: 'boolean' },
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
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Marked as read' },
        },
      },
    },

    // ============================================
    // DATA HUB (Legacy Mapped)
    // ============================================
    '/api/v1/data-sources': {
      get: {
        tags: ['Data Hub'],
        summary: 'List data sources',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of data sources',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/DataSource' } } } },
          },
        },
      },
      post: {
        tags: ['Data Hub'],
        summary: 'Create data source',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDataSourceRequest' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/DataSource' } } } },
        },
      },
    },
    '/api/v1/data-sources/{id}': {
      put: {
        tags: ['Data Hub'],
        summary: 'Update data source',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Data Hub'],
        summary: 'Delete data source',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/api/v1/data-categories': {
      get: {
        tags: ['Data Hub'],
        summary: 'List categories',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of categories',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/DataCategory' } } } },
          },
        },
      },
    },

    // ============================================
    // PORTFOLIOS
    // ============================================
    '/api/v1/portfolios': {
      get: {
        tags: ['Portfolios'],
        summary: 'List portfolios',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of portfolios',
            content: { 'application/json': { schema: { type: 'object', properties: { portfolios: { type: 'array', items: { $ref: '#/components/schemas/Portfolio' } } } } } },
          },
        },
      },
      post: {
        tags: ['Portfolios'],
        summary: 'Create portfolio',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePortfolioRequest' } } },
        },
        responses: {
          201: { description: 'Created' },
        },
      },
    },

    // ============================================
    // TRADES
    // ============================================
    '/api/v1/trades': {
      get: {
        tags: ['Trades'],
        summary: 'List trades',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of trades',
            content: { 'application/json': { schema: { type: 'object', properties: { trades: { type: 'array', items: { $ref: '#/components/schemas/Trade' } } } } } },
          },
        },
      },
      post: {
        tags: ['Trades'],
        summary: 'Create trade (Execute)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTradeRequest' } } },
        },
        responses: {
          201: { description: 'Trade executed' },
        },
      },
    },

    // ============================================
    // HEALTH
    // ============================================
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Healthy',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness check',
        responses: {
          200: { description: 'Ready' },
        },
      },
    },

    // ============================================
    // TOPIC ROUTING (TASK-BE-013)
    // ============================================
    '/api/v1/topic-routing': {
      get: {
        tags: ['Topic Routing'],
        summary: 'List all topic routing rules',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of routing rules',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    rules: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string', example: 'Bitcoin Market Intelligence' },
                          keywords: { type: 'array', items: { type: 'string' }, example: ['bitcoin', 'btc'] },
                          agent_key: { type: 'string', example: 'market_intelligence' },
                          priority: { type: 'integer', example: 100 },
                          is_active: { type: 'boolean', example: true },
                          created_at: { type: 'string', format: 'date-time' },
                          updated_at: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Topic Routing'],
        summary: 'Create new routing rule',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'keywords', 'agent_key'],
                properties: {
                  name: { type: 'string', example: 'DeFi Topics' },
                  keywords: { type: 'array', items: { type: 'string' }, example: ['defi', 'uniswap', 'aave'] },
                  agent_key: { type: 'string', example: 'market_intelligence' },
                  priority: { type: 'integer', example: 50 },
                  is_active: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Rule created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    rule: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/topic-routing/{id}': {
      put: {
        tags: ['Topic Routing'],
        summary: 'Update routing rule',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  keywords: { type: 'array', items: { type: 'string' } },
                  agent_key: { type: 'string' },
                  priority: { type: 'integer' },
                  is_active: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Rule updated successfully' },
          404: { description: 'Rule not found' }
        }
      },
      delete: {
        tags: ['Topic Routing'],
        summary: 'Delete routing rule',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          200: { description: 'Rule deleted successfully' },
          404: { description: 'Rule not found' }
        }
      }
    },
    '/api/v1/topic-routing/logs': {
      get: {
        tags: ['Topic Routing'],
        summary: 'Get routing logs',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 }
          }
        ],
        responses: {
          200: {
            description: 'Routing logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    logs: { type: 'array', items: { type: 'object' } },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
  },
};

export default openApiSpec;
