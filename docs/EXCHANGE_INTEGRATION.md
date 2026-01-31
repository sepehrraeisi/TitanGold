# Exchange Integration Guide

**Task**: BACKEND-020 - Abstract Exchange Integration  
**Date**: 2026-01-31  
**Status**: Production Ready  

## Overview

The TitanGold Exchange Abstraction Layer provides a unified interface for integrating multiple cryptocurrency exchanges. This abstraction allows agents and services to work with any exchange without code changes.

### Benefits

- **Multi-Exchange Support**: Easily add new exchanges (Binance, Coinbase, Kraken, etc.)
- **Consistent Interface**: All exchanges expose the same standardized methods
- **Agent Independence**: Agents work with any exchange without modification
- **Centralized Configuration**: Manage exchange settings in one place
- **Type Safety**: Well-defined interfaces prevent integration errors
- **Easy Testing**: Mock exchanges for unit tests

### Architecture

```
┌─────────────────────────────────────────────────┐
│          Agents & Services                       │
│  (Volume, Arbitrage, Price Prediction, etc.)    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         Exchange Factory                         │
│  (Create and manage exchange instances)         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            IExchange Interface                   │
│  (Standardized methods for all exchanges)       │
└──────────┬──────────────────────┬────────────────┘
           │                      │
           ▼                      ▼
  ┌─────────────────┐    ┌──────────────────┐
  │  MexcExchange   │    │ BinanceExchange  │
  │   (Adapter)     │    │     (Stub)       │
  └────────┬────────┘    └────────┬─────────┘
           │                      │
           ▼                      ▼
    ┌──────────────┐       ┌───────────────┐
    │ MexcService  │       │  Future Impl  │
    │   (ccxt)     │       │               │
    └──────────────┘       └───────────────┘
```

## Quick Start

### Using an Exchange in an Agent

```javascript
import { getDefaultExchange } from '../exchanges/index.js';

export async function run({ userId, symbol, timeframe, config }) {
  // Get default exchange (MEXC)
  const exchange = getDefaultExchange();
  
  // Initialize with user credentials
  await exchange.initialize(userId);
  
  // Fetch market data
  const ticker = await exchange.fetchTicker(userId, symbol);
  const ohlcv = await exchange.fetchOHLCV(userId, symbol, timeframe, 100);
  
  // Use the data
  console.log(`Current price: ${ticker.last}`);
  
  return {
    agent_key: 'my_agent',
    symbol,
    price: ticker.last,
    // ...
  };
}
```

### Using a Specific Exchange

```javascript
import { getExchange } from '../exchanges/index.js';

// Get specific exchange
const exchange = getExchange('binance'); // or 'mexc'

await exchange.initialize(userId);
const ticker = await exchange.fetchTicker(userId, 'BTC/USDT');
```

### Available Methods

All exchanges implement these standardized methods:

```javascript
// Exchange information
exchange.getName()              // 'MEXC', 'Binance', etc.
exchange.isInitialized()        // true/false

// Initialization
await exchange.initialize(userId)
await exchange.loadMarkets(userId)
await exchange.getExchangeInfo(userId)

// Market data (read-only, userId can be null)
await exchange.fetchTicker(userId, 'BTC/USDT')
await exchange.fetchTickers(userId, ['BTC/USDT', 'ETH/USDT'])
await exchange.fetchOrderBook(userId, 'BTC/USDT', 20)
await exchange.fetchOHLCV(userId, 'BTC/USDT', '1h', 100)

// Trading operations (userId required)
await exchange.fetchBalance(userId)
await exchange.createOrder(userId, 'BTC/USDT', 'market', 'buy', 0.1)
await exchange.cancelOrder(userId, orderId, 'BTC/USDT')
await exchange.fetchOpenOrders(userId, 'BTC/USDT')
await exchange.fetchOrder(userId, orderId, 'BTC/USDT')

// Health check
await exchange.healthCheck()
```

## Adding a New Exchange

Follow these steps to add support for a new exchange (e.g., Kraken):

### Step 1: Create Exchange Adapter

Create `backend/services/exchanges/KrakenExchange.js`:

```javascript
import { IExchange, ExchangeError, ExchangeNotConfiguredError } from './IExchange.js';
import { logger } from '../logger.js';
// Import your exchange client (e.g., ccxt, custom API client)
import ccxt from 'ccxt';

export class KrakenExchange extends IExchange {
  constructor() {
    super();
    this.exchangeName = 'Kraken';
    this.initialized = false;
    this.client = null;
  }

  getName() {
    return this.exchangeName;
  }

  isInitialized() {
    return this.initialized;
  }

  async initialize(userId) {
    try {
      // Get API keys from database or environment
      const apiKey = process.env.KRAKEN_API_KEY;
      const secret = process.env.KRAKEN_SECRET;

      if (!apiKey || !secret) {
        throw new ExchangeNotConfiguredError(this.exchangeName, { userId });
      }

      // Initialize client
      this.client = new ccxt.kraken({
        apiKey,
        secret,
        enableRateLimit: true
      });

      this.initialized = true;
      logger.info(`✅ ${this.exchangeName} initialized`);
      return true;
    } catch (error) {
      throw new ExchangeError(
        `Failed to initialize ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'INITIALIZATION_ERROR',
        { userId }
      );
    }
  }

  async fetchTicker(userId, symbol) {
    try {
      const ticker = await this.client.fetchTicker(symbol);
      
      // Return standardized format
      return {
        symbol: ticker.symbol,
        last: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask,
        high: ticker.high,
        low: ticker.low,
        volume: ticker.baseVolume,
        timestamp: ticker.timestamp
      };
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch ticker: ${error.message}`,
        this.exchangeName,
        'FETCH_TICKER_ERROR',
        { symbol }
      );
    }
  }

  // Implement all other required methods...
  // fetchTickers, fetchOrderBook, fetchOHLCV, etc.
  
  async healthCheck() {
    const startTime = Date.now();
    try {
      await this.client.fetchStatus();
      return {
        status: 'healthy',
        exchange: this.exchangeName,
        latency: Date.now() - startTime,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        exchange: this.exchangeName,
        latency: Date.now() - startTime,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

export default KrakenExchange;
```

### Step 2: Register Exchange

Update `backend/services/exchanges/ExchangeFactory.js`:

```javascript
import KrakenExchange from './KrakenExchange.js';

const EXCHANGE_REGISTRY = {
  mexc: MexcExchange,
  binance: BinanceExchange,
  kraken: KrakenExchange,  // Add here
};
```

### Step 3: Export from Index

Update `backend/services/exchanges/index.js`:

```javascript
export { KrakenExchange } from './KrakenExchange.js';
```

### Step 4: Add Configuration

Add environment variables to `.env`:

```bash
KRAKEN_API_KEY=your_api_key_here
KRAKEN_SECRET=your_secret_here
```

Or add database configuration for per-user keys.

### Step 5: Create Tests

Create `backend/__tests__/services/KrakenExchange.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { KrakenExchange } from '../../services/exchanges/KrakenExchange.js';

describe('KrakenExchange', () => {
  it('should return correct exchange name', () => {
    const kraken = new KrakenExchange();
    expect(kraken.getName()).toBe('Kraken');
  });

  it('should initialize successfully', async () => {
    const kraken = new KrakenExchange();
    await kraken.initialize(null);
    expect(kraken.isInitialized()).toBe(true);
  });

  // Add more tests...
});
```

### Step 6: Verify Integration

```bash
# Run tests
npm test -- __tests__/services/KrakenExchange.test.js

# Test in an agent
node -e "
  import { getExchange } from './services/exchanges/index.js';
  const kraken = getExchange('kraken');
  await kraken.initialize(null);
  const ticker = await kraken.fetchTicker(null, 'BTC/USDT');
  console.log(ticker);
"
```

## API Reference

### IExchange Interface

#### Exchange Information

**`getName(): string`**
- Returns the exchange name (e.g., 'MEXC', 'Binance')
- Used for logging and identification

**`isInitialized(): boolean`**
- Returns true if exchange has been initialized
- Check before calling other methods

**`initialize(userId: number|null): Promise<boolean>`**
- Initialize exchange with user's API keys
- Pass `null` for system-wide/public operations
- Throws `ExchangeNotConfiguredError` if keys not found

#### Market Data Methods

**`loadMarkets(userId: number|null): Promise<Object>`**
- Load all available markets/trading pairs
- Returns object keyed by symbol
- Results are cached internally

**`fetchTicker(userId: number|null, symbol: string): Promise<Ticker>`**
- Fetch current ticker data for a symbol
- Symbol format: 'BTC/USDT' or 'BTCUSDT' (normalized internally)
- Returns: `{ symbol, last, bid, ask, high, low, volume, timestamp }`

**`fetchTickers(userId: number|null, symbols: string[]): Promise<Object>`**
- Fetch multiple tickers at once
- Pass empty array for all tickers
- Returns object keyed by symbol

**`fetchOrderBook(userId: number|null, symbol: string, limit: number): Promise<OrderBook>`**
- Fetch order book depth
- `limit`: number of price levels (default: 20)
- Returns: `{ bids: [[price, amount], ...], asks: [[price, amount], ...], timestamp }`

**`fetchOHLCV(userId: number|null, symbol: string, timeframe: string, limit: number): Promise<Array>`**
- Fetch OHLCV (candlestick) data
- `timeframe`: '1m', '5m', '15m', '1h', '4h', '1d', etc.
- `limit`: number of candles (default: 100)
- Returns: Array of `[timestamp, open, high, low, close, volume]`

#### Trading Methods

**`fetchBalance(userId: number): Promise<Object>`**
- Fetch account balance
- `userId` is required (no system-wide balance)
- Returns: `{ [currency]: { free, used, total }, ... }`

**`createOrder(userId: number, symbol: string, type: string, side: string, amount: number, price?: number): Promise<Order>`**
- Create a new order
- `type`: 'market' or 'limit'
- `side`: 'buy' or 'sell'
- `price`: required for limit orders
- Returns: `{ id, symbol, type, side, amount, price, status, ... }`

**`cancelOrder(userId: number, orderId: string, symbol: string): Promise<Order>`**
- Cancel an existing order
- Returns cancelled order data

**`fetchOpenOrders(userId: number, symbol?: string): Promise<Array<Order>>`**
- Fetch open (active) orders
- Optional symbol filter
- Returns array of orders

**`fetchOrder(userId: number, orderId: string, symbol: string): Promise<Order>`**
- Fetch specific order status
- Returns order data

#### Utility Methods

**`getExchangeInfo(userId: number|null): Promise<Object>`**
- Get exchange information (limits, fees, rules)
- Varies by exchange

**`healthCheck(): Promise<HealthStatus>`**
- Check exchange connectivity
- Returns: `{ status: 'healthy'|'degraded'|'unhealthy', latency, error?, timestamp }`

### ExchangeFactory

**`getSupportedExchanges(): string[]`**
- Returns array of supported exchange names

**`isSupported(exchangeName: string): boolean`**
- Check if an exchange is supported

**`getExchange(exchangeName?: string, forceNew?: boolean): IExchange`**
- Get exchange instance
- Default exchange: 'mexc'
- `forceNew`: create new instance (bypass cache)

**`getDefaultExchange(): IExchange`**
- Get default exchange (MEXC)

**`clearCache(exchangeName?: string): void`**
- Clear cached instances
- Useful for testing or configuration changes

**`registerExchange(exchangeName: string, ExchangeClass: class): void`**
- Dynamically register a new exchange

**`initializeExchange(userId: number|null, exchangeName?: string): Promise<IExchange>`**
- Convenience method: get exchange and initialize it

**`getHealthStatus(exchangeName?: string): Promise<Object>`**
- Get health status for one or all exchanges

### Convenience Functions

```javascript
import { 
  getExchange, 
  getDefaultExchange, 
  initializeExchange 
} from './services/exchanges/index.js';

// Get specific exchange
const exchange = getExchange('mexc');

// Get default exchange
const defaultExchange = getDefaultExchange();

// Get and initialize in one call
const initializedExchange = await initializeExchange(userId, 'mexc');
```

## Error Handling

### Exchange Errors

All exchange operations throw standardized errors:

```javascript
try {
  const ticker = await exchange.fetchTicker(userId, 'BTC/USDT');
} catch (error) {
  if (error instanceof ExchangeNotConfiguredError) {
    // API keys not configured
    console.error('Please configure API keys');
  } else if (error instanceof RateLimitError) {
    // Rate limit exceeded
    console.error(`Rate limited. Retry after ${error.retryAfter}ms`);
  } else if (error instanceof InsufficientBalanceError) {
    // Insufficient balance
    console.error(`Need ${error.details.required} ${error.details.currency}`);
  } else if (error instanceof ExchangeError) {
    // Generic exchange error
    console.error(`${error.exchange} error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Details:`, error.details);
  }
}
```

### Error Types

**`ExchangeError`**
- Base class for all exchange errors
- Properties: `message`, `exchange`, `code`, `details`, `timestamp`

**`ExchangeNotConfiguredError`**
- Thrown when API keys are not configured
- Code: `EXCHANGE_NOT_CONFIGURED`

**`RateLimitError`**
- Thrown when rate limit is exceeded
- Code: `RATE_LIMIT_EXCEEDED`
- Property: `retryAfter` (milliseconds)

**`InsufficientBalanceError`**
- Thrown when balance is too low
- Code: `INSUFFICIENT_BALANCE`
- Details: `{ currency, required, available }`

## Best Practices

### 1. Always Initialize Before Use

```javascript
// ✅ Good
const exchange = getExchange('mexc');
await exchange.initialize(userId);
const ticker = await exchange.fetchTicker(userId, 'BTC/USDT');

// ❌ Bad
const exchange = getExchange('mexc');
const ticker = await exchange.fetchTicker(userId, 'BTC/USDT'); // May fail
```

### 2. Use System-Wide Operations When Appropriate

```javascript
// For public data (no authentication needed)
const ticker = await exchange.fetchTicker(null, 'BTC/USDT');

// For user-specific operations (authentication required)
const balance = await exchange.fetchBalance(userId);
```

### 3. Handle Errors Gracefully

```javascript
try {
  const ticker = await exchange.fetchTicker(userId, symbol);
  return processData(ticker);
} catch (error) {
  logger.error('Failed to fetch ticker', error);
  
  // Return fallback data
  return {
    agent_key: 'my_agent',
    symbol,
    error: error.message,
    success: false
  };
}
```

### 4. Normalize Symbols

Exchanges accept different symbol formats. The abstraction handles this:

```javascript
// All these work:
await exchange.fetchTicker(userId, 'BTC/USDT');
await exchange.fetchTicker(userId, 'BTCUSDT');
await exchange.fetchTicker(userId, 'btc/usdt');
```

### 5. Use Health Checks

```javascript
// Check before critical operations
const health = await exchange.healthCheck();

if (health.status !== 'healthy') {
  logger.warn(`Exchange unhealthy: ${health.error}`);
  // Use fallback or retry
}
```

### 6. Cache Instances

```javascript
// ✅ Good - Factory caches instances
const exchange1 = getExchange('mexc');
const exchange2 = getExchange('mexc'); // Same instance

// ❌ Bad - Creating multiple instances unnecessarily
const exchange1 = new MexcExchange();
const exchange2 = new MexcExchange();
```

## Configuration

### Environment Variables

```bash
# MEXC
MEXC_ACCESS_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret

# Binance (future)
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret

# Other exchanges
KRAKEN_API_KEY=your_kraken_api_key
KRAKEN_SECRET=your_kraken_secret
```

### Database Configuration

For per-user API keys, use the `exchange_connections` table:

```sql
CREATE TABLE exchange_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  exchange VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  is_testnet BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Unit Tests

Test exchange implementations:

```javascript
import { describe, it, expect, jest } from '@jest/globals';
import { MexcExchange } from '../../services/exchanges/MexcExchange.js';

describe('MexcExchange', () => {
  it('should fetch ticker successfully', async () => {
    const mexc = new MexcExchange();
    
    // Mock underlying service
    mexc.mexcService.fetchTicker = jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      last: 50000
    });

    await mexc.initialize(null);
    const ticker = await mexc.fetchTicker(null, 'BTC/USDT');
    
    expect(ticker.symbol).toBe('BTCUSDT');
    expect(ticker.last).toBe(50000);
  });
});
```

### Integration Tests

Test with real exchanges (use testnet):

```javascript
describe('MexcExchange Integration', () => {
  it('should fetch real ticker data', async () => {
    const mexc = getExchange('mexc');
    await mexc.initialize(null);
    
    const ticker = await mexc.fetchTicker(null, 'BTC/USDT');
    
    expect(ticker).toHaveProperty('last');
    expect(ticker).toHaveProperty('bid');
    expect(ticker).toHaveProperty('ask');
    expect(typeof ticker.last).toBe('number');
  });
});
```

## Troubleshooting

### Exchange Not Configured

**Error**: `ExchangeNotConfiguredError: MEXC API keys not configured`

**Solution**:
1. Check environment variables: `echo $MEXC_ACCESS_KEY`
2. Verify `.env` file exists and is loaded
3. Check database `exchange_connections` table
4. Ensure keys are valid and not expired

### Rate Limit Exceeded

**Error**: `RateLimitError: MEXC rate limit exceeded`

**Solution**:
1. Implement exponential backoff
2. Use rate limiter (already in MEXC service)
3. Cache results when possible
4. Reduce request frequency

### Symbol Not Found

**Error**: `ExchangeError: Symbol BTC/USD not found`

**Solution**:
1. Verify symbol format: 'BTC/USDT' not 'BTC/USD'
2. Check if symbol is available: `await exchange.loadMarkets()`
3. Use exchange-specific symbols if needed

### Tests Hanging

**Issue**: Tests don't exit after completion

**Solution**:
1. Close database connections: `await pool.end()`
2. Clear timers/intervals
3. Use `--detectOpenHandles` to find leaks
4. Mock external services in tests

## Roadmap

### Completed
- ✅ IExchange interface
- ✅ MexcExchange adapter
- ✅ BinanceExchange stub
- ✅ ExchangeFactory
- ✅ Unit tests
- ✅ Documentation
- ✅ Integration with Volume agent

### Future Enhancements
- 🔄 Complete Binance implementation
- 🔄 Add Kraken support
- 🔄 Add Coinbase support
- 🔄 WebSocket support for real-time data
- 🔄 Advanced order types (stop-loss, take-profit)
- 🔄 Multi-exchange arbitrage
- 🔄 Exchange-specific optimizations
- 🔄 Performance monitoring
- 🔄 Automatic failover between exchanges

## Support

For questions or issues:
1. Check this documentation
2. Review test files for examples
3. Check existing exchange implementations
4. Create an issue with:
   - Exchange name
   - Error message
   - Code example
   - Expected vs actual behavior

## License

Internal TitanGold project. All rights reserved.

---

**Last Updated**: 2026-01-31  
**Version**: 1.0.0  
**Task**: BACKEND-020
