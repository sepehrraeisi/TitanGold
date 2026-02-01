/**
 * Production Environment Configuration (INFRA-008)
 * 
 * Configuration for production environment.
 * Maximum security, performance, and reliability settings.
 * 
 * NOTE: All secrets MUST come from environment variables, never hardcoded.
 * ALL sensitive values are required and have NO defaults.
 */

import { getEnvVar } from './schema.js';

export default {
  // Environment
  nodeEnv: 'production',

  // Server
  port: getEnvVar('PORT', 'number', 5001),

  // Database - All values REQUIRED from environment
  database: {
    host: getEnvVar('DB_HOST', 'string'), // Required - no default
    port: getEnvVar('DB_PORT', 'number', 5432),
    name: getEnvVar('DB_NAME', 'string'), // Required - no default
    user: getEnvVar('DB_USER', 'string'), // Required - no default
    password: getEnvVar('DB_PASSWORD', 'string'), // Required - no default
    url: getEnvVar('DATABASE_URL', 'string'), // Required - no default
    ssl: getEnvVar('DB_SSL', 'boolean', true), // Enforce SSL
    sslRejectUnauthorized: getEnvVar('DB_SSL_REJECT_UNAUTHORIZED', 'boolean', true) // Strict SSL
  },

  // Database Pool - Optimized for production load
  dbPool: {
    max: getEnvVar('DB_POOL_MAX', 'number', 20),
    min: getEnvVar('DB_POOL_MIN', 'number', 5),
    idleTimeout: getEnvVar('DB_POOL_IDLE_TIMEOUT', 'number', 30000),
    connectionTimeout: getEnvVar('DB_POOL_CONNECTION_TIMEOUT', 'number', 2000),
    maxLifetime: getEnvVar('DB_POOL_MAX_LIFETIME', 'number', 3600),
    leakThreshold: getEnvVar('DB_POOL_LEAK_THRESHOLD', 'number', 30000)
  },

  // JWT - REQUIRED from environment, NO defaults
  jwt: {
    secret: getEnvVar('JWT_SECRET', 'string'), // Required - no default
    expiresIn: getEnvVar('JWT_EXPIRES_IN', 'string', '7d'),
    refreshExpiresIn: getEnvVar('REFRESH_TOKEN_EXPIRES_IN', 'string', '30d')
  },

  // Redis - REQUIRED from environment
  redis: {
    url: getEnvVar('REDIS_URL', 'string'), // Required - no default
    password: getEnvVar('REDIS_PASSWORD', 'string') // Required - no default
  },

  // CORS - Strict whitelisting for production domains
  cors: {
    allowedOrigins: getEnvVar('CORS_ALLOWED_ORIGINS', 'array', [
      'https://titangold.com',
      'https://www.titangold.com',
      'https://app.titangold.com'
    ])
  },

  // Rate Limiting - Strict limits for production
  rateLimit: {
    windowMs: getEnvVar('RATE_LIMIT_WINDOW_MS', 'number', 900000), // 15 minutes
    maxRequests: getEnvVar('RATE_LIMIT_MAX_REQUESTS', 'number', 100) // Conservative
  },

  // Encryption - REQUIRED from environment, NO default
  encryption: {
    key: getEnvVar('ENCRYPTION_KEY', 'string') // Required - no default
  },

  // Engine
  engine: {
    enabled: getEnvVar('ENGINE_ENABLED', 'boolean', false)
  },

  // Git
  git: {
    sha: getEnvVar('GIT_SHA', 'string', 'production-unknown')
  },

  // External API
  externalApi: {
    sslVerify: getEnvVar('EXTERNAL_API_SSL_VERIFY', 'boolean', true) // Always verify SSL
  },

  // Production-specific settings
  logging: {
    level: 'warn', // Only warnings and errors
    prettyPrint: false, // JSON format for log aggregation
    includeStack: false // Don't expose stack traces
  },

  security: {
    helmetEnabled: true, // Always enabled
    corsStrict: true, // Strict CORS enforcement
    trustProxy: true // Behind load balancer/CDN
  },

  features: {
    swaggerUI: false, // Disable API docs in production
    debugEndpoints: false, // Disable debug endpoints
    hotReload: false
  }
};
