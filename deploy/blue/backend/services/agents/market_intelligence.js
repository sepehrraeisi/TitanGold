/**
 * Market Intelligence Agent
 * BACKEND-012: Implement Market Intelligence Agent
 * 
 * Aggregates comprehensive market intelligence:
 * - News from multiple sources (CryptoPanic, NewsAPI)
 * - On-chain metrics (Glassnode, CoinGecko, Blockchain.info)
 * - Macro indicators (DXY, VIX, S&P 500, Gold)
 * - Anomaly detection
 * - Market summary reports
 * 
 * Provides actionable intelligence for trading decisions
 */

import { logger } from '../../services/logger.js';
import { fetchNews } from '../../services/newsAPI.js';
import { fetchOnChainMetrics, detectAnomalies } from '../../services/onChainAPI.js';
import { fetchMacroIndicators } from '../../services/macroAPI.js';

// Agent state
const agentState = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastRun: null,
  totalExecutionTime: 0
};

// Historical data for anomaly detection
const historicalData = new Map();

/**
 * Run Market Intelligence Agent
 * @param {Object} params - Agent parameters
 * @param {string} params.userId - User ID
 * @param {string} params.symbol - Trading pair symbol (e.g., BTC/USDT)
 * @param {string} params.timeframe - Analysis timeframe (24h, 7d, 30d)
 * @param {Object} params.config - Agent configuration
 * @returns {Object} Market intelligence report
 */
export async function run({ userId, symbol, timeframe = '24h', config = {} }) {
  const startTime = Date.now();
  
  try {
    logger.info(`🤖 Market Intelligence Agent started`, { userId, symbol, timeframe });
    
    agentState.totalRuns++;
    
    // Default configuration
    const agentConfig = {
      includeNews: true,
      includeOnChain: true,
      includeMacro: true,
      detectAnomalies: true,
      generateSummary: true,
      newsLimit: 20,
      ...config
    };
    
    // Parallel data fetching for speed
    const dataPromises = [];
    
    // 1. Fetch news
    if (agentConfig.includeNews) {
      dataPromises.push(
        fetchNews(symbol, {
          timeframe,
          limit: agentConfig.newsLimit,
          useCache: true
        }).catch(error => {
          logger.error('News fetch failed', error);
          return null;
        })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    // 2. Fetch on-chain metrics
    if (agentConfig.includeOnChain) {
      dataPromises.push(
        fetchOnChainMetrics(symbol, {
          useCache: true
        }).catch(error => {
          logger.error('On-chain metrics fetch failed', error);
          return null;
        })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    // 3. Fetch macro indicators
    if (agentConfig.includeMacro) {
      dataPromises.push(
        fetchMacroIndicators({
          useCache: true
        }).catch(error => {
          logger.error('Macro indicators fetch failed', error);
          return null;
        })
      );
    } else {
      dataPromises.push(Promise.resolve(null));
    }
    
    // Wait for all data
    const [newsData, onChainData, macroData] = await Promise.all(dataPromises);
    
    // Detect anomalies
    let anomalies = [];
    if (agentConfig.detectAnomalies && onChainData) {
      const historicalKey = `${symbol}_onchain`;
      const historical = historicalData.get(historicalKey);
      
      if (historical) {
        anomalies = detectAnomalies(onChainData, historical);
      }
      
      // Store current data for future anomaly detection
      historicalData.set(historicalKey, onChainData);
    }
    
    // Generate comprehensive analysis
    const analysis = generateAnalysis({
      symbol,
      timeframe,
      newsData,
      onChainData,
      macroData,
      anomalies
    });
    
    // Generate market summary
    const summary = agentConfig.generateSummary
      ? generateMarketSummary(analysis)
      : null;
    
    // Calculate overall confidence
    const confidence = calculateConfidence(analysis);
    
    // Generate trading recommendation
    const recommendation = generateRecommendation(analysis, confidence);
    
    // Build result
    const executionTime = Date.now() - startTime;
    
    const result = {
      agent_key: 'market_intelligence',
      symbol,
      timeframe,
      
      // Core data
      data: {
        news: newsData,
        onchain: onChainData,
        macro: macroData,
        anomalies
      },
      
      // Analysis
      analysis,
      
      // Summary
      summary,
      
      // Recommendation
      recommendation,
      
      // Confidence
      confidence,
      
      // Metadata
      metadata: {
        execution_time_ms: executionTime,
        data_sources: {
          news: newsData !== null,
          onchain: onChainData !== null,
          macro: macroData !== null
        },
        data_freshness: {
          news: newsData?.timestamp || null,
          onchain: onChainData?.timestamp || null,
          macro: macroData?.timestamp || null
        },
        anomalies_detected: anomalies.length,
        agent_version: '1.0.0'
      },
      
      timestamp: new Date().toISOString()
    };
    
    // Update state
    agentState.successfulRuns++;
    agentState.lastRun = new Date().toISOString();
    agentState.totalExecutionTime += executionTime;
    
    logger.info(`✅ Market Intelligence Agent completed`, {
      userId,
      symbol,
      executionTime,
      confidence
    });
    
    return result;
    
  } catch (error) {
    agentState.failedRuns++;
    logger.error('Market Intelligence Agent failed', error);
    
    throw {
      code: 'MARKET_INTELLIGENCE_ERROR',
      message: 'Failed to generate market intelligence',
      error: error.message
    };
  }
}

/**
 * Generate comprehensive analysis from all data sources
 * @param {Object} data - All collected data
 * @returns {Object} Comprehensive analysis
 */
function generateAnalysis(data) {
  const { symbol, timeframe, newsData, onChainData, macroData, anomalies } = data;
  
  const analysis = {
    symbol,
    timeframe,
    
    // Sentiment analysis
    sentiment: {
      overall: 'neutral',
      news: null,
      onchain: null,
      macro: null,
      confidence: 0
    },
    
    // Market conditions
    market_conditions: {
      trend: 'neutral',
      volatility: 'moderate',
      volume: 'normal',
      risk_appetite: 'neutral'
    },
    
    // Key signals
    signals: [],
    
    // Risk factors
    risks: [],
    
    // Opportunities
    opportunities: [],
    
    // Overall assessment
    assessment: 'neutral'
  };
  
  // Analyze news sentiment
  if (newsData && newsData.sentiment) {
    const newsSentiment = newsData.sentiment.score;
    analysis.sentiment.news = newsSentiment;
    
    if (newsSentiment > 0.3) {
      analysis.signals.push({
        type: 'positive_news',
        source: 'news',
        message: 'Positive news sentiment',
        score: newsSentiment,
        strength: 'moderate'
      });
      analysis.opportunities.push({
        type: 'sentiment',
        message: `Bullish news sentiment: ${(newsSentiment * 100).toFixed(1)}%`,
        confidence: newsData.sentiment.confidence
      });
    } else if (newsSentiment < -0.3) {
      analysis.signals.push({
        type: 'negative_news',
        source: 'news',
        message: 'Negative news sentiment',
        score: newsSentiment,
        strength: 'moderate'
      });
      analysis.risks.push({
        type: 'sentiment',
        message: `Bearish news sentiment: ${(newsSentiment * 100).toFixed(1)}%`,
        severity: 'medium'
      });
    }
  }
  
  // Analyze on-chain metrics
  if (onChainData && onChainData.analysis) {
    const onchainAnalysis = onChainData.analysis;
    analysis.sentiment.onchain = onchainAnalysis.health;
    
    // Add on-chain signals
    if (onchainAnalysis.signals) {
      onchainAnalysis.signals.forEach(signal => {
        analysis.signals.push({
          type: signal.type,
          source: 'onchain',
          message: signal.message,
          severity: signal.severity,
          value: signal.value
        });
        
        if (signal.severity === 'positive') {
          analysis.opportunities.push({
            type: 'onchain',
            message: signal.message,
            confidence: 0.7
          });
        } else if (signal.severity === 'warning') {
          analysis.risks.push({
            type: 'onchain',
            message: signal.message,
            severity: 'medium'
          });
        }
      });
    }
    
    // Volume analysis
    if (onChainData.metrics?.market?.total_volume) {
      const volume = onChainData.metrics.market.total_volume;
      const marketCap = onChainData.metrics.market.market_cap;
      
      if (marketCap && volume / marketCap > 0.3) {
        analysis.market_conditions.volume = 'high';
      } else if (marketCap && volume / marketCap < 0.05) {
        analysis.market_conditions.volume = 'low';
      }
    }
  }
  
  // Analyze macro indicators
  if (macroData && macroData.analysis) {
    const macroAnalysis = macroData.analysis;
    analysis.sentiment.macro = macroAnalysis.risk_sentiment;
    
    // Market regime
    analysis.market_conditions.risk_appetite = macroAnalysis.risk_sentiment;
    
    if (macroAnalysis.market_regime === 'volatile') {
      analysis.market_conditions.volatility = 'high';
      analysis.risks.push({
        type: 'macro',
        message: 'High market volatility detected',
        severity: 'high'
      });
    }
    
    // Add macro insights
    if (macroAnalysis.insights) {
      macroAnalysis.insights.forEach(insight => {
        analysis.signals.push({
          type: insight.type,
          source: 'macro',
          message: insight.message,
          indicator: insight.indicator
        });
      });
    }
    
    // Risk-on/risk-off
    if (macroAnalysis.risk_sentiment === 'risk-on') {
      analysis.opportunities.push({
        type: 'macro',
        message: 'Risk-on environment favorable for crypto',
        confidence: 0.6
      });
    } else if (macroAnalysis.risk_sentiment === 'risk-off') {
      analysis.risks.push({
        type: 'macro',
        message: 'Risk-off environment, caution advised',
        severity: 'high'
      });
    }
  }
  
  // Analyze anomalies
  if (anomalies && anomalies.length > 0) {
    anomalies.forEach(anomaly => {
      analysis.signals.push({
        type: 'anomaly',
        source: 'anomaly_detection',
        message: anomaly.message,
        severity: anomaly.severity,
        details: anomaly
      });
      
      if (anomaly.severity === 'high') {
        analysis.risks.push({
          type: 'anomaly',
          message: `Anomaly detected: ${anomaly.message}`,
          severity: 'high'
        });
      }
    });
    
    analysis.market_conditions.volatility = 'high';
  }
  
  // Calculate overall sentiment
  const sentiments = [
    analysis.sentiment.news,
    analysis.sentiment.onchain === 'positive' ? 0.5 : analysis.sentiment.onchain === 'negative' ? -0.5 : 0,
    analysis.sentiment.macro === 'risk-on' ? 0.3 : analysis.sentiment.macro === 'risk-off' ? -0.3 : 0
  ].filter(s => s !== null);
  
  if (sentiments.length > 0) {
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    analysis.sentiment.overall = avgSentiment > 0.2 ? 'positive' : avgSentiment < -0.2 ? 'negative' : 'neutral';
    analysis.sentiment.confidence = Math.min(sentiments.length / 3, 1);
  }
  
  // Overall assessment
  const positiveSignals = analysis.signals.filter(s => s.severity === 'positive' || s.type === 'positive_news').length;
  const negativeSignals = analysis.signals.filter(s => s.severity === 'warning' || s.type === 'negative_news').length;
  
  if (positiveSignals > negativeSignals + 2) {
    analysis.assessment = 'bullish';
  } else if (negativeSignals > positiveSignals + 2) {
    analysis.assessment = 'bearish';
  } else {
    analysis.assessment = 'neutral';
  }
  
  return analysis;
}

/**
 * Generate market summary
 * @param {Object} analysis - Market analysis
 * @returns {string} Human-readable summary
 */
function generateMarketSummary(analysis) {
  const { symbol, sentiment, market_conditions, signals, risks, opportunities, assessment } = analysis;
  
  const parts = [];
  
  // Opening statement
  parts.push(`Market Intelligence Report for ${symbol}`);
  parts.push(`Overall Assessment: ${assessment.toUpperCase()}`);
  parts.push('');
  
  // Sentiment
  parts.push(`Sentiment: ${sentiment.overall.toUpperCase()} (confidence: ${(sentiment.confidence * 100).toFixed(0)}%)`);
  if (sentiment.news !== null) {
    parts.push(`- News sentiment: ${(sentiment.news * 100).toFixed(1)}%`);
  }
  if (sentiment.onchain !== null) {
    parts.push(`- On-chain health: ${sentiment.onchain}`);
  }
  if (sentiment.macro !== null) {
    parts.push(`- Macro environment: ${sentiment.macro}`);
  }
  parts.push('');
  
  // Market conditions
  parts.push(`Market Conditions:`);
  parts.push(`- Trend: ${market_conditions.trend}`);
  parts.push(`- Volatility: ${market_conditions.volatility}`);
  parts.push(`- Volume: ${market_conditions.volume}`);
  parts.push(`- Risk appetite: ${market_conditions.risk_appetite}`);
  parts.push('');
  
  // Key signals
  if (signals.length > 0) {
    parts.push(`Key Signals (${signals.length}):`);
    signals.slice(0, 5).forEach(signal => {
      parts.push(`- [${signal.source}] ${signal.message}`);
    });
    if (signals.length > 5) {
      parts.push(`- ... and ${signals.length - 5} more signals`);
    }
    parts.push('');
  }
  
  // Opportunities
  if (opportunities.length > 0) {
    parts.push(`Opportunities (${opportunities.length}):`);
    opportunities.slice(0, 3).forEach(opp => {
      parts.push(`- ${opp.message}`);
    });
    parts.push('');
  }
  
  // Risks
  if (risks.length > 0) {
    parts.push(`Risk Factors (${risks.length}):`);
    risks.slice(0, 3).forEach(risk => {
      parts.push(`- [${risk.severity}] ${risk.message}`);
    });
    parts.push('');
  }
  
  return parts.join('\n');
}

/**
 * Calculate overall confidence score
 * @param {Object} analysis - Market analysis
 * @returns {number} Confidence score (0-100)
 */
function calculateConfidence(analysis) {
  let confidence = 50; // Base confidence
  
  // Add confidence based on sentiment confidence
  if (analysis.sentiment.confidence > 0) {
    confidence += analysis.sentiment.confidence * 20;
  }
  
  // Add confidence based on number of signals
  const signalCount = analysis.signals.length;
  if (signalCount > 5) {
    confidence += 10;
  } else if (signalCount > 10) {
    confidence += 15;
  }
  
  // Reduce confidence if assessment is neutral
  if (analysis.assessment === 'neutral') {
    confidence -= 10;
  }
  
  // Reduce confidence if high risks
  if (analysis.risks.length > 3) {
    confidence -= 10;
  }
  
  // Add confidence if clear opportunities
  if (analysis.opportunities.length > 2) {
    confidence += 10;
  }
  
  // Ensure confidence is within bounds
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

/**
 * Generate trading recommendation
 * @param {Object} analysis - Market analysis
 * @param {number} confidence - Confidence score
 * @returns {Object} Trading recommendation
 */
function generateRecommendation(analysis, confidence) {
  const recommendation = {
    action: 'HOLD',
    confidence,
    rationale: [],
    risk_level: 'medium',
    position_sizing: 'normal',
    stop_loss: null,
    take_profit: null
  };
  
  // Determine action based on assessment
  if (analysis.assessment === 'bullish' && confidence >= 60) {
    recommendation.action = 'BUY';
    recommendation.rationale.push('Bullish market assessment with high confidence');
    recommendation.position_sizing = confidence >= 75 ? 'aggressive' : 'normal';
  } else if (analysis.assessment === 'bearish' && confidence >= 60) {
    recommendation.action = 'SELL';
    recommendation.rationale.push('Bearish market assessment with high confidence');
    recommendation.position_sizing = 'conservative';
  } else {
    recommendation.action = 'HOLD';
    recommendation.rationale.push('Neutral or low confidence assessment - wait for clearer signals');
    recommendation.position_sizing = 'minimal';
  }
  
  // Adjust for risk factors
  if (analysis.risks.length > 3) {
    recommendation.risk_level = 'high';
    recommendation.rationale.push(`High risk environment (${analysis.risks.length} risk factors identified)`);
    
    if (recommendation.action === 'BUY') {
      recommendation.position_sizing = 'conservative';
      recommendation.rationale.push('Reduce position size due to elevated risks');
    }
  } else if (analysis.risks.length === 0) {
    recommendation.risk_level = 'low';
  }
  
  // Add specific rationale from opportunities
  if (analysis.opportunities.length > 0) {
    const topOpportunity = analysis.opportunities[0];
    recommendation.rationale.push(topOpportunity.message);
  }
  
  // Add specific rationale from risks
  if (analysis.risks.length > 0) {
    const topRisk = analysis.risks[0];
    recommendation.rationale.push(`Risk: ${topRisk.message}`);
  }
  
  // Market conditions considerations
  if (analysis.market_conditions.volatility === 'high') {
    recommendation.rationale.push('High volatility - use tighter stops and smaller positions');
    recommendation.position_sizing = 'conservative';
  }
  
  if (analysis.market_conditions.volume === 'low') {
    recommendation.rationale.push('Low volume - be cautious of slippage and false signals');
  }
  
  return recommendation;
}

/**
 * Get agent details and status
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
    agent_key: 'market_intelligence',
    name: 'Market Intelligence Agent',
    description: 'Aggregates news, on-chain metrics, and macro indicators for comprehensive market analysis',
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
      'News aggregation (CryptoPanic, NewsAPI)',
      'On-chain metrics (Glassnode, CoinGecko)',
      'Macro indicators (DXY, VIX, S&P 500, Gold)',
      'Anomaly detection',
      'Sentiment analysis',
      'Market summary generation',
      'Trading recommendations'
    ],
    data_sources: {
      news: ['CryptoPanic', 'NewsAPI'],
      onchain: ['Glassnode', 'CoinGecko', 'Blockchain.info'],
      macro: ['Alpha Vantage']
    }
  };
}

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    includeNews: true,
    includeOnChain: true,
    includeMacro: true,
    detectAnomalies: true,
    generateSummary: true,
    newsLimit: 20,
    confidence_threshold: 60
  };
}

/**
 * Clear historical data (for testing)
 */
export function clearHistoricalData() {
  historicalData.clear();
  logger.info('Market Intelligence historical data cleared');
}

export default {
  run,
  getDetails,
  defaultConfig,
  clearHistoricalData
};
