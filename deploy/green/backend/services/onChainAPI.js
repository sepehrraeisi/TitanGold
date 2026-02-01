/**
 * On-Chain Metrics API Service
 * BACKEND-012: Implement Market Intelligence Agent
 * 
 * Fetches on-chain metrics from multiple sources:
 * - Glassnode API (premium on-chain analytics)
 * - CoinGecko API (market data, supply metrics)
 * - Blockchain.info (Bitcoin-specific metrics)
 * 
 * Provides comprehensive on-chain intelligence for market analysis
 */

import axios from 'axios';
import { logger } from './logger.js';

// Cache for on-chain data
const metricsCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (on-chain data changes slowly)

/**
 * Fetch metrics from Glassnode
 * @param {string} symbol - Cryptocurrency symbol (BTC, ETH, etc.)
 * @param {Object} options - Fetch options
 * @returns {Object} On-chain metrics
 */
async function fetchGlassnodeMetrics(symbol, options = {}) {
  try {
    const baseSymbol = symbol.split('/')[0];
    const apiKey = process.env.GLASSNODE_API_KEY;
    
    if (!apiKey) {
      logger.warn('Glassnode API key not configured');
      return null;
    }
    
    const asset = baseSymbol.toLowerCase();
    const metrics = {};
    
    // Fetch multiple metrics in parallel
    const metricsList = [
      'addresses/active_count',
      'addresses/new_non_zero_count',
      'blockchain/block_count',
      'transactions/count',
      'transactions/transfers_volume_sum',
      'supply/current',
      'market/price_usd_close'
    ];
    
    const promises = metricsList.map(async (metric) => {
      try {
        const response = await axios.get(`https://api.glassnode.com/v1/metrics/${metric}`, {
          params: {
            a: asset,
            api_key: apiKey,
            i: '24h', // 24-hour interval
            s: Math.floor(Date.now() / 1000) - 86400 * 7, // Last 7 days
            timestamp_format: 'humanized'
          },
          timeout: 10000
        });
        
        return { metric, data: response.data };
      } catch (error) {
        logger.warn(`Failed to fetch Glassnode metric: ${metric}`, { error: error.message });
        return { metric, data: null };
      }
    });
    
    const results = await Promise.all(promises);
    
    // Process results
    results.forEach(({ metric, data }) => {
      if (data && data.length > 0) {
        const metricName = metric.split('/').pop();
        const latestValue = data[data.length - 1];
        metrics[metricName] = {
          value: latestValue.v,
          timestamp: latestValue.t,
          trend: calculateTrend(data)
        };
      }
    });
    
    return {
      source: 'Glassnode',
      asset: baseSymbol,
      metrics,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Failed to fetch Glassnode metrics', error);
    return null;
  }
}

/**
 * Fetch metrics from CoinGecko
 * @param {string} symbol - Cryptocurrency symbol
 * @param {Object} options - Fetch options
 * @returns {Object} Market and supply metrics
 */
async function fetchCoinGeckoMetrics(symbol, options = {}) {
  try {
    const baseSymbol = symbol.split('/')[0];
    
    // Map symbol to CoinGecko ID
    const coinIdMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2'
    };
    
    const coinId = coinIdMap[baseSymbol] || baseSymbol.toLowerCase();
    
    // Fetch coin data
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: true,
        developer_data: true,
        sparkline: true
      },
      timeout: 10000
    });
    
    const data = response.data;
    
    return {
      source: 'CoinGecko',
      asset: baseSymbol,
      metrics: {
        market_cap: data.market_data?.market_cap?.usd || 0,
        market_cap_rank: data.market_cap_rank,
        total_volume: data.market_data?.total_volume?.usd || 0,
        circulating_supply: data.market_data?.circulating_supply || 0,
        total_supply: data.market_data?.total_supply || 0,
        max_supply: data.market_data?.max_supply || null,
        price_change_24h: data.market_data?.price_change_percentage_24h || 0,
        price_change_7d: data.market_data?.price_change_percentage_7d || 0,
        price_change_30d: data.market_data?.price_change_percentage_30d || 0,
        ath: data.market_data?.ath?.usd || 0,
        ath_date: data.market_data?.ath_date?.usd || null,
        atl: data.market_data?.atl?.usd || 0,
        atl_date: data.market_data?.atl_date?.usd || null,
        community: {
          twitter_followers: data.community_data?.twitter_followers || 0,
          reddit_subscribers: data.community_data?.reddit_subscribers || 0,
          reddit_active_48h: data.community_data?.reddit_accounts_active_48h || 0
        },
        developer: {
          forks: data.developer_data?.forks || 0,
          stars: data.developer_data?.stars || 0,
          subscribers: data.developer_data?.subscribers || 0,
          total_issues: data.developer_data?.total_issues || 0,
          closed_issues: data.developer_data?.closed_issues || 0,
          pull_requests_merged: data.developer_data?.pull_requests_merged || 0,
          commit_count_4_weeks: data.developer_data?.commit_count_4_weeks || 0
        }
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Failed to fetch CoinGecko metrics', error);
    return null;
  }
}

/**
 * Fetch Bitcoin-specific metrics from Blockchain.info
 * @returns {Object} Bitcoin network metrics
 */
async function fetchBlockchainInfoMetrics() {
  try {
    const response = await axios.get('https://blockchain.info/stats', {
      params: { format: 'json' },
      timeout: 10000
    });
    
    const data = response.data;
    
    return {
      source: 'Blockchain.info',
      asset: 'BTC',
      metrics: {
        market_price_usd: data.market_price_usd,
        hash_rate: data.hash_rate,
        difficulty: data.difficulty,
        miners_revenue_usd: data.miners_revenue_usd,
        total_fees_btc: data.total_fees_btc,
        n_btc_mined: data.n_btc_mined,
        n_tx: data.n_tx,
        n_blocks_mined: data.n_blocks_mined,
        minutes_between_blocks: data.minutes_between_blocks,
        totalbc: data.totalbc,
        blocks_size: data.blocks_size,
        nextretarget: data.nextretarget,
        estimated_transaction_volume_usd: data.estimated_transaction_volume_usd,
        trade_volume_btc: data.trade_volume_btc,
        trade_volume_usd: data.trade_volume_usd
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Failed to fetch Blockchain.info metrics', error);
    return null;
  }
}

/**
 * Fetch aggregated on-chain metrics
 * @param {string} symbol - Cryptocurrency symbol
 * @param {Object} options - Fetch options
 * @returns {Object} Aggregated on-chain metrics
 */
export async function fetchOnChainMetrics(symbol, options = {}) {
  try {
    const cacheKey = `onchain_${symbol}`;
    
    // Check cache
    if (options.useCache !== false) {
      const cached = metricsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('Returning cached on-chain metrics', { symbol });
        return cached.data;
      }
    }
    
    logger.info('Fetching on-chain metrics', { symbol });
    
    const baseSymbol = symbol.split('/')[0];
    
    // Fetch from multiple sources in parallel
    const promises = [
      fetchCoinGeckoMetrics(symbol, options),
      baseSymbol === 'BTC' ? fetchBlockchainInfoMetrics() : Promise.resolve(null),
      fetchGlassnodeMetrics(symbol, options)
    ];
    
    const [coinGecko, blockchainInfo, glassnode] = await Promise.all(promises);
    
    // Combine metrics
    const result = {
      symbol,
      sources: {
        coinGecko: coinGecko !== null,
        blockchainInfo: blockchainInfo !== null,
        glassnode: glassnode !== null
      },
      metrics: {},
      analysis: {},
      timestamp: new Date().toISOString()
    };
    
    // Add CoinGecko metrics
    if (coinGecko) {
      result.metrics.market = coinGecko.metrics;
    }
    
    // Add Blockchain.info metrics (Bitcoin only)
    if (blockchainInfo) {
      result.metrics.network = blockchainInfo.metrics;
    }
    
    // Add Glassnode metrics
    if (glassnode && glassnode.metrics) {
      result.metrics.onchain = glassnode.metrics;
    }
    
    // Perform analysis
    result.analysis = analyzeMetrics(result.metrics, symbol);
    
    // Cache result
    metricsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    logger.error('Failed to fetch on-chain metrics', error);
    throw error;
  }
}

/**
 * Calculate trend from time series data
 * @param {Array} data - Time series data
 * @returns {string} Trend direction (up, down, flat)
 */
function calculateTrend(data) {
  if (!data || data.length < 2) return 'unknown';
  
  const recent = data.slice(-7); // Last 7 data points
  const values = recent.map(d => d.v);
  
  // Calculate simple linear regression slope
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Determine trend
  if (slope > 0.01) return 'up';
  if (slope < -0.01) return 'down';
  return 'flat';
}

/**
 * Analyze on-chain metrics for insights
 * @param {Object} metrics - Combined metrics
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Object} Analysis results
 */
function analyzeMetrics(metrics, symbol) {
  const analysis = {
    health: 'neutral',
    signals: [],
    anomalies: [],
    insights: []
  };
  
  try {
    // Analyze market metrics
    if (metrics.market) {
      const market = metrics.market;
      
      // Volume analysis
      if (market.total_volume && market.market_cap) {
        const volumeRatio = market.total_volume / market.market_cap;
        if (volumeRatio > 0.5) {
          analysis.signals.push({
            type: 'high_volume',
            severity: 'info',
            message: 'High trading volume relative to market cap',
            value: (volumeRatio * 100).toFixed(2) + '%'
          });
        } else if (volumeRatio < 0.05) {
          analysis.signals.push({
            type: 'low_volume',
            severity: 'warning',
            message: 'Low trading volume relative to market cap',
            value: (volumeRatio * 100).toFixed(2) + '%'
          });
        }
      }
      
      // Supply analysis
      if (market.circulating_supply && market.total_supply && market.total_supply > 0) {
        const supplyRatio = market.circulating_supply / market.total_supply;
        if (supplyRatio > 0.9) {
          analysis.insights.push({
            type: 'supply',
            message: 'High circulating supply ratio - limited inflation pressure',
            value: (supplyRatio * 100).toFixed(1) + '% circulating'
          });
        }
      }
      
      // Community engagement
      if (market.community) {
        const { twitter_followers, reddit_subscribers } = market.community;
        const totalCommunity = twitter_followers + reddit_subscribers;
        
        if (totalCommunity > 1000000) {
          analysis.insights.push({
            type: 'community',
            message: 'Large active community',
            value: `${(totalCommunity / 1000000).toFixed(1)}M followers`
          });
        }
      }
      
      // Developer activity
      if (market.developer && market.developer.commit_count_4_weeks > 0) {
        const commits = market.developer.commit_count_4_weeks;
        if (commits > 100) {
          analysis.insights.push({
            type: 'development',
            message: 'High developer activity',
            value: `${commits} commits (4 weeks)`
          });
          analysis.health = 'positive';
        } else if (commits < 10) {
          analysis.signals.push({
            type: 'low_dev_activity',
            severity: 'warning',
            message: 'Low developer activity',
            value: `${commits} commits (4 weeks)`
          });
        }
      }
    }
    
    // Analyze network metrics (Bitcoin)
    if (metrics.network) {
      const network = metrics.network;
      
      // Hash rate analysis
      if (network.hash_rate) {
        analysis.insights.push({
          type: 'security',
          message: 'Network hash rate',
          value: `${(network.hash_rate / 1e9).toFixed(2)} EH/s`
        });
      }
      
      // Transaction volume
      if (network.estimated_transaction_volume_usd) {
        const volumeUSD = network.estimated_transaction_volume_usd;
        analysis.insights.push({
          type: 'adoption',
          message: 'Daily transaction volume',
          value: `$${(volumeUSD / 1e9).toFixed(2)}B`
        });
      }
    }
    
    // Analyze on-chain metrics (Glassnode)
    if (metrics.onchain) {
      const onchain = metrics.onchain;
      
      // Active addresses trend
      if (onchain.active_count) {
        const trend = onchain.active_count.trend;
        if (trend === 'up') {
          analysis.signals.push({
            type: 'active_addresses_up',
            severity: 'positive',
            message: 'Increasing active addresses - growing network usage',
            value: onchain.active_count.value
          });
          analysis.health = 'positive';
        } else if (trend === 'down') {
          analysis.signals.push({
            type: 'active_addresses_down',
            severity: 'warning',
            message: 'Decreasing active addresses - declining network usage',
            value: onchain.active_count.value
          });
        }
      }
      
      // New addresses trend
      if (onchain.new_non_zero_count) {
        const trend = onchain.new_non_zero_count.trend;
        if (trend === 'up') {
          analysis.insights.push({
            type: 'adoption',
            message: 'Increasing new addresses - growing adoption',
            value: onchain.new_non_zero_count.value
          });
        }
      }
    }
    
    // Overall health assessment
    if (analysis.signals.filter(s => s.severity === 'warning').length > 2) {
      analysis.health = 'negative';
    } else if (analysis.signals.filter(s => s.severity === 'positive').length > 1) {
      analysis.health = 'positive';
    }
    
  } catch (error) {
    logger.error('Error analyzing metrics', error);
  }
  
  return analysis;
}

/**
 * Detect anomalies in metrics
 * @param {Object} currentMetrics - Current metrics
 * @param {Object} historicalMetrics - Historical metrics
 * @returns {Array} Detected anomalies
 */
export function detectAnomalies(currentMetrics, historicalMetrics) {
  const anomalies = [];
  
  try {
    // Compare current vs historical
    if (currentMetrics.metrics?.market && historicalMetrics.metrics?.market) {
      const current = currentMetrics.metrics.market;
      const historical = historicalMetrics.metrics.market;
      
      // Volume spike
      if (current.total_volume > historical.total_volume * 2) {
        anomalies.push({
          type: 'volume_spike',
          severity: 'high',
          message: 'Trading volume doubled',
          current: current.total_volume,
          historical: historical.total_volume,
          change: ((current.total_volume / historical.total_volume - 1) * 100).toFixed(1) + '%'
        });
      }
      
      // Price divergence
      const priceChange = Math.abs(current.price_change_24h);
      if (priceChange > 10) {
        anomalies.push({
          type: 'price_volatility',
          severity: priceChange > 20 ? 'high' : 'medium',
          message: 'High price volatility',
          value: current.price_change_24h.toFixed(2) + '%'
        });
      }
    }
    
  } catch (error) {
    logger.error('Error detecting anomalies', error);
  }
  
  return anomalies;
}

/**
 * Clear metrics cache
 */
export function clearCache() {
  metricsCache.clear();
  logger.info('On-chain metrics cache cleared');
}

export default {
  fetchOnChainMetrics,
  detectAnomalies,
  clearCache
};
