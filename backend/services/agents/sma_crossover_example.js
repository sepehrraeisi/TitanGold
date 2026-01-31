// ============================================================================
// Example Agent: Simple Moving Average (SMA) Crossover Strategy
// ============================================================================
// 
// This is a complete example implementation using the agent template.
// It demonstrates:
// - Input validation
// - Error handling
// - Timeout protection
// - Health checks
// - Best practices
//
// Strategy: Buy when fast SMA crosses above slow SMA, sell when opposite
//
// ============================================================================

import { logger } from '../../services/logger.js';
// BACKEND-020: Import exchange abstraction for market data
// Uncomment to use real exchange data:
// import { getExchange } from '../exchanges/index.js';

// ============================================================================
// Configuration & Constants
// ============================================================================

const AGENT_KEY = 'sma_crossover_example';
const AGENT_NAME = 'SMA Crossover Example Agent';
const AGENT_DESCRIPTION = 'Example agent demonstrating SMA crossover strategy';
const AGENT_VERSION = '1.0.0';

const EXECUTION_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT) || 30000;
const MAX_RETRIES = 3;

// ============================================================================
// Input Validation
// ============================================================================

function validateRunParams(params) {
  const errors = [];
  
  if (!params) {
    errors.push('Parameters object is required');
    return { valid: false, errors };
  }
  
  // symbol is required for this agent
  if (!params.symbol) {
    errors.push('symbol is required');
  } else if (typeof params.symbol !== 'string') {
    errors.push('symbol must be a string');
  } else if (!/^[A-Za-z0-9]+$/.test(params.symbol)) {
    errors.push('symbol must contain only letters and numbers');
  }
  
  // timeframe validation
  if (params.timeframe) {
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    if (!validTimeframes.includes(params.timeframe)) {
      errors.push(`timeframe must be one of: ${validTimeframes.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function sanitizeParams(params) {
  return {
    userId: params.userId || null,
    symbol: params.symbol ? params.symbol.toUpperCase() : null,
    timeframe: params.timeframe || '1h',
    config: params.config || defaultConfig()
  };
}

// ============================================================================
// Core Agent Logic
// ============================================================================

export async function run(params) {
  const startTime = Date.now();
  
  try {
    logger.info(`🚀 ${AGENT_NAME} starting: ${JSON.stringify(params)}`);
    
    // Step 1: Validate input
    const validation = validateRunParams(params);
    if (!validation.valid) {
      const errorMsg = `Invalid parameters: ${validation.errors.join(', ')}`;
      logger.error(`❌ ${AGENT_NAME} validation failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // Step 2: Sanitize parameters
    const sanitized = sanitizeParams(params);
    
    // Step 3: Execute with timeout
    const resultPromise = executeWithTimeout(
      () => performAnalysis(sanitized),
      EXECUTION_TIMEOUT_MS
    );
    
    const result = await resultPromise;
    
    // Step 4: Add metadata
    const executionTime = Date.now() - startTime;
    result._meta = {
      ...result._meta,
      agent_key: AGENT_KEY,
      version: AGENT_VERSION,
      executionTime,
      timestamp: new Date().toISOString()
    };
    
    logger.info(`✅ ${AGENT_NAME} complete (${executionTime}ms): ${result.signal}`);
    return result;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`❌ ${AGENT_NAME} failed (${executionTime}ms):`, error.message);
    
    return {
      agent_key: AGENT_KEY,
      error: error.message,
      success: false,
      confidence: 0,
      timestamp: new Date().toISOString(),
      _meta: {
        agent_key: AGENT_KEY,
        version: AGENT_VERSION,
        executionTime,
        error: true
      }
    };
  }
}

async function performAnalysis(params) {
  const { symbol, timeframe, config } = params;
  
  // 1. Generate mock price data (in production, fetch from real API)
  const prices = generateMockPrices(100);
  
  // 2. Calculate SMAs
  const fastSMA = calculateSMA(prices, config.fast_period);
  const slowSMA = calculateSMA(prices, config.slow_period);
  
  // 3. Detect crossover
  const crossover = detectCrossover(prices, config.fast_period, config.slow_period);
  
  // 4. Generate signal
  let signal = 'NEUTRAL';
  let confidence = 0.5;
  
  if (crossover === 'golden') {
    signal = 'BUY';
    confidence = 0.75;
  } else if (crossover === 'death') {
    signal = 'SELL';
    confidence = 0.75;
  } else if (fastSMA > slowSMA) {
    signal = 'BUY';
    confidence = 0.6;
  } else if (fastSMA < slowSMA) {
    signal = 'SELL';
    confidence = 0.6;
  }
  
  // 5. Return result
  return {
    agent_key: AGENT_KEY,
    symbol,
    timeframe,
    signal,
    confidence,
    indicators: {
      fast_sma: fastSMA,
      slow_sma: slowSMA,
      crossover: crossover,
      current_price: prices[prices.length - 1]
    },
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate mock price data for testing
 * @param {number} count - Number of price points
 * @returns {number[]} Array of prices
 */
function generateMockPrices(count) {
  const prices = [];
  let price = 40000 + Math.random() * 5000; // Start around $40-45k
  
  for (let i = 0; i < count; i++) {
    // Random walk with slight upward bias
    const change = (Math.random() - 0.48) * 500;
    price = Math.max(35000, Math.min(50000, price + change));
    prices.push(price);
  }
  
  return prices;
}

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Price array
 * @param {number} period - SMA period
 * @returns {number} SMA value
 */
function calculateSMA(prices, period) {
  if (prices.length < period) {
    throw new Error(`Not enough data points. Need ${period}, got ${prices.length}`);
  }
  
  const recentPrices = prices.slice(-period);
  const sum = recentPrices.reduce((acc, price) => acc + price, 0);
  
  return sum / period;
}

/**
 * Detect SMA crossover
 * @param {number[]} prices - Price array
 * @param {number} fastPeriod - Fast SMA period
 * @param {number} slowPeriod - Slow SMA period
 * @returns {string} 'golden', 'death', or null
 */
function detectCrossover(prices, fastPeriod, slowPeriod) {
  if (prices.length < slowPeriod + 1) {
    return null;
  }
  
  // Current SMAs
  const currentFast = calculateSMA(prices, fastPeriod);
  const currentSlow = calculateSMA(prices, slowPeriod);
  
  // Previous SMAs
  const previousPrices = prices.slice(0, -1);
  const previousFast = calculateSMA(previousPrices, fastPeriod);
  const previousSlow = calculateSMA(previousPrices, slowPeriod);
  
  // Golden cross: fast crosses above slow
  if (previousFast <= previousSlow && currentFast > currentSlow) {
    return 'golden';
  }
  
  // Death cross: fast crosses below slow
  if (previousFast >= previousSlow && currentFast < currentSlow) {
    return 'death';
  }
  
  return null;
}

/**
 * Execute with timeout protection
 */
async function executeWithTimeout(fn, timeoutMs) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// ============================================================================
// Agent Details
// ============================================================================

export async function getDetails({ userId }) {
  try {
    return {
      agent_key: AGENT_KEY,
      name: AGENT_NAME,
      description: AGENT_DESCRIPTION,
      version: AGENT_VERSION,
      status: 'active',
      capabilities: [
        'Simple Moving Average (SMA) calculation',
        'Golden cross detection',
        'Death cross detection',
        'Trend analysis'
      ],
      lastRun: null,
      metrics: {
        totalRuns: 0,
        avgExecutionTime: 0,
        successRate: 0
      }
    };
  } catch (error) {
    logger.error(`❌ Failed to get ${AGENT_NAME} details:`, error.message);
    throw error;
  }
}

// ============================================================================
// Commands
// ============================================================================

export async function command({ command, payload }) {
  logger.info(`⚡ ${AGENT_NAME} command: ${command}`);
  
  try {
    switch (command) {
      case 'reset':
        return { success: true, message: 'Agent reset successful' };
      
      case 'calibrate':
        return { success: true, message: 'Agent calibrated' };
      
      case 'status':
        return {
          success: true,
          status: 'active',
          message: 'Agent is operational'
        };
      
      case 'test':
        // Run a test analysis
        const testResult = await run({
          symbol: 'BTCUSDT',
          timeframe: '1h'
        });
        return {
          success: !testResult.error,
          result: testResult
        };
      
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    logger.error(`❌ ${AGENT_NAME} command failed:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// Configuration
// ============================================================================

export function defaultConfig() {
  return {
    enabled: true,
    timeout: EXECUTION_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    
    // SMA-specific configuration
    fast_period: 20,    // Fast SMA period (e.g., 20 candles)
    slow_period: 50,    // Slow SMA period (e.g., 50 candles)
    min_confidence: 0.5 // Minimum confidence threshold
  };
}

export function validateConfig(config) {
  const errors = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }
  
  // Validate fast_period
  if (config.fast_period !== undefined) {
    if (typeof config.fast_period !== 'number') {
      errors.push('fast_period must be a number');
    } else if (config.fast_period < 2 || config.fast_period > 200) {
      errors.push('fast_period must be between 2 and 200');
    }
  }
  
  // Validate slow_period
  if (config.slow_period !== undefined) {
    if (typeof config.slow_period !== 'number') {
      errors.push('slow_period must be a number');
    } else if (config.slow_period < 2 || config.slow_period > 200) {
      errors.push('slow_period must be between 2 and 200');
    }
  }
  
  // Validate relationship: fast < slow
  if (config.fast_period && config.slow_period) {
    if (config.fast_period >= config.slow_period) {
      errors.push('fast_period must be less than slow_period');
    }
  }
  
  // Validate min_confidence
  if (config.min_confidence !== undefined) {
    if (typeof config.min_confidence !== 'number') {
      errors.push('min_confidence must be a number');
    } else if (config.min_confidence < 0 || config.min_confidence > 1) {
      errors.push('min_confidence must be between 0 and 1');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Health Check
// ============================================================================

export async function healthCheck() {
  try {
    const checks = {
      configValid: false,
      memoryOk: false,
      dependenciesOk: false,
      canExecute: false
    };
    
    // Check 1: Config validation
    const config = defaultConfig();
    const configValidation = validateConfig(config);
    checks.configValid = configValidation.valid;
    
    // Check 2: Memory usage
    const memUsage = process.memoryUsage();
    checks.memoryOk = memUsage.heapUsed < memUsage.heapTotal * 0.9;
    
    // Check 3: Dependencies (none for this simple agent)
    checks.dependenciesOk = true;
    
    // Check 4: Test execution
    try {
      const testResult = await run({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        config: defaultConfig()
      });
      checks.canExecute = testResult && testResult.agent_key === AGENT_KEY && !testResult.error;
    } catch (error) {
      checks.canExecute = false;
      logger.warn(`Health check execution test failed: ${error.message}`);
    }
    
    // Determine status
    const allChecksPass = Object.values(checks).every(v => v === true);
    const anyCheckFail = Object.values(checks).some(v => v === false);
    
    let status = 'healthy';
    if (!allChecksPass && anyCheckFail) {
      status = 'degraded';
    }
    if (!checks.canExecute) {
      status = 'unhealthy';
    }
    
    return {
      status,
      checks,
      metadata: {
        agent: AGENT_KEY,
        version: AGENT_VERSION,
        memoryUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`❌ ${AGENT_NAME} health check failed:`, error.message);
    return {
      status: 'unhealthy',
      error: error.message,
      metadata: {
        agent: AGENT_KEY,
        version: AGENT_VERSION
      }
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  run,
  getDetails,
  command,
  defaultConfig,
  validateConfig,
  healthCheck
};
