import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { logger } from '../services/logger.js';

dotenv.config();

// Connection pool configuration (DATABASE-005)
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,  // PostgreSQL is on port 5433
  database: process.env.DB_NAME || 'titangold_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  
  // Pool size configuration (DATABASE-005)
  max: parseInt(process.env.DB_POOL_MAX) || 20,  // Maximum pool size (configurable via env)
  min: parseInt(process.env.DB_POOL_MIN) || 2,   // Minimum pool size
  
  // Timeout configuration (DATABASE-005)
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,  // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT) || 2000,  // 2 seconds
  maxLifetimeSeconds: parseInt(process.env.DB_POOL_MAX_LIFETIME) || 3600,  // 1 hour (60 * 60)
  
  // Connection leak detection (DATABASE-005)
  allowExitOnIdle: false,  // Keep pool alive even if all connections are idle
  
  // SSL Configuration
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    // For localhost with self-signed cert, we need to allow unauthorized
    // In production with proper certs, set DB_SSL_REJECT_UNAUTHORIZED=true
  } : false,
};

// Create PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Pool monitoring metrics (DATABASE-005)
let poolMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  waitingClients: 0,
  lastUpdated: new Date(),
};

// Update pool metrics
const updatePoolMetrics = () => {
  poolMetrics = {
    totalConnections: pool.totalCount,
    activeConnections: pool.totalCount - pool.idleCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    lastUpdated: new Date(),
  };
};

// Connection leak detection (DATABASE-005)
const connectionAcquireTimes = new Map();
const CONNECTION_LEAK_THRESHOLD = parseInt(process.env.DB_POOL_LEAK_THRESHOLD) || 30000; // 30 seconds

// Test database connection
pool.on('connect', (client) => {
  logger.info('✅ Connected to PostgreSQL database');
  updatePoolMetrics();
});

pool.on('acquire', (client) => {
  // Track connection acquisition time for leak detection
  const acquireTime = Date.now();
  connectionAcquireTimes.set(client, acquireTime);
  updatePoolMetrics();
});

pool.on('release', (client) => {
  // Check for connection leaks
  const acquireTime = connectionAcquireTimes.get(client);
  if (acquireTime) {
    const holdTime = Date.now() - acquireTime;
    if (holdTime > CONNECTION_LEAK_THRESHOLD) {
      logger.warn(`⚠️  Connection leak detected: held for ${holdTime}ms (threshold: ${CONNECTION_LEAK_THRESHOLD}ms)`);
    }
    connectionAcquireTimes.delete(client);
  }
  updatePoolMetrics();
});

pool.on('remove', (client) => {
  connectionAcquireTimes.delete(client);
  updatePoolMetrics();
});

pool.on('error', (err) => {
  logger.error('❌ Unexpected error on idle client', err);
  updatePoolMetrics();
  process.exit(-1);
});

// Query helper function with slow query logging (DATABASE-007)
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 100; // 100ms default
const slowQueries = [];
const MAX_SLOW_QUERIES = 1000; // Keep last 1000 slow queries

export const query = async (text, params) => {
  const start = Date.now();
  const queryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (DATABASE-007)
    if (duration > SLOW_QUERY_THRESHOLD) {
      const slowQuery = {
        id: queryId,
        query: text,
        params: params,
        duration,
        timestamp: new Date().toISOString(),
        rows: res.rowCount,
      };
      
      slowQueries.push(slowQuery);
      
      // Keep only last MAX_SLOW_QUERIES
      if (slowQueries.length > MAX_SLOW_QUERIES) {
        slowQueries.shift();
      }
      
      logger.warn(`🐌 SLOW QUERY (${duration}ms):`, {
        query: text.substring(0, 200),
        duration,
        rows: res.rowCount,
        threshold: SLOW_QUERY_THRESHOLD,
      });
    } else {
      logger.info('📊 Query executed:', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('❌ Query error:', {
      error: error.message,
      query: text.substring(0, 200),
      duration,
    });
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get client from pool for complex operations
export const getClient = () => pool.connect();

// Get pool metrics (DATABASE-005)
export const getPoolMetrics = () => {
  updatePoolMetrics();
  return {
    ...poolMetrics,
    config: {
      max: poolConfig.max,
      min: poolConfig.min,
      idleTimeoutMs: poolConfig.idleTimeoutMillis,
      connectionTimeoutMs: poolConfig.connectionTimeoutMillis,
      maxLifetimeSeconds: poolConfig.maxLifetimeSeconds,
    },
    utilization: poolMetrics.totalConnections > 0 
      ? ((poolMetrics.activeConnections / poolConfig.max) * 100).toFixed(2) + '%'
      : '0%',
  };
};

// Check connection leaks (DATABASE-005)
export const checkConnectionLeaks = () => {
  const now = Date.now();
  const leaks = [];
  
  connectionAcquireTimes.forEach((acquireTime, client) => {
    const holdTime = now - acquireTime;
    if (holdTime > CONNECTION_LEAK_THRESHOLD) {
      leaks.push({
        client: client.processID,
        holdTimeMs: holdTime,
        thresholdMs: CONNECTION_LEAK_THRESHOLD,
      });
    }
  });
  
  return {
    hasLeaks: leaks.length > 0,
    leakCount: leaks.length,
    leaks,
    totalTrackedConnections: connectionAcquireTimes.size,
  };
};

// Graceful shutdown (DATABASE-005)
export const shutdownPool = async () => {
  logger.info('🔄 Shutting down database connection pool...');
  await pool.end();
  logger.info('✅ Database connection pool closed');
};

// Get slow queries (DATABASE-007)
export const getSlowQueries = (limit = 100) => {
  const sorted = [...slowQueries].sort((a, b) => b.duration - a.duration);
  return sorted.slice(0, limit);
};

// Get slow query statistics (DATABASE-007)
export const getSlowQueryStats = () => {
  if (slowQueries.length === 0) {
    return {
      total: 0,
      avgDuration: 0,
      maxDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      threshold: SLOW_QUERY_THRESHOLD,
    };
  }
  
  const durations = slowQueries.map(q => q.duration).sort((a, b) => a - b);
  const total = durations.length;
  const sum = durations.reduce((acc, d) => acc + d, 0);
  
  const p95Index = Math.floor(total * 0.95);
  const p99Index = Math.floor(total * 0.99);
  
  return {
    total,
    avgDuration: Math.round(sum / total),
    maxDuration: durations[durations.length - 1],
    p95Duration: durations[p95Index] || 0,
    p99Duration: durations[p99Index] || 0,
    threshold: SLOW_QUERY_THRESHOLD,
    topPatterns: getTopSlowQueryPatterns(),
  };
};

// Get top slow query patterns (DATABASE-007)
const getTopSlowQueryPatterns = () => {
  const patterns = new Map();
  
  slowQueries.forEach(sq => {
    // Normalize query by removing specific values
    const pattern = sq.query
      .replace(/\$\d+/g, '$?')
      .replace(/\d+/g, 'N')
      .replace(/'[^']*'/g, "'?'")
      .trim();
    
    if (!patterns.has(pattern)) {
      patterns.set(pattern, {
        pattern,
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        avgDuration: 0,
        examples: [],
      });
    }
    
    const stats = patterns.get(pattern);
    stats.count++;
    stats.totalDuration += sq.duration;
    stats.maxDuration = Math.max(stats.maxDuration, sq.duration);
    stats.avgDuration = Math.round(stats.totalDuration / stats.count);
    
    // Keep up to 3 examples
    if (stats.examples.length < 3) {
      stats.examples.push({
        query: sq.query,
        duration: sq.duration,
        timestamp: sq.timestamp,
      });
    }
  });
  
  return Array.from(patterns.values())
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, 10);
};

// Clear slow query log (DATABASE-007)
export const clearSlowQueries = () => {
  const count = slowQueries.length;
  slowQueries.length = 0;
  return { cleared: count };
};

// Log pool metrics periodically (DATABASE-005)
if (process.env.DB_POOL_METRICS_INTERVAL) {
  const interval = parseInt(process.env.DB_POOL_METRICS_INTERVAL);
  setInterval(() => {
    const metrics = getPoolMetrics();
    logger.info('📊 Pool Metrics:', metrics);
    
    const leakStatus = checkConnectionLeaks();
    if (leakStatus.hasLeaks) {
      logger.warn('⚠️  Connection Leaks:', leakStatus);
    }
  }, interval);
}

export default pool;
