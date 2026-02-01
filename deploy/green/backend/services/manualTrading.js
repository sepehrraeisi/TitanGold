import { query } from '../database/db.js';
import { mexcService } from './mexc.js';
import RiskGateService from './risk-gate.js';
import * as db from '../database/db.js';
import { logger } from '../services/logger.js';

// Import mexcService if not already imported

class ManualTradingService {
  constructor() {
    this.riskGate = new RiskGateService(db);
  }
  /**
   * Get complete page data for manual trading
   */
  async getPageData(userId) {
    try {
      logger.info(`📊 Starting to fetch manual trading page data for user ${userId}`);
      
      // Get stats (from database - always works)
      const stats = await this.getStats(userId).catch(err => {
        logger.warn('⚠️ Error getting stats, using defaults:', err);
        return this.getDefaultStats();
      });
      
      // Get chart data - Real data from MEXC (may fail if MEXC not configured)
      const chart = await this.getChartData(userId, 'BTC/USDT').catch(err => {
        logger.warn('⚠️ Error getting chart data, generating demo data:', err.message);
        // Generate demo data instead of empty array
        const now = Date.now();
        const basePrice = 42000;
        return Array.from({ length: 100 }, (_, i) => {
          const timestamp = now - (100 - i) * 3600000; // 1 hour intervals
          const random = () => (Math.random() - 0.5) * 0.02;
          const open = basePrice * (1 + random());
          const close = open * (1 + random());
          const high = Math.max(open, close) * (1 + Math.abs(random()));
          const low = Math.min(open, close) * (1 - Math.abs(random()));
          const volume = Math.random() * 1000;
          return {
            timestamp: new Date(timestamp).toISOString(),
            open,
            high,
            low,
            close,
            volume,
          };
        });
      });
      
      // Get quick trade config - Real data from MEXC (may fail if MEXC not configured)
      const quickTrade = await this.getQuickTradeConfig(userId, 'BTC/USDT').catch(err => {
        logger.warn('⚠️ Error getting quick trade config, using defaults:', err);
        return {
          pair: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          price: 0,
          changePercent: 0,
          availableBalance: 0,
          amountPresets: [10, 25, 50, 75, 100],
          defaultPreset: 25,
          stopLossPercent: 2,
          takeProfitPercent: 5,
          baseAssetPrecision: 8,
        };
      });
      
      // Get recommendations - Real data from AI (may fail if MEXC not configured)
      const recommendations = await this.getRecommendations(userId).catch(err => {
        logger.warn('⚠️ Error getting recommendations, using defaults:', err);
        return [];
      });
      
      // Get sentiment - Real data from market (may fail if MEXC not configured)
      const sentiment = await this.getSentiment(userId).catch(err => {
        logger.warn('⚠️ Error getting sentiment, using defaults:', err);
        return {
          score: 50,
          labelKey: 'sentiment_neutral',
        };
      });
      
      // Get strategies (from database - always works)
      const strategies = await this.getStrategies(userId).catch(err => {
        logger.warn('⚠️ Error getting strategies, using empty array:', err);
        return [];
      });
      
      // Get portfolio (from database - always works)
      const portfolio = await this.getPortfolio(userId).catch(err => {
        logger.warn('⚠️ Error getting portfolio, using empty array:', err);
        return [];
      });
      
      // Get performance (from database - always works)
      const performance = await this.getPerformance(userId).catch(err => {
        logger.warn('⚠️ Error getting performance, using empty array:', err);
        return [];
      });
      
      // Get recent trades (from database - always works)
      const recentTrades = await this.getRecentTrades(userId, 12).catch(err => {
        logger.warn('⚠️ Error getting recent trades, using empty array:', err);
        return [];
      });

      logger.info(`✅ Successfully assembled manual trading page data`);
      return {
        stats,
        chart,
        quickTrade,
        recommendations,
        sentiment,
        strategies,
        portfolio,
        performance,
        recentTrades,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('❌ Critical error getting manual trading page data:', error);
      throw error;
    }
  }

  /**
   * Get trading statistics
   */
  async getStats(userId) {
    try {
      // Check if manual_trades table exists by trying a simple query
      try {
        // Get today's profit
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayProfitResult = await query(
          `SELECT COALESCE(SUM(pnl), 0) as total 
           FROM manual_trades 
           WHERE user_id = $1 AND executed_at >= $2`,
          [userId, todayStart.toISOString()]
        );
        const todayProfit = parseFloat(todayProfitResult.rows[0]?.total || 0);

        // Get total profit
        const totalProfitResult = await query(
          `SELECT COALESCE(SUM(pnl), 0) as total 
           FROM manual_trades 
           WHERE user_id = $1`,
          [userId]
        );
        const totalProfit = parseFloat(totalProfitResult.rows[0]?.total || 0);

        // Get trades volume
        const volumeResult = await query(
          `SELECT COALESCE(SUM(amount * price), 0) as total 
           FROM manual_trades 
           WHERE user_id = $1`,
          [userId]
        );
        const tradesVolume = parseFloat(volumeResult.rows[0]?.total || 0);

        // Get active trades count
        const activeTradesResult = await query(
          `SELECT COUNT(*) as count 
           FROM manual_trades 
           WHERE user_id = $1 AND status = 'open'`,
          [userId]
        );
        const activeTrades = parseInt(activeTradesResult.rows[0]?.count || 0);

        // Get win rate
        const winRateResult = await query(
          `SELECT 
             COUNT(*) as total,
             SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
           FROM manual_trades 
           WHERE user_id = $1 AND status = 'closed'`,
          [userId]
        );
        const total = parseInt(winRateResult.rows[0]?.total || 0);
        const wins = parseInt(winRateResult.rows[0]?.wins || 0);
        const winRate = total > 0 ? (wins / total) * 100 : 0;

        // Get success rate (similar to win rate)
        const successRate = winRate;

        // Get total trades count
        const totalTradesResult = await query(
          `SELECT COUNT(*) as count 
           FROM manual_trades 
           WHERE user_id = $1`,
          [userId]
        );
        const totalTrades = parseInt(totalTradesResult.rows[0]?.count || 0);

        return [
        {
          id: 'today_profit',
          labelKey: 'today_profit',
          value: todayProfit,
          format: 'currency',
          decimals: 2,
          showSign: true,
        },
        {
          id: 'total_profit',
          labelKey: 'total_profit',
          value: totalProfit,
          format: 'currency',
          decimals: 2,
          showSign: true,
        },
        {
          id: 'trades_volume',
          labelKey: 'trades_volume',
          value: tradesVolume,
          format: 'currency',
          decimals: 0,
        },
        {
          id: 'active_trades',
          labelKey: 'active_trades',
          value: activeTrades,
          format: 'plain',
          decimals: 0,
        },
        {
          id: 'win_rate',
          labelKey: 'win_rate',
          value: winRate,
          format: 'percent',
          decimals: 1,
        },
        {
          id: 'success_rate',
          labelKey: 'success_rate',
          value: successRate,
          format: 'percent',
          decimals: 1,
        },
        {
          id: 'total_trades',
          labelKey: 'total_trades',
          value: totalTrades,
          format: 'plain',
          decimals: 0,
        },
      ];
      } catch (dbError) {
        // If table doesn't exist or other DB error, return defaults
        logger.warn('⚠️ Database error in getStats, using defaults:', dbError.message);
        if (dbError.message?.includes('does not exist') || dbError.message?.includes('relation')) {
          logger.warn('⚠️ manual_trades table does not exist. Please run: psql -U postgres -d titangold_db -f backend/scripts/init_manual_trades.sql');
        }
        return this.getDefaultStats();
      }
    } catch (error) {
      logger.error('❌ Error getting stats:', error);
      return this.getDefaultStats();
    }
  }

  /**
   * Get default stats when no data available
   */
  getDefaultStats() {
    return [
      { id: 'today_profit', labelKey: 'today_profit', value: 0, format: 'currency', decimals: 2, showSign: true },
      { id: 'total_profit', labelKey: 'total_profit', value: 0, format: 'currency', decimals: 2, showSign: true },
      { id: 'trades_volume', labelKey: 'trades_volume', value: 0, format: 'currency', decimals: 0 },
      { id: 'active_trades', labelKey: 'active_trades', value: 0, format: 'plain', decimals: 0 },
      { id: 'win_rate', labelKey: 'win_rate', value: 0, format: 'percent', decimals: 1 },
      { id: 'success_rate', labelKey: 'success_rate', value: 0, format: 'percent', decimals: 1 },
      { id: 'total_trades', labelKey: 'total_trades', value: 0, format: 'plain', decimals: 0 },
    ];
  }

  /**
   * Get chart data (OHLCV) - Real data from MEXC or simulated for demo
   */
  async getChartData(userId, pair = 'BTC/USDT', timeframe = '1h', limit = 100) {
    try {
      // Check user's trading mode
      const mode = await this.getUserTradingMode(userId);
      
      // In demo mode, return simulated chart data
      if (mode === 'demo') {
        logger.info(`📈 Generating demo chart data for ${pair}...`);
        const now = Date.now();
        const basePrice = pair.includes('BTC') ? 42000 : pair.includes('ETH') ? 2500 : 100;
        
        const candles = Array.from({ length: limit }, (_, i) => {
          const timestamp = now - (limit - i) * 3600000; // 1 hour intervals
          const random = () => (Math.random() - 0.5) * 0.02; // ±2% variation
          const open = basePrice * (1 + random());
          const close = open * (1 + random());
          const high = Math.max(open, close) * (1 + Math.abs(random()));
          const low = Math.min(open, close) * (1 - Math.abs(random()));
          const volume = Math.random() * 1000;
          
          return {
            timestamp: new Date(timestamp).toISOString(),
            open,
            high,
            low,
            close,
            volume,
          };
        });
        
        return candles;
      }
      
      // Live mode: fetch from MEXC
      logger.info(`📈 Fetching chart data for ${pair} from MEXC...`);
      const ohlcv = await mexcService.fetchOHLCV(userId, pair, timeframe, limit);
      
      if (!ohlcv || ohlcv.length === 0) {
        logger.warn(`⚠️ No chart data from MEXC for ${pair}, returning empty array`);
        return [];
      }
      
      logger.info(`✅ Fetched ${ohlcv.length} candles from MEXC`);
      return ohlcv.map(candle => ({
        timestamp: new Date(candle[0]).toISOString(),
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      logger.error(`❌ Error getting chart data from MEXC for ${pair}:`, error);
      // Return empty chart data on error - don't throw to allow other data to load
      return [];
    }
  }

  /**
   * Get quick trade configuration - Real data from MEXC
   */
  async getQuickTradeConfig(userId, pair = 'BTC/USDT') {
    try {
      logger.info(`💰 Fetching quick trade config for ${pair} from MEXC...`);
      // Get current price from MEXC - catch errors gracefully
      const ticker = await mexcService.fetchTicker(userId, pair).catch(err => {
        logger.warn(`⚠️ MEXC fetchTicker failed for ${pair}, using defaults:`, err.message);
        return null;
      });
      
      if (!ticker) {
        logger.warn(`⚠️ No ticker data from MEXC for ${pair}, using default values`);
        // Don't throw - return default config instead
        const balance = await this.getBalance(userId).catch(() => ({ USDT: 10000, BTC: 0, ETH: 0 }));
        const [baseAsset, quoteAsset] = pair.split('/');
        return {
          pair,
          baseAsset,
          quoteAsset: quoteAsset || 'USDT',
          price: 0,
          changePercent: 0,
          availableBalance: balance.USDT || 10000,
          amountPresets: [10, 25, 50, 75, 100],
          defaultPreset: 25,
          stopLossPercent: 2,
          takeProfitPercent: 5,
          baseAssetPrecision: 8,
        };
      }
      
      const price = ticker.last || 0;
      const changePercent = ticker.percentage || 0;
      logger.info(`✅ Fetched price for ${pair}: $${price} (${changePercent}%)`);

      // Get balance
      const balance = await this.getBalance(userId);
      const availableBalance = balance.USDT || 0;

      // Parse pair
      const [baseAsset, quoteAsset] = pair.split('/');

      return {
        pair,
        baseAsset,
        quoteAsset: quoteAsset || 'USDT',
        price,
        changePercent,
        availableBalance,
        amountPresets: [10, 25, 50, 75, 100],
        defaultPreset: 25,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        baseAssetPrecision: 8,
      };
    } catch (error) {
      logger.error('❌ Error getting quick trade config:', error);
      // Return default config on any error
      const balance = await this.getBalance(userId).catch(() => ({ USDT: 10000, BTC: 0, ETH: 0 }));
      return {
        pair: 'BTC/USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        price: 0,
        changePercent: 0,
        availableBalance: balance.USDT || 10000,
        amountPresets: [10, 25, 50, 75, 100],
        defaultPreset: 25,
        stopLossPercent: 2,
        takeProfitPercent: 5,
        baseAssetPrecision: 8,
      };
    }
  }

  /**
   * Get AI recommendations - Real data from Artemis AI
   */
  async getRecommendations(userId) {
    try {
      // TODO: Integrate with Artemis AI for real recommendations
      // For now, return basic recommendations based on market data
      const ticker = await mexcService.fetchTicker(userId, 'BTC/USDT').catch(() => null);
      if (ticker && ticker.percentage > 0) {
        return [
          {
            id: 'rec-1',
            titleKey: 'recommendation_buy_btc',
            descriptionKey: 'recommendation_buy_btc_desc',
            type: 'buy',
            confidence: Math.min(95, 70 + Math.abs(ticker.percentage) * 2),
          },
        ];
      }
      return [
        {
          id: 'rec-1',
          titleKey: 'recommendation_hold_btc',
          descriptionKey: 'recommendation_hold_btc_desc',
          type: 'hold',
          confidence: 65,
        },
      ];
    } catch (error) {
      logger.error('Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Get market sentiment - Real data from market analysis
   */
  async getSentiment(userId) {
    try {
      // Get BTC and ETH tickers to calculate sentiment
      const [btcTicker, ethTicker] = await Promise.all([
        mexcService.fetchTicker(userId, 'BTC/USDT').catch(() => null),
        mexcService.fetchTicker(userId, 'ETH/USDT').catch(() => null),
      ]);

      let score = 50; // Neutral
      if (btcTicker && ethTicker) {
        const avgChange = (btcTicker.percentage + ethTicker.percentage) / 2;
        score = 50 + (avgChange * 2); // Scale to 0-100
        score = Math.max(0, Math.min(100, score));
      }

      let labelKey = 'sentiment_neutral';
      if (score > 70) labelKey = 'sentiment_bullish';
      else if (score < 30) labelKey = 'sentiment_bearish';

      return {
        score: Math.round(score),
        labelKey,
      };
    } catch (error) {
      logger.error('Error getting sentiment:', error);
      return {
        score: 50,
        labelKey: 'sentiment_neutral',
      };
    }
  }

  /**
   * Get user strategies
   */
  async getStrategies(userId) {
    try {
      const result = await query(
        `SELECT * FROM manual_trading_strategies WHERE user_id = $1`,
        [userId]
      ).catch(err => {
        logger.warn('⚠️ Error querying strategies table, using defaults:', err.message);
        return { rows: [] };
      });

      if (result.rows.length === 0) {
        // Try to create default strategies, but don't fail if table doesn't exist
        try {
          return await this.createDefaultStrategies(userId);
        } catch (createError) {
          logger.warn('⚠️ Could not create default strategies, returning empty array:', createError.message);
          return [];
        }
      }

      return result.rows.map(row => ({
        id: row.id,
        nameKey: row.name_key,
        isActive: row.is_active,
        performance: parseFloat(row.performance || 0),
      }));
    } catch (error) {
      logger.error('Error getting strategies:', error);
      return [];
    }
  }

  /**
   * Create default strategies for user
   */
  async createDefaultStrategies(userId) {
    const defaultStrategies = [
      { nameKey: 'strategy_scalping', isActive: false, performance: 0 },
      { nameKey: 'strategy_swing', isActive: false, performance: 0 },
      { nameKey: 'strategy_day_trading', isActive: false, performance: 0 },
    ];

    const strategies = [];
    for (const strategy of defaultStrategies) {
      const result = await query(
        `INSERT INTO manual_trading_strategies (user_id, name_key, is_active, performance) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [userId, strategy.nameKey, strategy.isActive, strategy.performance]
      );
      strategies.push({
        id: result.rows[0].id,
        nameKey: result.rows[0].name_key,
        isActive: result.rows[0].is_active,
        performance: parseFloat(result.rows[0].performance || 0),
      });
    }

    return strategies;
  }

  /**
   * Get portfolio distribution
   */
  async getPortfolio(userId) {
    try {
      const result = await query(
        `SELECT 
           asset,
           SUM(amount * price) as value
         FROM manual_trades 
         WHERE user_id = $1 AND status = 'open'
         GROUP BY asset`,
        [userId]
      ).catch(err => {
        logger.warn('⚠️ Error querying portfolio, using empty array:', err.message);
        return { rows: [] };
      });

      const total = result.rows.reduce((sum, row) => sum + parseFloat(row.value || 0), 0);

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

      return result.rows.map((row, index) => ({
        id: row.asset,
        asset: row.asset,
        percentage: total > 0 ? (parseFloat(row.value) / total) * 100 : 0,
        color: colors[index % colors.length],
        value: parseFloat(row.value || 0),
      }));
    } catch (error) {
      logger.error('Error getting portfolio:', error);
      return [];
    }
  }

  /**
   * Get performance data
   */
  async getPerformance(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await query(
        `SELECT 
           DATE(executed_at) as date,
           SUM(pnl) as daily_profit
         FROM manual_trades 
         WHERE user_id = $1 AND executed_at >= $2
         GROUP BY DATE(executed_at)
         ORDER BY date ASC`,
        [userId, startDate.toISOString()]
      ).catch(err => {
        logger.warn('⚠️ Error querying performance, using empty array:', err.message);
        return { rows: [] };
      });

      let cumulative = 0;
      return result.rows.map(row => {
        cumulative += parseFloat(row.daily_profit || 0);
        return {
          timestamp: new Date(row.date).toISOString(),
          value: cumulative,
        };
      });
    } catch (error) {
      logger.error('Error getting performance:', error);
      return [];
    }
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(userId, limit = 12) {
    try {
      const result = await query(
        `SELECT * FROM manual_trades 
         WHERE user_id = $1 
         ORDER BY executed_at DESC 
         LIMIT $2`,
        [userId, limit]
      ).catch(err => {
        logger.warn('⚠️ Error querying recent trades, using empty array:', err.message);
        return { rows: [] };
      });

      return result.rows.map(row => ({
        id: row.id,
        side: row.side,
        asset: row.asset,
        pair: row.pair,
        price: parseFloat(row.price || 0),
        amount: parseFloat(row.amount || 0),
        pnl: parseFloat(row.pnl || 0),
        pnlPercent: parseFloat(row.pnl_percent || 0),
        confidence: row.confidence ? parseFloat(row.confidence) : undefined,
        executedAt: row.executed_at.toISOString(),
      }));
    } catch (error) {
      logger.error('Error getting recent trades:', error);
      return [];
    }
  }

  /**
   * Execute quick trade
   */
  async executeQuickTrade(userId, order) {
    const { side, amountPercent, stopLossPercent, takeProfitPercent, pair = 'BTC/USDT' } = order;

    try {
      // 🔥 Get user's trading mode (per-user, DB-backed)
      const mode = await this.getUserTradingMode(userId);
      logger.info(`🔄 executeQuickTrade for user ${userId}: mode=${mode}, side=${side}, pair=${pair}`);
      
      // Get current price and balance
      const ticker = await mexcService.fetchTicker(userId, pair);
      if (!ticker) {
        throw new Error('Pair not found or MEXC connection failed');
      }

      const price = ticker.last;
      const balance = await this.getBalance(userId);
      const [baseAsset, quoteAsset] = pair.split('/');
      const availableBalance = balance[quoteAsset || 'USDT'] || 0;

      // Calculate trade amount
      const notional = (availableBalance * amountPercent) / 100;
      const amount = notional / price;

      // Check if balance is sufficient
      if (side === 'buy' && notional > availableBalance) {
        throw new Error('Insufficient balance');
      }

      // 🛡️ Risk Gate: Check if trade should be blocked
      const riskCheck = await this.riskGate.checkRiskGate({
        symbol: pair,
        side,
        amount,
        price,
        userId
      });

      if (!riskCheck.allowed) {
        throw new Error(riskCheck.message || 'Trade blocked by risk management');
      }

      // 🔥 Execute trade based on user's mode
      let executedPrice = price;
      let orderId = null;

      if (mode === 'live') {
        // ⚠️ LIVE MODE: Real execution via MEXC
        logger.info(`🔴 LIVE MODE: Executing real trade on MEXC`);
        const mexcOrder = await mexcService.createOrder(
          userId,
          pair,
          'market',
          side,
          amount
        );
        orderId = mexcOrder.id;
        executedPrice = mexcOrder.price || price;
      } else {
        // ✅ DEMO MODE: Simulate execution (NO MEXC call)
        logger.info(`🟢 DEMO MODE: Simulating trade (no MEXC call)`);
        executedPrice = price * (1 + (Math.random() * 0.001 - 0.0005)); // Small price variation
        orderId = `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Calculate PnL (for demo, simulate)
      const pnlPercent = mode === 'demo' 
        ? (Math.random() * 2 - 1) * (side === 'buy' ? 1 : -1) // Random PnL for demo
        : 0; // Will be calculated when position is closed
      const pnl = (notional * pnlPercent) / 100;

      // Save trade to database
      const tradeResult = await query(
        `INSERT INTO manual_trades 
         (user_id, side, asset, pair, price, amount, pnl, pnl_percent, status, stop_loss_percent, take_profit_percent, order_id, executed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         RETURNING *`,
        [
          userId,
          side,
          baseAsset,
          pair,
          executedPrice,
          amount,
          pnl,
          pnlPercent,
          'open',
          stopLossPercent || null,
          takeProfitPercent || null,
          orderId,
        ]
      );

      // 🔥 Update balance (DEMO MODE ONLY - update demo wallet in user_preferences)
      if (mode === 'demo') {
        // Get current demo balance
        const currentBalance = await this.getBalance(userId);
        
        // Calculate new balances
        const newBalances = { ...currentBalance };
        
        if (side === 'buy') {
          // Deduct quote asset (e.g., USDT)
          newBalances[quoteAsset || 'USDT'] = Math.max(0, (currentBalance[quoteAsset || 'USDT'] || 0) - notional);
          // Add base asset (e.g., BTC)
          newBalances[baseAsset] = (currentBalance[baseAsset] || 0) + amount;
        } else {
          // side === 'sell'
          // Add quote asset
          newBalances[quoteAsset || 'USDT'] = (currentBalance[quoteAsset || 'USDT'] || 0) + notional;
          // Deduct base asset
          newBalances[baseAsset] = Math.max(0, (currentBalance[baseAsset] || 0) - amount);
        }
        
        // Update demo wallet in user_preferences
        await query(
          `UPDATE user_preferences
           SET preferences = jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{wallet}',
               COALESCE(preferences->'wallet', '{}'::jsonb)
             ),
             '{wallet,demo,balances}',
             $2::jsonb
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId, JSON.stringify(newBalances)]
        );
        
        logger.info(`✅ Demo wallet updated for user ${userId}:`, newBalances);
      }

      // Return updated page data
      return await this.getPageData(userId);
    } catch (error) {
      logger.error('Error executing quick trade:', error);
      throw error;
    }
  }

  /**
   * Toggle strategy
   */
  async toggleStrategy(userId, strategyId) {
    try {
      const result = await query(
        `UPDATE manual_trading_strategies 
         SET is_active = NOT is_active,
             performance = performance + CASE WHEN is_active THEN -$1 ELSE $1 END
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [Math.random() * 1.2, strategyId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Strategy not found');
      }

      // Return updated page data
      return await this.getPageData(userId);
    } catch (error) {
      logger.error('Error toggling strategy:', error);
      throw error;
    }
  }

  /**
   * Get user's trading mode (demo or live)
   */
  async getUserTradingMode(userId) {
    try {
      const modeResult = await query(
        `SELECT preferences->'trading'->>'mode' as mode
         FROM user_preferences
         WHERE user_id = $1 AND is_deleted = FALSE`,
        [userId]
      );
      
      const mode = modeResult.rows[0]?.mode || 'demo';
      logger.info(`🎯 getUserTradingMode for user ${userId}: mode=${mode}`);
      return mode;
    } catch (error) {
      logger.warn('⚠️ Error getting trading mode, defaulting to demo:', error.message);
      return 'demo';
    }
  }

  /**
   * Get user balance
   */
  async getBalance(userId) {
    try {
      // Get trading mode from user_preferences
      const mode = await this.getUserTradingMode(userId);
      logger.info(`💰 getBalance for user ${userId}: mode=${mode}`);
      
      // If demo mode, get from user_preferences
      if (mode === 'demo') {
        const demoResult = await query(
          `SELECT preferences->'wallet'->'demo'->>'balances' as balances
           FROM user_preferences
           WHERE user_id = $1 AND is_deleted = FALSE`,
          [userId]
        );
        
        const balances = demoResult.rows[0]?.balances;
        if (balances) {
          const parsed = JSON.parse(balances);
          logger.info(`✅ Demo balance fetched:`, parsed);
          return parsed;
        }
        
        // Initialize demo wallet with defaults
        const defaults = { USDT: 10000, BTC: 0, ETH: 0 };
        await query(
          `UPDATE user_preferences
           SET preferences = jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{wallet}',
               COALESCE(preferences->'wallet', '{}'::jsonb)
             ),
             '{wallet,demo,balances}',
             $2::jsonb
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId, JSON.stringify(defaults)]
        );
        
        logger.info(`✅ Demo wallet initialized for user ${userId}`);
        return defaults;
      }
      
      // Live mode: try to get from user_balances table (legacy)
      const result = await query(
        `SELECT * FROM user_balances WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default balance
        await query(
          `INSERT INTO user_balances (user_id, USDT) VALUES ($1, 10000) ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
        // Try to get it again
        const newResult = await query(
          `SELECT * FROM user_balances WHERE user_id = $1`,
          [userId]
        );
        if (newResult.rows.length > 0) {
          const balance = newResult.rows[0];
          return {
            USDT: parseFloat(balance.USDT || 10000),
            BTC: parseFloat(balance.BTC || 0),
            ETH: parseFloat(balance.ETH || 0),
          };
        }
        return { USDT: 10000, BTC: 0, ETH: 0 };
      }

      const balance = result.rows[0];
      return {
        USDT: parseFloat(balance.USDT || 0),
        BTC: parseFloat(balance.BTC || 0),
        ETH: parseFloat(balance.ETH || 0),
      };
    } catch (error) {
      logger.error('Error getting balance:', error);
      return { USDT: 0, BTC: 0, ETH: 0 };
    }
  }

  /**
   * Place advanced order (limit, stop-loss, take-profit, etc.)
   */
  async placeAdvancedOrder(userId, order) {
    try {
      const { type, side, pair, amount, price, stopPrice, limitPrice } = order;

      // 🎯 Get user's trading mode
      const mode = await this.getUserTradingMode(userId);

      // Determine order type for MEXC
      let mexcOrderType = 'limit';
      if (type === 'market') {
        mexcOrderType = 'market';
      } else if (type === 'limit') {
        mexcOrderType = 'limit';
      } else if (type === 'stop-loss' || type === 'stop-limit') {
        // For stop orders, we need to create a conditional order
        // MEXC supports stop-limit orders
        mexcOrderType = 'stop-limit';
      }

      // 🛡️ Risk Gate: Check if trade should be blocked
      const riskCheck = await this.riskGate.checkRiskGate({
        symbol: pair,
        side,
        amount,
        price: price || stopPrice || limitPrice,
        userId
      });

      if (!riskCheck.allowed) {
        throw new Error(riskCheck.message || 'Trade blocked by risk management');
      }

      let mexcOrder;
      
      if (mode === 'live') {
        // 🚨 LIVE MODE: Execute order via MEXC
        if (mexcOrderType === 'market') {
          mexcOrder = await mexcService.createOrder(userId, pair, 'market', side, amount);
        } else if (mexcOrderType === 'limit') {
          mexcOrder = await mexcService.createOrder(userId, pair, 'limit', side, amount, price);
        } else if (mexcOrderType === 'stop-limit') {
          // For stop-limit, use stopPrice as trigger and limitPrice as limit
          mexcOrder = await mexcService.createOrder(
            userId,
            pair,
            'stop-limit',
            side,
            amount,
            limitPrice || price,
            undefined,
            { stopPrice }
          );
        }
      } else {
        // 🎮 DEMO MODE: Simulate order execution
        const executedPrice = price || stopPrice || limitPrice || 0;
        mexcOrder = {
          id: `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'closed',
          price: executedPrice,
          timestamp: Date.now(),
          mode: 'demo'
        };
        logger.info('🎮 [DEMO MODE] Simulated advanced order:', mexcOrder);
      }

      // Save order to database
      const orderResult = await query(
        `INSERT INTO manual_trades 
         (user_id, pair, side, type, amount, price, stop_price, limit_price, status, executed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          userId,
          pair,
          side,
          type,
          amount,
          price || null,
          stopPrice || null,
          limitPrice || null,
          mexcOrder?.status === 'closed' ? 'filled' : 'pending',
        ]
      ).catch(err => {
        logger.warn('⚠️ Could not save order to database:', err.message);
        return { rows: [] };
      });

      // Return updated page data
      return await this.getPageData(userId);
    } catch (error) {
      logger.error('Error placing advanced order:', error);
      throw error;
    }
  }

  /**
   * Get open orders for user
   */
  async getOpenOrders(userId, pair = null) {
    try {
      // 🎯 Get user's trading mode
      const mode = await this.getUserTradingMode(userId);

      if (mode === 'live') {
        // 🚨 LIVE MODE: Try to fetch from MEXC first (real-time data)
        try {
          const mexcOrders = await mexcService.fetchOpenOrders(userId, pair || undefined);
          if (mexcOrders && mexcOrders.length > 0) {
            return mexcOrders;
          }
        } catch (mexcError) {
          logger.warn('⚠️ Could not fetch open orders from MEXC, falling back to database:', mexcError.message);
        }
      } else {
        // 🎮 DEMO MODE: Only use database
        logger.info('🎮 [DEMO MODE] Fetching open orders from database only');
      }

      // Fallback to database
      let queryText = `
        SELECT * FROM manual_trades 
        WHERE user_id = $1 AND status IN ('pending', 'open')
      `;
      const params = [userId];

      if (pair) {
        queryText += ` AND pair = $2`;
        params.push(pair);
      }

      queryText += ` ORDER BY created_at DESC`;

      const result = await query(queryText, params).catch(err => {
        logger.warn('⚠️ Could not fetch open orders from database:', err.message);
        return { rows: [] };
      });

      return result.rows.map(row => ({
        id: row.exchange_order_id || row.id.toString(), // Use exchange order ID if available
        pair: row.pair,
        side: row.side,
        type: row.type || 'limit',
        amount: parseFloat(row.amount || 0),
        price: row.price ? parseFloat(row.price) : null,
        stopPrice: row.stop_price ? parseFloat(row.stop_price) : null,
        limitPrice: row.limit_price ? parseFloat(row.limit_price) : null,
        status: row.status,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error getting open orders:', error);
      return [];
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(userId, orderId) {
    try {
      // Try to cancel on MEXC first (if orderId is a valid MEXC order ID)
      try {
        // Check if we can find the order in database first to get the pair
        const orderResult = await query(
          `SELECT * FROM manual_trades WHERE (id::text = $1 OR exchange_order_id = $1) AND user_id = $2`,
          [orderId, userId]
        ).catch(() => ({ rows: [] }));

        if (orderResult.rows.length > 0) {
          const order = orderResult.rows[0];
          const exchangeOrderId = order.exchange_order_id || orderId;
          
          // Try to cancel on MEXC
          try {
            await mexcService.cancelOrder(userId, exchangeOrderId, order.pair);
            logger.info(`✅ Order ${exchangeOrderId} cancelled on MEXC`);
          } catch (mexcError) {
            logger.warn('⚠️ Could not cancel order on MEXC:', mexcError.message);
            // Continue with database update even if MEXC cancel fails
          }

          // Update order status in database
          await query(
            `UPDATE manual_trades SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [order.id]
          ).catch(err => {
            logger.warn('⚠️ Could not update order status in database:', err.message);
          });
        } else {
          // Order not in database, try to cancel directly on MEXC (might be an exchange order ID)
          // We need the pair, so try common pairs or fail gracefully
          const commonPairs = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
          let cancelled = false;
          
          for (const pair of commonPairs) {
            try {
              await mexcService.cancelOrder(userId, orderId, pair);
              cancelled = true;
              logger.info(`✅ Order ${orderId} cancelled on MEXC for ${pair}`);
              break;
            } catch (e) {
              // Try next pair
            }
          }
          
          if (!cancelled) {
            throw new Error('Order not found in database or MEXC');
          }
        }

        return { success: true };
      } catch (mexcError) {
        // If MEXC cancel fails and we don't have the order in DB, throw error
        if (mexcError.code === 'MEXC_NOT_CONFIGURED') {
          throw new Error('MEXC API keys not configured. Please configure in Settings > Connections > Exchange API Keys');
        }
        throw mexcError;
      }
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }
}

export const manualTradingService = new ManualTradingService();

