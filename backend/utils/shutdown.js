import { logger } from '../services/logger.js';
import pool from '../database/db.js';
import { closeRedis, isRedisAvailable } from './redis.js';

/**
 * Graceful Shutdown Utility (INFRA-007)
 * 
 * Handles graceful shutdown of the TitanGold backend server:
 * - Stops accepting new requests
 * - Waits for in-flight requests to complete (max 30s)
 * - Closes database connections
 * - Closes Redis connections
 * - Exits with appropriate code
 */

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
let isShuttingDown = false;
let shutdownStartTime = null;

/**
 * Check if server is currently shutting down
 * @returns {boolean}
 */
export function isShutdownInProgress() {
  return isShuttingDown;
}

/**
 * Get shutdown elapsed time in ms
 * @returns {number}
 */
export function getShutdownElapsedTime() {
  if (!shutdownStartTime) return 0;
  return Date.now() - shutdownStartTime;
}

/**
 * Middleware to reject new requests during shutdown
 */
export function shutdownMiddleware(req, res, next) {
  if (isShuttingDown) {
    res.set('Connection', 'close');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server is shutting down',
      retryAfter: 10
    });
  }
  next();
}

/**
 * Close database connections gracefully
 * @returns {Promise<void>}
 */
async function closeDatabaseConnections() {
  try {
    logger.info('🔌 Closing database connections...');
    
    // Get pool stats before closing
    const totalCount = pool.totalCount || 0;
    const idleCount = pool.idleCount || 0;
    const waitingCount = pool.waitingCount || 0;
    
    logger.info(`📊 Database pool stats: total=${totalCount}, idle=${idleCount}, waiting=${waitingCount}`);
    
    await pool.end();
    logger.info('✅ Database connections closed');
  } catch (error) {
    logger.error('❌ Error closing database connections:', error.message);
    throw error;
  }
}

/**
 * Close Redis connections gracefully
 * @returns {Promise<void>}
 */
async function closeRedisConnections() {
  try {
    if (isRedisAvailable()) {
      logger.info('🔌 Closing Redis connections...');
      await closeRedis();
      logger.info('✅ Redis connections closed');
    } else {
      logger.info('⏭️ Redis not connected, skipping');
    }
  } catch (error) {
    logger.error('❌ Error closing Redis connections:', error.message);
    // Don't throw - Redis is optional
  }
}

/**
 * Close background services gracefully
 * @param {Object} services - Object containing service instances to shut down
 * @returns {Promise<void>}
 */
async function closeBackgroundServices(services = {}) {
  const {
    messageQueue,
    engineWorker,
    favoritesWebSocketService,
    favoritesAlertMonitor,
    autopilotWorker
  } = services;

  // Stop Engine Worker
  if (engineWorker && process.env.ENGINE_ENABLED === 'true') {
    try {
      logger.info('🛑 Stopping Engine Worker...');
      await engineWorker.stop();
      logger.info('✅ Engine Worker stopped');
    } catch (error) {
      logger.error('❌ Error stopping Engine Worker:', error.message);
    }
  }

  // Stop Favorites Alert Monitor
  if (favoritesAlertMonitor) {
    try {
      logger.info('🛑 Stopping Favorites Alert Monitor...');
      favoritesAlertMonitor.stop();
      logger.info('✅ Favorites Alert Monitor stopped');
    } catch (error) {
      logger.error('❌ Error stopping Favorites Alert Monitor:', error.message);
    }
  }

  // Stop Autopilot Worker
  if (autopilotWorker) {
    try {
      logger.info('🛑 Stopping Autopilot Worker...');
      await autopilotWorker.stop();
      logger.info('✅ Autopilot Worker stopped');
    } catch (error) {
      logger.error('❌ Error stopping Autopilot Worker:', error.message);
    }
  }

  // Shutdown WebSocket services
  if (favoritesWebSocketService) {
    try {
      logger.info('🛑 Shutting down Favorites WebSocket...');
      favoritesWebSocketService.shutdown();
      logger.info('✅ Favorites WebSocket shutdown');
    } catch (error) {
      logger.error('❌ Error shutting down Favorites WebSocket:', error.message);
    }
  }

  // Close Message Queue
  if (messageQueue) {
    try {
      logger.info('🛑 Closing Message Queue...');
      await messageQueue.close();
      logger.info('✅ Message Queue closed');
    } catch (error) {
      logger.error('❌ Error closing Message Queue:', error.message);
    }
  }
}

/**
 * Wait for in-flight requests to complete
 * @param {http.Server} server - HTTP server instance
 * @returns {Promise<void>}
 */
function waitForInFlightRequests(server) {
  return new Promise((resolve) => {
    if (!server) {
      logger.info('⏭️ No server instance, skipping in-flight request wait');
      return resolve();
    }

    const startTime = Date.now();
    let connectionsClosed = false;

    // Force close after timeout
    const timeoutId = setTimeout(() => {
      if (!connectionsClosed) {
        logger.warn(`⏱️ Shutdown timeout reached (${SHUTDOWN_TIMEOUT}ms), forcing close`);
        
        // Get active connections if available
        server.getConnections((err, count) => {
          if (!err && count > 0) {
            logger.warn(`⚠️ Forcing close with ${count} active connections`);
          }
        });
        
        resolve();
      }
    }, SHUTDOWN_TIMEOUT);

    // Try to close gracefully
    server.close(() => {
      connectionsClosed = true;
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      logger.info(`✅ HTTP server closed gracefully (${elapsed}ms)`);
      resolve();
    });

    // Log connection count
    server.getConnections((err, count) => {
      if (!err) {
        logger.info(`🔄 Waiting for ${count} in-flight request(s) to complete...`);
      }
    });
  });
}

/**
 * Perform graceful shutdown
 * @param {Object} options - Shutdown options
 * @param {http.Server} options.server - HTTP server instance
 * @param {Object} options.services - Background services to shut down
 * @param {string} options.signal - Signal that triggered shutdown (SIGTERM, SIGINT, etc.)
 * @returns {Promise<void>}
 */
export async function gracefulShutdown(options = {}) {
  const { server, services = {}, signal = 'SIGTERM' } = options;

  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('⚠️ Shutdown already in progress, ignoring duplicate signal');
    return;
  }

  isShuttingDown = true;
  shutdownStartTime = Date.now();

  logger.info('');
  logger.info('🛑 ============================================');
  logger.info(`🛑 Graceful Shutdown Initiated (${signal})`);
  logger.info('🛑 ============================================');

  try {
    // Step 1: Stop accepting new requests (middleware handles this via isShuttingDown flag)
    logger.info('📛 Step 1/5: Stopped accepting new requests');

    // Step 2: Wait for in-flight requests to complete
    logger.info('⏳ Step 2/5: Waiting for in-flight requests (max 30s)...');
    await waitForInFlightRequests(server);

    // Step 3: Close background services
    logger.info('🛠️ Step 3/5: Closing background services...');
    await closeBackgroundServices(services);

    // Step 4: Close Redis connections
    logger.info('🔴 Step 4/5: Closing Redis connections...');
    await closeRedisConnections();

    // Step 5: Close database connections
    logger.info('🗄️ Step 5/5: Closing database connections...');
    await closeDatabaseConnections();

    const totalTime = Date.now() - shutdownStartTime;
    logger.info('');
    logger.info('✅ ============================================');
    logger.info(`✅ Graceful Shutdown Complete (${totalTime}ms)`);
    logger.info('✅ ============================================');
    logger.info('');

    // Exit with success code
    process.exit(0);
  } catch (error) {
    const totalTime = Date.now() - shutdownStartTime;
    logger.error('❌ ============================================');
    logger.error(`❌ Shutdown Error (${totalTime}ms)`);
    logger.error('❌ ============================================');
    logger.error('❌ Error during graceful shutdown:', error.message);
    logger.error(error.stack);
    
    // Exit with error code
    process.exit(1);
  }
}

/**
 * Register shutdown signal handlers
 * @param {Object} options - Options for shutdown handlers
 * @param {http.Server} options.server - HTTP server instance
 * @param {Object} options.services - Background services to shut down
 */
export function registerShutdownHandlers(options = {}) {
  const { server, services = {} } = options;

  // SIGTERM - Graceful shutdown (from Docker, Kubernetes, systemd)
  process.on('SIGTERM', async () => {
    await gracefulShutdown({ server, services, signal: 'SIGTERM' });
  });

  // SIGINT - Graceful shutdown (Ctrl+C)
  process.on('SIGINT', async () => {
    await gracefulShutdown({ server, services, signal: 'SIGINT' });
  });

  // Uncaught exceptions - Log and exit
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error.message);
    logger.error(error.stack);
    
    // Attempt graceful shutdown
    gracefulShutdown({ server, services, signal: 'uncaughtException' }).catch(() => {
      process.exit(1);
    });
  });

  // Unhandled promise rejections - Log and exit
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Promise Rejection:', reason);
    logger.error('Promise:', promise);
    
    // Attempt graceful shutdown
    gracefulShutdown({ server, services, signal: 'unhandledRejection' }).catch(() => {
      process.exit(1);
    });
  });

  logger.info('✅ Shutdown signal handlers registered (SIGTERM, SIGINT)');
}

export default {
  gracefulShutdown,
  registerShutdownHandlers,
  shutdownMiddleware,
  isShutdownInProgress,
  getShutdownElapsedTime
};
