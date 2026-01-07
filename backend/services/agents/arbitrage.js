// Arbitrage Agent - Real Implementation
// Purpose: Scan for arbitrage opportunities across exchanges
// Date: 2026-01-03

import fetch from 'node-fetch';
import { logger } from '../../services/logger.js';

/**
 * Fetch ticker data from MEXC via backend proxy
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @returns {Promise<Object>} Ticker data
 */
async function fetchMexcTicker(symbol) {
  const url = `http://localhost:5002/api/market/mexc/ticker24hr?symbol=${symbol}`;
  
  try {
    const response = await fetch(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'TitanGold-Backend/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`MEXC proxy error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.ok || !result.data) {
      throw new Error('Invalid MEXC proxy response');
    }
    
    return result.data;
  } catch (error) {
    logger.error(`❌ Failed to fetch MEXC ticker for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch orderbook depth from MEXC via backend proxy
 * @param {string} symbol - Trading symbol
 * @param {number} limit - Depth limit (default: 20)
 * @returns {Promise<Object>} Orderbook data
 */
async function fetchMexcDepth(symbol, limit = 20) {
  const url = `http://localhost:5002/api/market/mexc/depth?symbol=${symbol}&limit=${limit}`;
  
  try {
    const response = await fetch(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'TitanGold-Backend/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`MEXC depth proxy error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.ok || !result.data) {
      throw new Error('Invalid MEXC depth response');
    }
    
    return result.data;
  } catch (error) {
    logger.error(`❌ Failed to fetch MEXC depth for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Calculate effective price considering orderbook depth and slippage
 * @param {Array} orders - Orderbook orders [[price, quantity], ...]
 * @param {number} volumeUSDT - Volume in USDT
 * @param {boolean} isBuy - True for buy orders, false for sell
 * @returns {number} Effective price
 */
function calculateEffectivePrice(orders, volumeUSDT, isBuy) {
  let remainingVolume = volumeUSDT;
  let totalCost = 0;
  let totalQty = 0;
  
  for (const [priceStr, qtyStr] of orders) {
    const price = parseFloat(priceStr);
    const qty = parseFloat(qtyStr);
    const orderValue = price * qty;
    
    if (remainingVolume <= 0) break;
    
    if (orderValue >= remainingVolume) {
      // Partial fill
      const neededQty = remainingVolume / price;
      totalCost += remainingVolume;
      totalQty += neededQty;
      remainingVolume = 0;
    } else {
      // Full fill
      totalCost += orderValue;
      totalQty += qty;
      remainingVolume -= orderValue;
    }
  }
  
  if (totalQty === 0) return 0;
  
  return totalCost / totalQty;
}

/**
 * Calculate spread between bid and ask
 * @param {number} bid - Bid price
 * @param {number} ask - Ask price
 * @returns {number} Spread percentage
 */
function calculateSpread(bid, ask) {
  if (!bid || !ask || ask === 0) return 0;
  return ((ask - bid) / ask) * 100;
}

/**
 * Calculate net profit considering fees and slippage
 * @param {number} spread - Spread percentage
 * @param {number} volumeUSDT - Trade volume in USDT
 * @param {Object} config - Configuration
 * @returns {Object} Profit calculation
 */
function calculateNetProfit(spread, volumeUSDT, config) {
  const feeBps = config.feeBps || 10; // 10 basis points = 0.1%
  const slippageBps = config.slippageBps || 10; // 10 basis points = 0.1%
  
  const feePercent = feeBps / 100; // Convert basis points to percent
  const slippagePercent = slippageBps / 100;
  
  // Net spread after fees and slippage
  const netSpread = spread - feePercent - slippagePercent;
  
  // Profit in USDT
  const profitUSDT = (netSpread / 100) * volumeUSDT;
  
  return {
    grossSpreadPct: spread,
    feePct: feePercent,
    slippagePct: slippagePercent,
    netSpreadPct: netSpread,
    profitUSDT: profitUSDT,
    profitBps: netSpread * 100 // Convert back to basis points
  };
}

/**
 * Detect arbitrage opportunities
 * @param {Object} params - Parameters
 * @returns {Promise<Array>} Array of opportunities
 */
async function detectOpportunities(params) {
  const { config } = params;
  
  // Default config values
  const symbols = config.symbols || ['BTCUSDT', 'ETHUSDT'];
  const minSpreadPct = config.minSpreadPct || 0.20;
  const maxSpreadPct = config.maxSpreadPct || 5.00;
  const minVolumeUSDT = config.minVolumeUSDT || 100000;
  const orderbookDepth = config.orderbookDepth || 20;
  
  const opportunities = [];
  
  logger.info(`🔍 Scanning ${symbols.length} symbols for arbitrage...`);
  
  for (const symbol of symbols) {
    try {
      // Fetch ticker and orderbook in parallel
      const [ticker, depth] = await Promise.all([
        fetchMexcTicker(symbol),
        fetchMexcDepth(symbol, orderbookDepth)
      ]);
      
      // Parse ticker data
      const lastPrice = parseFloat(ticker.lastPrice);
      const volume24h = parseFloat(ticker.quoteVolume || ticker.volume);
      
      // Skip if volume too low
      if (volume24h < minVolumeUSDT) {
        logger.info(`⏭️  ${symbol}: Volume too low (${volume24h.toFixed(0)} USDT)`);
        continue;
      }
      
      // Get best bid and ask from orderbook
      const bestBid = depth.bids && depth.bids[0] ? parseFloat(depth.bids[0][0]) : null;
      const bestAsk = depth.asks && depth.asks[0] ? parseFloat(depth.asks[0][0]) : null;
      
      if (!bestBid || !bestAsk) {
        logger.info(`⏭️  ${symbol}: Missing bid/ask data`);
        continue;
      }
      
      // Calculate spread
      const spread = calculateSpread(bestBid, bestAsk);
      
      // Filter by spread thresholds
      if (spread < minSpreadPct || spread > maxSpreadPct) {
        logger.info(`⏭️  ${symbol}: Spread ${spread.toFixed(2)}% outside range [${minSpreadPct}, ${maxSpreadPct}]`);
        continue;
      }
      
      // Calculate effective prices with slippage
      const testVolume = Math.min(volume24h * 0.01, 10000); // 1% of 24h volume or 10k USDT
      const effectiveBuyPrice = calculateEffectivePrice(depth.asks, testVolume, true);
      const effectiveSellPrice = calculateEffectivePrice(depth.bids, testVolume, false);
      
      // Calculate net profit
      const profitCalc = calculateNetProfit(spread, testVolume, config);
      
      // Risk scoring
      const riskScore = calculateRiskScore(spread, volume24h, depth, config);
      
      // Build opportunity
      const opportunity = {
        id: `${symbol}-${Date.now()}`, // Unique ID for UI
        symbol,
        exchange: 'mexc',
        type: 'spot',
        strategy: 'spot', // Strategy type for UI
        timestamp: new Date().toISOString(),
        
        // Path for UI (spot arbitrage is simple: Buy → Sell)
        path: [`Buy ${symbol}`, `Sell ${symbol}`],
        
        // Prices
        lastPrice,
        bidPrice: bestBid,
        askPrice: bestAsk,
        effectiveBuyPrice,
        effectiveSellPrice,
        
        // Spread & Profit
        spreadPct: spread,
        netSpreadPct: profitCalc.netSpreadPct,
        estimatedProfitUSDT: profitCalc.profitUSDT,
        netProfitUSDT: profitCalc.profitUSDT, // Alias for UI
        profitBps: profitCalc.profitBps,
        expectedProfitBps: profitCalc.profitBps, // Alias for UI
        
        // Volume & Liquidity
        volume24hUSDT: volume24h,
        testVolumeUSDT: testVolume,
        bidDepth: depth.bids ? depth.bids.length : 0,
        askDepth: depth.asks ? depth.asks.length : 0,
        
        // Risk
        riskScore,
        riskLevel: getRiskLevel(riskScore),
        
        // Execution time estimate (simplified)
        executionTimeMs: spread > 1.0 ? 500 : 200, // Higher spread = slower execution
        
        // Meta
        fees: {
          feePct: profitCalc.feePct,
          slippagePct: profitCalc.slippagePct
        }
      };
      
      opportunities.push(opportunity);
      
      logger.info(`✅ ${symbol}: Spread ${spread.toFixed(2)}% | Profit ${profitCalc.profitUSDT.toFixed(2)} USDT | Risk ${riskScore}`);
      
    } catch (error) {
      logger.error(`❌ Error scanning ${symbol}:`, error.message);
      // Continue with next symbol
    }
  }
  
  return opportunities;
}

/**
 * Calculate risk score for an opportunity
 * @param {number} spread - Spread percentage
 * @param {number} volume24h - 24h volume in USDT
 * @param {Object} depth - Orderbook depth
 * @param {Object} config - Configuration
 * @returns {number} Risk score (0-100, lower is better)
 */
function calculateRiskScore(spread, volume24h, depth, config) {
  let risk = 0;
  
  // Abnormal spread = higher risk
  if (spread > 2.0) risk += 30;
  else if (spread > 1.0) risk += 20;
  else if (spread > 0.5) risk += 10;
  
  // Low volume = higher risk
  const minVolumeUSDT = config.minVolumeUSDT || 100000;
  if (volume24h < minVolumeUSDT * 2) risk += 20;
  else if (volume24h < minVolumeUSDT * 5) risk += 10;
  
  // Shallow orderbook = higher risk
  const totalDepth = (depth.bids?.length || 0) + (depth.asks?.length || 0);
  if (totalDepth < 20) risk += 20;
  else if (totalDepth < 40) risk += 10;
  
  // Execution time estimation (simplified)
  // High spread might indicate illiquid market = slower execution
  if (spread > 1.0) risk += 10;
  
  return Math.min(risk, 100);
}

/**
 * Get risk level label
 * @param {number} riskScore - Risk score (0-100)
 * @returns {string} Risk level
 */
function getRiskLevel(riskScore) {
  if (riskScore >= 75) return 'high';
  if (riskScore >= 50) return 'medium';
  return 'low';
}

/**
 * Run arbitrage scan
 * @param {Object} params - Scan parameters
 * @returns {Promise<Object>} Scan result
 */
export async function run(params) {
  const { userId, symbol, timeframe, config, input } = params;
  
  logger.info(`🤖 Arbitrage Agent: Starting scan...`);
  
  try {
    // Detect opportunities
    const opportunities = await detectOpportunities({ config });
    
    // Sort by profit (descending)
    opportunities.sort((a, b) => b.estimatedProfitUSDT - a.estimatedProfitUSDT);
    
    // Calculate summary metrics
    const totalOpportunities = opportunities.length;
    const totalProfitUSDT = opportunities.reduce((sum, opp) => sum + opp.estimatedProfitUSDT, 0);
    const avgSpreadPct = totalOpportunities > 0
      ? opportunities.reduce((sum, opp) => sum + opp.spreadPct, 0) / totalOpportunities
      : 0;
    const avgRiskScore = totalOpportunities > 0
      ? opportunities.reduce((sum, opp) => sum + opp.riskScore, 0) / totalOpportunities
      : 0;
    
    // Risk alerts (opportunities with high risk)
    const riskAlerts = opportunities.filter(opp => opp.riskScore >= 75);
    
    logger.info(`✅ Arbitrage scan complete: ${totalOpportunities} opportunities found`);
    
    return {
      agent_key: 'arbitrage',
      decision_type: 'arbitrage_scan',
      timestamp: new Date().toISOString(),
      
      // Summary
      summary: {
        totalOpportunities,
        totalProfitUSDT: parseFloat(totalProfitUSDT.toFixed(2)),
        avgSpreadPct: parseFloat(avgSpreadPct.toFixed(2)),
        avgRiskScore: parseFloat(avgRiskScore.toFixed(0)),
        riskAlertCount: riskAlerts.length
      },
      
      // Opportunities (top 10)
      opportunities: opportunities.slice(0, 10),
      
      // Risk alerts
      riskAlerts: riskAlerts.map(opp => ({
        symbol: opp.symbol,
        riskScore: opp.riskScore,
        riskLevel: opp.riskLevel,
        reason: opp.riskScore >= 75 ? 'High risk score' : 'Moderate risk'
      })),
      
      // Config used
      config: {
        symbols: config.symbols || ['BTCUSDT', 'ETHUSDT'],
        minSpreadPct: config.minSpreadPct || 0.20,
        maxSpreadPct: config.maxSpreadPct || 5.00,
        minVolumeUSDT: config.minVolumeUSDT || 100000,
        feeBps: config.feeBps || 10,
        slippageBps: config.slippageBps || 10
      },
      
      // Confidence (based on opportunities found)
      confidence: totalOpportunities > 0 ? Math.min(0.5 + (totalOpportunities * 0.05), 0.95) : 0.1,
      
      // Meta
      _meta: {
        source: 'real',
        version: '1.0.0',
        executionTimeMs: 0, // Will be calculated by caller
        dataProvider: 'mexc'
      }
    };
    
  } catch (error) {
    logger.error('❌ Arbitrage scan error:', error);
    
    // Return error result
    return {
      agent_key: 'arbitrage',
      decision_type: 'arbitrage_scan',
      timestamp: new Date().toISOString(),
      error: true,
      errorMessage: error.message,
      summary: {
        totalOpportunities: 0,
        totalProfitUSDT: 0,
        avgSpreadPct: 0,
        avgRiskScore: 0,
        riskAlertCount: 0
      },
      opportunities: [],
      riskAlerts: [],
      confidence: 0,
      _meta: {
        source: 'error',
        version: '1.0.0',
        error: error.message
      }
    };
  }
}

/**
 * Get agent details
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Agent details
 */
export async function getDetails({ userId }) {
  return {
    agent_key: 'arbitrage',
    name: 'Arbitrage Agent',
    description: 'Scans for arbitrage opportunities across exchanges',
    status: 'active',
    lastRun: null,
    metrics: {
      totalRuns: 0,
      avgExecutionTime: 0,
      successRate: 0
    }
  };
}

/**
 * Default configuration
 * @returns {Object} Default config
 */
export function defaultConfig() {
  return {
    enabled: true,
    exchanges: ['mexc'],
    symbols: ['BTCUSDT', 'ETHUSDT'],
    minSpreadPct: 0.20,
    maxSpreadPct: 5.00,
    minVolumeUSDT: 100000,
    scanIntervalSec: 10,
    feeBps: 10, // 0.1% fee
    slippageBps: 10, // 0.1% slippage
    orderbookDepth: 20,
    mode: 'spot',
    autoTrade: false
  };
}

export default { run, getDetails, defaultConfig };
