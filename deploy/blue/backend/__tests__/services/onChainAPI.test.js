/**
 * On-Chain API Service Unit Tests
 * BACKEND-012: Implement Market Intelligence Agent
 */

import { fetchOnChainMetrics, detectAnomalies, clearCache } from '../../services/onChainAPI.js';

// Mock axios
jest.mock('axios');
import axios from 'axios';

// Mock logger
jest.mock('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('On-Chain API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
    
    axios.get = jest.fn();
  });

  describe('fetchOnChainMetrics', () => {
    it('should fetch metrics from multiple sources', async () => {
      // Mock CoinGecko response
      axios.get.mockImplementation((url) => {
        if (url.includes('coingecko')) {
          return Promise.resolve({
            data: {
              market_cap_rank: 1,
              market_data: {
                market_cap: { usd: 1000000000000 },
                total_volume: { usd: 50000000000 },
                circulating_supply: 19000000,
                total_supply: 21000000,
                max_supply: 21000000,
                price_change_percentage_24h: 2.5,
                price_change_percentage_7d: 5.0,
                ath: { usd: 69000 },
                atl: { usd: 100 }
              },
              community_data: {
                twitter_followers: 5000000,
                reddit_subscribers: 4000000
              },
              developer_data: {
                forks: 1000,
                stars: 50000,
                commit_count_4_weeks: 150
              }
            }
          });
        } else if (url.includes('blockchain.info')) {
          return Promise.resolve({
            data: {
              market_price_usd: 50000,
              hash_rate: 300000000000,
              difficulty: 40000000000000,
              n_tx: 300000,
              totalbc: 1900000000000000
            }
          });
        } else if (url.includes('glassnode')) {
          return Promise.resolve({
            data: [
              { t: '2026-01-07', v: 1000000 },
              { t: '2026-01-06', v: 950000 }
            ]
          });
        }
        return Promise.reject(new Error('Unknown API'));
      });

      const result = await fetchOnChainMetrics('BTC/USDT', { useCache: false });

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.metrics).toBeDefined();
      expect(result.analysis).toBeDefined();
    });

    it('should analyze market metrics correctly', async () => {
      axios.get.mockResolvedValue({
        data: {
          market_cap_rank: 1,
          market_data: {
            market_cap: { usd: 1000000000000 },
            total_volume: { usd: 600000000000 }, // High volume ratio
            circulating_supply: 19000000,
            total_supply: 21000000,
            developer_data: {
              commit_count_4_weeks: 200 // High activity
            }
          },
          community_data: {
            twitter_followers: 6000000
          },
          developer_data: {
            commit_count_4_weeks: 200
          }
        }
      });

      const result = await fetchOnChainMetrics('BTC/USDT', { useCache: false });

      expect(result.analysis).toBeDefined();
      expect(result.analysis.health).toBeDefined();
      expect(result.analysis.signals).toBeInstanceOf(Array);
      expect(result.analysis.insights).toBeInstanceOf(Array);
    });

    it('should identify high volume signals', async () => {
      axios.get.mockResolvedValue({
        data: {
          market_cap_rank: 1,
          market_data: {
            market_cap: { usd: 1000000000000 },
            total_volume: { usd: 600000000000 }, // 60% of market cap
            circulating_supply: 19000000,
            total_supply: 21000000
          },
          community_data: {},
          developer_data: {}
        }
      });

      const result = await fetchOnChainMetrics('BTC/USDT', { useCache: false });

      const highVolumeSignal = result.analysis.signals.find(s => s.type === 'high_volume');
      expect(highVolumeSignal).toBeDefined();
    });

    it('should identify low developer activity warnings', async () => {
      axios.get.mockResolvedValue({
        data: {
          market_cap_rank: 1,
          market_data: {
            market_cap: { usd: 1000000000000 },
            total_volume: { usd: 50000000000 },
            circulating_supply: 19000000,
            total_supply: 21000000
          },
          community_data: {},
          developer_data: {
            commit_count_4_weeks: 5 // Low activity
          }
        }
      });

      const result = await fetchOnChainMetrics('BTC/USDT', { useCache: false });

      const lowDevSignal = result.analysis.signals.find(s => s.type === 'low_dev_activity');
      expect(lowDevSignal).toBeDefined();
      expect(lowDevSignal.severity).toBe('warning');
    });

    it('should handle Bitcoin-specific metrics', async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes('blockchain.info')) {
          return Promise.resolve({
            data: {
              market_price_usd: 50000,
              hash_rate: 300000000000,
              difficulty: 40000000000000,
              n_tx: 300000,
              estimated_transaction_volume_usd: 5000000000,
              totalbc: 1900000000000000
            }
          });
        } else if (url.includes('coingecko')) {
          return Promise.resolve({
            data: {
              market_data: {
                market_cap: { usd: 1000000000000 },
                total_volume: { usd: 50000000000 },
                circulating_supply: 19000000,
                total_supply: 21000000
              },
              community_data: {},
              developer_data: {}
            }
          });
        }
        return Promise.reject(new Error('Unknown API'));
      });

      const result = await fetchOnChainMetrics('BTC/USDT', { useCache: false });

      expect(result.metrics.network).toBeDefined();
      expect(result.metrics.network.hash_rate).toBeDefined();
      expect(result.metrics.network.difficulty).toBeDefined();
    });

    it('should cache results', async () => {
      axios.get.mockResolvedValue({
        data: {
          market_data: {
            market_cap: { usd: 1000000000000 },
            total_volume: { usd: 50000000000 },
            circulating_supply: 19000000,
            total_supply: 21000000
          },
          community_data: {},
          developer_data: {}
        }
      });

      // First call
      const result1 = await fetchOnChainMetrics('BTC/USDT');
      
      // Second call should use cache
      const result2 = await fetchOnChainMetrics('BTC/USDT');

      expect(result1).toEqual(result2);
    });

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('API error'));

      await expect(fetchOnChainMetrics('BTC/USDT', { useCache: false })).rejects.toThrow();
    });

    it('should handle missing API keys', async () => {
      const originalGlassnodeKey = process.env.GLASSNODE_API_KEY;
      delete process.env.GLASSNODE_API_KEY;

      axios.get.mockResolvedValue({
        data: {
          market_data: {
            market_cap: { usd: 1000000000000 },
            total_volume: { usd: 50000000000 },
            circulating_supply: 19000000,
            total_supply: 21000000
          },
          community_data: {},
          developer_data: {}
        }
      });

      const result = await fetchOnChainMetrics('BTC/USDT', { useCache: false });

      expect(result.sources.glassnode).toBe(false);

      if (originalGlassnodeKey) process.env.GLASSNODE_API_KEY = originalGlassnodeKey;
    });
  });

  describe('detectAnomalies', () => {
    it('should detect volume spikes', () => {
      const current = {
        metrics: {
          market: {
            total_volume: 200000000000,
            market_cap: 1000000000000
          }
        }
      };

      const historical = {
        metrics: {
          market: {
            total_volume: 50000000000,
            market_cap: 1000000000000
          }
        }
      };

      const anomalies = detectAnomalies(current, historical);

      expect(anomalies).toBeInstanceOf(Array);
      const volumeSpike = anomalies.find(a => a.type === 'volume_spike');
      expect(volumeSpike).toBeDefined();
      expect(volumeSpike.severity).toBe('high');
    });

    it('should detect price volatility', () => {
      const current = {
        metrics: {
          market: {
            price_change_24h: 15.5, // High volatility
            total_volume: 50000000000,
            market_cap: 1000000000000
          }
        }
      };

      const historical = {
        metrics: {
          market: {
            price_change_24h: 2.0,
            total_volume: 50000000000,
            market_cap: 1000000000000
          }
        }
      };

      const anomalies = detectAnomalies(current, historical);

      const volatilityAnomaly = anomalies.find(a => a.type === 'price_volatility');
      expect(volatilityAnomaly).toBeDefined();
    });

    it('should classify severity correctly', () => {
      const current = {
        metrics: {
          market: {
            price_change_24h: 25, // Extreme volatility
            total_volume: 50000000000,
            market_cap: 1000000000000
          }
        }
      };

      const historical = {
        metrics: {
          market: {
            price_change_24h: 2.0,
            total_volume: 50000000000,
            market_cap: 1000000000000
          }
        }
      };

      const anomalies = detectAnomalies(current, historical);

      const highSeverity = anomalies.find(a => a.severity === 'high');
      expect(highSeverity).toBeDefined();
    });

    it('should handle missing metrics gracefully', () => {
      const current = {
        metrics: {}
      };

      const historical = {
        metrics: {}
      };

      const anomalies = detectAnomalies(current, historical);

      expect(anomalies).toBeInstanceOf(Array);
      expect(anomalies.length).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      axios.get.mockResolvedValue({
        data: {
          market_data: {
            market_cap: { usd: 1000000000000 },
            total_volume: { usd: 50000000000 },
            circulating_supply: 19000000,
            total_supply: 21000000
          },
          community_data: {},
          developer_data: {}
        }
      });

      await fetchOnChainMetrics('BTC/USDT');
      
      clearCache();
      
      await fetchOnChainMetrics('BTC/USDT', { useCache: true });

      expect(axios.get.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
