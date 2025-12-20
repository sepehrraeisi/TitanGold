import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

dotenv.config();

const serverUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${process.env.PORT || 5001}`;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'TitanGold Backend API',
      version: '1.0.0',
      description: 'API documentation for TitanGold backend services',
    },
    servers: [
      {
        url: serverUrl,
        description: 'Current server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' },
            messageQueue: { type: 'object' },
            uptime: { type: 'number' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'admin@titangold.com' },
            password: { type: 'string', example: 'secret' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { type: 'object' },
          },
        },
        FavoriteItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            symbol: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            change24h: { type: 'number' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Health' },
      { name: 'Auth' },
      { name: 'Favorites' },
      { name: 'Exports' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            200: {
              description: 'Health status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
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
                  schema: { $ref: '#/components/schemas/LoginResponse' },
                },
              },
            },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/favorites': {
        get: {
          tags: ['Favorites'],
          summary: 'Get favorites list',
          responses: {
            200: {
              description: 'List of favorites',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/FavoriteItem' },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/exports/trades': {
        get: {
          tags: ['Exports'],
          summary: 'Export trade history to CSV',
          parameters: [
            { in: 'query', name: 'startDate', schema: { type: 'string' }, description: 'ISO date' },
            { in: 'query', name: 'endDate', schema: { type: 'string' }, description: 'ISO date' },
            { in: 'query', name: 'symbol', schema: { type: 'string' } },
            { in: 'query', name: 'status', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'CSV stream' },
            401: { description: 'Unauthorized' },
          },
        },
      },
    },
  },
  apis: [], // We use programmatic definition above; can add JSDoc paths later.
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

