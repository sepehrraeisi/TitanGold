/**
 * Volume Analysis Agent
 * BACKEND-013: Implement Volume Analysis Agent
 * BACKEND-020: Updated to use exchange abstraction layer
 * 
 * Provides comprehensive volume analysis for trading decisions:
 * - On-Balance Volume (OBV) with divergence detection
 * - Volume Weighted Average Price (VWAP)
 * - Volume Profile with POC and Value Area
 * - Volume Spike Detection
 * - Volume-based Trading Signals
 * 
 * Integrates with exchanges via abstraction layer for real-time OHLCV data
 */

import { logger } from '../../services/logger.js';
import { getDefaultExchange } from '../exchanges/index.js';
import {
  calculateOBV,
  calculateVWAP,
  generateVolumeProfile,
  detectVolumeSpikes,
  generateVolumeSignals,
  analyzeVolume
} from '../volumeAnalyzer.js';

// Agent state tracking
const agentState = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastRun: null,
  totalExecutionTime: 0
};

// Cache for volume analysis
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Run Volume Analysis Agent
 * 
 * @param {Object} params - Agent parameters
 * @param {string} params.userId - User ID
 * @param {string} params.symbol - Trading pair (e.g., 'BTC/USDT')
 * @param {string} params.timeframe - Analysis timeframe (e.g., '1h', '4h', '1d')
 * @param {Object} params.config - Agent configuration
 * @returns {Object} Volume analysis results with trading signals
 */
export async function run({ userId, symbol, timeframe = '1h', config = {} }) {
  const startTime = Date.now();
  
  try {
    logger.info(`🔊 Volume Analysis Agent started`, { userId, symbol, timeframe });
    
    agentState.totalRuns++;

    // Check cache
    const cacheKey = `${symbol}_${timeframe}`;
    if (config.useCache !== false) {
      const cached = analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('📦 Returning cached volume analysis', {
          symbol,
          age: Math.round((Date.now() - cached.timestamp) / 1000) + 's'
        });
        return cached.data;
      }
    }

    // Default configuration
    const agentConfig = {
      dataLimit: 100,        // Number of candles to fetch
      profileBins: 20,       // Volume profile bins
      spikeThreshold: 2.0,   // Volume spike threshold (2x average)
      useCache: true,
      ...config
    };

    // Fetch OHLCV data from exchange
    let ohlcv;
    try {
      const exchange = getDefaultExchange();
      await exchange.initialize(userId);
      
      ohlcv = await exchange.fetchOHLCV(
        userId,
        symbol,
        timeframe,
        agentConfig.dataLimit
      );
    } catch (error) {
      agentState.failedRuns++;
      logger.error('❌ Failed to fetch OHLCV data', error);
      throw {
        code: 'VOLUME_ANALYSIS_ERROR',
        message: 'Failed to fetch market data from exchange',
        error: error.message,
        symbol,
        timeframe
      };
    }

    if (!ohlcv || ohlcv.length < 20) {
      agentState.failedRuns++;
      throw {
        code: 'VOLUME_ANALYSIS_ERROR',
        message: `Insufficient OHLCV data: ${ohlcv?.length || 0} candles (minimum 20 required)`,
        symbol,
        timeframe
      };
    }

    logger.info(`📊 Fetched ${ohlcv.length} candles for volume analysis`);

    // Perform comprehensive volume analysis
    const analysis = analyzeVolume(ohlcv, {
      symbol,
      profileBins: agentConfig.profileBins,
      spikeThreshold: agentConfig.spikeThreshold
    });

    // Build comprehensive result
    const executionTime = Date.now() - startTime;

    const result = {
      agent_key: 'volume',
      symbol,
      timeframe,
      
      // Core indicators
      obv: {
        current: analysis.obv.current,
        trend: analysis.obv.trend,
        divergence: analysis.obv.divergence,
        signal: analysis.obv.signal
      },
      
      vwap: {
        current: analysis.vwap.current,
        currentPrice: analysis.vwap.currentPrice,
        position: analysis.vwap.position,
        deviation: analysis.vwap.deviation,
        signal: analysis.vwap.signal
      },
      
      volume_profile: {
        pointOfControl: {
          price: analysis.volumeProfile.pointOfControl.priceLevel,
          volume: analysis.volumeProfile.pointOfControl.volume
        },
        valueAreaHigh: analysis.volumeProfile.valueAreaHigh,
        valueAreaLow: analysis.volumeProfile.valueAreaLow,
        currentPrice: analysis.volumeProfile.currentPrice,
        position: analysis.volumeProfile.analysis.position,
        nearPOC: analysis.volumeProfile.analysis.nearPOC,
        topLevels: analysis.volumeProfile.profile.slice(0, 5).map(level => ({
          price: level.priceLevel,
          volume: level.volume,
          trades: level.trades
        }))
      },
      
      volume_spikes: {
        avgVolume: analysis.volumeSpikes.avgVolume,
        currentVolume: analysis.volumeSpikes.currentVolume,
        volumeRatio: analysis.volumeSpikes.volumeRatio,
        isSpike: analysis.volumeSpikes.isSpike,
        recentSpikes: analysis.volumeSpikes.recentSpikes.length,
        totalSpikes: analysis.volumeSpikes.totalSpikes,
        volumeTrend: analysis.volumeSpikes.analysis.volumeTrend,
        buyingPressure: analysis.volumeSpikes.analysis.buying_pressure,
        sellingPressure: analysis.volumeSpikes.analysis.selling_pressure
      },
      
      // Trading signals
      trading_recommendation: {
        action: analysis.signals.overallSignal,
        confidence: analysis.signals.confidence,
        signals: analysis.signals.signals,
        summary: analysis.signals.summary
      },
      
      // Summary
      summary: generateSummary(analysis, symbol),
      
      // Metadata
      metadata: {
        dataPoints: ohlcv.length,
        executionTime,
        cacheKey,
        timestamp: new Date().toISOString(),
        agent_version: '1.0.0'
      },
      
      timestamp: new Date().toISOString()
    };

    // Cache result
    if (agentConfig.useCache) {
      analysisCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    // Update state
    agentState.successfulRuns++;
    agentState.lastRun = new Date().toISOString();
    agentState.totalExecutionTime += executionTime;

    logger.info(`✅ Volume Analysis Agent completed`, {
      userId,
      symbol,
      executionTime,
      signal: result.trading_recommendation.action,
      confidence: result.trading_recommendation.confidence
    });

    return result;

  } catch (error) {
    agentState.failedRuns++;
    logger.error('❌ Volume Analysis Agent failed', error);
    
    throw {
      code: 'VOLUME_ANALYSIS_ERROR',
      message: 'Failed to perform volume analysis',
      error: error.message,
      symbol,
      timeframe
    };
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(analysis, symbol) {
  const lines = [];
  
  lines.push(`Volume Analysis for ${symbol}`);
  lines.push('');
  
  // OBV
  lines.push(`OBV: ${analysis.obv.signal.reason}`);
  if (analysis.obv.divergence.type !== 'none') {
    lines.push(`  ⚠️ ${analysis.obv.divergence.type.toUpperCase()} divergence detected`);
  }
  lines.push('');
  
  // VWAP
  lines.push(`VWAP: Price ${analysis.vwap.position} VWAP (${analysis.vwap.deviation > 0 ? '+' : ''}${analysis.vwap.deviation.toFixed(2)}%)`);
  lines.push(`  ${analysis.vwap.signal.reason}`);
  lines.push('');
  
  // Volume Profile
  lines.push(`Volume Profile:`);
  lines.push(`  POC: $${analysis.volumeProfile.pointOfControl.priceLevel.toFixed(2)}`);
  lines.push(`  Value Area: $${analysis.volumeProfile.valueAreaLow.toFixed(2)} - $${analysis.volumeProfile.valueAreaHigh.toFixed(2)}`);
  lines.push(`  Current Position: ${analysis.volumeProfile.analysis.position.replace('_', ' ')}`);
  lines.push('');
  
  // Volume Spikes
  if (analysis.volumeSpikes.isSpike) {
    const recent = analysis.volumeSpikes.recentSpikes[analysis.volumeSpikes.recentSpikes.length - 1];
    lines.push(`🔔 VOLUME SPIKE: ${recent.multiplier.toFixed(1)}x average (${recent.direction})`);
  } else {
    lines.push(`Volume: ${(analysis.volumeSpikes.volumeRatio * 100).toFixed(0)}% of average`);
  }
  lines.push(`  Trend: ${analysis.volumeSpikes.analysis.volumeTrend}`);
  
  const totalPressure = analysis.volumeSpikes.analysis.buying_pressure + analysis.volumeSpikes.analysis.selling_pressure;
  if (totalPressure > 0) {
    const buyPercent = (analysis.volumeSpikes.analysis.buying_pressure / totalPressure * 100).toFixed(0);
    lines.push(`  Buying Pressure: ${buyPercent}%`);
  }
  lines.push('');
  
  // Trading Signals
  lines.push(`Overall Signal: ${analysis.signals.overallSignal} (${analysis.signals.confidence}% confidence)`);
  lines.push(`Active Signals: ${analysis.signals.summary.buySignals} BUY, ${analysis.signals.summary.sellSignals} SELL`);
  
  return lines.join('\n');
}

/**
 * Get agent details and metrics
 * 
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID
 * @returns {Object} Agent details
 */
export async function getDetails({ userId }) {
  const avgExecutionTime = agentState.totalRuns > 0
    ? Math.round(agentState.totalExecutionTime / agentState.totalRuns)
    : 0;
  
  const successRate = agentState.totalRuns > 0
    ? (agentState.successfulRuns / agentState.totalRuns) * 100
    : 0;

  return {
    agent_key: 'volume',
    name: 'Volume Analysis Agent',
    description: 'Comprehensive volume analysis with OBV, VWAP, volume profile, and spike detection',
    status: 'active',
    version: '1.0.0',
    lastRun: agentState.lastRun,
    metrics: {
      totalRuns: agentState.totalRuns,
      successfulRuns: agentState.successfulRuns,
      failedRuns: agentState.failedRuns,
      avgExecutionTime,
      successRate: Math.round(successRate)
    },
    capabilities: [
      'On-Balance Volume (OBV) with divergence detection',
      'Volume Weighted Average Price (VWAP)',
      'Volume Profile with POC and Value Area',
      'Volume Spike detection and anomaly analysis',
      'Buying/Selling pressure calculation',
      'Volume-based trading signals',
      'Multi-exchange support via abstraction layer'
    ],
    indicators: {
      obv: 'Tracks cumulative volume flow based on price direction',
      vwap: 'Volume-weighted average price - institutional benchmark',
      volumeProfile: 'Distribution of volume across price levels',
      volumeSpikes: 'Detects unusual volume activity'
    }
  };
}

/**
 * Get default configuration
 * 
 * @returns {Object} Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    dataLimit: 100,
    profileBins: 20,
    spikeThreshold: 2.0,
    useCache: true,
    confidence_threshold: 60
  };
}

/**
 * Clear analysis cache and reset agent state (for testing/maintenance)
 */
export function clearCache() {
  analysisCache.clear();
  // Reset agent state
  agentState.totalRuns = 0;
  agentState.successfulRuns = 0;
  agentState.failedRuns = 0;
  agentState.lastRun = null;
  agentState.totalExecutionTime = 0;
  logger.info('🗑️ Volume analysis cache and state cleared');
}

export default {
  run,
  getDetails,
  defaultConfig,
  clearCache
};
