/**
 * MEXC market-data helper (legacy ccxt surface).
 *
 * MEXC-E2E remediation:
 * - PUBLIC market data uses credential-free ccxt instances only.
 * - Private reads/writes are FAIL-CLOSED — must use canonical Connections owner.
 * - Tier-4 (orders/withdrawals/transfers) always blocked.
 * - Never reads encrypted DB secrets as plaintext into ccxt.
 * - Never injects env API keys into public market-data paths.
 */

import ccxt from 'ccxt';
import { mexcLimiter } from './rateLimiter.js';
import { logger } from '../services/logger.js';
import {
  assertTier4Impossible,
  assertNoLegacyPrivateBypass,
} from './connections/mexc/canonicalClientOwnership.js';

class MexcService {
  constructor() {
    this.publicExchange = null;
    this.publicFuturesExchange = null;
    this.markets = null;
  }

  getPublicExchange() {
    if (!this.publicExchange) {
      this.publicExchange = new ccxt.mexc({
        enableRateLimit: true,
        options: { defaultType: 'spot' },
      });
    }
    return this.publicExchange;
  }

  getPublicFuturesExchange() {
    if (!this.publicFuturesExchange) {
      this.publicFuturesExchange = new ccxt.mexc({
        enableRateLimit: true,
        options: { defaultType: 'swap' },
      });
    }
    return this.publicFuturesExchange;
  }

  async initializeExchange(_userId) {
    assertNoLegacyPrivateBypass('initializeExchange');
  }

  async getExchange(_userId) {
    return this.getPublicExchange();
  }

  async loadMarkets(_userId) {
    return mexcLimiter.execute(
      'mexc:loadMarkets:public',
      async () => {
        const ex = this.getPublicExchange();
        if (!this.markets) {
          this.markets = await ex.loadMarkets();
        }
        return this.markets;
      },
      true,
      900000,
    );
  }

  async getSystemExchange() {
    return this.getPublicExchange();
  }

  async loadSystemMarkets() {
    return this.loadMarkets(null);
  }

  async fetchSystemPrices(symbols = []) {
    return this.fetchPrices(null, symbols);
  }

  async fetchSystemTicker(symbol) {
    return this.fetchTicker(null, symbol);
  }

  async fetchSystemOHLCV(symbol, timeframe = '1h', limit = 100) {
    return this.fetchOHLCV(null, symbol, timeframe, limit);
  }

  async getSystemExchangeInfo() {
    return this.getExchangeInfo(null);
  }

  async fetchSystemPerpetualTicker(symbol) {
    return this.fetchPerpetualTicker(null, symbol);
  }

  async fetchPrices(_userId, symbols = []) {
    const cacheKey = symbols.length === 0
      ? 'mexc:fetchPrices:public:all'
      : `mexc:fetchPrices:public:${symbols.join(',')}`;

    return mexcLimiter.execute(
      cacheKey,
      async () => {
        const ex = this.getPublicExchange();
        if (symbols.length === 0) {
          return ex.fetchTickers();
        }
        return ex.fetchTickers(symbols);
      },
      true,
      60000,
    ).catch((error) => {
      logger.error('MEXC fetchPrices error:', error);
      throw error;
    });
  }

  async getBalance(_userId) {
    assertNoLegacyPrivateBypass('getBalance');
  }

  async createOrder(_userId, _symbol, _type, _side, _amount, _price) {
    assertTier4Impossible('createOrder');
  }

  async fetchOHLCV(_userId, symbol, timeframe = '1h', limit = 100) {
    try {
      const ex = this.getPublicExchange();
      return await ex.fetchOHLCV(symbol, timeframe, undefined, limit);
    } catch (error) {
      logger.error(`MEXC fetchOHLCV error for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchTicker(_userId, symbol) {
    try {
      const ex = this.getPublicExchange();
      return await ex.fetchTicker(symbol);
    } catch (error) {
      logger.error(`MEXC fetchTicker error for ${symbol}:`, error);
      return null;
    }
  }

  async getExchangeInfo(_userId) {
    try {
      await this.loadMarkets(null);
      return {
        symbols: Object.values(this.markets || {}).map((market) => ({
          symbol: market.symbol,
          baseAsset: market.base,
          quoteAsset: market.quote,
          status: market.active ? 'TRADING' : 'INACTIVE',
        })),
      };
    } catch (error) {
      logger.error('MEXC getExchangeInfo error:', error);
      return { symbols: [] };
    }
  }

  async fetchPerpetualTicker(_userId, symbol) {
    try {
      // Credential-free public futures client only
      const futuresExchange = this.getPublicFuturesExchange();
      return await futuresExchange.fetchTicker(symbol);
    } catch (error) {
      logger.error(`MEXC fetchPerpetualTicker error for ${symbol}:`, error);
      return null;
    }
  }

  async createSystemOrder(symbol, type, side, amount, price = undefined) {
    assertTier4Impossible('createSystemOrder');
  }

  async fetchOrderBook(_userId, symbol, limit = 20) {
    try {
      const ex = this.getPublicExchange();
      const orderBook = await ex.fetchOrderBook(symbol, limit);
      return {
        bids: orderBook.bids || [],
        asks: orderBook.asks || [],
        timestamp: orderBook.timestamp || Date.now(),
      };
    } catch (error) {
      logger.error(`MEXC fetchOrderBook error for ${symbol}:`, error);
      return { bids: [], asks: [], timestamp: Date.now() };
    }
  }

  async cancelOrder(_userId, _orderId, _symbol) {
    assertTier4Impossible('cancelOrder');
  }

  async fetchOpenOrders(_userId, _symbol = null) {
    assertNoLegacyPrivateBypass('fetchOpenOrders');
  }
}

export const mexcService = new MexcService();
export default mexcService;
