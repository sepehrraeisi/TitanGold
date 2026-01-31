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
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import swaggerUi from 'swagger-ui-express';
import openApiSpec from './openapi.js';
import { initWebsocket, broadcastNotification } from './services/websocket.js';
import favoritesWebSocketService from './services/favoritesWebSocket.js';
import favoritesAlertMonitor from './services/favoritesAlertMonitor.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import portfolioRoutes from './routes/portfolios.js';
import tradeRoutes from './routes/trades.js';
import aiAgentRoutes from './routes/ai-agents.js';
import trainingRoutes from './routes/training.js';
import artemisRoutes from './routes/artemis.js';
import configRoutes from './routes/config.js';
import autopilotRoutes from './routes/autopilot.js';
import dataSourceRoutes from './routes/data-sources.js';
import notificationRoutes from './routes/notifications.js';
import favoriteRoutes from './routes/favorites.js';
import settingsRoutes from './routes/settings.js';
import emailRoutes from './routes/email.js';
import schedulerRoutes from './routes/scheduler.js';
import tradingEngineRoutes from './routes/trading-engine.js';
import manualTradesRoutes from './routes/manual-trades.js';
import connectionsRoutes from './routes/connections.js';
import strategyRoutes from './routes/strategies.js';
import securityRoutes from './routes/security.js';
import marketProxyRoutes from './routes/market-proxy.js';
import exportRoutes from './routes/exports.js';
import walletRoutes from './routes/wallet.js';
import profileRoutes from './routes/profile.js';
import userPreferencesRoutes from './routes/userPreferences.js';
import favoritesRoutes from './routes/favorites.js';
import favoriteAlertsRoutes from './routes/favoriteAlerts.js';
import healthRoutes from './routes/health.js';
import monitoringRoutes from './routes/monitoring.js';
import backtestRoutes from './routes/backtest.js';
import scenariosRoutes from './routes/scenarios.js';
import liquidityAgentRoutes from './routes/liquidity-agent.js';

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

// Prometheus metrics (INFRA-006)
app.use(metricsMiddleware);

// API Versioning (API-001)
app.use(addVersionHeader);
app.use(legacyRedirect);

// Request logging (to DB)
app.use(requestLogger);

// Security middleware
app.use(helmet());

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
    
    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
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
    'X-API-Version'
  ],
  
  // Exposed headers (accessible to client)
  exposedHeaders: [
    'X-API-Version',
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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/ready', healthRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/portfolios', portfolioRoutes);
app.use('/api/v1/trades', tradeRoutes);
app.use('/api/v1/ai-agents', aiAgentRoutes);
app.use('/api/v1/agents/liquidity', liquidityAgentRoutes);
app.use('/api/v1/market', marketProxyRoutes);
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/artemis', artemisRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/autopilot', autopilotRoutes);
app.use('/api/v1/data-sources', dataSourceRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/favorites', favoriteRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/scheduler', schedulerRoutes);
app.use('/api/v1/trading-engine', tradingEngineRoutes);
app.use('/api/v1/manual-trades', manualTradesRoutes);
app.use('/api/v1/connections', connectionsRoutes);
app.use('/api/v1/strategies', strategyRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/exports', exportRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/user-preferences', userPreferencesRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/favorites', favoriteAlertsRoutes); // Alerts are nested under favorites
app.use('/api/v1/backtest', backtestRoutes);
app.use('/api/v1/scenarios', scenariosRoutes);

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
    
    // Initialize Favorites WebSocket for real-time price updates
    try {
      favoritesWebSocketService.initialize(server);
      logger.info('✅ Favorites WebSocket ready at /ws/favorites');
    } catch (error) {
      logger.error('❌ Failed to initialize Favorites WebSocket:', error);
    }
    
    // Start Autopilot Worker (if enabled)
    try {
      const autopilotWorker = await import('./workers/autopilot-worker.js');
      autopilotWorker.default.start(5); // Run every 5 minutes
      logger.info('✅ Autopilot Worker started (5min interval)');
    } catch (error) {
      logger.error('❌ Failed to start Autopilot Worker:', error);
      // Don't crash server if autopilot fails
    }
    
    // Start Favorites Alert Monitor
    try {
      favoritesAlertMonitor.start();
      logger.info('✅ Favorites Alert Monitor started (10s interval)');
    } catch (error) {
      logger.error('❌ Failed to start Favorites Alert Monitor:', error);
    }
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

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM signal received: closing HTTP server');
  
  // Shutdown Engine Worker if running
  if (process.env.ENGINE_ENABLED === 'true') {
    try {
      const { engineWorker } = await import('./workers/engineWorker.js');
      await engineWorker.stop();
    } catch (error) {
      logger.error('Error stopping engine worker:', error);
    }
  }
  
  // Shutdown services
  favoritesWebSocketService.shutdown();
  favoritesAlertMonitor.stop();
  await messageQueue.close().catch(() => {});
  
  // Close server if it's running
  if (server) {
    server.close(() => {
      pool.end(() => {
        logger.info('🛑 Database pool closed');
        process.exit(0);
      });
    });
  } else {
    pool.end(() => {
      logger.info('🛑 Database pool closed');
      process.exit(0);
    });
  }
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT signal received: closing HTTP server');
  await messageQueue.close().catch(() => {});
  
  // Close server if it's running
  if (server) {
    server.close(() => {
      pool.end(() => {
        logger.info('🛑 Database pool closed');
        process.exit(0);
      });
    });
  } else {
    pool.end(() => {
      logger.info('🛑 Database pool closed');
      process.exit(0);
    });
  }
});

export default app;
