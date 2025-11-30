import ccxt from 'ccxt';
import dotenv from 'dotenv';

dotenv.config();

class MexcService {
  constructor() {
    this.exchange = new ccxt.mexc({
      apiKey: process.env.MEXC_ACCESS_KEY,
      secret: process.env.MEXC_SECRET_KEY,
      options: {
        defaultType: 'spot', // or 'future'
      },
    });
    this.markets = null;
  }

  async loadMarkets() {
    if (!this.markets) {
      this.markets = await this.exchange.loadMarkets();
    }
    return this.markets;
  }

  async fetchPrices(symbols = []) {
    try {
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

  async getBalance() {
    try {
      const balance = await this.exchange.fetchBalance();
      return balance;
    } catch (error) {
      console.error('MEXC getBalance error:', error);
      throw error;
    }
  }

  async createOrder(symbol, type, side, amount, price = undefined) {
    try {
      const order = await this.exchange.createOrder(symbol, type, side, amount, price);
      return order;
    } catch (error) {
      console.error('MEXC createOrder error:', error);
      throw error;
    }
  }

  async fetchOHLCV(symbol, timeframe = '1h', limit = 100) {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      return ohlcv;
    } catch (error) {
      console.error('MEXC fetchOHLCV error:', error);
      throw error;
    }
  }

  async fetchTicker(symbol) {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      return ticker;
    } catch (error) {
      console.error(`MEXC fetchTicker error for ${symbol}:`, error);
      return null;
    }
  }

  async getExchangeInfo() {
    try {
      await this.loadMarkets();
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

  async fetchPerpetualTicker(symbol) {
    try {
      // Create futures exchange instance
      const futuresExchange = new ccxt.mexc({
        apiKey: process.env.MEXC_ACCESS_KEY,
        secret: process.env.MEXC_SECRET_KEY,
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
