/**
 * Unit Tests for Sentiment API Service
 * 
 * Tests sentiment analysis functionality including:
 * - Text sentiment analysis
 * - Twitter/Reddit/News API integration
 * - Aggregate sentiment calculation
 * - Trending topic detection
 * - Sentiment trends
 * - Rate limiting
 * - Caching
 * 
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import sentimentAPI from '../../services/sentimentAPI.js';

describe('Sentiment API Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    sentimentAPI.clearCache();
    
    // Reset environment variables
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_BEARER_TOKEN;
    delete process.env.NEWS_API_KEY;
    delete process.env.CRYPTOPANIC_API_KEY;
  });

  describe('Text Sentiment Analysis', () => {
    test('should analyze positive text correctly', () => {
      const result = sentimentAPI.analyzeTextSentiment('Bitcoin is amazing! Great investment opportunity!');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.positive).toContain('amazing');
      expect(result.positive).toContain('great');
    });

    test('should analyze negative text correctly', () => {
      const result = sentimentAPI.analyzeTextSentiment('Bitcoin is terrible. Bad investment. Avoid!');
      
      expect(result.score).toBeLessThan(0);
      expect(result.negative).toContain('terrible');
      expect(result.negative).toContain('bad');
    });

    test('should analyze neutral text correctly', () => {
      const result = sentimentAPI.analyzeTextSentiment('Bitcoin is a cryptocurrency');
      
      expect(result.score).toBeCloseTo(0, 1);
    });

    test('should handle empty text', () => {
      const result = sentimentAPI.analyzeTextSentiment('');
      
      expect(result.score).toBe(0);
      expect(result.tokens).toEqual([]);
    });

    test('should handle null/undefined text', () => {
      expect(sentimentAPI.analyzeTextSentiment(null).score).toBe(0);
      expect(sentimentAPI.analyzeTextSentiment(undefined).score).toBe(0);
    });

    test('should normalize sentiment score to -1 to +1 range', () => {
      const veryPositive = sentimentAPI.analyzeTextSentiment('excellent wonderful amazing fantastic great');
      const veryNegative = sentimentAPI.analyzeTextSentiment('terrible horrible awful bad worst');
      
      expect(veryPositive.score).toBeGreaterThanOrEqual(-1);
      expect(veryPositive.score).toBeLessThanOrEqual(1);
      expect(veryNegative.score).toBeGreaterThanOrEqual(-1);
      expect(veryNegative.score).toBeLessThanOrEqual(1);
    });

    test('should return all sentiment components', () => {
      const result = sentimentAPI.analyzeTextSentiment('This is good but also bad');
      
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('comparative');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('rawScore');
    });
  });

  describe('Twitter Sentiment', () => {
    test('should return mock data when API key is missing', async () => {
      const result = await sentimentAPI.fetchTwitterSentiment('BTC', {});
      
      expect(result.source).toBe('twitter');
      expect(result.symbol).toBe('BTC');
      expect(result.mock).toBe(true);
      expect(result.sentiment).toBeDefined();
      expect(typeof result.sentiment).toBe('number');
      expect(result.sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.sentiment).toBeLessThanOrEqual(1);
    });

    test('should return valid structure', async () => {
      const result = await sentimentAPI.fetchTwitterSentiment('BTC', {});
      
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('tweets');
      expect(result).toHaveProperty('timestamp');
    });

    test('should use cache for repeated requests', async () => {
      const result1 = await sentimentAPI.fetchTwitterSentiment('BTC', { timeframe: '24h' });
      const result2 = await sentimentAPI.fetchTwitterSentiment('BTC', { timeframe: '24h' });
      
      // Results should be identical (from cache)
      expect(result1.timestamp).toBe(result2.timestamp);
      expect(result1.sentiment).toBe(result2.sentiment);
    });

    test('should handle different timeframes', async () => {
      const result24h = await sentimentAPI.fetchTwitterSentiment('BTC', { timeframe: '24h' });
      const result7d = await sentimentAPI.fetchTwitterSentiment('BTC', { timeframe: '7d' });
      
      expect(result24h).toBeDefined();
      expect(result7d).toBeDefined();
      expect(result24h.symbol).toBe('BTC');
      expect(result7d.symbol).toBe('BTC');
    });
  });

  describe('Reddit Sentiment', () => {
    test('should fetch Reddit sentiment successfully', async () => {
      const result = await sentimentAPI.fetchRedditSentiment('BTC', {});
      
      expect(result.source).toBe('reddit');
      expect(result.symbol).toBe('BTC');
      expect(result.sentiment).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(0);
    }, 30000);

    test('should return valid structure', async () => {
      const result = await sentimentAPI.fetchRedditSentiment('BTC', {});
      
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('posts');
      expect(result).toHaveProperty('timestamp');
    }, 30000);

    test('should respect custom subreddit options', async () => {
      const subreddits = ['CryptoCurrency', 'Bitcoin'];
      const result = await sentimentAPI.fetchRedditSentiment('BTC', { subreddits });
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTC');
    }, 30000);

    test('should use cache', async () => {
      const result1 = await sentimentAPI.fetchRedditSentiment('BTC', { timeframe: '24h' });
      const result2 = await sentimentAPI.fetchRedditSentiment('BTC', { timeframe: '24h' });
      
      expect(result1.timestamp).toBe(result2.timestamp);
    }, 30000);
  });

  describe('News Sentiment', () => {
    test('should fetch news sentiment', async () => {
      const result = await sentimentAPI.fetchNewsSentiment('BTC', {});
      
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('timestamp');
    }, 30000);

    test('should return mock data when no API keys', async () => {
      const result = await sentimentAPI.fetchNewsSentiment('BTC', {});
      
      expect(result.mock).toBe(true);
      expect(result.sentiment).toBeDefined();
    }, 30000);

    test('should handle different symbols', async () => {
      const btcResult = await sentimentAPI.fetchNewsSentiment('BTC', {});
      const ethResult = await sentimentAPI.fetchNewsSentiment('ETH', {});
      
      expect(btcResult.symbol).toBe('BTC');
      expect(ethResult.symbol).toBe('ETH');
    }, 30000);
  });

  describe('Aggregate Sentiment', () => {
    test('should aggregate sentiment from all sources', async () => {
      const result = await sentimentAPI.aggregateSentiment('BTC', {});
      
      expect(result.symbol).toBe('BTC');
      expect(result.aggregate_sentiment).toBeDefined();
      expect(result.sources).toHaveProperty('twitter');
      expect(result.sources).toHaveProperty('reddit');
      expect(result.sources).toHaveProperty('news');
      expect(result.weights).toBeDefined();
      expect(result.timestamp).toBeDefined();
    }, 30000);

    test('should use default weights', async () => {
      const result = await sentimentAPI.aggregateSentiment('BTC', {});
      
      expect(result.weights.twitter).toBe(0.3);
      expect(result.weights.reddit).toBe(0.35);
      expect(result.weights.news).toBe(0.35);
    }, 30000);

    test('should use custom weights for aggregation', async () => {
      const customWeights = {
        twitter: 0.5,
        reddit: 0.3,
        news: 0.2
      };

      const result = await sentimentAPI.aggregateSentiment('BTC', { weights: customWeights });
      
      expect(result.weights).toEqual(customWeights);
    }, 30000);

    test('should return sentiment in valid range', async () => {
      const result = await sentimentAPI.aggregateSentiment('BTC', {});
      
      expect(result.aggregate_sentiment).toBeGreaterThanOrEqual(-1);
      expect(result.aggregate_sentiment).toBeLessThanOrEqual(1);
    }, 30000);

    test('should handle different symbols', async () => {
      const btcResult = await sentimentAPI.aggregateSentiment('BTC', {});
      const ethResult = await sentimentAPI.aggregateSentiment('ETH', {});
      
      expect(btcResult.symbol).toBe('BTC');
      expect(ethResult.symbol).toBe('ETH');
    }, 30000);
  });

  describe('Trending Topics Detection', () => {
    test('should detect trending topics', async () => {
      const result = await sentimentAPI.detectTrendingTopics('BTC', {});
      
      expect(result.symbol).toBe('BTC');
      expect(result.trending_topics).toBeDefined();
      expect(Array.isArray(result.trending_topics)).toBe(true);
      expect(result.timestamp).toBeDefined();
    }, 30000);

    test('should return topic objects with keyword and count', async () => {
      const result = await sentimentAPI.detectTrendingTopics('BTC', {});
      
      if (result.trending_topics.length > 0) {
        const topic = result.trending_topics[0];
        expect(topic).toHaveProperty('keyword');
        expect(topic).toHaveProperty('count');
      }
    }, 30000);

    test('should limit number of trending topics', async () => {
      const result = await sentimentAPI.detectTrendingTopics('BTC', {});
      
      // Should return at most 20 topics
      expect(result.trending_topics.length).toBeLessThanOrEqual(20);
    }, 30000);
  });

  describe('Sentiment Trends', () => {
    test('should fetch sentiment trends for multiple timeframes', async () => {
      const result = await sentimentAPI.getSentimentTrends('BTC', {});
      
      expect(result.symbol).toBe('BTC');
      expect(result.last_24h).toBeDefined();
      expect(result.last_7d).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(result.change).toBeDefined();
      expect(result.timestamp).toBeDefined();
    }, 30000);

    test('should calculate trend direction', async () => {
      const result = await sentimentAPI.getSentimentTrends('BTC', {});
      
      expect(['bullish', 'bearish', 'neutral']).toContain(result.trend);
    }, 30000);

    test('should have valid sentiment values', async () => {
      const result = await sentimentAPI.getSentimentTrends('BTC', {});
      
      expect(result.last_24h).toBeGreaterThanOrEqual(-1);
      expect(result.last_24h).toBeLessThanOrEqual(1);
      expect(result.last_7d).toBeGreaterThanOrEqual(-1);
      expect(result.last_7d).toBeLessThanOrEqual(1);
    }, 30000);

    test('should calculate change correctly', async () => {
      const result = await sentimentAPI.getSentimentTrends('BTC', {});
      
      const expectedChange = result.last_24h - result.last_7d;
      expect(result.change).toBeCloseTo(expectedChange, 5);
    }, 30000);
  });

  describe('Rate Limiting', () => {
    test('should track rate limits for all sources', () => {
      const status = sentimentAPI.getRateLimitStatus();
      
      expect(status).toHaveProperty('twitter');
      expect(status).toHaveProperty('reddit');
      expect(status).toHaveProperty('news');
    });

    test('should have valid rate limit structure', () => {
      const status = sentimentAPI.getRateLimitStatus();
      
      expect(status.twitter).toHaveProperty('requests');
      expect(status.twitter).toHaveProperty('maxRequests');
      expect(status.twitter).toHaveProperty('remaining');
      expect(status.twitter).toHaveProperty('resetIn');
      expect(status.twitter).toHaveProperty('resetAt');
    });

    test('should return correct remaining requests', () => {
      const status = sentimentAPI.getRateLimitStatus();
      
      expect(status.twitter.remaining).toBeLessThanOrEqual(status.twitter.maxRequests);
      expect(status.reddit.remaining).toBeLessThanOrEqual(status.reddit.maxRequests);
      expect(status.news.remaining).toBeLessThanOrEqual(status.news.maxRequests);
    });

    test('should have positive reset times', () => {
      const status = sentimentAPI.getRateLimitStatus();
      
      expect(status.twitter.resetIn).toBeGreaterThanOrEqual(0);
      expect(status.reddit.resetIn).toBeGreaterThanOrEqual(0);
      expect(status.news.resetIn).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Caching', () => {
    test('should cache sentiment results', async () => {
      const result1 = await sentimentAPI.fetchTwitterSentiment('BTC', { timeframe: '24h' });
      const result2 = await sentimentAPI.fetchTwitterSentiment('BTC', { timeframe: '24h' });
      
      // Results should be identical (from cache)
      expect(result1.timestamp).toBe(result2.timestamp);
      expect(result1.sentiment).toBe(result2.sentiment);
    });

    test('should use different cache keys for different symbols', async () => {
      const resultBTC = await sentimentAPI.fetchTwitterSentiment('BTC', {});
      const resultETH = await sentimentAPI.fetchTwitterSentiment('ETH', {});
      
      expect(resultBTC.symbol).toBe('BTC');
      expect(resultETH.symbol).toBe('ETH');
    });

    test('should clear cache on demand', async () => {
      await sentimentAPI.fetchTwitterSentiment('BTC', {});
      
      sentimentAPI.clearCache();
      
      // After clearing, should fetch fresh data
      const result = await sentimentAPI.fetchTwitterSentiment('BTC', {});
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long symbol names', async () => {
      const longSymbol = 'A'.repeat(100);
      const result = await sentimentAPI.aggregateSentiment(longSymbol, {});
      
      expect(result.symbol).toBe(longSymbol);
    }, 30000);

    test('should handle special characters in symbols', async () => {
      const result = await sentimentAPI.aggregateSentiment('BTC/USDT', {});
      
      expect(result.symbol).toBe('BTC/USDT');
    }, 30000);

    test('should return consistent results for same input', async () => {
      const result1 = await sentimentAPI.aggregateSentiment('BTC', {});
      const result2 = await sentimentAPI.aggregateSentiment('BTC', {});
      
      // Due to caching, should be identical
      expect(result1.aggregate_sentiment).toBe(result2.aggregate_sentiment);
    }, 30000);

    test('should handle empty options', async () => {
      const result = await sentimentAPI.aggregateSentiment('BTC');
      
      expect(result).toBeDefined();
      expect(result.aggregate_sentiment).toBeDefined();
    }, 30000);
  });
});
