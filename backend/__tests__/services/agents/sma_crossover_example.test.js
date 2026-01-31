// ============================================================================
// Unit Tests: SMA Crossover Example Agent (BACKEND-018)
// ============================================================================

import {
  run,
  getDetails,
  command,
  defaultConfig,
  validateConfig,
  healthCheck
} from '../../../services/agents/sma_crossover_example.js';

describe('SMA Crossover Example Agent (BACKEND-018)', () => {
  // ============================================================================
  // run() Tests
  // ============================================================================

  describe('run()', () => {
    it('should return valid result for valid input', async () => {
      const result = await run({
        symbol: 'BTCUSDT',
        timeframe: '1h'
      });
      
      expect(result).toBeDefined();
      expect(result.agent_key).toBe('sma_crossover_example');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timeframe).toBe('1h');
      expect(['BUY', 'SELL', 'NEUTRAL']).toContain(result.signal);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.indicators).toBeDefined();
      expect(result.indicators.fast_sma).toBeDefined();
      expect(result.indicators.slow_sma).toBeDefined();
      expect(result._meta).toBeDefined();
      expect(result._meta.executionTime).toBeDefined();
    });

    it('should handle missing symbol', async () => {
      const result = await run({
        timeframe: '1h'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('symbol is required');
    });

    it('should handle invalid symbol format', async () => {
      const result = await run({
        symbol: 'btc@usdt', // Invalid characters
        timeframe: '1h'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('letters and numbers');
    });

    it('should handle invalid timeframe', async () => {
      const result = await run({
        symbol: 'BTCUSDT',
        timeframe: '2h' // Invalid timeframe
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeframe must be one of');
    });

    it('should use default timeframe when not provided', async () => {
      const result = await run({
        symbol: 'BTCUSDT'
      });
      
      expect(result.timeframe).toBe('1h'); // Default timeframe
    });

    it('should normalize symbol to uppercase', async () => {
      const result = await run({
        symbol: 'btcusdt'
      });
      
      expect(result.symbol).toBe('BTCUSDT');
    });

    it('should include execution metadata', async () => {
      const result = await run({
        symbol: 'BTCUSDT'
      });
      
      expect(result._meta).toBeDefined();
      expect(result._meta.agent_key).toBe('sma_crossover_example');
      expect(result._meta.version).toBe('1.0.0');
      expect(result._meta.executionTime).toBeGreaterThan(0);
      expect(result._meta.timestamp).toBeDefined();
    });

    it('should return indicators data', async () => {
      const result = await run({
        symbol: 'BTCUSDT'
      });
      
      expect(result.indicators).toBeDefined();
      expect(typeof result.indicators.fast_sma).toBe('number');
      expect(typeof result.indicators.slow_sma).toBe('number');
      expect(typeof result.indicators.current_price).toBe('number');
      expect(result.indicators.crossover).toBeDefined();
    });
  });

  // ============================================================================
  // getDetails() Tests
  // ============================================================================

  describe('getDetails()', () => {
    it('should return agent details', async () => {
      const details = await getDetails({ userId: 'test-user' });
      
      expect(details).toBeDefined();
      expect(details.agent_key).toBe('sma_crossover_example');
      expect(details.name).toBe('SMA Crossover Example Agent');
      expect(details.description).toBeDefined();
      expect(details.version).toBe('1.0.0');
      expect(details.status).toBe('active');
      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
      expect(details.metrics).toBeDefined();
    });
  });

  // ============================================================================
  // command() Tests
  // ============================================================================

  describe('command()', () => {
    it('should handle reset command', async () => {
      const result = await command({
        command: 'reset',
        payload: {}
      });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset');
    });

    it('should handle calibrate command', async () => {
      const result = await command({
        command: 'calibrate',
        payload: {}
      });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('calibrated');
    });

    it('should handle status command', async () => {
      const result = await command({
        command: 'status',
        payload: {}
      });
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('active');
    });

    it('should handle test command', async () => {
      const result = await command({
        command: 'test',
        payload: {}
      });
      
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
    });

    it('should reject unknown command', async () => {
      const result = await command({
        command: 'unknown_command',
        payload: {}
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });
  });

  // ============================================================================
  // defaultConfig() Tests
  // ============================================================================

  describe('defaultConfig()', () => {
    it('should return default configuration', () => {
      const config = defaultConfig();
      
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config.enabled).toBe(true);
      expect(config.fast_period).toBe(20);
      expect(config.slow_period).toBe(50);
      expect(config.min_confidence).toBe(0.5);
    });

    it('should have fast_period < slow_period', () => {
      const config = defaultConfig();
      
      expect(config.fast_period).toBeLessThan(config.slow_period);
    });
  });

  // ============================================================================
  // validateConfig() Tests
  // ============================================================================

  describe('validateConfig()', () => {
    it('should validate correct config', () => {
      const config = defaultConfig();
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject non-object config', () => {
      const validation = validateConfig('not an object');
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Config must be an object');
    });

    it('should reject invalid fast_period type', () => {
      const config = { ...defaultConfig(), fast_period: 'invalid' };
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('fast_period must be a number'))).toBe(true);
    });

    it('should reject fast_period out of range', () => {
      const config = { ...defaultConfig(), fast_period: 300 };
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('fast_period must be between'))).toBe(true);
    });

    it('should reject slow_period out of range', () => {
      const config = { ...defaultConfig(), slow_period: 1 };
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('slow_period must be between'))).toBe(true);
    });

    it('should reject fast_period >= slow_period', () => {
      const config = { ...defaultConfig(), fast_period: 50, slow_period: 20 };
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('fast_period must be less than slow_period'))).toBe(true);
    });

    it('should reject min_confidence out of range', () => {
      const config = { ...defaultConfig(), min_confidence: 1.5 };
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('min_confidence must be between 0 and 1'))).toBe(true);
    });

    it('should accept partial config', () => {
      const config = { fast_period: 15, slow_period: 40 };
      const validation = validateConfig(config);
      
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================================================
  // healthCheck() Tests
  // ============================================================================

  describe('healthCheck()', () => {
    it('should return health status', async () => {
      const health = await healthCheck();
      
      expect(health).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.checks).toBeDefined();
      expect(health.metadata).toBeDefined();
    });

    it('should include all required checks', async () => {
      const health = await healthCheck();
      
      expect(health.checks.configValid).toBeDefined();
      expect(health.checks.memoryOk).toBeDefined();
      expect(health.checks.dependenciesOk).toBeDefined();
      expect(health.checks.canExecute).toBeDefined();
    });

    it('should validate config in health check', async () => {
      const health = await healthCheck();
      
      expect(health.checks.configValid).toBe(true);
    });

    it('should test execution in health check', async () => {
      const health = await healthCheck();
      
      // canExecute should be true if agent works
      expect(typeof health.checks.canExecute).toBe('boolean');
    });

    it('should include metadata', async () => {
      const health = await healthCheck();
      
      expect(health.metadata.agent).toBe('sma_crossover_example');
      expect(health.metadata.version).toBe('1.0.0');
      expect(health.metadata.memoryUsed).toBeDefined();
      expect(health.metadata.timestamp).toBeDefined();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration: Complete Workflow', () => {
    it('should execute complete analysis workflow', async () => {
      // 1. Get details
      const details = await getDetails({ userId: 'test' });
      expect(details.agent_key).toBe('sma_crossover_example');
      
      // 2. Validate config
      const config = defaultConfig();
      const validation = validateConfig(config);
      expect(validation.valid).toBe(true);
      
      // 3. Run analysis
      const result = await run({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        config: config
      });
      expect(result.agent_key).toBe('sma_crossover_example');
      expect(result.signal).toBeDefined();
      
      // 4. Check health
      const health = await healthCheck();
      expect(health.status).toBeDefined();
    });

    it('should handle multiple runs', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      
      for (const symbol of symbols) {
        const result = await run({ symbol });
        expect(result.agent_key).toBe('sma_crossover_example');
        expect(result.symbol).toBe(symbol);
      }
    });
  });
});
