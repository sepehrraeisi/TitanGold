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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    const mqStatus = messageQueue.getStatus();
    res.json({
      status: 'healthy',
      timestamp: result.rows[0].now,
      database: 'connected',
      messageQueue: mqStatus,
      uptime: process.uptime()
    });
  } catch (error) {
    const mqStatus = messageQueue.getStatus();
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      messageQueue: mqStatus,
      error: error.message
    });
  }
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

const server = app.listen(PORT, async () => {
  console.log('');
  console.log('🚀 ============================================');
  console.log(`🚀 TitanGold Backend API`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV}`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Health check: http://localhost:${PORT}/health`);
  console.log('🚀 ============================================');
  console.log('');

  // Initialize Message Queue
  try {
    await messageQueue.connect();
    console.log('✅ Message Queue initialized');
  } catch (error) {
    console.warn('⚠️ Message Queue initialization failed, using fallback mode:', error.message);
  }

  // Start Autopilot Engine
  autopilot.start();
  
  // Start 24/7 Scheduler Service
  scheduler.start();
  
  // Start Trading Engine
  tradingEngine.start();

  // Initialize WebSocket Notifications
  initWebsocket(server);
  console.log('✅ WebSocket notifications ready at /ws/notifications');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM signal received: closing HTTP server');
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
