/**
 * Risk Management Agent
 * BACKEND-004: Implement Risk Management Agent
 * 
 * Provides comprehensive risk management analysis:
 * - Portfolio Value at Risk (VaR) calculation
 * - Position sizing recommendations based on risk tolerance
 * - Asset correlation monitoring
 * - Stop-loss recommendations
 * - Integration with portfolio data
 */

import { logger } from '../logger.js';
import { query } from '../../database/db.js';
import {
  calculateReturns,
  calculateHistoricalVaR,
  calculateParametricVaR,
  calculateKellyPositionSize,
  calculateFixedFractionalSize,
  calculateCorrelationMatrix,
  calculateATRStopLoss,
  calculatePercentageStopLoss,
  calculatePortfolioRiskMetrics
} from '../riskCalculator.js';

/**
 * Fetch portfolio data for a user
 */
async function getPortfolioData(userId, portfolioId = null) {
  try {
    let portfolioQuery;
    let params;
    
    if (portfolioId) {
      portfolioQuery = 'SELECT * FROM portfolios WHERE user_id = $1 AND id = $2';
      params = [userId, portfolioId];
    } else {
      // Get main portfolio or first portfolio
      portfolioQuery = 'SELECT * FROM portfolios WHERE user_id = $1 ORDER BY is_main DESC, created_at ASC LIMIT 1';
      params = [userId];
    }
    
    const portfolioResult = await query(portfolioQuery, params);
    
    if (portfolioResult.rows.length === 0) {
      return null;
    }
    
    const portfolio = portfolioResult.rows[0];
    
    // Get trades for this portfolio
    const tradesQuery = `
      SELECT * FROM trades 
      WHERE user_id = $1 AND portfolio_id = $2 
      ORDER BY created_at DESC 
      LIMIT 500
    `;
    const tradesResult = await query(tradesQuery, [userId, portfolio.id]);
    
    return {
      portfolio,
      trades: tradesResult.rows
    };
  } catch (error) {
    logger.error('Failed to fetch portfolio data', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate portfolio positions from trades
 */
function calculatePositions(trades) {
  const positions = {};
  
  for (const trade of trades) {
    if (trade.status !== 'completed') continue;
    
    const symbol = trade.symbol;
    if (!positions[symbol]) {
      positions[symbol] = {
        symbol,
        quantity: 0,
        total_cost: 0,
        realized_pnl: 0,
        trades: []
      };
    }
    
    const position = positions[symbol];
    const amount = parseFloat(trade.amount) || 0;
    const price = parseFloat(trade.price) || 0;
    
    if (trade.side === 'buy') {
      position.quantity += amount;
      position.total_cost += amount * price;
    } else if (trade.side === 'sell') {
      const avgCost = position.quantity > 0 ? position.total_cost / position.quantity : 0;
      position.realized_pnl += amount * (price - avgCost);
      position.quantity -= amount;
      position.total_cost -= amount * avgCost;
    }
    
    position.trades.push(trade);
  }
  
  // Calculate average cost for remaining positions
  for (const symbol in positions) {
    const position = positions[symbol];
    if (position.quantity > 0) {
      position.avg_cost = position.total_cost / position.quantity;
    } else {
      position.avg_cost = 0;
    }
  }
  
  return positions;
}

/**
 * Generate mock historical price data for testing
 * In production, this would fetch from market data API
 */
function generateMockPriceData(symbol, days = 100, currentPrice = 100) {
  const prices = [];
  let price = currentPrice;
  const volatility = 0.02; // 2% daily volatility
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Random walk with drift
    const change = (Math.random() - 0.48) * volatility * price;
    price = Math.max(price + change, price * 0.5); // Prevent negative prices
    
    prices.push({
      timestamp: date.toISOString(),
      open: price * (1 + (Math.random() - 0.5) * 0.01),
      high: price * (1 + Math.random() * 0.02),
      low: price * (1 - Math.random() * 0.02),
      close: price
    });
  }
  
  return prices;
}

/**
 * Calculate trading statistics for Kelly Criterion
 */
function calculateTradingStats(trades) {
  const completedTrades = trades.filter(t => t.status === 'completed');
  
  if (completedTrades.length < 10) {
    return null; // Insufficient data
  }
  
  let wins = 0;
  let losses = 0;
  let totalWin = 0;
  let totalLoss = 0;
  
  // Group trades by symbol to calculate P&L
  const tradesBySymbol = {};
  for (const trade of completedTrades) {
    const symbol = trade.symbol;
    if (!tradesBySymbol[symbol]) {
      tradesBySymbol[symbol] = [];
    }
    tradesBySymbol[symbol].push(trade);
  }
  
  // Calculate P&L for each symbol
  for (const symbol in tradesBySymbol) {
    const symbolTrades = tradesBySymbol[symbol];
    let position = 0;
    let costBasis = 0;
    
    for (const trade of symbolTrades) {
      const amount = parseFloat(trade.amount) || 0;
      const price = parseFloat(trade.price) || 0;
      
      if (trade.side === 'buy') {
        costBasis = position > 0 ? ((costBasis * position) + (price * amount)) / (position + amount) : price;
        position += amount;
      } else if (trade.side === 'sell' && position > 0) {
        const pnl = amount * (price - costBasis);
        if (pnl > 0) {
          wins++;
          totalWin += pnl;
        } else {
          losses++;
          totalLoss += Math.abs(pnl);
        }
        position -= amount;
      }
    }
  }
  
  const totalTrades = wins + losses;
  if (totalTrades === 0) return null;
  
  return {
    win_rate: wins / totalTrades,
    avg_win: wins > 0 ? totalWin / wins : 0,
    avg_loss: losses > 0 ? totalLoss / losses : 0,
    total_trades: totalTrades
  };
}

/**
 * Main run function for Risk Management Agent
 */
export async function run({ userId, symbol = null, timeframe = '1d', config = {} }) {
  const startTime = Date.now();
  
  try {
    logger.info('Risk Management Agent: Starting analysis', { userId, symbol });
    
    // Default config
    const riskConfig = {
      confidence_level: config.confidence_level || 0.95,
      max_risk_per_trade: config.max_risk_per_trade || 0.02,
      stop_loss_method: config.stop_loss_method || 'atr',
      atr_multiplier: config.atr_multiplier || 2,
      use_kelly_criterion: config.use_kelly_criterion !== false,
      ...config
    };
    
    // Fetch portfolio data
    const portfolioData = await getPortfolioData(userId, config.portfolio_id);
    
    if (!portfolioData) {
      return {
        agent_key: 'risk',
        symbol,
        result: 'No portfolio found',
        confidence: 0,
        timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
        warning: 'User has no portfolio to analyze'
      };
    }
    
    const { portfolio, trades } = portfolioData;
    const positions = calculatePositions(trades);
    const activePositions = Object.values(positions).filter(p => p.quantity > 0);
    
    // Calculate portfolio value (mock - in production would use current market prices)
    let portfolioValue = 100000; // Default value
    if (activePositions.length > 0) {
      portfolioValue = activePositions.reduce((sum, p) => sum + (p.quantity * (p.avg_cost || 100)), 0);
    }
    
    // Generate analysis results
    const analysis = {
      portfolio_id: portfolio.id,
      portfolio_name: portfolio.name,
      portfolio_value: portfolioValue,
      positions_count: activePositions.length,
      risk_metrics: {},
      position_sizing: {},
      correlations: null,
      stop_loss_recommendations: [],
      warnings: [],
      recommendations: []
    };
    
    // 1. Calculate VaR if we have historical data
    if (activePositions.length > 0) {
      // Generate mock price data for the portfolio (would be real data in production)
      const mockPrices = generateMockPriceData('PORTFOLIO', 100, portfolioValue);
      const returns = calculateReturns(mockPrices);
      
      // Historical VaR
      const historicalVaR = calculateHistoricalVaR(returns, riskConfig.confidence_level, portfolioValue);
      
      // Parametric VaR
      const parametricVaR = calculateParametricVaR(returns, riskConfig.confidence_level, portfolioValue);
      
      // Portfolio risk metrics
      const riskMetrics = calculatePortfolioRiskMetrics(returns, 0.04);
      
      analysis.risk_metrics = {
        historical_var: historicalVaR,
        parametric_var: parametricVaR,
        ...riskMetrics
      };
      
      // Add warnings based on risk metrics
      if (riskMetrics.sharpe_ratio < 0.5) {
        analysis.warnings.push('Low Sharpe ratio indicates poor risk-adjusted returns');
      }
      if (riskMetrics.max_drawdown > 0.3) {
        analysis.warnings.push(`High maximum drawdown: ${(riskMetrics.max_drawdown * 100).toFixed(2)}%`);
      }
      if (historicalVaR.var_1day_percent > 5) {
        analysis.warnings.push(`High VaR: Portfolio could lose ${historicalVaR.var_1day_percent.toFixed(2)}% in one day`);
      }
    }
    
    // 2. Position sizing recommendations
    const tradingStats = calculateTradingStats(trades);
    
    if (tradingStats && riskConfig.use_kelly_criterion) {
      const kellySize = calculateKellyPositionSize(
        tradingStats.win_rate,
        tradingStats.avg_win,
        tradingStats.avg_loss,
        portfolioValue,
        riskConfig.max_risk_per_trade
      );
      
      analysis.position_sizing.kelly_criterion = kellySize;
      
      if (kellySize.fractional_kelly_percent > 0) {
        analysis.recommendations.push(
          `Based on your trading history (${(tradingStats.win_rate * 100).toFixed(1)}% win rate), ` +
          `optimal position size is ${kellySize.fractional_kelly_percent.toFixed(2)}% of portfolio`
        );
      }
    }
    
    // Fixed fractional sizing for new trade
    if (symbol && config.entry_price && config.stop_loss_price) {
      const fixedFractional = calculateFixedFractionalSize(
        portfolioValue,
        riskConfig.max_risk_per_trade,
        config.entry_price,
        config.stop_loss_price
      );
      
      analysis.position_sizing.fixed_fractional = fixedFractional;
      analysis.recommendations.push(
        `For ${symbol} at $${config.entry_price} with stop at $${config.stop_loss_price}, ` +
        `recommended position size: ${fixedFractional.shares} shares ($${fixedFractional.position_size.toFixed(2)})`
      );
    }
    
    // Generic position sizing recommendation
    if (!analysis.position_sizing.kelly_criterion && !analysis.position_sizing.fixed_fractional) {
      const genericSize = portfolioValue * riskConfig.max_risk_per_trade;
      analysis.position_sizing.recommended = {
        method: 'fixed_percentage',
        risk_percent: riskConfig.max_risk_per_trade * 100,
        position_size: genericSize,
        max_loss: genericSize
      };
      
      analysis.recommendations.push(
        `Recommended max position size: $${genericSize.toFixed(2)} ` +
        `(${(riskConfig.max_risk_per_trade * 100)}% of portfolio)`
      );
    }
    
    // 3. Correlation analysis if multiple positions
    if (activePositions.length >= 2) {
      const assetReturns = {};
      
      for (const position of activePositions) {
        const mockPrices = generateMockPriceData(position.symbol, 100, position.avg_cost || 100);
        assetReturns[position.symbol] = calculateReturns(mockPrices);
      }
      
      const correlationAnalysis = calculateCorrelationMatrix(assetReturns);
      analysis.correlations = correlationAnalysis;
      
      if (correlationAnalysis.high_correlations.length > 0) {
        analysis.warnings.push(
          `High correlation detected between ${correlationAnalysis.high_correlations.length} asset pairs`
        );
        
        correlationAnalysis.high_correlations.forEach(hc => {
          analysis.warnings.push(
            `${hc.pair[0]} and ${hc.pair[1]} are highly correlated (${(hc.correlation * 100).toFixed(1)}%)`
          );
        });
      }
      
      analysis.recommendations.push(
        `Diversification score: ${correlationAnalysis.diversification_score}/100`
      );
    }
    
    // 4. Stop-loss recommendations
    if (symbol) {
      const mockPrices = generateMockPriceData(symbol, 100, config.current_price || 100);
      const currentPrice = config.current_price || mockPrices[mockPrices.length - 1].close;
      const side = config.side || 'buy';
      
      // ATR-based stop-loss
      if (riskConfig.stop_loss_method === 'atr' || !config.stop_loss_price) {
        const atrStop = calculateATRStopLoss(
          mockPrices,
          riskConfig.atr_multiplier,
          currentPrice,
          side
        );
        
        analysis.stop_loss_recommendations.push(atrStop);
        
        if (!atrStop.warning) {
          analysis.recommendations.push(
            `ATR-based stop-loss for ${symbol}: $${atrStop.stop_loss_price.toFixed(2)} ` +
            `(${atrStop.stop_loss_percent.toFixed(2)}% risk)`
          );
        }
      }
      
      // Percentage-based stop-loss
      const percentStop = calculatePercentageStopLoss(
        currentPrice,
        riskConfig.max_risk_per_trade,
        side
      );
      
      analysis.stop_loss_recommendations.push(percentStop);
      
      // Risk/Reward analysis
      if (config.target_price) {
        const risk = Math.abs(currentPrice - percentStop.stop_loss_price);
        const reward = Math.abs(config.target_price - currentPrice);
        const riskRewardRatio = risk > 0 ? reward / risk : 0;
        
        analysis.risk_reward = {
          entry_price: currentPrice,
          stop_loss: percentStop.stop_loss_price,
          target: config.target_price,
          risk_amount: risk,
          reward_amount: reward,
          risk_reward_ratio: riskRewardRatio,
          assessment: riskRewardRatio >= 2 ? 'Good' : riskRewardRatio >= 1.5 ? 'Acceptable' : 'Poor'
        };
        
        if (riskRewardRatio < 1.5) {
          analysis.warnings.push(
            `Low risk/reward ratio: ${riskRewardRatio.toFixed(2)}:1 (recommended minimum: 1.5:1)`
          );
        } else {
          analysis.recommendations.push(
            `Good risk/reward ratio: ${riskRewardRatio.toFixed(2)}:1`
          );
        }
      }
    }
    
    // Stop-loss recommendations for existing positions
    if (activePositions.length > 0 && !symbol) {
      analysis.stop_loss_recommendations = activePositions.slice(0, 5).map(position => {
        const mockPrices = generateMockPriceData(position.symbol, 100, position.avg_cost);
        const currentPrice = mockPrices[mockPrices.length - 1].close;
        
        const atrStop = calculateATRStopLoss(mockPrices, riskConfig.atr_multiplier, currentPrice, 'buy');
        
        return {
          symbol: position.symbol,
          quantity: position.quantity,
          avg_cost: position.avg_cost,
          current_price: currentPrice,
          unrealized_pnl: position.quantity * (currentPrice - position.avg_cost),
          ...atrStop
        };
      });
    }
    
    // Overall risk assessment
    const overallRisk = assessOverallRisk(analysis);
    analysis.overall_risk_level = overallRisk.level;
    analysis.overall_risk_score = overallRisk.score;
    
    // Calculate confidence based on data quality
    const confidence = calculateConfidence(activePositions.length, trades.length, analysis);
    
    const executionTime = Date.now() - startTime;
    
    logger.info('Risk Management Agent: Analysis complete', {
      userId,
      symbol,
      executionTime,
      confidence,
      positionsAnalyzed: activePositions.length
    });
    
    return {
      agent_key: 'risk',
      symbol,
      result: 'Risk analysis complete',
      confidence,
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      analysis,
      _meta: {
        source: 'risk_calculator',
        version: '2.0.0',
        config: riskConfig
      }
    };
    
  } catch (error) {
    logger.error('Risk Management Agent: Error', {
      error: error.message,
      stack: error.stack,
      userId,
      symbol
    });
    
    return {
      agent_key: 'risk',
      symbol,
      result: 'Analysis failed',
      confidence: 0,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - startTime,
      error: error.message,
      _meta: { source: 'error', version: '2.0.0' }
    };
  }
}

/**
 * Assess overall portfolio risk level
 */
function assessOverallRisk(analysis) {
  let riskScore = 50; // Start at neutral
  
  // Adjust based on VaR
  if (analysis.risk_metrics.historical_var) {
    const varPercent = analysis.risk_metrics.historical_var.var_1day_percent;
    if (varPercent > 10) riskScore += 30;
    else if (varPercent > 5) riskScore += 20;
    else if (varPercent > 2) riskScore += 10;
  }
  
  // Adjust based on Sharpe ratio
  if (analysis.risk_metrics.sharpe_ratio !== undefined) {
    if (analysis.risk_metrics.sharpe_ratio < 0) riskScore += 20;
    else if (analysis.risk_metrics.sharpe_ratio < 0.5) riskScore += 10;
    else if (analysis.risk_metrics.sharpe_ratio > 2) riskScore -= 10;
  }
  
  // Adjust based on max drawdown
  if (analysis.risk_metrics.max_drawdown !== undefined) {
    const dd = analysis.risk_metrics.max_drawdown;
    if (dd > 0.5) riskScore += 25;
    else if (dd > 0.3) riskScore += 15;
    else if (dd > 0.15) riskScore += 5;
  }
  
  // Adjust based on correlation
  if (analysis.correlations) {
    const highCorr = analysis.correlations.high_correlations.length;
    if (highCorr > 3) riskScore += 15;
    else if (highCorr > 1) riskScore += 10;
    
    if (analysis.correlations.diversification_score < 50) riskScore += 10;
  }
  
  // Clamp score between 0 and 100
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  // Determine risk level
  let level;
  if (riskScore >= 80) level = 'CRITICAL';
  else if (riskScore >= 60) level = 'HIGH';
  else if (riskScore >= 40) level = 'MODERATE';
  else if (riskScore >= 20) level = 'LOW';
  else level = 'VERY_LOW';
  
  return { score: riskScore, level };
}

/**
 * Calculate confidence based on data quality
 */
function calculateConfidence(positionsCount, tradesCount, analysis) {
  let confidence = 0.5; // Base confidence
  
  // More positions = more confidence
  if (positionsCount >= 5) confidence += 0.15;
  else if (positionsCount >= 3) confidence += 0.10;
  else if (positionsCount >= 1) confidence += 0.05;
  
  // More trades = more confidence in statistics
  if (tradesCount >= 100) confidence += 0.15;
  else if (tradesCount >= 50) confidence += 0.10;
  else if (tradesCount >= 20) confidence += 0.05;
  
  // Reduce confidence if we have warnings
  if (analysis.warnings.length > 3) confidence -= 0.10;
  else if (analysis.warnings.length > 0) confidence -= 0.05;
  
  // Cap confidence
  return Math.max(0.3, Math.min(0.95, confidence));
}

/**
 * Get agent details
 */
export async function getDetails({ userId }) {
  try {
    const portfolioData = await getPortfolioData(userId);
    const lastRun = portfolioData ? new Date().toISOString() : null;
    
    return {
      agent_key: 'risk',
      name: 'Risk Management Agent',
      description: 'Comprehensive risk analysis including VaR, position sizing, correlation, and stop-loss recommendations',
      status: 'active',
      lastRun,
      capabilities: [
        'Portfolio Value at Risk (VaR) calculation',
        'Position sizing using Kelly Criterion and Fixed Fractional',
        'Asset correlation monitoring',
        'Stop-loss recommendations (ATR and percentage-based)',
        'Risk/reward ratio analysis',
        'Portfolio risk metrics (Sharpe ratio, volatility, max drawdown)'
      ],
      metrics: {
        totalRuns: 0,
        avgExecutionTime: 0,
        successRate: 100
      }
    };
  } catch (error) {
    logger.error('Failed to get risk agent details', { error: error.message });
    return {
      agent_key: 'risk',
      name: 'Risk Management Agent',
      description: 'Risk management analysis agent',
      status: 'active',
      lastRun: null,
      metrics: {
        totalRuns: 0,
        avgExecutionTime: 0,
        successRate: 0
      }
    };
  }
}

/**
 * Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    confidence_level: 0.95,
    max_risk_per_trade: 0.02,
    stop_loss_method: 'atr',
    atr_multiplier: 2,
    use_kelly_criterion: true,
    risk_free_rate: 0.04
  };
}

export default { run, getDetails, defaultConfig };
