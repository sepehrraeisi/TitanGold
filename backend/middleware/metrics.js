/**
 * Prometheus Metrics Middleware
 * Task: INFRA-006
 * 
 * Exposes metrics at /metrics endpoint for Prometheus scraping:
 * - Default metrics: CPU, memory, event loop lag, GC stats
 * - Custom metrics: HTTP request duration, agent execution time, cache hit rate
 */

import promClient from 'prom-client';
import { logger } from '../services/logger.js';

// ============================================================================
// PROMETHEUS REGISTRY
// ============================================================================

// Create a custom registry
export const register = new promClient.Registry();

// Add default labels to all metrics
register.setDefaultLabels({
  app: 'titangold-backend',
  environment: process.env.NODE_ENV || 'development',
});

// ============================================================================
// DEFAULT METRICS (Node.js process metrics)
// ============================================================================

// Collect default metrics (CPU, memory, event loop lag, etc.).
// Skip in unit tests: monitorEventLoopDelay keeps the Jest process alive
// when the suite runs in-band (GHA 2-CPU → maxWorkers 50% → 1).
if (process.env.NODE_ENV !== 'test') {
  promClient.collectDefaultMetrics({
    register,
    prefix: 'titangold_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // seconds
  });

  logger.info('Prometheus default metrics enabled', {
    prefix: 'titangold_',
    metrics: [
      'process_cpu_user_seconds_total',
      'process_cpu_system_seconds_total',
      'process_resident_memory_bytes',
      'process_heap_bytes',
      'nodejs_eventloop_lag_seconds',
      'nodejs_gc_duration_seconds',
    ],
  });
}

// ============================================================================
// CUSTOM METRICS
// ============================================================================

/**
 * HTTP Request Duration Histogram
 * Tracks API request response times
 */
export const httpRequestDuration = new promClient.Histogram({
  name: 'titangold_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // seconds
  registers: [register],
});

/**
 * HTTP Request Counter
 * Tracks total number of HTTP requests
 */
export const httpRequestCounter = new promClient.Counter({
  name: 'titangold_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * Active Requests Gauge
 * Tracks currently active HTTP requests
 */
export const activeRequestsGauge = new promClient.Gauge({
  name: 'titangold_http_active_requests',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method', 'route'],
  registers: [register],
});

/**
 * Agent Execution Duration Histogram
 * Tracks AI agent execution times
 */
export const agentExecutionDuration = new promClient.Histogram({
  name: 'titangold_agent_execution_duration_seconds',
  help: 'Duration of AI agent executions in seconds',
  labelNames: ['agent_type', 'agent_id', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120], // seconds
  registers: [register],
});

/**
 * Agent Execution Counter
 * Tracks total number of agent executions
 */
export const agentExecutionCounter = new promClient.Counter({
  name: 'titangold_agent_executions_total',
  help: 'Total number of AI agent executions',
  labelNames: ['agent_type', 'agent_id', 'status'],
  registers: [register],
});

/**
 * Cache Operations Counter
 * Tracks cache hits and misses
 */
export const cacheOperationsCounter = new promClient.Counter({
  name: 'titangold_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
});

/**
 * Cache Hit Rate Gauge
 * Tracks cache hit rate as a percentage (0-100)
 */
export const cacheHitRateGauge = new promClient.Gauge({
  name: 'titangold_cache_hit_rate_percent',
  help: 'Cache hit rate as a percentage (0-100)',
  registers: [register],
});

/**
 * Database Query Duration Histogram
 * Tracks database query execution times
 */
export const dbQueryDuration = new promClient.Histogram({
  name: 'titangold_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5], // seconds
  registers: [register],
});

/**
 * Database Connection Pool Gauge
 * Tracks database connection pool metrics
 */
export const dbPoolActiveConnections = new promClient.Gauge({
  name: 'titangold_db_pool_active_connections',
  help: 'Number of active database connections',
  registers: [register],
});

export const dbPoolIdleConnections = new promClient.Gauge({
  name: 'titangold_db_pool_idle_connections',
  help: 'Number of idle database connections',
  registers: [register],
});

export const dbPoolWaitingRequests = new promClient.Gauge({
  name: 'titangold_db_pool_waiting_requests',
  help: 'Number of requests waiting for a database connection',
  registers: [register],
});

/**
 * Trading Engine Metrics
 */
export const tradeExecutionCounter = new promClient.Counter({
  name: 'titangold_trades_executed_total',
  help: 'Total number of trades executed',
  labelNames: ['exchange', 'symbol', 'side', 'status'],
  registers: [register],
});

export const tradeExecutionDuration = new promClient.Histogram({
  name: 'titangold_trade_execution_duration_seconds',
  help: 'Duration of trade execution in seconds',
  labelNames: ['exchange', 'symbol'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * WebSocket Connections Gauge
 */
export const websocketConnectionsGauge = new promClient.Gauge({
  name: 'titangold_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['type'], // 'notifications', 'favorites', etc.
  registers: [register],
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate and update cache hit rate
 */
let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit() {
  cacheHits++;
  cacheOperationsCounter.inc({ operation: 'get', result: 'hit' });
  updateCacheHitRate();
}

export function recordCacheMiss() {
  cacheMisses++;
  cacheOperationsCounter.inc({ operation: 'get', result: 'miss' });
  updateCacheHitRate();
}

export function recordCacheSet() {
  cacheOperationsCounter.inc({ operation: 'set', result: 'success' });
}

export function recordCacheDelete() {
  cacheOperationsCounter.inc({ operation: 'delete', result: 'success' });
}

function updateCacheHitRate() {
  const total = cacheHits + cacheMisses;
  if (total > 0) {
    const hitRate = (cacheHits / total) * 100;
    cacheHitRateGauge.set(hitRate);
  }
}

/**
 * Reset cache statistics (optional, for testing)
 */
export function resetCacheStats() {
  cacheHits = 0;
  cacheMisses = 0;
  cacheHitRateGauge.set(0);
}

// ============================================================================
// MIDDLEWARE: Track HTTP Requests
// ============================================================================

/**
 * Middleware to track HTTP request metrics
 * Should be applied early in the middleware chain
 */
export function metricsMiddleware(req, res, next) {
  // Skip metrics collection for the /metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime.bigint();
  
  // Normalize route path (remove IDs, UUIDs)
  const route = normalizeRoutePath(req.path);
  
  // Increment active requests
  activeRequestsGauge.inc({ method: req.method, route });

  // Track when response finishes
  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const statusCode = res.statusCode;

    // Record metrics
    httpRequestDuration.observe(
      { method: req.method, route, status_code: statusCode },
      durationSeconds
    );
    
    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    // Decrement active requests
    activeRequestsGauge.dec({ method: req.method, route });
  });

  next();
}

/**
 * Normalize route paths by replacing IDs/UUIDs with placeholders
 * Examples:
 *   /api/v1/users/123 -> /api/v1/users/:id
 *   /api/v1/portfolios/abc-123-def -> /api/v1/portfolios/:id
 */
function normalizeRoutePath(path) {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs
    .replace(/\/\d+\b/g, '/:id')
    // Replace agent-N patterns
    .replace(/\/agent-\d+/g, '/agent-:id')
    // Replace alphanumeric IDs (6+ chars)
    .replace(/\/[a-zA-Z0-9_-]{6,}/g, '/:id');
}

// ============================================================================
// METRICS ENDPOINT HANDLER
// ============================================================================

/**
 * Express handler for /metrics endpoint
 * Returns metrics in Prometheus exposition format
 */
export async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).end('Internal Server Error');
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

logger.info('Prometheus metrics initialized', {
  endpoint: '/metrics',
  customMetrics: [
    'http_request_duration_seconds',
    'http_requests_total',
    'http_active_requests',
    'agent_execution_duration_seconds',
    'agent_executions_total',
    'cache_operations_total',
    'cache_hit_rate_percent',
    'db_query_duration_seconds',
    'db_pool_*_connections',
    'trades_executed_total',
    'websocket_connections_active',
  ],
});
