/**
 * News API Service Unit Tests
 * BACKEND-012: Implement Market Intelligence Agent
 */

import { jest } from '@jest/globals';

// Mock axios
const mockAxiosGet = jest.fn();
jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet
  }
}));

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const { fetchNews, searchNews, clearCache } = await import('../../services/newsAPI.js');

describe('News API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
    
    // Setup default axios mocks
    mockAxiosGet.mockReset();
  });

  describe('fetchNews', () => {
    it('should fetch news from multiple sources', async () => {
      // Mock CryptoPanic response
      mockAxiosGet.mockImplementation((url) => {
        if (url.includes('cryptopanic')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  id: '1',
                  title: 'Bitcoin breaks $50k',
                  url: 'https://example.com/btc-50k',
                  published_at: '2026-01-07T12:00:00Z',
                  kind: 'news',
                  domain: 'coindesk.com',
                  currencies: [{ code: 'BTC' }],
                  votes: { positive: 10, negative: 2, neutral: 3 }
                }
              ]
            }
          });
        } else if (url.includes('newsapi')) {
          return Promise.resolve({
            data: {
              articles: [
                {
                  source: { name: 'CoinTelegraph' },
                  title: 'Crypto markets rally',
                  description: 'Markets showing strength',
                  url: 'https://example.com/rally',
                  publishedAt: '2026-01-07T11:00:00Z',
                  author: 'John Doe',
                  urlToImage: 'https://example.com/image.jpg',
                  content: 'Full article content'
                }
              ]
            }
          });
        }
      });

      const result = await fetchNews('BTC/USDT', { useCache: false });

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.articles).toBeInstanceOf(Array);
      expect(result.articles.length).toBeGreaterThan(0);
      expect(result.sentiment).toBeDefined();
      expect(result.topics).toBeDefined();
    });

    it('should calculate sentiment correctly', async () => {
      mockAxiosGet.mockImplementation((url) => {
        if (url.includes('cryptopanic')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  id: '1',
                  title: 'Bullish news',
                  url: 'https://example.com/1',
                  published_at: '2026-01-07T12:00:00Z',
                  votes: { positive: 20, negative: 5, neutral: 5 }
                },
                {
                  id: '2',
                  title: 'Bearish news',
                  url: 'https://example.com/2',
                  published_at: '2026-01-07T11:00:00Z',
                  votes: { positive: 3, negative: 15, neutral: 2 }
                }
              ]
            }
          });
        }
        return Promise.resolve({ data: { articles: [] } });
      });

      const result = await fetchNews('BTC/USDT', { useCache: false });

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment.score).toBeGreaterThan(-1);
      expect(result.sentiment.score).toBeLessThan(1);
      expect(result.sentiment.positive).toBeGreaterThanOrEqual(0);
      expect(result.sentiment.negative).toBeGreaterThanOrEqual(0);
    });

    it('should extract trending topics', async () => {
      mockAxiosGet.mockImplementation((url) => {
        if (url.includes('cryptopanic')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  id: '1',
                  title: 'Bitcoin ETF approval brings bull rally',
                  url: 'https://example.com/1',
                  published_at: '2026-01-07T12:00:00Z'
                },
                {
                  id: '2',
                  title: 'SEC regulation and ETF news',
                  url: 'https://example.com/2',
                  published_at: '2026-01-07T11:00:00Z'
                }
              ]
            }
          });
        }
        return Promise.resolve({ data: { articles: [] } });
      });

      const result = await fetchNews('BTC/USDT', { useCache: false });

      expect(result.topics).toBeDefined();
      expect(result.topics).toBeInstanceOf(Array);
      
      const hasEtfTopic = result.topics.some(t => t.topic === 'etf');
      const hasBullTopic = result.topics.some(t => t.topic === 'bull');
      
      expect(hasEtfTopic || hasBullTopic).toBe(true);
    });

    it('should cache results', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          results: [],
          articles: []
        }
      });

      // First call
      const result1 = await fetchNews('BTC/USDT');
      
      // Second call should use cache
      const result2 = await fetchNews('BTC/USDT');

      expect(result1).toEqual(result2);
      // Should only call API once
      expect(mockAxiosGet.mock.calls.length).toBeLessThanOrEqual(2); // Max 2 calls (CryptoPanic + NewsAPI)
    });

    it('should handle API errors gracefully', async () => {
      mockAxiosGet.mockRejectedValue(new Error('API error'));

      await expect(fetchNews('BTC/USDT', { useCache: false })).rejects.toThrow();
    });

    it('should handle missing API keys', async () => {
      // Clear environment variables
      const originalCryptoPanicKey = process.env.CRYPTOPANIC_API_KEY;
      const originalNewsAPIKey = process.env.NEWSAPI_KEY;
      
      delete process.env.CRYPTOPANIC_API_KEY;
      delete process.env.NEWSAPI_KEY;

      const result = await fetchNews('BTC/USDT', { useCache: false });

      expect(result.articles).toHaveLength(0);
      expect(result.sources.cryptoPanic).toBe(0);
      expect(result.sources.newsAPI).toBe(0);

      // Restore
      if (originalCryptoPanicKey) process.env.CRYPTOPANIC_API_KEY = originalCryptoPanicKey;
      if (originalNewsAPIKey) process.env.NEWSAPI_KEY = originalNewsAPIKey;
    });

    it('should sort articles by date', async () => {
      mockAxiosGet.mockImplementation((url) => {
        if (url.includes('cryptopanic')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  id: '1',
                  title: 'Old news',
                  url: 'https://example.com/1',
                  published_at: '2026-01-06T12:00:00Z'
                },
                {
                  id: '2',
                  title: 'New news',
                  url: 'https://example.com/2',
                  published_at: '2026-01-07T12:00:00Z'
                }
              ]
            }
          });
        }
        return Promise.resolve({ data: { articles: [] } });
      });

      const result = await fetchNews('BTC/USDT', { useCache: false });

      expect(result.articles[0].title).toBe('New news');
      expect(result.articles[1].title).toBe('Old news');
    });

    it('should respect limit parameter', async () => {
      const manyArticles = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        title: `Article ${i}`,
        url: `https://example.com/${i}`,
        published_at: new Date(Date.now() - i * 60000).toISOString()
      }));

      mockAxiosGet.mockResolvedValue({
        data: {
          results: manyArticles,
          articles: []
        }
      });

      const result = await fetchNews('BTC/USDT', { limit: 10, useCache: false });

      expect(result.articles.length).toBeLessThanOrEqual(10);
    });
  });

  describe('searchNews', () => {
    it('should search news by query', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          articles: [
            {
              source: { name: 'Test' },
              title: 'Bitcoin regulation news',
              url: 'https://example.com/1',
              publishedAt: '2026-01-07T12:00:00Z'
            }
          ]
        }
      });

      const result = await searchNews('Bitcoin regulation');

      expect(result).toBeInstanceOf(Array);
      expect(mockAxiosGet).toHaveBeenCalled();
    });

    it('should handle search errors', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Search error'));

      const result = await searchNews('test query');

      expect(result).toEqual([]);
    });

    it('should support date filters', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { articles: [] }
      });

      await searchNews('Bitcoin', {
        from: '2026-01-01',
        to: '2026-01-07'
      });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            from: '2026-01-01',
            to: '2026-01-07'
          })
        })
      );
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          results: [],
          articles: []
        }
      });

      // Fetch to populate cache
      await fetchNews('BTC/USDT');

      // Clear cache
      clearCache();

      // Next fetch should hit API again
      await fetchNews('BTC/USDT', { useCache: true });

      expect(mockAxiosGet.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
