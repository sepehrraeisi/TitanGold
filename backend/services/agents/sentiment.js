/**
 * Sentiment Analysis Agent
 * 
 * Analyzes market sentiment from multiple sources:
 * - Twitter/X (social media sentiment)
 * - Reddit (community discussions)
 * - NewsAPI/CryptoPanic (news sentiment)
 * 
 * Returns aggregate sentiment score (-1 to +1), trending topics,
 * and sentiment trends over time.
 * 
 * @module agents/sentiment
 * @version 1.0.0
 * @date 2026-01-07
 */

import { logger } from '../../services/logger.js';
import sentimentAPI from '../sentimentAPI.js';

/**
 * Run sentiment analysis for a trading symbol
 * 
 * @param {object} params - Analysis parameters
 * @param {number} params.userId - User ID
 * @param {string} params.symbol - Trading symbol (e.g., BTC/USDT, ETH/USDT)
 * @param {string} params.timeframe - Timeframe for analysis (e.g., 1h, 1d, 7d)
 * @param {object} params.config - Agent configuration
 * @returns {Promise<object>} - Sentiment analysis results
 */
export async function run({ userId, symbol, timeframe, config }) {
  const startTime = Date.now();
  
  try {
    logger.info('Sentiment Analysis Agent starting', { 
      userId, 
      symbol, 
      timeframe,
      agent: 'sentiment'
    });

    // Extract configuration options
    const options = {
      timeframe: timeframe || '24h',
      weights: config?.weights || {
        twitter: 0.3,
        reddit: 0.35,
        news: 0.35
      },
      includeTopics: config?.includeTopics !== false,
      includeTrends: config?.includeTrends !== false
    };

    // Fetch aggregate sentiment from all sources
    const aggregateData = await sentimentAPI.aggregateSentiment(symbol, options);
    
    // Fetch trending topics if requested
    let trendingTopics = null;
    if (options.includeTopics) {
      trendingTopics = await sentimentAPI.detectTrendingTopics(symbol, options);
    }

    // Fetch sentiment trends if requested
    let sentimentTrends = null;
    if (options.includeTrends) {
      sentimentTrends = await sentimentAPI.getSentimentTrends(symbol, options);
    }

    // Calculate confidence based on data availability
    const sourcesAvailable = Object.values(aggregateData.sources)
      .filter(s => !s.error && s.count > 0).length;
    const confidence = Math.min(0.95, 0.5 + (sourcesAvailable / 3) * 0.45);

    // Determine sentiment label
    const sentimentScore = aggregateData.aggregate_sentiment;
    let sentimentLabel = 'neutral';
    if (sentimentScore > 0.3) sentimentLabel = 'very_bullish';
    else if (sentimentScore > 0.1) sentimentLabel = 'bullish';
    else if (sentimentScore < -0.3) sentimentLabel = 'very_bearish';
    else if (sentimentScore < -0.1) sentimentLabel = 'bearish';

    // Generate recommendation based on sentiment
    const recommendation = generateRecommendation(
      sentimentScore,
      sentimentTrends,
      trendingTopics
    );

    const executionTime = Date.now() - startTime;

    const result = {
      agent_key: 'sentiment',
      symbol,
      timestamp: new Date().toISOString(),
      confidence,
      result: {
        aggregate_sentiment: sentimentScore,
        sentiment_label: sentimentLabel,
        sources: {
          twitter: {
            sentiment: aggregateData.sources.twitter.sentiment,
            count: aggregateData.sources.twitter.count || 0,
            weight: options.weights.twitter,
            mock: aggregateData.sources.twitter.mock || false
          },
          reddit: {
            sentiment: aggregateData.sources.reddit.sentiment,
            count: aggregateData.sources.reddit.count || 0,
            weight: options.weights.reddit,
            mock: aggregateData.sources.reddit.mock || false
          },
          news: {
            sentiment: aggregateData.sources.news.sentiment,
            count: aggregateData.sources.news.count || 0,
            weight: options.weights.news,
            mock: aggregateData.sources.news.mock || false
          }
        },
        trending_topics: trendingTopics?.trending_topics || [],
        sentiment_trends: sentimentTrends ? {
          last_24h: sentimentTrends.last_24h,
          last_7d: sentimentTrends.last_7d,
          trend: sentimentTrends.trend,
          change: sentimentTrends.change
        } : null,
        recommendation
      },
      meta: {
        source: 'realtime',
        version: '1.0.0',
        execution_time_ms: executionTime,
        sources_available: sourcesAvailable,
        rate_limits: sentimentAPI.getRateLimitStatus()
      }
    };

    logger.info('Sentiment Analysis Agent completed', {
      userId,
      symbol,
      sentiment: sentimentScore,
      confidence,
      executionTime,
      agent: 'sentiment'
    });

    return result;

  } catch (error) {
    logger.error('Sentiment Analysis Agent error', {
      userId,
      symbol,
      error: error.message,
      stack: error.stack,
      agent: 'sentiment'
    });

    // Return error response
    return {
      agent_key: 'sentiment',
      symbol,
      timestamp: new Date().toISOString(),
      confidence: 0,
      error: error.message,
      result: {
        aggregate_sentiment: 0,
        sentiment_label: 'unknown',
        sources: {
          twitter: { sentiment: 0, count: 0, weight: 0.3 },
          reddit: { sentiment: 0, count: 0, weight: 0.35 },
          news: { sentiment: 0, count: 0, weight: 0.35 }
        },
        trending_topics: [],
        sentiment_trends: null,
        recommendation: 'Unable to generate recommendation due to error'
      },
      meta: {
        source: 'error',
        version: '1.0.0',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

/**
 * Generate trading recommendation based on sentiment analysis
 * 
 * @param {number} sentimentScore - Aggregate sentiment score
 * @param {object} trends - Sentiment trends data
 * @param {object} topics - Trending topics data
 * @returns {string} - Trading recommendation
 */
function generateRecommendation(sentimentScore, trends, topics) {
  const recommendations = [];

  // Base recommendation on sentiment score
  if (sentimentScore > 0.4) {
    recommendations.push('Strong positive sentiment detected');
    recommendations.push('Consider long positions with appropriate risk management');
  } else if (sentimentScore > 0.2) {
    recommendations.push('Moderately positive sentiment');
    recommendations.push('Favorable conditions for long positions');
  } else if (sentimentScore > -0.2) {
    recommendations.push('Neutral sentiment');
    recommendations.push('Wait for clearer signals before entering positions');
  } else if (sentimentScore > -0.4) {
    recommendations.push('Moderately negative sentiment');
    recommendations.push('Exercise caution, consider reducing exposure');
  } else {
    recommendations.push('Strong negative sentiment detected');
    recommendations.push('Consider defensive positioning or short opportunities');
  }

  // Add trend-based recommendations
  if (trends) {
    if (trends.trend === 'bullish' && trends.change > 0.2) {
      recommendations.push('Sentiment is rapidly improving - potential momentum opportunity');
    } else if (trends.trend === 'bearish' && trends.change < -0.2) {
      recommendations.push('Sentiment is deteriorating quickly - risk of further decline');
    } else if (trends.trend === 'neutral') {
      recommendations.push('Sentiment is stable - range-bound conditions likely');
    }
  }

  // Add topic-based insights
  if (topics && topics.trending_topics?.length > 0) {
    const topKeywords = topics.trending_topics.slice(0, 3).map(t => t.keyword);
    recommendations.push(`Trending: ${topKeywords.join(', ')}`);
  }

  return recommendations.join('. ');
}

/**
 * Get agent details and metrics
 * 
 * @param {object} params - Parameters
 * @param {number} params.userId - User ID
 * @returns {Promise<object>} - Agent details
 */
export async function getDetails({ userId }) {
  try {
    // In production, fetch real metrics from database
    // For now, return static details
    
    return {
      agent_key: 'sentiment',
      name: 'Sentiment Analysis Agent',
      description: 'Analyzes market sentiment from Twitter, Reddit, and news sources to gauge market mood and detect trending topics',
      status: 'active',
      version: '1.0.0',
      capabilities: [
        'Social media sentiment analysis (Twitter/X)',
        'Community discussion analysis (Reddit)',
        'News sentiment analysis (CryptoPanic, NewsAPI)',
        'Aggregate sentiment scoring (-1 to +1)',
        'Trending topic detection',
        'Sentiment trend analysis (24h, 7d)',
        'Rate limit handling',
        'Multi-source data fusion'
      ],
      configuration: {
        sources: ['twitter', 'reddit', 'news'],
        default_weights: {
          twitter: 0.3,
          reddit: 0.35,
          news: 0.35
        },
        timeframes: ['1h', '24h', '7d'],
        cache_ttl: '5 minutes'
      },
      rate_limits: sentimentAPI.getRateLimitStatus(),
      lastRun: null,
      metrics: {
        totalRuns: 0,
        avgExecutionTime: 0,
        successRate: 0
      }
    };
  } catch (error) {
    logger.error('Error getting sentiment agent details', {
      userId,
      error: error.message
    });

    return {
      agent_key: 'sentiment',
      name: 'Sentiment Analysis Agent',
      description: 'Sentiment analysis agent',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get default configuration for the agent
 * 
 * @returns {object} - Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    threshold: 0.6,
    weights: {
      twitter: 0.3,
      reddit: 0.35,
      news: 0.35
    },
    includeTopics: true,
    includeTrends: true,
    sources: {
      twitter: {
        enabled: true,
        maxResults: 100
      },
      reddit: {
        enabled: true,
        subreddits: ['CryptoCurrency', 'Bitcoin', 'CryptoMarkets', 'ethtrader'],
        limit: 100
      },
      news: {
        enabled: true,
        source: 'cryptopanic' // or 'newsapi'
      }
    }
  };
}

export default { run, getDetails, defaultConfig };
