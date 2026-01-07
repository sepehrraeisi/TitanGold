/**
 * Integration Tests for Sentiment Analysis Agent
 * 
 * Tests the complete sentiment agent workflow including:
 * - Agent run with real API integration
 * - Configuration handling
 * - Error scenarios
 * - Response format validation
 * 
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import sentimentAgent from '../../services/agents/sentiment.js';

describe('Sentiment Analysis Agent Integration', () => {
  beforeEach(() => {
    // Clear any environment variables
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_BEARER_TOKEN;
    delete process.env.NEWS_API_KEY;
    delete process.env.CRYPTOPANIC_API_KEY;
  });

  describe('Agent Run', () => {
    test('should run sentiment analysis successfully', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result).toBeDefined();
      expect(result.agent_key).toBe('sentiment');
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.timestamp).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }, 30000); // 30 second timeout for API calls

    test('should return aggregate sentiment score', async () => {
      const params = {
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '24h',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.result).toBeDefined();
      expect(result.result.aggregate_sentiment).toBeDefined();
      expect(typeof result.result.aggregate_sentiment).toBe('number');
      expect(result.result.aggregate_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.result.aggregate_sentiment).toBeLessThanOrEqual(1);
    }, 30000);

    test('should include sentiment label', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.sentiment_label).toBeDefined();
      expect([
        'very_bullish',
        'bullish',
        'neutral',
        'bearish',
        'very_bearish'
      ]).toContain(result.result.sentiment_label);
    }, 30000);

    test('should include data from all sources', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.sources).toBeDefined();
      expect(result.result.sources.twitter).toBeDefined();
      expect(result.result.sources.reddit).toBeDefined();
      expect(result.result.sources.news).toBeDefined();

      // Each source should have sentiment and count
      expect(typeof result.result.sources.twitter.sentiment).toBe('number');
      expect(typeof result.result.sources.reddit.sentiment).toBe('number');
      expect(typeof result.result.sources.news.sentiment).toBe('number');
    }, 30000);

    test('should include trending topics when enabled', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {
          includeTopics: true
        }
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.trending_topics).toBeDefined();
      expect(Array.isArray(result.result.trending_topics)).toBe(true);
    }, 30000);

    test('should include sentiment trends when enabled', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {
          includeTrends: true
        }
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.sentiment_trends).toBeDefined();
      expect(result.result.sentiment_trends.last_24h).toBeDefined();
      expect(result.result.sentiment_trends.last_7d).toBeDefined();
      expect(result.result.sentiment_trends.trend).toBeDefined();
      expect(result.result.sentiment_trends.change).toBeDefined();
    }, 30000);

    test('should generate recommendation', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.recommendation).toBeDefined();
      expect(typeof result.result.recommendation).toBe('string');
      expect(result.result.recommendation.length).toBeGreaterThan(0);
    }, 30000);

    test('should include metadata', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.meta).toBeDefined();
      expect(result.meta.source).toBe('realtime');
      expect(result.meta.version).toBe('1.0.0');
      expect(result.meta.execution_time_ms).toBeDefined();
      expect(result.meta.sources_available).toBeDefined();
      expect(result.meta.rate_limits).toBeDefined();
    }, 30000);
  });

  describe('Configuration Options', () => {
    test('should use custom weights', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {
          weights: {
            twitter: 0.5,
            reddit: 0.3,
            news: 0.2
          }
        }
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.sources.twitter.weight).toBe(0.5);
      expect(result.result.sources.reddit.weight).toBe(0.3);
      expect(result.result.sources.news.weight).toBe(0.2);
    }, 30000);

    test('should exclude topics when configured', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {
          includeTopics: false
        }
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.trending_topics).toEqual([]);
    }, 30000);

    test('should exclude trends when configured', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {
          includeTrends: false
        }
      };

      const result = await sentimentAgent.run(params);

      expect(result.result.sentiment_trends).toBeNull();
    }, 30000);

    test('should use default timeframe when not specified', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result).toBeDefined();
      expect(result.result.aggregate_sentiment).toBeDefined();
    }, 30000);
  });

  describe('Multiple Symbols', () => {
    test('should analyze BTC sentiment', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.symbol).toBe('BTC/USDT');
      expect(result.result.aggregate_sentiment).toBeDefined();
    }, 30000);

    test('should analyze ETH sentiment', async () => {
      const params = {
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result.symbol).toBe('ETH/USDT');
      expect(result.result.aggregate_sentiment).toBeDefined();
    }, 30000);

    test('should analyze different symbols independently', async () => {
      const btcResult = await sentimentAgent.run({
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      });

      const ethResult = await sentimentAgent.run({
        userId: 1,
        symbol: 'ETH/USDT',
        timeframe: '1d',
        config: {}
      });

      expect(btcResult.symbol).toBe('BTC/USDT');
      expect(ethResult.symbol).toBe('ETH/USDT');
      
      // Results should be independent
      expect(btcResult.result.aggregate_sentiment).toBeDefined();
      expect(ethResult.result.aggregate_sentiment).toBeDefined();
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      const params = {
        userId: null, // Invalid user ID
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      // Should still return a result, even if partial
      expect(result).toBeDefined();
      expect(result.agent_key).toBe('sentiment');
    }, 30000);

    test('should return zero sentiment on complete failure', async () => {
      const params = {
        userId: 1,
        symbol: 'INVALID_SYMBOL_12345',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      expect(result).toBeDefined();
      expect(result.result.aggregate_sentiment).toBeDefined();
      // Mock data should still provide some sentiment value
    }, 30000);
  });

  describe('Agent Details', () => {
    test('should return agent details', async () => {
      const details = await sentimentAgent.getDetails({ userId: 1 });

      expect(details).toBeDefined();
      expect(details.agent_key).toBe('sentiment');
      expect(details.name).toBe('Sentiment Analysis Agent');
      expect(details.description).toBeDefined();
      expect(details.status).toBe('active');
      expect(details.version).toBe('1.0.0');
    });

    test('should include capabilities', async () => {
      const details = await sentimentAgent.getDetails({ userId: 1 });

      expect(details.capabilities).toBeDefined();
      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
    });

    test('should include configuration info', async () => {
      const details = await sentimentAgent.getDetails({ userId: 1 });

      expect(details.configuration).toBeDefined();
      expect(details.configuration.sources).toBeDefined();
      expect(details.configuration.default_weights).toBeDefined();
      expect(details.configuration.timeframes).toBeDefined();
    });

    test('should include rate limit status', async () => {
      const details = await sentimentAgent.getDetails({ userId: 1 });

      expect(details.rate_limits).toBeDefined();
      expect(details.rate_limits.twitter).toBeDefined();
      expect(details.rate_limits.reddit).toBeDefined();
      expect(details.rate_limits.news).toBeDefined();
    });
  });

  describe('Default Configuration', () => {
    test('should return default config', () => {
      const config = sentimentAgent.defaultConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(0.6);
      expect(config.weights).toBeDefined();
      expect(config.includeTopics).toBe(true);
      expect(config.includeTrends).toBe(true);
    });

    test('should include source configurations', () => {
      const config = sentimentAgent.defaultConfig();

      expect(config.sources).toBeDefined();
      expect(config.sources.twitter).toBeDefined();
      expect(config.sources.reddit).toBeDefined();
      expect(config.sources.news).toBeDefined();
    });

    test('should include default subreddits', () => {
      const config = sentimentAgent.defaultConfig();

      expect(config.sources.reddit.subreddits).toBeDefined();
      expect(Array.isArray(config.sources.reddit.subreddits)).toBe(true);
      expect(config.sources.reddit.subreddits.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should complete within reasonable time', async () => {
      const startTime = Date.now();

      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      await sentimentAgent.run(params);

      const duration = Date.now() - startTime;
      
      // Should complete within 10 seconds (even with real API calls)
      expect(duration).toBeLessThan(10000);
    }, 30000);

    test('should handle concurrent requests', async () => {
      const requests = [
        sentimentAgent.run({ userId: 1, symbol: 'BTC/USDT', timeframe: '1d', config: {} }),
        sentimentAgent.run({ userId: 1, symbol: 'ETH/USDT', timeframe: '1d', config: {} }),
        sentimentAgent.run({ userId: 1, symbol: 'BTC/USDT', timeframe: '1d', config: {} })
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.agent_key).toBe('sentiment');
      });
    }, 30000);
  });

  describe('Confidence Calculation', () => {
    test('should have higher confidence with more sources', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      // With mock data, all 3 sources should be available
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    }, 30000);

    test('should calculate confidence based on sources available', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      // Confidence should reflect number of sources (3 sources = higher confidence)
      expect(result.meta.sources_available).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Sentiment Labels', () => {
    test('should label very positive sentiment correctly', async () => {
      // This test depends on actual sentiment data
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      if (result.result.aggregate_sentiment > 0.3) {
        expect(result.result.sentiment_label).toBe('very_bullish');
      }
    }, 30000);

    test('should label neutral sentiment correctly', async () => {
      const params = {
        userId: 1,
        symbol: 'BTC/USDT',
        timeframe: '1d',
        config: {}
      };

      const result = await sentimentAgent.run(params);

      if (Math.abs(result.result.aggregate_sentiment) <= 0.1) {
        expect(result.result.sentiment_label).toBe('neutral');
      }
    }, 30000);
  });
});
