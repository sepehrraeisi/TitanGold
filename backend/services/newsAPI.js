/**
 * News API Service
 * BACKEND-012: Implement Market Intelligence Agent
 * 
 * Aggregates cryptocurrency news from multiple sources:
 * - CryptoPanic API
 * - NewsAPI.org
 * - CoinDesk/CoinTelegraph RSS feeds
 * 
 * Provides filtered, relevant news for market intelligence
 */

import axios from 'axios';
import { logger } from './logger.js';

// Cache for news data
const newsCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch news from CryptoPanic
 * @param {string} symbol - Cryptocurrency symbol (BTC, ETH, etc.)
 * @param {Object} options - Fetch options
 * @returns {Array} News articles
 */
async function fetchCryptoPanicNews(symbol, options = {}) {
  try {
    const baseSymbol = symbol.split('/')[0]; // BTC/USDT -> BTC
    const apiKey = process.env.CRYPTOPANIC_API_KEY;
    
    if (!apiKey) {
      logger.warn('CryptoPanic API key not configured');
      return [];
    }
    
    const params = {
      auth_token: apiKey,
      currencies: baseSymbol,
      kind: options.kind || 'news', // news, media, all
      filter: options.filter || 'important', // rising, hot, important, saved, lol
      public: 'true'
    };
    
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params,
      timeout: 10000
    });
    
    const articles = response.data.results || [];
    
    return articles.map(article => ({
      source: 'CryptoPanic',
      title: article.title,
      url: article.url,
      published: article.published_at,
      sentiment: article.votes ? calculateSentiment(article.votes) : null,
      currencies: article.currencies || [],
      domain: article.domain,
      metadata: {
        id: article.id,
        kind: article.kind,
        votes: article.votes
      }
    }));
    
  } catch (error) {
    logger.error('Failed to fetch CryptoPanic news', error);
    return [];
  }
}

/**
 * Fetch news from NewsAPI.org
 * @param {string} symbol - Cryptocurrency symbol
 * @param {Object} options - Fetch options
 * @returns {Array} News articles
 */
async function fetchNewsAPI(symbol, options = {}) {
  try {
    const baseSymbol = symbol.split('/')[0];
    const apiKey = process.env.NEWSAPI_KEY;
    
    if (!apiKey) {
      logger.warn('NewsAPI key not configured');
      return [];
    }
    
    const query = `${baseSymbol} OR cryptocurrency OR crypto`;
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const params = {
      q: query,
      apiKey,
      language: 'en',
      sortBy: 'publishedAt',
      from,
      pageSize: options.limit || 20
    };
    
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params,
      timeout: 10000
    });
    
    const articles = response.data.articles || [];
    
    return articles.map(article => ({
      source: article.source.name,
      title: article.title,
      description: article.description,
      url: article.url,
      published: article.publishedAt,
      author: article.author,
      image: article.urlToImage,
      content: article.content
    }));
    
  } catch (error) {
    logger.error('Failed to fetch NewsAPI', error);
    return [];
  }
}

/**
 * Fetch aggregated news from all sources
 * @param {string} symbol - Cryptocurrency symbol
 * @param {Object} options - Fetch options
 * @returns {Object} Aggregated news data
 */
export async function fetchNews(symbol, options = {}) {
  try {
    const cacheKey = `news_${symbol}_${options.timeframe || '24h'}`;
    
    // Check cache
    if (options.useCache !== false) {
      const cached = newsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info('Returning cached news', { symbol });
        return cached.data;
      }
    }
    
    logger.info('Fetching news from sources', { symbol });
    
    // Fetch from multiple sources in parallel
    const [cryptoPanicNews, newsAPIArticles] = await Promise.all([
      fetchCryptoPanicNews(symbol, options),
      fetchNewsAPI(symbol, options)
    ]);
    
    // Combine and deduplicate
    const allArticles = [
      ...cryptoPanicNews,
      ...newsAPIArticles
    ];
    
    // Sort by published date (most recent first)
    allArticles.sort((a, b) => {
      const dateA = new Date(a.published);
      const dateB = new Date(b.published);
      return dateB - dateA;
    });
    
    // Limit results
    const limit = options.limit || 50;
    const articles = allArticles.slice(0, limit);
    
    // Analyze sentiment across articles
    const sentiment = analyzeSentiment(articles);
    
    // Extract trending topics
    const topics = extractTopics(articles);
    
    const result = {
      symbol,
      articles,
      count: articles.length,
      sentiment,
      topics,
      sources: {
        cryptoPanic: cryptoPanicNews.length,
        newsAPI: newsAPIArticles.length
      },
      timestamp: new Date().toISOString()
    };
    
    // Cache result
    newsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    logger.error('Failed to fetch news', error);
    throw error;
  }
}

/**
 * Calculate sentiment from article votes
 * @param {Object} votes - Vote object from CryptoPanic
 * @returns {number} Sentiment score (-1 to 1)
 */
function calculateSentiment(votes) {
  if (!votes) return null;
  
  const positive = votes.positive || 0;
  const negative = votes.negative || 0;
  const neutral = votes.neutral || 0;
  const total = positive + negative + neutral;
  
  if (total === 0) return 0;
  
  return (positive - negative) / total;
}

/**
 * Analyze overall sentiment from articles
 * @param {Array} articles - News articles
 * @returns {Object} Sentiment analysis
 */
function analyzeSentiment(articles) {
  const articlesWithSentiment = articles.filter(a => a.sentiment !== null && a.sentiment !== undefined);
  
  if (articlesWithSentiment.length === 0) {
    return {
      score: 0,
      confidence: 0,
      positive: 0,
      negative: 0,
      neutral: 0
    };
  }
  
  const avgSentiment = articlesWithSentiment.reduce((sum, a) => sum + a.sentiment, 0) / articlesWithSentiment.length;
  
  const positive = articlesWithSentiment.filter(a => a.sentiment > 0.2).length;
  const negative = articlesWithSentiment.filter(a => a.sentiment < -0.2).length;
  const neutral = articlesWithSentiment.length - positive - negative;
  
  return {
    score: avgSentiment,
    confidence: articlesWithSentiment.length / articles.length,
    positive,
    negative,
    neutral,
    total: articles.length
  };
}

/**
 * Extract trending topics from articles
 * @param {Array} articles - News articles
 * @returns {Array} Trending topics
 */
function extractTopics(articles) {
  const topics = new Map();
  
  // Keywords to track
  const keywords = [
    'bull', 'bear', 'rally', 'crash', 'pump', 'dump',
    'regulation', 'sec', 'etf', 'adoption', 'institutional',
    'hack', 'security', 'breach', 'upgrade', 'fork',
    'bitcoin', 'ethereum', 'defi', 'nft', 'web3'
  ];
  
  articles.forEach(article => {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        topics.set(keyword, (topics.get(keyword) || 0) + 1);
      }
    });
  });
  
  // Convert to array and sort by frequency
  return Array.from(topics.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Search news by keywords
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Matching articles
 */
export async function searchNews(query, options = {}) {
  try {
    const apiKey = process.env.NEWSAPI_KEY;
    
    if (!apiKey) {
      logger.warn('NewsAPI key not configured');
      return [];
    }
    
    const params = {
      q: query,
      apiKey,
      language: 'en',
      sortBy: options.sortBy || 'publishedAt',
      pageSize: options.limit || 20
    };
    
    if (options.from) {
      params.from = options.from;
    }
    
    if (options.to) {
      params.to = options.to;
    }
    
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params,
      timeout: 10000
    });
    
    return response.data.articles || [];
    
  } catch (error) {
    logger.error('Failed to search news', error);
    return [];
  }
}

/**
 * Clear news cache
 */
export function clearCache() {
  newsCache.clear();
  logger.info('News cache cleared');
}

export default {
  fetchNews,
  searchNews,
  clearCache
};
