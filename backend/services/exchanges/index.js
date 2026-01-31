/**
 * Exchange Abstraction Layer - Main Entry Point
 * Purpose: Export all exchange-related components
 * Date: 2026-01-31
 * Task: BACKEND-020 - Abstract Exchange Integration
 * 
 * This module provides a unified interface for working with multiple exchanges.
 * Import from this file to access all exchange functionality.
 * 
 * Quick Start:
 *   import { getExchange } from './services/exchanges/index.js';
 *   
 *   const exchange = getExchange('mexc'); // or 'binance'
 *   await exchange.initialize(userId);
 *   const ticker = await exchange.fetchTicker(userId, 'BTC/USDT');
 */

// Base interface and errors
export { 
  IExchange,
  ExchangeError,
  ExchangeNotConfiguredError,
  RateLimitError,
  InsufficientBalanceError
} from './IExchange.js';

// Exchange implementations
export { MexcExchange } from './MexcExchange.js';
export { BinanceExchange } from './BinanceExchange.js';

// Factory and convenience methods
export { 
  ExchangeFactory,
  exchangeFactory,
  getExchange,
  getDefaultExchange,
  initializeExchange
} from './ExchangeFactory.js';

// Re-export default as factory
export { default } from './ExchangeFactory.js';
