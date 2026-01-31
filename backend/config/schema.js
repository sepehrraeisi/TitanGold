/**
 * Configuration Schema and Validation (INFRA-008)
 * 
 * Defines the structure and validation rules for environment-specific configuration.
 * All secrets MUST be provided via environment variables, never hardcoded.
 */

/**
 * Configuration schema with validation rules
 */
export const configSchema = {
  // Environment
  nodeEnv: {
    type: 'string',
    required: true,
    enum: ['development', 'staging', 'production', 'test'],
    envVar: 'NODE_ENV',
    default: 'development'
  },

  // Server
  port: {
    type: 'number',
    required: true,
    envVar: 'PORT',
    default: 5001,
    min: 1,
    max: 65535
  },

  // Database
  database: {
    host: {
      type: 'string',
      required: true,
      envVar: 'DB_HOST',
      default: 'localhost'
    },
    port: {
      type: 'number',
      required: true,
      envVar: 'DB_PORT',
      default: 5432,
      min: 1,
      max: 65535
    },
    name: {
      type: 'string',
      required: true,
      envVar: 'DB_NAME'
    },
    user: {
      type: 'string',
      required: true,
      envVar: 'DB_USER'
    },
    password: {
      type: 'string',
      required: false,
      secret: true,
      envVar: 'DB_PASSWORD'
    },
    url: {
      type: 'string',
      required: false,
      secret: true,
      envVar: 'DATABASE_URL'
    },
    ssl: {
      type: 'boolean',
      required: false,
      envVar: 'DB_SSL',
      default: false
    },
    sslRejectUnauthorized: {
      type: 'boolean',
      required: false,
      envVar: 'DB_SSL_REJECT_UNAUTHORIZED',
      default: true
    }
  },

  // Database Pool
  dbPool: {
    max: {
      type: 'number',
      required: false,
      envVar: 'DB_POOL_MAX',
      default: 20,
      min: 1,
      max: 100
    },
    min: {
      type: 'number',
      required: false,
      envVar: 'DB_POOL_MIN',
      default: 2,
      min: 0,
      max: 50
    },
    idleTimeout: {
      type: 'number',
      required: false,
      envVar: 'DB_POOL_IDLE_TIMEOUT',
      default: 30000,
      min: 1000
    },
    connectionTimeout: {
      type: 'number',
      required: false,
      envVar: 'DB_POOL_CONNECTION_TIMEOUT',
      default: 2000,
      min: 100
    },
    maxLifetime: {
      type: 'number',
      required: false,
      envVar: 'DB_POOL_MAX_LIFETIME',
      default: 3600,
      min: 60
    },
    leakThreshold: {
      type: 'number',
      required: false,
      envVar: 'DB_POOL_LEAK_THRESHOLD',
      default: 30000,
      min: 1000
    }
  },

  // JWT
  jwt: {
    secret: {
      type: 'string',
      required: true,
      secret: true,
      envVar: 'JWT_SECRET',
      minLength: 32
    },
    expiresIn: {
      type: 'string',
      required: false,
      envVar: 'JWT_EXPIRES_IN',
      default: '7d'
    },
    refreshExpiresIn: {
      type: 'string',
      required: false,
      envVar: 'REFRESH_TOKEN_EXPIRES_IN',
      default: '30d'
    }
  },

  // Redis
  redis: {
    url: {
      type: 'string',
      required: false,
      envVar: 'REDIS_URL',
      default: 'redis://localhost:6379'
    },
    password: {
      type: 'string',
      required: false,
      secret: true,
      envVar: 'REDIS_PASSWORD'
    }
  },

  // CORS
  cors: {
    allowedOrigins: {
      type: 'array',
      required: false,
      envVar: 'CORS_ALLOWED_ORIGINS',
      default: ['http://localhost:3000', 'http://localhost:5173']
    }
  },

  // Rate Limiting
  rateLimit: {
    windowMs: {
      type: 'number',
      required: false,
      envVar: 'RATE_LIMIT_WINDOW_MS',
      default: 900000, // 15 minutes
      min: 1000
    },
    maxRequests: {
      type: 'number',
      required: false,
      envVar: 'RATE_LIMIT_MAX_REQUESTS',
      default: 100,
      min: 1
    }
  },

  // Encryption
  encryption: {
    key: {
      type: 'string',
      required: true,
      secret: true,
      envVar: 'ENCRYPTION_KEY',
      minLength: 32
    }
  },

  // Engine
  engine: {
    enabled: {
      type: 'boolean',
      required: false,
      envVar: 'ENGINE_ENABLED',
      default: false
    }
  },

  // Git
  git: {
    sha: {
      type: 'string',
      required: false,
      envVar: 'GIT_SHA'
    }
  },

  // External API SSL
  externalApi: {
    sslVerify: {
      type: 'boolean',
      required: false,
      envVar: 'EXTERNAL_API_SSL_VERIFY',
      default: true
    }
  }
};

/**
 * Validate a single configuration value
 */
function validateValue(value, rules, path) {
  const errors = [];

  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${path} is required`);
    return errors;
  }

  // If value is not provided and not required, use default
  if (value === undefined || value === null || value === '') {
    return errors;
  }

  // Type validation
  switch (rules.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${path} must be a string, got ${typeof value}`);
      } else {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${path} must be at least ${rules.minLength} characters long`);
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${path} must be one of: ${rules.enum.join(', ')}`);
        }
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`${path} must be a number, got ${typeof value}`);
      } else {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${path} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${path} must be at most ${rules.max}`);
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`${path} must be a boolean, got ${typeof value}`);
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array, got ${typeof value}`);
      }
      break;
  }

  return errors;
}

/**
 * Recursively validate configuration object against schema
 */
function validateConfig(config, schema, path = '') {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const currentPath = path ? `${path}.${key}` : key;
    const value = config[key];

    if (rules.type === 'object' || (typeof rules === 'object' && !rules.type && !rules.envVar)) {
      // Nested object
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        errors.push(...validateConfig(value, rules, currentPath));
      } else if (rules.required) {
        errors.push(`${currentPath} is required`);
      }
    } else {
      // Leaf value
      errors.push(...validateValue(value, rules, currentPath));
    }
  }

  return errors;
}

/**
 * Validate entire configuration
 * @param {Object} config - Configuration object to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validate(config) {
  const errors = validateConfig(config, configSchema);

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get environment variable with type coercion
 */
export function getEnvVar(envVar, type, defaultValue) {
  const value = process.env[envVar];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  // Handle empty string specially for arrays
  if (value === '' && type === 'array') {
    return [];
  }

  if (value === '') {
    return defaultValue;
  }

  switch (type) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;

    case 'boolean':
      return value === 'true' || value === '1' || value === 'yes';

    case 'array':
      return value.split(',').map(v => v.trim()).filter(Boolean);

    case 'string':
    default:
      return value;
  }
}

export default {
  configSchema,
  validate,
  getEnvVar
};
