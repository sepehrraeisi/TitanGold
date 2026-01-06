/**
 * Unit Tests for Arbitrage Agent
 * Tests arbitrage opportunity detection, profit calculations, and error handling
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// Mock node-fetch before importing the agent
const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

// Now import the agent (after mocking)
const { run, getDetails, defaultConfig } = await import('../../../services/agents/arbitrage.js');

describe('Arbitrage Agent - Opportunity Detection', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock console to reduce test clutter
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should detect arbitrage when spread exceeds minimum threshold', async () => {
    // Setup: MEXC price with sufficient spread (0.5%)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000', // 500M USDT volume
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [
            ['44900', '1.5'],
            ['44890', '2.0'],
            ['44880', '1.8']
          ],
          asks: [
            ['45125', '1.2'], // Spread: (45125 - 44900) / 45125 = 0.498% ≈ 0.5%
            ['45130', '1.5'],
            ['45140', '1.0']
          ]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000,
        feeBps: 10,
        slippageBps: 10
      }
    });

    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBeGreaterThan(0);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].symbol).toBe('BTCUSDT');
    expect(result.opportunities[0].spreadPct).toBeGreaterThan(0.20);
  });

  test('should not detect arbitrage when spread is below minimum threshold', async () => {
    // Setup: MEXC price with insufficient spread (0.1%)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44995', '1.5']],
          asks: [['45005', '1.2']] // Spread: (45005 - 44995) / 45005 = 0.022% ≈ 0.02%
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20, // Minimum 0.20%
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });

  test('should not detect arbitrage when spread exceeds maximum threshold', async () => {
    // Setup: MEXC price with excessive spread (10%)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['40000', '1.5']],
          asks: [['50000', '1.2']] // Spread: (50000 - 40000) / 50000 = 20%
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00, // Maximum 5%
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });

  test('should skip symbols with insufficient volume', async () => {
    // Setup: Low volume symbol
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '50000', // Only 50k USDT - below minimum
          quoteVolume: '50000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45100', '1.2']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000 // Minimum 100k USDT
      }
    });

    expect(result.summary.totalOpportunities).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });

  test('should handle multiple symbols and detect multiple opportunities', async () => {
    // Setup: Two symbols with good spreads
    // BTCUSDT ticker
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    });
    // BTCUSDT depth
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45125', '1.2']]
        }
      })
    });
    // ETHUSDT ticker
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'ETHUSDT',
          lastPrice: '2500.00',
          volume: '200000000',
          quoteVolume: '200000000'
        }
      })
    });
    // ETHUSDT depth
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['2490', '10']],
          asks: [['2512', '12']] // Spread: (2512 - 2490) / 2512 = 0.876%
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(2);
    expect(result.opportunities).toHaveLength(2);
    expect(result.opportunities.some(o => o.symbol === 'BTCUSDT')).toBe(true);
    expect(result.opportunities.some(o => o.symbol === 'ETHUSDT')).toBe(true);
  });

  test('should skip symbols with missing bid/ask data', async () => {
    // Setup: Orderbook with missing data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [], // Empty orderbook
          asks: []
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });
});

describe('Arbitrage Agent - Profit Calculation', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should calculate profit correctly with fees and slippage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '2.0']],
          asks: [['45125', '2.0']] // Spread: 0.498%
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000,
        feeBps: 10, // 0.1% = 0.10%
        slippageBps: 10 // 0.1% = 0.10%
      }
    });

    expect(result.opportunities).toHaveLength(1);
    const opp = result.opportunities[0];
    
    // Net spread should be: gross spread - fees - slippage
    // ~0.498% - 0.10% - 0.10% = ~0.298%
    expect(opp.netSpreadPct).toBeLessThan(opp.spreadPct);
    expect(opp.fees.feePct).toBe(0.1);
    expect(opp.fees.slippagePct).toBe(0.1);
    
    // Profit should be positive but less than gross spread would suggest
    expect(opp.estimatedProfitUSDT).toBeGreaterThan(0);
    expect(opp.netProfitUSDT).toBe(opp.estimatedProfitUSDT);
  });

  test('should include trading fees in profit calculation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '2.0']],
          asks: [['45125', '2.0']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000,
        feeBps: 20, // 0.2% fee
        slippageBps: 10
      }
    });

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].fees.feePct).toBe(0.2);
  });

  test('should calculate percentage profit (basis points)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '2.0']],
          asks: [['45125', '2.0']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000,
        feeBps: 10,
        slippageBps: 10
      }
    });

    expect(result.opportunities).toHaveLength(1);
    const opp = result.opportunities[0];
    
    // Profit in basis points should be net spread * 100
    expect(opp.profitBps).toBe(opp.netSpreadPct * 100);
    expect(opp.expectedProfitBps).toBe(opp.profitBps);
  });

  test('should handle slippage in effective price calculations', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [
            ['44900', '0.5'],  // Small order at best price
            ['44890', '1.0'],  // Larger order at worse price
            ['44880', '2.0']
          ],
          asks: [
            ['45125', '0.5'],  // Small order at best price
            ['45135', '1.0'],  // Larger order at worse price
            ['45145', '2.0']
          ]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000,
        feeBps: 10,
        slippageBps: 10
      }
    });

    expect(result.opportunities).toHaveLength(1);
    const opp = result.opportunities[0];
    
    // Effective prices should differ from best bid/ask due to depth
    expect(opp.effectiveBuyPrice).toBeGreaterThanOrEqual(opp.askPrice);
    expect(opp.effectiveSellPrice).toBeLessThanOrEqual(opp.bidPrice);
  });

  test('should sort opportunities by profit (descending)', async () => {
    // Setup: Two symbols with different profits
    // BTCUSDT with low profit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44990', '2.0']],
          asks: [['45100', '2.0']] // Small spread
        }
      })
    });
    
    // ETHUSDT with high profit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'ETHUSDT',
          lastPrice: '2500.00',
          volume: '200000000',
          quoteVolume: '200000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['2450', '20']],
          asks: [['2550', '20']] // Large spread
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.opportunities).toHaveLength(2);
    // Should be sorted by profit (descending)
    expect(result.opportunities[0].estimatedProfitUSDT)
      .toBeGreaterThanOrEqual(result.opportunities[1].estimatedProfitUSDT);
  });
});

describe('Arbitrage Agent - Error Handling', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should handle MEXC API timeout gracefully', async () => {
    // Simulate timeout error
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    // Should still return a result with zero opportunities
    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });

  test('should handle network errors gracefully', async () => {
    // Simulate network error
    mockFetch.mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'));

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle invalid JSON response gracefully', async () => {
    // Simulate invalid JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('Unexpected token in JSON');
      }
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle missing price data gracefully', async () => {
    // Ticker succeeds but depth fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: false, // Invalid response
        data: null
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle HTTP error responses (4xx, 5xx)', async () => {
    // Simulate 500 Internal Server Error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle rate limiting (429 errors) gracefully', async () => {
    // Simulate rate limit
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.agent_key).toBe('arbitrage');
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should log errors appropriately', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Test error'));

    await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should continue with other symbols after one fails', async () => {
    // BTCUSDT ticker fails (Promise.all will reject on first failure)
    mockFetch.mockRejectedValueOnce(new Error('BTCUSDT ticker error'));
    // BTCUSDT depth also needs to be mocked since Promise.all calls both in parallel
    mockFetch.mockRejectedValueOnce(new Error('BTCUSDT depth error'));
    
    // ETHUSDT ticker succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'ETHUSDT',
          lastPrice: '2500.00',
          volume: '200000000',
          quoteVolume: '200000000'
        }
      })
    });
    // ETHUSDT depth succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['2490', '10']],
          asks: [['2512', '12']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    // Should have one opportunity (ETHUSDT) - BTCUSDT failed but processing continued
    expect(result.summary.totalOpportunities).toBe(1);
    expect(result.opportunities[0].symbol).toBe('ETHUSDT');
  });
});

describe('Arbitrage Agent - Interface Compliance', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should have required methods (run, getDetails, defaultConfig)', async () => {
    expect(typeof run).toBe('function');
    expect(typeof getDetails).toBe('function');
    expect(typeof defaultConfig).toBe('function');
  });

  test('should return correct result format from run()', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45125', '1.2']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    // Verify structure
    expect(result).toHaveProperty('agent_key');
    expect(result).toHaveProperty('decision_type');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('opportunities');
    expect(result).toHaveProperty('riskAlerts');
    expect(result).toHaveProperty('config');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('_meta');

    // Verify types
    expect(result.agent_key).toBe('arbitrage');
    expect(result.decision_type).toBe('arbitrage_scan');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.summary).toBe('object');
    expect(Array.isArray(result.opportunities)).toBe(true);
    expect(Array.isArray(result.riskAlerts)).toBe(true);
  });

  test('should return correct details format from getDetails()', async () => {
    const details = await getDetails({ userId: 1 });

    expect(details).toHaveProperty('agent_key');
    expect(details).toHaveProperty('name');
    expect(details).toHaveProperty('description');
    expect(details).toHaveProperty('status');
    expect(details).toHaveProperty('metrics');

    expect(details.agent_key).toBe('arbitrage');
    expect(details.name).toBe('Arbitrage Agent');
    expect(typeof details.description).toBe('string');
  });

  test('should return correct defaultConfig format', () => {
    const config = defaultConfig();

    expect(config).toHaveProperty('enabled');
    expect(config).toHaveProperty('exchanges');
    expect(config).toHaveProperty('symbols');
    expect(config).toHaveProperty('minSpreadPct');
    expect(config).toHaveProperty('maxSpreadPct');
    expect(config).toHaveProperty('minVolumeUSDT');
    expect(config).toHaveProperty('scanIntervalSec');
    expect(config).toHaveProperty('feeBps');
    expect(config).toHaveProperty('slippageBps');
    expect(config).toHaveProperty('orderbookDepth');

    expect(typeof config.enabled).toBe('boolean');
    expect(Array.isArray(config.exchanges)).toBe(true);
    expect(Array.isArray(config.symbols)).toBe(true);
    expect(typeof config.minSpreadPct).toBe('number');
  });

  test('should include confidence score in result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45125', '1.2']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result).toHaveProperty('confidence');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('Arbitrage Agent - Edge Cases', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should handle zero volume scenario', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '0', // Zero volume
          quoteVolume: '0'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45125', '1.2']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle negative profit scenarios', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44990', '1.5']],
          asks: [['45010', '1.2']] // Very small spread: 0.044%
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20, // Required spread higher than actual
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000,
        feeBps: 10,
        slippageBps: 10
      }
    });

    // Should not detect opportunity (spread too small)
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle very small price differences', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44999.5', '1.5']],
          asks: [['45000.5', '1.2']] // 1 USDT difference
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    // Very small spread should be filtered out
    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle API returning empty array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [],
          asks: []
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(0);
  });

  test('should handle missing config gracefully with defaults', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45125', '1.2']]
        }
      })
    });

    // Run with minimal config (should use defaults)
    const result = await run({
      userId: 1,
      config: {} // Empty config
    });

    // Should still work with default values
    expect(result.agent_key).toBe('arbitrage');
    expect(result.config.minSpreadPct).toBe(0.20); // Default
    expect(result.config.maxSpreadPct).toBe(5.00); // Default
    expect(result.config.minVolumeUSDT).toBe(100000); // Default
    expect(result.config.feeBps).toBe(10); // Default
    expect(result.config.slippageBps).toBe(10); // Default
  });
});

describe('Arbitrage Agent - Risk Scoring', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should calculate risk score for opportunities', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5'], ['44890', '1.0']],
          asks: [['45125', '1.2'], ['45130', '1.0']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.opportunities).toHaveLength(1);
    const opp = result.opportunities[0];
    
    expect(opp).toHaveProperty('riskScore');
    expect(opp).toHaveProperty('riskLevel');
    expect(typeof opp.riskScore).toBe('number');
    expect(['low', 'medium', 'high']).toContain(opp.riskLevel);
  });

  test('should identify high-risk opportunities', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '150000', // Low volume (higher risk)
          quoteVolume: '150000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['43000', '1.0']], // Only 1 bid (shallow orderbook)
          asks: [['47000', '1.0']] // Large spread (~9%)
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 10.00, // Allow high spreads for this test
        minVolumeUSDT: 100000
      }
    });

    if (result.opportunities.length > 0) {
      const opp = result.opportunities[0];
      // High spread + low volume + shallow orderbook = high risk
      expect(opp.riskScore).toBeGreaterThan(50);
    }
  });

  test('should include risk alerts in summary', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '1.5']],
          asks: [['45125', '1.2']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result).toHaveProperty('riskAlerts');
    expect(Array.isArray(result.riskAlerts)).toBe(true);
    expect(result.summary).toHaveProperty('riskAlertCount');
    expect(typeof result.summary.riskAlertCount).toBe('number');
  });
});

describe('Arbitrage Agent - Summary Metrics', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should calculate total profit across opportunities', async () => {
    // Setup two opportunities
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '2.0']],
          asks: [['45125', '2.0']]
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'ETHUSDT',
          lastPrice: '2500.00',
          volume: '200000000',
          quoteVolume: '200000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['2490', '10']],
          asks: [['2512', '12']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    expect(result.summary.totalOpportunities).toBe(2);
    expect(result.summary.totalProfitUSDT).toBeGreaterThan(0);
    expect(result.summary.avgSpreadPct).toBeGreaterThan(0);
  });

  test('should calculate average spread percentage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
          volume: '500000000',
          quoteVolume: '500000000'
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          bids: [['44900', '2.0']],
          asks: [['45125', '2.0']]
        }
      })
    });

    const result = await run({
      userId: 1,
      config: {
        symbols: ['BTCUSDT'],
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    if (result.opportunities.length > 0) {
      // avgSpreadPct is rounded to 2 decimal places, so compare accordingly
      expect(result.summary.avgSpreadPct).toBeCloseTo(result.opportunities[0].spreadPct, 1);
    }
  });

  test('should limit opportunities to top 10 in result', async () => {
    // Create 12 mock symbols
    const symbols = Array.from({ length: 12 }, (_, i) => `SYM${i}USDT`);
    
    // Mock responses for all symbols
    for (let i = 0; i < symbols.length; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            symbol: symbols[i],
            lastPrice: '100.00',
            volume: '500000000',
            quoteVolume: '500000000'
          }
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            bids: [['99.5', '2.0']],
            asks: [['100.5', '2.0']]
          }
        })
      });
    }

    const result = await run({
      userId: 1,
      config: {
        symbols,
        minSpreadPct: 0.20,
        maxSpreadPct: 5.00,
        minVolumeUSDT: 100000
      }
    });

    // Should find all 12 opportunities
    expect(result.summary.totalOpportunities).toBe(12);
    // But only return top 10 in opportunities array
    expect(result.opportunities.length).toBeLessThanOrEqual(10);
  });
});
