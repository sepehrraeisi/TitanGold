import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { query } from '../database/db.js';

dotenv.config();

class MexcService {
  constructor() {
    // Will be initialized with user's API keys from database
    this.exchange = null;
    this.markets = null;
  }

  /**
   * Initialize exchange with user's API keys from database
   */
  async initializeExchange(userId) {
    try {
      // Get MEXC connection from database
      const result = await query(
        `SELECT api_key, api_secret, is_testnet 
         FROM exchange_connections 
         WHERE user_id = $1 AND exchange = 'MEXC' AND is_active = true
         LIMIT 1`,
        [userId]
      ).catch(err => {
        console.warn('⚠️ Error querying exchange_connections table:', err);
        return { rows: [] };
      });

      if (result.rows.length === 0) {
        // Fallback to environment variables if no database connection
        const apiKey = process.env.MEXC_ACCESS_KEY;
        const secret = process.env.MEXC_SECRET_KEY;
        
        if (!apiKey || !secret) {
          const error = new Error('MEXC API keys not configured. Please configure in Settings > Connections > Exchange API Keys');
          error.code = 'MEXC_NOT_CONFIGURED';
          throw error;
        }

        console.log('📝 Using MEXC API keys from environment variables');
        this.exchange = new ccxt.mexc({
          apiKey,
          secret,
          options: {
            defaultType: 'spot',
          },
        });
      } else {
        const connection = result.rows[0];
        console.log('📝 Using MEXC API keys from database');
        this.exchange = new ccxt.mexc({
          apiKey: connection.api_key,
          secret: connection.api_secret,
          options: {
            defaultType: connection.is_testnet ? 'test' : 'spot',
          },
        });
      }

      this.markets = null; // Reset markets cache
      return this.exchange;
    } catch (error) {
      console.error('❌ Error initializing MEXC exchange:', error);
      
      // If it's a configuration error, re-throw it
      if (error.code === 'MEXC_NOT_CONFIGURED') {
        throw error;
      }
      
      // Fallback to environment variables
      const apiKey = process.env.MEXC_ACCESS_KEY;
      const secret = process.env.MEXC_SECRET_KEY;
      
      if (apiKey && secret) {
        console.log('📝 Fallback: Using MEXC API keys from environment variables');
        this.exchange = new ccxt.mexc({
          apiKey,
          secret,
          options: {
            defaultType: 'spot',
          },
        });
        return this.exchange;
      }
      
      // If no fallback available, throw a user-friendly error
      const friendlyError = new Error('MEXC API keys not configured. Please configure in Settings > Connections > Exchange API Keys');
      friendlyError.code = 'MEXC_NOT_CONFIGURED';
      throw friendlyError;
    }
  }

  /**
   * Get exchange instance (initialize if needed)
   */
  async getExchange(userId) {
    if (!this.exchange) {
      await this.initializeExchange(userId);
    }
    return this.exchange;
  }

  async loadMarkets(userId) {
    if (!this.exchange) {
      await this.getExchange(userId);
    }
    if (!this.markets) {
      this.markets = await this.exchange.loadMarkets();
    }
    return this.markets;
  }

  async fetchPrices(userId, symbols = []) {
    try {
      await this.getExchange(userId);
      // If symbols is empty, fetch all tickers (careful with rate limits)
      // Better to fetch specific list
      if (symbols.length === 0) {
        const tickers = await this.exchange.fetchTickers();
        return tickers;
      } else {
        const tickers = await this.exchange.fetchTickers(symbols);
        return tickers;
      }
    } catch (error) {
      console.error('MEXC fetchPrices error:', error);
      throw error;
    }
  }

  async getBalance(userId) {
    try {
      await this.getExchange(userId);
      const balance = await this.exchange.fetchBalance();
      return balance;
    } catch (error) {
      console.error('MEXC getBalance error:', error);
      throw error;
    }
  }

  async createOrder(userId, symbol, type, side, amount, price = undefined) {
    try {
      await this.getExchange(userId);
      const order = await this.exchange.createOrder(symbol, type, side, amount, price);
      return order;
    } catch (error) {
      console.error('MEXC createOrder error:', error);
      throw error;
    }
  }

  async fetchOHLCV(userId, symbol, timeframe = '1h', limit = 100) {
    try {
      await this.getExchange(userId);
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      return ohlcv;
    } catch (error) {
      console.error(`❌ MEXC fetchOHLCV error for ${symbol}:`, error);
      // If it's a configuration error, re-throw it
      if (error.code === 'MEXC_NOT_CONFIGURED') {
        throw error;
      }
      // Otherwise throw to allow caller to handle
      throw error;
    }
  }

  async fetchTicker(userId, symbol) {
    try {
      await this.getExchange(userId);
      const ticker = await this.exchange.fetchTicker(symbol);
      return ticker;
    } catch (error) {
      console.error(`❌ MEXC fetchTicker error for ${symbol}:`, error);
      // If it's a configuration error, re-throw it
      if (error.code === 'MEXC_NOT_CONFIGURED') {
        throw error;
      }
      // Otherwise return null to allow graceful degradation
      return null;
    }
  }

  async getExchangeInfo(userId) {
    try {
      await this.loadMarkets(userId);
      return {
        symbols: Object.values(this.markets).map(market => ({
          symbol: market.symbol,
          baseAsset: market.base,
          quoteAsset: market.quote,
          status: market.active ? 'TRADING' : 'INACTIVE',
        }))
      };
    } catch (error) {
      console.error('MEXC getExchangeInfo error:', error);
      return { symbols: [] };
    }
  }

  async fetchPerpetualTicker(userId, symbol) {
    try {
      // Get connection from database
      const result = await query(
        `SELECT api_key, api_secret, is_testnet 
         FROM exchange_connections 
         WHERE user_id = $1 AND exchange = 'MEXC' AND is_active = true
         LIMIT 1`,
        [userId]
      );

      let apiKey, secret;
      if (result.rows.length > 0) {
        apiKey = result.rows[0].api_key;
        secret = result.rows[0].api_secret;
      } else {
        apiKey = process.env.MEXC_ACCESS_KEY;
        secret = process.env.MEXC_SECRET_KEY;
      }

      if (!apiKey || !secret) {
        throw new Error('MEXC API keys not configured');
      }

      // Create futures exchange instance
      const futuresExchange = new ccxt.mexc({
        apiKey,
        secret,
        options: {
          defaultType: 'swap', // Perpetual futures
        },
      });

      const ticker = await futuresExchange.fetchTicker(symbol);
      return ticker;
    } catch (error) {
      console.error(`MEXC fetchPerpetualTicker error for ${symbol}:`, error);
      return null;
    }
  }
}

export const mexcService = new MexcService();
