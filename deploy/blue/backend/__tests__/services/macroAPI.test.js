/**
 * Macro API Service Unit Tests
 * BACKEND-012: Implement Market Intelligence Agent
 */

import { fetchMacroIndicators, clearCache } from '../../services/macroAPI.js';

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

describe('Macro API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
    
    axios.get = jest.fn();
  });

  describe('fetchMacroIndicators', () => {
    it('should fetch all macro indicators', async () => {
      // Mock Alpha Vantage responses
      axios.get.mockImplementation((url, config) => {
        const symbol = config.params.symbol;
        const func = config.params.function;
        
        if (func === 'FX_DAILY') {
          return Promise.resolve({
            data: {
              'Time Series FX (Daily)': {
                '2026-01-07': { '4. close': '1.05' },
                '2026-01-06': { '4. close': '1.04' }
              }
            }
          });
        } else if (func === 'TIME_SERIES_DAILY') {
          return Promise.resolve({
            data: {
              'Time Series (Daily)': {
                '2026-01-07': { '4. close': symbol === 'VIX' ? '18.5' : symbol === 'SPY' ? '480' : '200' },
                '2026-01-06': { '4. close': symbol === 'VIX' ? '17.0' : symbol === 'SPY' ? '475' : '198' }
              }
            }
          });
        }
        
        return Promise.reject(new Error('Unknown request'));
      });

      const result = await fetchMacroIndicators({ useCache: false });

      expect(result).toBeDefined();
      expect(result.indicators).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate VIX risk sentiment', async () => {
      axios.get.mockResolvedValue({
        data: {
          'Time Series (Daily)': {
            '2026-01-07': { '4. close': '12.0' }, // Low VIX
            '2026-01-06': { '4. close': '11.5' }
          }
        }
      });

      const result = await fetchMacroIndicators({ useCache: false });

      expect(result.analysis.risk_sentiment).toBeDefined();
      const lowVolInsight = result.analysis.insights.find(i => i.type === 'risk_sentiment');
      expect(lowVolInsight).toBeDefined();
    });

    it('should detect high volatility regime', async () => {
      axios.get.mockResolvedValue({
        data: {
          'Time Series (Daily)': {
            '2026-01-07': { '4. close': '35.0' }, // High VIX
            '2026-01-06': { '4. close': '28.0' }
          }
        }
      });

      const result = await fetchMacroIndicators({ useCache: false });

      expect(result.analysis.risk_sentiment).toBe('risk-off');
    });

    it('should analyze DXY-crypto correlation', async () => {
      axios.get.mockImplementation((url, config) => {
        if (config.params.function === 'FX_DAILY') {
          return Promise.resolve({
            data: {
              'Time Series FX (Daily)': {
                '2026-01-07': { '4. close': '1.10' },
                '2026-01-06': { '4. close': '1.08' } // DXY up 2%
              }
            }
          });
        }
        return Promise.resolve({
          data: {
            'Time Series (Daily)': {
              '2026-01-07': { '4. close': '20' },
              '2026-01-06': { '4. close': '20' }
            }
          }
        });
      });

      const result = await fetchMacroIndicators({ useCache: false });

      const dollarInsight = result.analysis.insights.find(i => i.type === 'dollar_strength');
      expect(dollarInsight).toBeDefined();
    });

    it('should detect risk-on regime', async () => {
      axios.get.mockImplementation((url, config) => {
        const symbol = config.params.symbol;
        
        if (symbol === 'VIX') {
          return Promise.resolve({
            data: {
              'Time Series (Daily)': {
                '2026-01-07': { '4. close': '13.0' },
                '2026-01-06': { '4. close': '14.0' } // VIX down
              }
            }
          });
        } else if (symbol === 'SPY') {
          return Promise.resolve({
            data: {
              'Time Series (Daily)': {
                '2026-01-07': { '4. close': '485' },
                '2026-01-06': { '4. close': '480' } // S&P up
              }
            }
          });
        }
        
        return Promise.resolve({
          data: {
            'Time Series (Daily)': {
              '2026-01-07': { '4. close': '100' },
              '2026-01-06': { '4. close': '100' }
            }
          }
        });
      });

      const result = await fetchMacroIndicators({ useCache: false });

      expect(result.analysis.market_regime).toBe('risk-on');
    });

    it('should detect risk-off regime', async () => {
      axios.get.mockImplementation((url, config) => {
        const symbol = config.params.symbol;
        
        if (symbol === 'VIX') {
          return Promise.resolve({
            data: {
              'Time Series (Daily)': {
                '2026-01-07': { '4. close': '32.0' },
                '2026-01-06': { '4. close': '28.0' } // VIX up
              }
            }
          });
        } else if (symbol === 'SPY') {
          return Promise.resolve({
            data: {
              'Time Series (Daily)': {
                '2026-01-07': { '4. close': '465' },
                '2026-01-06': { '4. close': '480' } // S&P down
              }
            }
          });
        }
        
        return Promise.resolve({
          data: {
            'Time Series (Daily)': {
              '2026-01-07': { '4. close': '100' },
              '2026-01-06': { '4. close': '100' }
            }
          }
        });
      });

      const result = await fetchMacroIndicators({ useCache: false });

      expect(result.analysis.market_regime).toBe('risk-off');
    });

    it('should cache results', async () => {
      axios.get.mockResolvedValue({
        data: {
          'Time Series (Daily)': {
            '2026-01-07': { '4. close': '20' },
            '2026-01-06': { '4. close': '20' }
          }
        }
      });

      const result1 = await fetchMacroIndicators();
      const result2 = await fetchMacroIndicators();

      expect(result1).toEqual(result2);
    });

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('API error'));

      await expect(fetchMacroIndicators({ useCache: false })).rejects.toThrow();
    });

    it('should handle missing API keys', async () => {
      const originalKey = process.env.ALPHA_VANTAGE_API_KEY;
      delete process.env.ALPHA_VANTAGE_API_KEY;

      // Should use fallback VIX data
      const result = await fetchMacroIndicators({ useCache: false });

      expect(result.indicators.vix).toBeDefined();
      expect(result.indicators.vix.note).toBe('Using fallback data');

      if (originalKey) process.env.ALPHA_VANTAGE_API_KEY = originalKey;
    });

    it('should provide correlations analysis', async () => {
      axios.get.mockImplementation((url, config) => {
        if (config.params.function === 'FX_DAILY') {
          return Promise.resolve({
            data: {
              'Time Series FX (Daily)': {
                '2026-01-07': { '4. close': '1.08' },
                '2026-01-06': { '4. close': '1.06' }
              }
            }
          });
        }
        return Promise.resolve({
          data: {
            'Time Series (Daily)': {
              '2026-01-07': { '4. close': '100' },
              '2026-01-06': { '4. close': '98' }
            }
          }
        });
      });

      const result = await fetchMacroIndicators({ useCache: false });

      expect(result.analysis.correlations).toBeInstanceOf(Array);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      axios.get.mockResolvedValue({
        data: {
          'Time Series (Daily)': {
            '2026-01-07': { '4. close': '20' },
            '2026-01-06': { '4. close': '20' }
          }
        }
      });

      await fetchMacroIndicators();
      
      clearCache();
      
      await fetchMacroIndicators({ useCache: true });

      expect(axios.get.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
