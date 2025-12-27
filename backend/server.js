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
import { autopilot } from './engine/autopilot.js';
import { scheduler } from './engine/scheduler.js';
import { tradingEngine } from './engine/tradingEngine.js';
import { messageQueue } from './services/messageQueue.js';
import { requestContextMiddleware, performanceMiddleware, logger } from './services/logger.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
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
import exportRoutes from './routes/exports.js';
import walletRoutes from './routes/wallet.js';
import profileRoutes from './routes/profile.js';
import userPreferencesRoutes from './routes/userPreferences.js';
import favoritesRoutes from './routes/favorites.js';
import favoriteAlertsRoutes from './routes/favoriteAlerts.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Request context & performance metrics
app.use(requestContextMiddleware);
app.use(performanceMiddleware);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

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
app.use('/api/', limiter);

// ============================================================================
// ROUTES
// ============================================================================

// Health check - Safe endpoint (no DB required)
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/ai-agents', aiAgentRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/artemis', artemisRoutes);
app.use('/api/data-sources', dataSourceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/trading-engine', tradingEngineRoutes);
app.use('/api/manual-trades', manualTradesRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/favorites', favoriteAlertsRoutes); // Alerts are nested under favorites
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

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

// GUARANTEE HTTP LISTEN - Always execute, even if background services fail
const server = app.listen(PORT, '0.0.0.0', () => {
  // Log actual bound address and port AFTER listen succeeds
  const address = server.address();
  const boundAddress = address ? `${address.address}:${address.port}` : `0.0.0.0:${PORT}`;
  
  console.log('');
  console.log('🚀 ============================================');
  console.log(`🚀 TitanGold Backend API`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Server listening on ${boundAddress}`);
  console.log(`🚀 Health check: http://localhost:${PORT}/health`);
  console.log('🚀 ============================================');
  console.log('');

  // Initialize background services (non-blocking, wrapped in try/catch)
  // These MUST NOT prevent the server from listening
  (async () => {
    // Initialize Message Queue
    try {
      await messageQueue.connect();
      console.log('✅ Message Queue initialized');
    } catch (error) {
      console.warn('⚠️ Message Queue initialization failed, using fallback mode:', error.message);
    }

    // Start Autopilot Engine
    try {
      autopilot.start();
    } catch (error) {
      console.error('❌ Failed to start Autopilot:', error);
    }
    
    // Start 24/7 Scheduler Service
    try {
      scheduler.start();
    } catch (error) {
      console.error('❌ Failed to start Scheduler:', error);
    }
    
    // Start Trading Engine
    try {
      tradingEngine.start();
    } catch (error) {
      console.error('❌ Failed to start Trading Engine:', error);
    }

    // Start Engine Worker (if enabled)
    if (process.env.ENGINE_ENABLED === 'true') {
      try {
        const { engineWorker } = await import('./workers/engineWorker.js');
        await engineWorker.start();
        console.log('✅ Engine Worker started');
      } catch (error) {
        console.error('❌ Failed to start Engine Worker:', error);
        // Don't crash server if engine fails to start
      }
    } else {
      console.log('⏸️ Engine Worker disabled (ENGINE_ENABLED != true)');
    }

    // Initialize WebSocket Notifications
    try {
      initWebsocket(server);
      console.log('✅ WebSocket notifications ready at /ws/notifications');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket:', error);
    }
    
    // Initialize Favorites WebSocket for real-time price updates
    try {
      favoritesWebSocketService.initialize(server);
      console.log('✅ Favorites WebSocket ready at /ws/favorites');
    } catch (error) {
      console.error('❌ Failed to initialize Favorites WebSocket:', error);
    }
    
    // Start Favorites Alert Monitor
    try {
      favoritesAlertMonitor.start();
      console.log('✅ Favorites Alert Monitor started (10s interval)');
    } catch (error) {
      console.error('❌ Failed to start Favorites Alert Monitor:', error);
    }
  })().catch(error => {
    console.error('❌ Error initializing background services:', error);
    // Server is already listening, so we continue
  });
});

// Handle listen errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM signal received: closing HTTP server');
  
  // Shutdown Engine Worker if running
  if (process.env.ENGINE_ENABLED === 'true') {
    try {
      const { engineWorker } = await import('./workers/engineWorker.js');
      await engineWorker.stop();
    } catch (error) {
      console.error('Error stopping engine worker:', error);
    }
  }
  
  // Shutdown services
  favoritesWebSocketService.shutdown();
  favoritesAlertMonitor.stop();
  await messageQueue.close().catch(() => {});
  
  pool.end(() => {
    console.log('🛑 Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT signal received: closing HTTP server');
  await messageQueue.close().catch(() => {});
  pool.end(() => {
    console.log('🛑 Database pool closed');
    process.exit(0);
  });
});

export default app;
