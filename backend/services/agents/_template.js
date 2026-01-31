// ============================================================================
// Agent Template - BACKEND-018
// ============================================================================
// 
// This is a complete template for creating new TitanGold AI agents.
// It includes all required methods, best practices, and patterns.
//
// INSTRUCTIONS:
// 1. Copy this file to create a new agent (e.g., my_new_agent.js)
// 2. Replace all PLACEHOLDER values with your agent-specific values
// 3. Implement the core logic in the run() function
// 4. Add your agent to AGENT_MODULES in registry.js
// 5. Run tests and verify health check
//
// REQUIRED PLACEHOLDERS TO REPLACE:
// - AGENT_KEY: Agent identifier (e.g., 'my_agent', 'sentiment')
// - AGENT_NAME: Human-readable name (e.g., 'My New Agent')
// - AGENT_DESCRIPTION: Brief description of what the agent does
// - AGENT_VERSION: Semantic version (e.g., '1.0.0')
//
// ============================================================================

import { logger } from '../../services/logger.js';
// BACKEND-020: Import exchange abstraction for market data
// import { getExchange } from '../exchanges/index.js';

// ============================================================================
// Configuration & Constants
// ============================================================================

const AGENT_KEY = 'PLACEHOLDER_AGENT_KEY'; // e.g., 'my_agent'
const AGENT_NAME = 'PLACEHOLDER_AGENT_NAME'; // e.g., 'My New Agent'
const AGENT_DESCRIPTION = 'PLACEHOLDER_DESCRIPTION'; // Brief description
const AGENT_VERSION = '1.0.0';

// Timeout for agent execution (default: 30 seconds)
const EXECUTION_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT) || 30000;

// Maximum retries for transient failures
const MAX_RETRIES = 3;

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate input parameters for the run() function
 * @param {Object} params - Input parameters
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateRunParams(params) {
  const errors = [];
  
  // Validate required parameters
  if (!params) {
    errors.push('Parameters object is required');
    return { valid: false, errors };
  }
  
  // userId validation (optional but recommended)
  if (params.userId !== undefined && typeof params.userId !== 'string') {
    errors.push('userId must be a string');
  }
  
  // symbol validation (if applicable to your agent)
  if (params.symbol !== undefined) {
    if (typeof params.symbol !== 'string') {
      errors.push('symbol must be a string');
    } else if (!/^[A-Za-z0-9]+$/.test(params.symbol)) {
      errors.push('symbol must contain only letters and numbers');
    }
  }
  
  // timeframe validation (if applicable)
  if (params.timeframe !== undefined) {
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    if (!validTimeframes.includes(params.timeframe)) {
      errors.push(`timeframe must be one of: ${validTimeframes.join(', ')}`);
    }
  }
  
  // config validation
  if (params.config !== undefined) {
    if (typeof params.config !== 'object' || params.config === null) {
      errors.push('config must be an object');
    }
  }
  
  // TODO: Add your agent-specific validations here
  // Example:
  // if (params.customParam && params.customParam < 0) {
  //   errors.push('customParam must be non-negative');
  // }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize input parameters
 * @param {Object} params - Input parameters
 * @returns {Object} Sanitized parameters
 */
function sanitizeParams(params) {
  return {
    userId: params.userId || null,
    symbol: params.symbol ? params.symbol.toUpperCase() : null,
    timeframe: params.timeframe || '1h',
    config: params.config || defaultConfig(),
    ...params // Preserve any additional params
  };
}

// ============================================================================
// Core Agent Logic
// ============================================================================

/**
 * Run the agent analysis
 * 
 * This is the main entry point for your agent. It should:
 * 1. Validate inputs
 * 2. Fetch necessary data
 * 3. Perform analysis/computation
 * 4. Return structured results
 * 
 * @param {Object} params - Input parameters
 * @param {string} [params.userId] - User identifier
 * @param {string} [params.symbol] - Trading symbol (e.g., 'BTCUSDT')
 * @param {string} [params.timeframe='1h'] - Timeframe for analysis
 * @param {Object} [params.config={}] - Agent configuration
 * @returns {Promise<Object>} Analysis result
 * @throws {Error} If validation fails or execution errors occur
 */
export async function run(params) {
  const startTime = Date.now();
  
  try {
    logger.info(`🚀 ${AGENT_NAME} starting: ${JSON.stringify(params)}`);
    
    // Step 1: Validate input parameters
    const validation = validateRunParams(params);
    if (!validation.valid) {
      const errorMsg = `Invalid parameters: ${validation.errors.join(', ')}`;
      logger.error(`❌ ${AGENT_NAME} validation failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // Step 2: Sanitize and normalize parameters
    const sanitized = sanitizeParams(params);
    
    // Step 3: Apply timeout protection
    const resultPromise = executeWithTimeout(
      () => performAnalysis(sanitized),
      EXECUTION_TIMEOUT_MS
    );
    
    // Step 4: Wait for result
    const result = await resultPromise;
    
    // Step 5: Validate output
    if (!result || typeof result !== 'object') {
      throw new Error('Agent returned invalid result');
    }
    
    // Step 6: Add metadata
    const executionTime = Date.now() - startTime;
    result._meta = {
      ...result._meta,
      agent_key: AGENT_KEY,
      version: AGENT_VERSION,
      executionTime,
      timestamp: new Date().toISOString()
    };
    
    logger.info(`✅ ${AGENT_NAME} complete (${executionTime}ms)`);
    return result;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`❌ ${AGENT_NAME} failed (${executionTime}ms):`, error.message);
    
    // Return error result instead of throwing (graceful degradation)
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

/**
 * Perform the actual analysis logic
 * 
 * TODO: Implement your agent's core logic here
 * 
 * @param {Object} params - Sanitized parameters
 * @returns {Promise<Object>} Analysis result
 */
async function performAnalysis(params) {
  // TODO: Replace this mock implementation with your agent's logic
  
  // Example: Fetch data from external API
  // const data = await fetchMarketData(params.symbol, params.timeframe);
  
  // Example: Perform calculations
  // const indicators = calculateIndicators(data, params.config);
  
  // Example: Generate signal
  // const signal = generateSignal(indicators);
  
  // For now, return a mock result
  const result = {
    agent_key: AGENT_KEY,
    symbol: params.symbol,
    timeframe: params.timeframe,
    signal: 'NEUTRAL', // TODO: Replace with actual signal
    confidence: 0.5,   // TODO: Replace with actual confidence
    data: {
      // TODO: Add your agent-specific data here
      example: 'This is mock data - replace with actual analysis'
    },
    timestamp: new Date().toISOString()
  };
  
  return result;
}

/**
 * Execute a function with timeout protection
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} Result of function or timeout error
 */
async function executeWithTimeout(fn, timeoutMs) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of function
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${backoffMs}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

// ============================================================================
// Agent Details
// ============================================================================

/**
 * Get agent details and metadata
 * @param {Object} params - Query parameters
 * @param {string} [params.userId] - User identifier
 * @returns {Promise<Object>} Agent details
 */
export async function getDetails({ userId }) {
  try {
    return {
      agent_key: AGENT_KEY,
      name: AGENT_NAME,
      description: AGENT_DESCRIPTION,
      version: AGENT_VERSION,
      status: 'active',
      capabilities: [
        // TODO: List your agent's capabilities
        'Example Capability 1',
        'Example Capability 2'
      ],
      lastRun: null, // TODO: Track from database if needed
      metrics: {
        totalRuns: 0,
        avgExecutionTime: 0,
        successRate: 0
        // TODO: Fetch actual metrics from database
      }
    };
  } catch (error) {
    logger.error(`❌ Failed to get ${AGENT_NAME} details:`, error.message);
    throw error;
  }
}

// ============================================================================
// Agent Commands
// ============================================================================

/**
 * Execute agent command
 * @param {Object} params - Command parameters
 * @param {string} params.command - Command name
 * @param {Object} [params.payload] - Command payload
 * @returns {Promise<Object>} Command result
 */
export async function command({ command, payload }) {
  logger.info(`⚡ ${AGENT_NAME} command: ${command}`);
  
  try {
    switch (command) {
      case 'reset':
        // Reset agent state
        return { success: true, message: 'Agent reset successful' };
      
      case 'calibrate':
        // Calibrate agent parameters
        return { success: true, message: 'Agent calibrated' };
      
      case 'status':
        // Get current agent status
        return {
          success: true,
          status: 'active',
          message: 'Agent is operational'
        };
      
      // TODO: Add your agent-specific commands here
      
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

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export function defaultConfig() {
  return {
    // TODO: Define your agent's default configuration
    enabled: true,
    timeout: EXECUTION_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    
    // Example configuration fields:
    // threshold: 0.7,
    // lookbackPeriod: 24,
    // updateInterval: 300
  };
}

/**
 * Validate agent configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }
  
  // Validate enabled flag
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  
  // Validate timeout
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number') {
      errors.push('timeout must be a number');
    } else if (config.timeout < 1000 || config.timeout > 300000) {
      errors.push('timeout must be between 1000 and 300000 ms');
    }
  }
  
  // Validate maxRetries
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number') {
      errors.push('maxRetries must be a number');
    } else if (config.maxRetries < 0 || config.maxRetries > 10) {
      errors.push('maxRetries must be between 0 and 10');
    }
  }
  
  // TODO: Add your agent-specific config validations here
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Health Check (BACKEND-015)
// ============================================================================

/**
 * Perform health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  try {
    const checks = {
      configValid: false,
      memoryOk: false,
      dependenciesOk: false,
      canExecute: false
    };
    
    // Check 1: Validate default config
    const config = defaultConfig();
    const configValidation = validateConfig(config);
    checks.configValid = configValidation.valid;
    
    // Check 2: Memory usage
    const memUsage = process.memoryUsage();
    checks.memoryOk = memUsage.heapUsed < memUsage.heapTotal * 0.9;
    
    // Check 3: Dependencies (if any)
    // TODO: Add checks for external dependencies (APIs, databases, etc.)
    checks.dependenciesOk = true; // Assume OK unless you have dependencies
    
    // Check 4: Can execute basic operation
    try {
      const testResult = await run({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        config: defaultConfig()
      });
      checks.canExecute = testResult && testResult.agent_key === AGENT_KEY;
    } catch (error) {
      checks.canExecute = false;
      logger.warn(`Health check execution test failed: ${error.message}`);
    }
    
    // Determine overall status
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
