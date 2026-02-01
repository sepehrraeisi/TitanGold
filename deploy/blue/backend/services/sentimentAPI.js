/**
 * Sentiment API Service
 * 
 * Fetches and analyzes sentiment data from multiple sources:
 * - Twitter/X API (social media sentiment)
 * - Reddit API (community discussions)
 * - NewsAPI / CryptoPanic (news sentiment)
 * 
 * Features:
 * - Aggregate sentiment scoring (-1 to +1)
 * - Trending topic detection
 * - Historical sentiment trends (24h, 7d)
 * - Rate limit handling
 * - Caching for performance
 * 
 * @module sentimentAPI
 */

import axios from 'axios';
import Sentiment from 'sentiment';
import { logger } from './logger.js';

// Initialize sentiment analyzer
const sentimentAnalyzer = new Sentiment();

// Rate limiting configuration
const rateLimits = {
  twitter: { requests: 0, resetTime: Date.now(), maxRequests: 50, window: 15 * 60 * 1000 }, // 50 per 15 min
  reddit: { requests: 0, resetTime: Date.now(), maxRequests: 60, window: 60 * 1000 }, // 60 per minute
  news: { requests: 0, resetTime: Date.now(), maxRequests: 100, window: 24 * 60 * 60 * 1000 } // 100 per day
};

// Cache for sentiment data (5-minute TTL)
const sentimentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check rate limit for a specific source
 * @param {string} source - Source name (twitter, reddit, news)
 * @returns {boolean} - Whether request is allowed
 */
function checkRateLimit(source) {
  const limit = rateLimits[source];
  if (!limit) return true;

  const now = Date.now();
  
  // Reset counter if window has passed
  if (now - limit.resetTime >= limit.window) {
    limit.requests = 0;
    limit.resetTime = now;
  }

  // Check if under limit
  if (limit.requests >= limit.maxRequests) {
    logger.warn(`Rate limit reached for ${source}`, {
      requests: limit.requests,
      maxRequests: limit.maxRequests,
      resetIn: limit.resetTime + limit.window - now
    });
    return false;
  }

  limit.requests++;
  return true;
}

/**
 * Get cached sentiment data if available
 * @param {string} key - Cache key
 * @returns {object|null} - Cached data or null
 */
function getCachedSentiment(key) {
  const cached = sentimentCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Returning cached sentiment data', { key });
    return cached.data;
  }
  return null;
}

/**
 * Cache sentiment data
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 */
function cacheSentiment(key, data) {
  sentimentCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Analyze text sentiment using sentiment library
 * @param {string} text - Text to analyze
 * @returns {object} - Sentiment score and details
 */
function analyzeTextSentiment(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, comparative: 0, tokens: [], positive: [], negative: [] };
  }

  const result = sentimentAnalyzer.analyze(text);
  
  // Normalize score to -1 to +1 range
  const normalizedScore = Math.max(-1, Math.min(1, result.comparative));
  
  return {
    score: normalizedScore,
    comparative: result.comparative,
    tokens: result.tokens,
    positive: result.positive,
    negative: result.negative,
    rawScore: result.score
  };
}

/**
 * Fetch Twitter/X sentiment for a symbol
 * @param {string} symbol - Trading symbol (e.g., BTC, ETH)
 * @param {object} options - Options including timeframe
 * @returns {Promise<object>} - Sentiment data from Twitter
 */
export async function fetchTwitterSentiment(symbol, options = {}) {
  const cacheKey = `twitter_${symbol}_${options.timeframe || '24h'}`;
  const cached = getCachedSentiment(cacheKey);
  if (cached) return cached;

  if (!checkRateLimit('twitter')) {
    return {
      source: 'twitter',
      error: 'Rate limit reached',
      sentiment: 0,
      tweets: []
    };
  }

  try {
    const apiKey = process.env.TWITTER_API_KEY || process.env.TWITTER_BEARER_TOKEN;
    
    // If no API key, return mock data for development
    if (!apiKey) {
      logger.info('Twitter API key not configured, using mock data', { symbol });
      return getMockTwitterSentiment(symbol);
    }

    // Twitter API v2 search endpoint
    const query = encodeURIComponent(`$${symbol} OR #${symbol} lang:en -is:retweet`);
    const maxResults = options.maxResults || 100;
    
    const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
      params: {
        query,
        max_results: maxResults,
        'tweet.fields': 'created_at,public_metrics,author_id'
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
    });

    const tweets = response.data.data || [];
    const sentimentScores = tweets.map(tweet => {
      const analysis = analyzeTextSentiment(tweet.text);
      return {
        text: tweet.text,
        score: analysis.score,
        created_at: tweet.created_at,
        metrics: tweet.public_metrics
      };
    });

    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((sum, t) => sum + t.score, 0) / sentimentScores.length
      : 0;

    const result = {
      source: 'twitter',
      symbol,
      sentiment: avgSentiment,
      count: tweets.length,
      tweets: sentimentScores,
      timestamp: new Date().toISOString()
    };

    cacheSentiment(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error fetching Twitter sentiment', {
      symbol,
      error: error.message,
      status: error.response?.status
    });

    // Return mock data on error
    return getMockTwitterSentiment(symbol);
  }
}

/**
 * Fetch Reddit sentiment for a symbol
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options including timeframe
 * @returns {Promise<object>} - Sentiment data from Reddit
 */
export async function fetchRedditSentiment(symbol, options = {}) {
  const cacheKey = `reddit_${symbol}_${options.timeframe || '24h'}`;
  const cached = getCachedSentiment(cacheKey);
  if (cached) return cached;

  if (!checkRateLimit('reddit')) {
    return {
      source: 'reddit',
      error: 'Rate limit reached',
      sentiment: 0,
      posts: []
    };
  }

  try {
    // Reddit doesn't require API key for public data
    const subreddits = options.subreddits || ['CryptoCurrency', 'Bitcoin', 'CryptoMarkets', 'ethtrader'];
    const timeFilter = options.timeFilter || 'day'; // hour, day, week, month, year
    const limit = options.limit || 100;

    const allPosts = [];
    
    // Fetch from multiple subreddits
    for (const subreddit of subreddits) {
      try {
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/search.json`, {
          params: {
            q: symbol,
            restrict_sr: true,
            sort: 'hot',
            t: timeFilter,
            limit: Math.min(limit, 100)
          },
          headers: {
            'User-Agent': 'TitanGold/1.0.0'
          },
          timeout: 10000
        });

        const posts = response.data?.data?.children || [];
        allPosts.push(...posts.map(p => p.data));
      } catch (err) {
        logger.warn(`Error fetching from r/${subreddit}`, { error: err.message });
      }
    }

    // Analyze sentiment of titles and self-text
    const sentimentScores = allPosts.map(post => {
      const text = `${post.title} ${post.selftext || ''}`;
      const analysis = analyzeTextSentiment(text);
      return {
        title: post.title,
        score: analysis.score,
        upvotes: post.ups,
        comments: post.num_comments,
        subreddit: post.subreddit,
        created: post.created_utc,
        url: post.url
      };
    });

    // Weight by upvotes (more upvoted posts have more influence)
    const totalWeight = sentimentScores.reduce((sum, p) => sum + (p.upvotes + 1), 0);
    const weightedSentiment = sentimentScores.reduce((sum, p) => {
      const weight = (p.upvotes + 1) / totalWeight;
      return sum + (p.score * weight);
    }, 0);

    const result = {
      source: 'reddit',
      symbol,
      sentiment: weightedSentiment,
      count: allPosts.length,
      posts: sentimentScores.slice(0, 20), // Return top 20
      subreddits,
      timestamp: new Date().toISOString()
    };

    cacheSentiment(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error fetching Reddit sentiment', {
      symbol,
      error: error.message,
      status: error.response?.status
    });

    return getMockRedditSentiment(symbol);
  }
}

/**
 * Fetch news sentiment for a symbol
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options including source preference
 * @returns {Promise<object>} - Sentiment data from news sources
 */
export async function fetchNewsSentiment(symbol, options = {}) {
  const cacheKey = `news_${symbol}_${options.timeframe || '24h'}`;
  const cached = getCachedSentiment(cacheKey);
  if (cached) return cached;

  if (!checkRateLimit('news')) {
    return {
      source: 'news',
      error: 'Rate limit reached',
      sentiment: 0,
      articles: []
    };
  }

  // Prefer CryptoPanic for crypto news, fallback to NewsAPI
  const useCryptoPanic = options.source === 'cryptopanic' || !process.env.NEWS_API_KEY;
  
  if (useCryptoPanic) {
    return fetchCryptoPanicSentiment(symbol, options);
  } else {
    return fetchNewsAPISentiment(symbol, options);
  }
}

/**
 * Fetch sentiment from CryptoPanic API
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options
 * @returns {Promise<object>} - Sentiment data
 */
async function fetchCryptoPanicSentiment(symbol, options = {}) {
  try {
    const apiKey = process.env.CRYPTOPANIC_API_KEY;
    
    if (!apiKey) {
      logger.info('CryptoPanic API key not configured, using mock data', { symbol });
      return getMockNewsSentiment(symbol);
    }

    const currencies = symbol.replace(/\/.*/, '').toLowerCase(); // Extract base currency
    const filter = options.filter || 'hot'; // hot, rising, bullish, bearish, important, saved, lol
    
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: apiKey,
        currencies,
        filter,
        public: true
      },
      timeout: 10000
    });

    const articles = response.data?.results || [];
    
    // Analyze sentiment from titles and metadata
    const sentimentScores = articles.map(article => {
      const text = article.title;
      const analysis = analyzeTextSentiment(text);
      
      // Adjust score based on CryptoPanic's own sentiment indicators
      let adjustedScore = analysis.score;
      if (article.votes?.positive > article.votes?.negative) {
        adjustedScore += 0.1;
      } else if (article.votes?.negative > article.votes?.positive) {
        adjustedScore -= 0.1;
      }
      
      adjustedScore = Math.max(-1, Math.min(1, adjustedScore));
      
      return {
        title: article.title,
        score: adjustedScore,
        url: article.url,
        source: article.source?.title,
        published: article.published_at,
        votes: article.votes
      };
    });

    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((sum, a) => sum + a.score, 0) / sentimentScores.length
      : 0;

    const result = {
      source: 'cryptopanic',
      symbol,
      sentiment: avgSentiment,
      count: articles.length,
      articles: sentimentScores,
      timestamp: new Date().toISOString()
    };

    const cacheKey = `news_${symbol}_${options.timeframe || '24h'}`;
    cacheSentiment(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error fetching CryptoPanic sentiment', {
      symbol,
      error: error.message,
      status: error.response?.status
    });
    
    return getMockNewsSentiment(symbol);
  }
}

/**
 * Fetch sentiment from NewsAPI
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options
 * @returns {Promise<object>} - Sentiment data
 */
async function fetchNewsAPISentiment(symbol, options = {}) {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    
    if (!apiKey) {
      logger.info('NewsAPI key not configured, using CryptoPanic instead', { symbol });
      return fetchCryptoPanicSentiment(symbol, options);
    }

    const query = `${symbol} OR cryptocurrency OR crypto`;
    const from = options.from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        apiKey,
        q: query,
        from,
        sortBy: 'popularity',
        language: 'en',
        pageSize: 100
      },
      timeout: 10000
    });

    const articles = response.data?.articles || [];
    
    const sentimentScores = articles.map(article => {
      const text = `${article.title} ${article.description || ''}`;
      const analysis = analyzeTextSentiment(text);
      
      return {
        title: article.title,
        score: analysis.score,
        url: article.url,
        source: article.source?.name,
        published: article.publishedAt
      };
    });

    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((sum, a) => sum + a.score, 0) / sentimentScores.length
      : 0;

    const result = {
      source: 'newsapi',
      symbol,
      sentiment: avgSentiment,
      count: articles.length,
      articles: sentimentScores,
      timestamp: new Date().toISOString()
    };

    const cacheKey = `news_${symbol}_${options.timeframe || '24h'}`;
    cacheSentiment(cacheKey, result);
    return result;

  } catch (error) {
    logger.error('Error fetching NewsAPI sentiment', {
      symbol,
      error: error.message,
      status: error.response?.status
    });
    
    return getMockNewsSentiment(symbol);
  }
}

/**
 * Aggregate sentiment from all sources
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options including weights
 * @returns {Promise<object>} - Aggregated sentiment data
 */
export async function aggregateSentiment(symbol, options = {}) {
  const weights = options.weights || {
    twitter: 0.3,
    reddit: 0.35,
    news: 0.35
  };

  // Fetch from all sources in parallel
  const [twitterData, redditData, newsData] = await Promise.allSettled([
    fetchTwitterSentiment(symbol, options),
    fetchRedditSentiment(symbol, options),
    fetchNewsSentiment(symbol, options)
  ]);

  const sources = {
    twitter: twitterData.status === 'fulfilled' ? twitterData.value : { sentiment: 0, error: true },
    reddit: redditData.status === 'fulfilled' ? redditData.value : { sentiment: 0, error: true },
    news: newsData.status === 'fulfilled' ? newsData.value : { sentiment: 0, error: true }
  };

  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [source, data] of Object.entries(sources)) {
    if (!data.error && typeof data.sentiment === 'number') {
      weightedSum += data.sentiment * weights[source];
      totalWeight += weights[source];
    }
  }

  const aggregateSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    symbol,
    aggregate_sentiment: aggregateSentiment,
    sources,
    weights,
    timestamp: new Date().toISOString()
  };
}

/**
 * Detect trending topics/keywords from sentiment sources
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options
 * @returns {Promise<object>} - Trending topics and keywords
 */
export async function detectTrendingTopics(symbol, options = {}) {
  try {
    // Fetch sentiment data
    const [twitterData, redditData, newsData] = await Promise.allSettled([
      fetchTwitterSentiment(symbol, options),
      fetchRedditSentiment(symbol, options),
      fetchNewsSentiment(symbol, options)
    ]);

    // Extract keywords from all sources
    const allKeywords = new Map();
    
    // Process Twitter data
    if (twitterData.status === 'fulfilled') {
      const tweets = twitterData.value.tweets || [];
      tweets.forEach(tweet => {
        if (tweet.text) {
          extractKeywords(tweet.text).forEach(keyword => {
            allKeywords.set(keyword, (allKeywords.get(keyword) || 0) + 1);
          });
        }
      });
    }

    // Process Reddit data
    if (redditData.status === 'fulfilled') {
      const posts = redditData.value.posts || [];
      posts.forEach(post => {
        if (post.title) {
          extractKeywords(post.title).forEach(keyword => {
            allKeywords.set(keyword, (allKeywords.get(keyword) || 0) + post.upvotes);
          });
        }
      });
    }

    // Process News data
    if (newsData.status === 'fulfilled') {
      const articles = newsData.value.articles || [];
      articles.forEach(article => {
        if (article.title) {
          extractKeywords(article.title).forEach(keyword => {
            allKeywords.set(keyword, (allKeywords.get(keyword) || 0) + 2); // Weight news higher
          });
        }
      });
    }

    // Sort by frequency and get top keywords
    const sortedKeywords = Array.from(allKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    return {
      symbol,
      trending_topics: sortedKeywords,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Error detecting trending topics', {
      symbol,
      error: error.message
    });

    return {
      symbol,
      trending_topics: [],
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} - List of keywords
 */
function extractKeywords(text) {
  if (!text) return [];
  
  // Remove URLs, mentions, hashtags symbols
  const cleanText = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  // Common stop words
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'this', 'that',
    'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'it'
  ]);

  const words = cleanText.split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  return words;
}

/**
 * Get sentiment trends over time periods
 * @param {string} symbol - Trading symbol
 * @param {object} options - Options
 * @returns {Promise<object>} - Sentiment trends
 */
export async function getSentimentTrends(symbol, options = {}) {
  try {
    // Fetch sentiment for different time periods
    const [sentiment24h, sentiment7d] = await Promise.allSettled([
      aggregateSentiment(symbol, { ...options, timeframe: '24h' }),
      aggregateSentiment(symbol, { ...options, timeframe: '7d' })
    ]);

    const trends = {
      symbol,
      last_24h: sentiment24h.status === 'fulfilled' ? sentiment24h.value.aggregate_sentiment : 0,
      last_7d: sentiment7d.status === 'fulfilled' ? sentiment7d.value.aggregate_sentiment : 0,
      timestamp: new Date().toISOString()
    };

    // Calculate trend direction
    const change = trends.last_24h - trends.last_7d;
    trends.trend = change > 0.1 ? 'bullish' : change < -0.1 ? 'bearish' : 'neutral';
    trends.change = change;

    return trends;

  } catch (error) {
    logger.error('Error getting sentiment trends', {
      symbol,
      error: error.message
    });

    return {
      symbol,
      last_24h: 0,
      last_7d: 0,
      trend: 'neutral',
      change: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Mock Twitter sentiment data (for development)
 */
function getMockTwitterSentiment(symbol) {
  return {
    source: 'twitter',
    symbol,
    sentiment: 0.15 + (Math.random() * 0.4 - 0.2), // 0.05 to 0.35
    count: Math.floor(Math.random() * 50) + 20,
    tweets: [],
    mock: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Mock Reddit sentiment data (for development)
 */
function getMockRedditSentiment(symbol) {
  return {
    source: 'reddit',
    symbol,
    sentiment: 0.2 + (Math.random() * 0.3 - 0.15), // 0.05 to 0.35
    count: Math.floor(Math.random() * 30) + 10,
    posts: [],
    mock: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Mock news sentiment data (for development)
 */
function getMockNewsSentiment(symbol) {
  return {
    source: 'news',
    symbol,
    sentiment: 0.1 + (Math.random() * 0.4 - 0.2), // -0.1 to 0.3
    count: Math.floor(Math.random() * 20) + 5,
    articles: [],
    mock: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Clear sentiment cache (for testing or manual refresh)
 */
export function clearCache() {
  sentimentCache.clear();
  logger.info('Sentiment cache cleared');
}

/**
 * Get rate limit status for all sources
 * @returns {object} - Rate limit status
 */
export function getRateLimitStatus() {
  const status = {};
  for (const [source, limit] of Object.entries(rateLimits)) {
    const now = Date.now();
    const resetIn = Math.max(0, limit.resetTime + limit.window - now);
    status[source] = {
      requests: limit.requests,
      maxRequests: limit.maxRequests,
      remaining: Math.max(0, limit.maxRequests - limit.requests),
      resetIn: Math.ceil(resetIn / 1000), // seconds
      resetAt: new Date(limit.resetTime + limit.window).toISOString()
    };
  }
  return status;
}

export default {
  fetchTwitterSentiment,
  fetchRedditSentiment,
  fetchNewsSentiment,
  aggregateSentiment,
  detectTrendingTopics,
  getSentimentTrends,
  analyzeTextSentiment,
  clearCache,
  getRateLimitStatus
};
