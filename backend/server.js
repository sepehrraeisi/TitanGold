import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database/db.js';
import { getRedisClient, isRedisAvailable } from './utils/redis.js';
// Import engines (needed for API routes)
import { tradingEngine } from './engine/tradingEngine.js';
import { messageQueue } from './services/messageQueue.js';
import { requestContextMiddleware, performanceMiddleware, logger } from './services/logger.js';
import { requestLogger, logError } from './middleware/requestLogger.js';
import { addVersionHeader, legacyRedirect } from './middleware/apiVersion.js';
import { cacheHeaders } from './middleware/cacheHeaders.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import { shutdownMiddleware, registerShutdownHandlers } from './utils/shutdown.js';
import swaggerUi from 'swagger-ui-express';
import openApiSpec from './openapi.js';
import { initWebsocket, broadcastNotification } from './services/websocket.js';
import favoritesWebSocketService from './services/favoritesWebSocket.js';
import favoritesAlertMonitor from './services/favoritesAlertMonitor.js';

// Import routes
import v1Router from './routes/v1/index.js';

// GraphQL (API-007)
import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import resolvers from './graphql/resolvers.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Trust proxy (behind nginx/cloudflare)
app.set('trust proxy', 1);

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Request context & performance metrics
app.use(requestContextMiddleware);
app.use(performanceMiddleware);

// Shutdown middleware - reject requests during graceful shutdown (INFRA-007)
app.use(shutdownMiddleware);

// Prometheus metrics (INFRA-006)
app.use(metricsMiddleware);

// API Versioning (API-001)
app.use(addVersionHeader);
app.use(legacyRedirect);

// Request logging (to DB)
app.use(requestLogger);

// Security middleware
app.use(helmet());

// Caching headers (TASK-API-004)
app.use(cacheHeaders);

// CORS configuration (API-006)
// Whitelist of allowed origins
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

const corsOptions = {
  // Dynamic origin validation with whitelist
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Normalize origin (remove trailing slash for comparison)
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedWhitelist = allowedOrigins.map(o => o.replace(/\/$/, ''));

    // Check if origin is in whitelist
    if (normalizedWhitelist.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      logger.warn(`❌ CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Version',
    'X-Request-ID',
    'X-Correlation-ID'
  ],

  // Exposed headers (accessible to client)
  exposedHeaders: [
    'X-API-Version',
    'X-Request-ID',
    'X-Response-Time',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Content-Disposition'
  ],

  // Preflight cache duration (seconds)
  maxAge: 86400, // 24 hours

  // Success status for legacy browsers
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads (avatars, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting - Increased for development/heavy dashboard usage
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Increased from 100 to 500
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and read operations
    return req.path === '/health' || req.method === 'GET';
  }
});
app.use('/api/', limiter); // Applies to both /api/* and /api/v1/*

// ============================================================================
// ROUTES
// ============================================================================

// ============================================================================
// METRICS & HEALTH ENDPOINTS
// ============================================================================

// Prometheus metrics endpoint (INFRA-006)
app.get('/metrics', metricsHandler);

// Health check - Safe endpoint (no DB required) - remains unversioned
app.get('/health', async (req, res) => {
  // Always return JSON, even if DB/Redis are down
  const health = {
    status: 'healthy',
    api: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Check database (non-blocking)
  try {
    const result = await pool.query('SELECT NOW()');
    health.database = 'connected';
    health.dbTimestamp = result.rows[0].now;
  } catch (error) {
    health.database = 'disconnected';
    health.dbError = error.message;
    health.status = 'degraded'; // Degraded but API is still up
  }

  // Check message queue (non-blocking, always safe)
  try {
    health.messageQueue = messageQueue.getStatus();
  } catch (error) {
    health.messageQueue = { connected: false, fallbackMode: true, error: error.message };
  }

  // Get engine heartbeat if enabled (non-blocking)
  if (process.env.ENGINE_ENABLED === 'true') {
    try {
      const { engineWorker } = await import('./workers/engineWorker.js');
      const engineHeartbeat = engineWorker.getHeartbeat();

      if (engineHeartbeat && engineHeartbeat.timestamp) {
        const heartbeatAge = Date.now() - new Date(engineHeartbeat.timestamp).getTime();
        engineHeartbeat.isFresh = heartbeatAge < 120000; // 2 minutes
      }

      health.engine = {
        enabled: true,
        isRunning: engineHeartbeat?.isRunning || false,
        lastSuccessfulCycle: engineHeartbeat?.lastSuccessfulCycle || null,
        lastError: engineHeartbeat?.lastError || null,
        cycleCount: engineHeartbeat?.cycleCount || 0,
        heartbeatFresh: engineHeartbeat?.isFresh !== false,
      };
    } catch (error) {
      health.engine = {
        enabled: true,
        error: 'Failed to get heartbeat',
      };
    }
  } else {
    health.engine = { enabled: false };
  }

  // Return 200 even if DB is down (API is still serving)
  const statusCode = health.database === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API v1 routes (API-001)
app.use('/api/v1', v1Router);

// ============================================================================
// GRAPHQL API (API-007)
// ============================================================================

// GraphQL setup - will be initialized asynchronously
let apolloServer = null;

async function initializeGraphQL() {
  try {
    // Load GraphQL schema
    const schemaPath = join(__dirname, 'graphql', 'schema.graphql');
    const typeDefs = readFileSync(schemaPath, 'utf-8');

    // Create Apollo Server instance
    apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: process.env.NODE_ENV !== 'production', // Enable introspection in dev
      formatError: (error) => {
        // Log error
        logger.error('GraphQL Error:', {
          message: error.message,
          path: error.path,
          extensions: error.extensions
        });

        // Return formatted error
        return {
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          path: error.path,
          extensions: {
            ...error.extensions,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Start Apollo Server
    await apolloServer.start();

    // Mount GraphQL endpoint at /graphql using json-based approach
    app.post('/graphql', async (req, res) => {
      try {
        const { query, variables, operationName } = req.body;

        const result = await apolloServer.executeOperation(
          {
            query,
            variables,
            operationName
          },
          {
            contextValue: {
              userId: req.user?.id,
              user: req.user,
              requestId: req.requestId
            }
          }
        );

        res.status(200).json(result);
      } catch (error) {
        logger.error('GraphQL execution error:', error);
        res.status(500).json({
          errors: [{
            message: 'Internal server error',
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          }]
        });
      }
    });

    // GET endpoint for playground / introspection
    app.get('/graphql', (req, res) => {
      if (process.env.NODE_ENV === 'production') {
        res.status(405).json({ error: 'GraphQL Playground is disabled in production' });
      } else {
        // Return simple playground HTML
        res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>TitanGold GraphQL</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    .container { max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #8b5cf6; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    .info { background: #e0e7ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 TitanGold GraphQL API</h1>
    <div class="info">
      <p><strong>Endpoint:</strong> <code>POST /graphql</code></p>
      <p><strong>Status:</strong> Ready</p>
      <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
    </div>
    <h2>Quick Start</h2>
    <p>Send POST requests to <code>/graphql</code> with a GraphQL query:</p>
    <pre><code>{
  "query": "query { agents { id name status } }"
}</code></pre>
    <p>Use tools like <strong>Postman</strong>, <strong>Insomnia</strong>, or <strong>Apollo Client</strong> to interact with the API.</p>
    <h2>Documentation</h2>
    <p>See <code>docs/GRAPHQL_API.md</code> for complete query examples and API reference.</p>
  </div>
</body>
</html>
        `);
      }
    });

    logger.info('✅ GraphQL API enabled at /graphql');

    // Add GraphQL Playground link in dev mode
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`🎮 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    }
  } catch (error) {
    logger.error('❌ Failed to initialize GraphQL:', error);
    logger.warn('⚠️  GraphQL endpoint will not be available');
  }
}

// ============================================================================
// API DOCUMENTATION
// ============================================================================

// API Documentation (remains unversioned for easier access)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'TitanGold API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
}));
app.get('/api/docs.json', (req, res) => res.json(openApiSpec));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('❌ Error', {
    requestId: req.requestId,
    path: req.originalUrl || req.url,
    method: req.method,
    status: err.status || 500,
    message: err.message,
  });

  // Log error to database (only 5xx errors to avoid noise)
  if (!err.status || err.status >= 500) {
    logError(
      req.path || 'unknown',
      err,
      {
        requestId: req.requestId,
        method: req.method,
        userId: req.user?.id || null
      }
    ).catch(logErr => {
      logger.error('Failed to log error to DB:', logErr);
    });
  }

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: process.env.NODE_ENV === 'development' ? {
      message,
      stack: err.stack,
      details: err.details
    } : {
      message
    }
  });
});

// ============================================================================
// START SERVER
// ============================================================================

// Only start server if not in test mode (for integration tests with supertest)
let server;
let backgroundServices = {}; // Track services for graceful shutdown

if (process.env.NODE_ENV !== 'test') {
  // GUARANTEE HTTP LISTEN - Always execute, even if background services fail
  server = app.listen(PORT, '0.0.0.0', () => {
    // Log actual bound address and port AFTER listen succeeds
    const address = server.address();
    const boundAddress = address ? `${address.address}:${address.port}` : `0.0.0.0:${PORT}`;

    logger.info('');
    logger.info('🚀 ============================================');
    logger.info(`🚀 TitanGold Backend API`);
    logger.info(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🚀 Server listening on ${boundAddress}`);
    logger.info(`🚀 Health check: http://localhost:${PORT}/health`);
    logger.info('🚀 ============================================');
    logger.info('');

    // Initialize background services (non-blocking, wrapped in try/catch)
    // These MUST NOT prevent the server from listening
    (async () => {
      // Initialize Redis
      try {
        await getRedisClient();
        logger.info('✅ Redis client connected and ready');
      } catch (error) {
        logger.warn('⚠️ Redis initialization failed, rate limiter will use fallback mode:', error.message);
      }

      // Initialize Message Queue
      try {
        await messageQueue.connect();
        backgroundServices.messageQueue = messageQueue;
        logger.info('✅ Message Queue initialized');
      } catch (error) {
        logger.warn('⚠️ Message Queue initialization failed, using fallback mode:', error.message);
      }

      // 🔧 Engines permanently disabled in backend API
      // All engines run in separate titan-engine-worker process
      logger.info('🔧 Engines disabled in backend API - running in separate titan-engine-worker');
      logger.info('📊 Backend cluster mode: API requests only');

      // Start Engine Worker (if enabled)
      if (process.env.ENGINE_ENABLED === 'true') {
        try {
          const { engineWorker } = await import('./workers/engineWorker.js');
          await engineWorker.start();
          backgroundServices.engineWorker = engineWorker;
          logger.info('✅ Engine Worker started');
        } catch (error) {
          logger.error('❌ Failed to start Engine Worker:', error);
          // Don't crash server if engine fails to start
        }
      } else {
        logger.info('⏸️ Engine Worker disabled (ENGINE_ENABLED != true)');
      }

      // Initialize WebSocket Notifications
      try {
        initWebsocket(server);
        logger.info('✅ WebSocket notifications ready at /ws/notifications');
      } catch (error) {
        logger.error('❌ Failed to initialize WebSocket:', error);
      }

      // Initialize Agent WebSocket Server (BACKEND-023)
      try {
        const { initAgentWebSocketServer } = await import('./websocket/server.js');
        initAgentWebSocketServer(server);
        backgroundServices.agentWebSocket = {
          close: async () => {
            const { closeWebSocketServer } = await import('./websocket/server.js');
            closeWebSocketServer();
          }
        };
        logger.info('✅ Agent WebSocket server ready at /ws/agents');
      } catch (error) {
        logger.error('❌ Failed to initialize Agent WebSocket:', error);
      }

      // Initialize GraphQL API (API-007)
      try {
        await initializeGraphQL();
      } catch (error) {
        logger.error('❌ Failed to initialize GraphQL API:', error);
      }

      // Initialize Favorites WebSocket for real-time price updates
      try {
        favoritesWebSocketService.initialize(server);
        backgroundServices.favoritesWebSocketService = favoritesWebSocketService;
        logger.info('✅ Favorites WebSocket ready at /ws/favorites');
      } catch (error) {
        logger.error('❌ Failed to initialize Favorites WebSocket:', error);
      }

      // Start Autopilot Worker (if enabled)
      try {
        const autopilotWorker = await import('./workers/autopilot-worker.js');
        autopilotWorker.default.start(5); // Run every 5 minutes
        backgroundServices.autopilotWorker = autopilotWorker.default;
        logger.info('✅ Autopilot Worker started (5min interval)');
      } catch (error) {
        logger.error('❌ Failed to start Autopilot Worker:', error);
        // Don't crash server if autopilot fails
      }

      // Start Favorites Alert Monitor
      try {
        favoritesAlertMonitor.start();
        backgroundServices.favoritesAlertMonitor = favoritesAlertMonitor;
        logger.info('✅ Favorites Alert Monitor started (10s interval)');
      } catch (error) {
        logger.error('❌ Failed to start Favorites Alert Monitor:', error);
      }

      // Register graceful shutdown handlers (INFRA-007)
      registerShutdownHandlers({ server, services: backgroundServices });
    })().catch(error => {
      logger.error('❌ Error initializing background services:', error);
      // Server is already listening, so we continue
    });
  });

  // Handle listen errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${PORT} is already in use`);
    } else {
      logger.error('❌ Server error:', error);
    }
    process.exit(1);
  });
} else {
  logger.info('🧪 Running in test mode - server not listening on port');
}

export default app;
