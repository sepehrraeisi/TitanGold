import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validate, getEnvVar, configSchema } from '../../config/schema.js';

describe('Configuration Schema and Validation (INFRA-008)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a fresh copy of environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getEnvVar', () => {
    it('should return environment variable value', () => {
      process.env.TEST_VAR = 'test_value';
      expect(getEnvVar('TEST_VAR', 'string')).toBe('test_value');
    });

    it('should return default value when env var is not set', () => {
      expect(getEnvVar('NOT_SET', 'string', 'default')).toBe('default');
    });

    it('should parse numbers correctly', () => {
      process.env.TEST_NUMBER = '123';
      expect(getEnvVar('TEST_NUMBER', 'number')).toBe(123);
    });

    it('should parse booleans correctly', () => {
      process.env.TEST_BOOL_TRUE = 'true';
      process.env.TEST_BOOL_FALSE = 'false';
      process.env.TEST_BOOL_1 = '1';
      
      expect(getEnvVar('TEST_BOOL_TRUE', 'boolean')).toBe(true);
      expect(getEnvVar('TEST_BOOL_FALSE', 'boolean')).toBe(false);
      expect(getEnvVar('TEST_BOOL_1', 'boolean')).toBe(true);
    });

    it('should parse arrays correctly', () => {
      process.env.TEST_ARRAY = 'a,b,c';
      expect(getEnvVar('TEST_ARRAY', 'array')).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty arrays', () => {
      process.env.TEST_EMPTY = '';
      expect(getEnvVar('TEST_EMPTY', 'array')).toEqual([]);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate a valid configuration', () => {
      const config = {
        nodeEnv: 'development',
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user',
          ssl: false,
          sslRejectUnauthorized: true
        },
        dbPool: {
          max: 20,
          min: 2,
          idleTimeout: 30000,
          connectionTimeout: 2000,
          maxLifetime: 3600,
          leakThreshold: 30000
        },
        jwt: {
          secret: 'a'.repeat(32),
          expiresIn: '7d',
          refreshExpiresIn: '30d'
        },
        redis: {
          url: 'redis://localhost:6379'
        },
        cors: {
          allowedOrigins: ['http://localhost:3000']
        },
        rateLimit: {
          windowMs: 900000,
          maxRequests: 100
        },
        encryption: {
          key: 'b'.repeat(32)
        },
        engine: {
          enabled: false
        },
        externalApi: {
          sslVerify: true
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation when required fields are missing', () => {
      const config = {
        port: 5001,
        database: {
          host: 'localhost'
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('nodeEnv'))).toBe(true);
    });

    it('should validate type constraints', () => {
      const config = {
        nodeEnv: 'development',
        port: 'not a number', // Should be number
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
        },
        jwt: {
          secret: 'a'.repeat(32)
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('port') && e.includes('number'))).toBe(true);
    });

    it('should validate enum constraints', () => {
      const config = {
        nodeEnv: 'invalid_env', // Should be one of: development, staging, production, test
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
        },
        jwt: {
          secret: 'a'.repeat(32)
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nodeEnv') && e.includes('one of'))).toBe(true);
    });

    it('should validate minimum length constraints', () => {
      const config = {
        nodeEnv: 'development',
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
        },
        jwt: {
          secret: 'short' // Should be at least 32 characters
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('jwt.secret') && e.includes('32 characters'))).toBe(true);
    });

    it('should validate numeric range constraints', () => {
      const config = {
        nodeEnv: 'development',
        port: 100000, // Should be max 65535
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
        },
        jwt: {
          secret: 'a'.repeat(32)
        },
        encryption: {
          key: 'b'.repeat(32)
        },
        dbPool: {
          max: 200, // Should be max 100
          min: 0
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('port') && e.includes('65535'))).toBe(true);
      expect(result.errors.some(e => e.includes('dbPool.max') && e.includes('100'))).toBe(true);
    });

    it('should validate boolean types', () => {
      const config = {
        nodeEnv: 'development',
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user',
          ssl: 'yes' // Should be boolean
        },
        jwt: {
          secret: 'a'.repeat(32)
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('database.ssl') && e.includes('boolean'))).toBe(true);
    });

    it('should validate array types', () => {
      const config = {
        nodeEnv: 'development',
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
        },
        cors: {
          allowedOrigins: 'not-an-array' // Should be array
        },
        jwt: {
          secret: 'a'.repeat(32)
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cors.allowedOrigins') && e.includes('array'))).toBe(true);
    });

    it('should handle optional fields with defaults', () => {
      const config = {
        nodeEnv: 'development',
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
          // password is optional
        },
        jwt: {
          secret: 'a'.repeat(32)
          // expiresIn is optional
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(true);
    });

    it('should validate nested objects', () => {
      const config = {
        nodeEnv: 'development',
        port: 5001,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'test_db',
          user: 'test_user'
        },
        dbPool: {
          max: 'not-a-number', // Should be number
          min: 2
        },
        jwt: {
          secret: 'a'.repeat(32)
        },
        encryption: {
          key: 'b'.repeat(32)
        }
      };

      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('dbPool.max') && e.includes('number'))).toBe(true);
    });
  });

  describe('Configuration Schema Structure', () => {
    it('should have all required top-level keys', () => {
      const requiredKeys = [
        'nodeEnv',
        'port',
        'database',
        'dbPool',
        'jwt',
        'redis',
        'cors',
        'rateLimit',
        'encryption',
        'engine'
      ];

      requiredKeys.forEach(key => {
        expect(configSchema).toHaveProperty(key);
      });
    });

    it('should mark secrets appropriately', () => {
      expect(configSchema.jwt.secret.secret).toBe(true);
      expect(configSchema.encryption.key.secret).toBe(true);
      expect(configSchema.database.password.secret).toBe(true);
    });

    it('should have proper environment variable mappings', () => {
      expect(configSchema.port.envVar).toBe('PORT');
      expect(configSchema.database.host.envVar).toBe('DB_HOST');
      expect(configSchema.jwt.secret.envVar).toBe('JWT_SECRET');
    });
  });
});
