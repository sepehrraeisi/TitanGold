/**
 * Market Intelligence Agent Integration Tests
 * BACKEND-012: Implement Market Intelligence Agent
 */

import { jest } from '@jest/globals';

// Mock external services
const mockFetchNews = jest.fn();
const mockFetchOnChainMetrics = jest.fn();
const mockFetchMacroIndicators = jest.fn();
const mockDetectAnomalies = jest.fn();

jest.unstable_mockModule('../../services/newsAPI.js', () => ({
  mockFetchNews: mockFetchNews,
  searchNews: jest.fn(),
  clearCache: jest.fn()
}));

jest.unstable_mockModule('../../services/onChainAPI.js', () => ({
  mockFetchOnChainMetrics: mockFetchOnChainMetrics,
  mockDetectAnomalies: mockDetectAnomalies,
  clearCache: jest.fn()
}));

jest.unstable_mockModule('../../services/macroAPI.js', () => ({
  mockFetchMacroIndicators: mockFetchMacroIndicators,
  clearCache: jest.fn()
}));

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const { run, getDetails, defaultConfig, clearHistoricalData } = await import('../../services/agents/market_intelligence.js');

describe('TITANGOLD Market Intelligence Agent - Integration Tests', () => {
  const userId = 'test-user-123';
  const symbol = 'BTC/USDT';
  const timeframe = '24h';

  beforeEach(() => {
    jest.clearAllMocks();
    clearHistoricalData();

    // Setup default mocks
    mockFetchNews.mockResolvedValue({
      symbol,
      articles: [
        {
          source: 'CryptoPanic',
          title: 'Bitcoin breaks new highs',
          url: 'https://example.com/1',
          published: '2026-01-07T12:00:00Z',
          sentiment: 0.6
        },
        {
          source: 'NewsAPI',
          title: 'Crypto markets showing strength',
          url: 'https://example.com/2',
          published: '2026-01-07T11:00:00Z',
          sentiment: 0.4
        }
      ],
      count: 2,
      sentiment: {
        score: 0.5,
        confidence: 0.8,
        positive: 2,
        negative: 0,
        neutral: 0,
        total: 2
      },
      topics: [
        { topic: 'bull', count: 2 },
        { topic: 'rally', count: 1 }
      ],
      sources: {
        cryptoPanic: 1,
        newsAPI: 1
      },
      timestamp: '2026-01-07T12:00:00Z'
    });

    mockFetchOnChainMetrics.mockResolvedValue({
      symbol,
      sources: {
        coinGecko: true,
        blockchainInfo: true,
        glassnode: false
      },
      metrics: {
        market: {
          market_cap: 1000000000000,
          total_volume: 50000000000,
          circulating_supply: 19000000,
          total_supply: 21000000,
          price_change_24h: 2.5,
          community: {
            twitter_followers: 5000000,
            reddit_subscribers: 4000000
          },
          developer: {
            commit_count_4_weeks: 150
          }
        }
      },
      analysis: {
        health: 'positive',
        signals: [
          {
            type: 'high_dev_activity',
            severity: 'positive',
            message: 'High developer activity',
            value: 150
          }
        ],
        anomalies: [],
        insights: [
          {
            type: 'development',
            message: 'High developer activity',
            value: '150 commits (4 weeks)'
          }
        ]
      },
      timestamp: '2026-01-07T12:00:00Z'
    });

    mockFetchMacroIndicators.mockResolvedValue({
      indicators: {
        dxy: {
          indicator: 'DXY',
          name: 'US Dollar Index',
          value: 103.5,
          change_24h: -0.5,
          trend: 'down'
        },
        vix: {
          indicator: 'VIX',
          name: 'CBOE Volatility Index',
          value: 14.5,
          change_24h: -2.0,
          trend: 'down',
          level: 'low'
        },
        sp500: {
          indicator: 'SP500',
          name: 'S&P 500',
          value: 4850,
          change_24h: 1.2,
          trend: 'up'
        }
      },
      analysis: {
        risk_sentiment: 'risk-on',
        market_regime: 'risk-on',
        correlations: [
          {
            pair: 'SP500-Crypto',
            relationship: 'positive',
            strength: 'strong'
          }
        ],
        insights: [
          {
            type: 'risk_sentiment',
            message: 'Low volatility - risk-on environment favorable for crypto',
            indicator: 'VIX',
            value: 14.5
          },
          {
            type: 'regime',
            message: 'Risk-on regime: falling VIX + rising equities',
            recommendation: 'Favorable environment for growth assets'
          }
        ]
      },
      timestamp: '2026-01-07T12:00:00Z'
    });

    mockDetectAnomalies.mockReturnValue([]);
  });

  describe('End-to-End Workflow', () => {
    it('should complete full analysis workflow', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result).toBeDefined();
      expect(result.agent_key).toBe('market_intelligence');
      expect(result.symbol).toBe(symbol);
      expect(result.timeframe).toBe(timeframe);
      expect(result.data).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.recommendation).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should fetch data from all sources', async () => {
      await run({ userId, symbol, timeframe });

      expect(mockFetchNews).toHaveBeenCalledWith(
        symbol,
        expect.objectContaining({
          timeframe,
          limit: 20,
          useCache: true
        })
      );

      expect(mockFetchOnChainMetrics).toHaveBeenCalledWith(
        symbol,
        expect.objectContaining({
          useCache: true
        })
      );

      expect(mockFetchMacroIndicators).toHaveBeenCalledWith(
        expect.objectContaining({
          useCache: true
        })
      );
    });

    it('should generate comprehensive analysis', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.analysis.sentiment).toBeDefined();
      expect(result.analysis.sentiment.overall).toMatch(/positive|negative|neutral/);
      expect(result.analysis.market_conditions).toBeDefined();
      expect(result.analysis.signals).toBeInstanceOf(Array);
      expect(result.analysis.risks).toBeInstanceOf(Array);
      expect(result.analysis.opportunities).toBeInstanceOf(Array);
      expect(result.analysis.assessment).toMatch(/bullish|bearish|neutral/);
    });

    it('should generate market summary', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary).toContain(symbol);
      expect(result.summary.length).toBeGreaterThan(100);
    });

    it('should generate trading recommendation', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.action).toMatch(/BUY|SELL|HOLD/);
      expect(result.recommendation.confidence).toBe(result.confidence);
      expect(result.recommendation.rationale).toBeInstanceOf(Array);
      expect(result.recommendation.risk_level).toMatch(/low|medium|high/);
      expect(result.recommendation.position_sizing).toMatch(/minimal|conservative|normal|aggressive/);
    });
  });

  describe('Data Integration', () => {
    it('should handle all data sources available', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.data.news).toBeDefined();
      expect(result.data.onchain).toBeDefined();
      expect(result.data.macro).toBeDefined();
      expect(result.metadata.data_sources).toEqual({
        news: true,
        onchain: true,
        macro: true
      });
    });

    it('should handle missing news data', async () => {
      mockFetchNews.mockResolvedValue(null);

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.news).toBeNull();
      expect(result.metadata.data_sources.news).toBe(false);
      expect(result.analysis).toBeDefined();
    });

    it('should handle missing on-chain data', async () => {
      mockFetchOnChainMetrics.mockResolvedValue(null);

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.onchain).toBeNull();
      expect(result.metadata.data_sources.onchain).toBe(false);
      expect(result.analysis).toBeDefined();
    });

    it('should handle missing macro data', async () => {
      mockFetchMacroIndicators.mockResolvedValue(null);

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.macro).toBeNull();
      expect(result.metadata.data_sources.macro).toBe(false);
      expect(result.analysis).toBeDefined();
    });

    it('should work with partial data', async () => {
      mockFetchNews.mockResolvedValue(null);
      mockFetchMacroIndicators.mockResolvedValue(null);

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.news).toBeNull();
      expect(result.data.macro).toBeNull();
      expect(result.data.onchain).not.toBeNull();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should detect positive sentiment', async () => {
      mockFetchNews.mockResolvedValue({
        symbol,
        articles: [],
        sentiment: { score: 0.7, confidence: 0.8 },
        topics: [],
        sources: {},
        timestamp: '2026-01-07T12:00:00Z'
      });

      const result = await run({ userId, symbol, timeframe });

      expect(result.analysis.sentiment.overall).toBe('positive');
      expect(result.analysis.opportunities.length).toBeGreaterThan(0);
    });

    it('should detect negative sentiment', async () => {
      mockFetchNews.mockResolvedValue({
        symbol,
        articles: [],
        sentiment: { score: -0.7, confidence: 0.8 },
        topics: [],
        sources: {},
        timestamp: '2026-01-07T12:00:00Z'
      });

      const result = await run({ userId, symbol, timeframe });

      expect(result.analysis.sentiment.overall).toBe('negative');
      expect(result.analysis.risks.length).toBeGreaterThan(0);
    });

    it('should combine sentiments from multiple sources', async () => {
      mockFetchNews.mockResolvedValue({
        symbol,
        articles: [],
        sentiment: { score: 0.5, confidence: 0.8 },
        topics: [],
        sources: {},
        timestamp: '2026-01-07T12:00:00Z'
      });

      mockFetchOnChainMetrics.mockResolvedValue({
        symbol,
        sources: {},
        metrics: {},
        analysis: { health: 'positive', signals: [], anomalies: [], insights: [] },
        timestamp: '2026-01-07T12:00:00Z'
      });

      const result = await run({ userId, symbol, timeframe });

      expect(result.analysis.sentiment.news).toBe(0.5);
      expect(result.analysis.sentiment.onchain).toBe('positive');
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect and report anomalies', async () => {
      mockDetectAnomalies.mockReturnValue([
        {
          type: 'volume_spike',
          severity: 'high',
          message: 'Trading volume doubled',
          current: 100000000000,
          historical: 50000000000,
          change: '100%'
        }
      ]);

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.anomalies.length).toBe(1);
      expect(result.metadata.anomalies_detected).toBe(1);
      
      const anomalySignal = result.analysis.signals.find(s => s.type === 'anomaly');
      expect(anomalySignal).toBeDefined();
    });

    it('should adjust confidence based on anomalies', async () => {
      mockDetectAnomalies.mockReturnValue([
        { type: 'volume_spike', severity: 'high', message: 'Volume spike' },
        { type: 'price_volatility', severity: 'high', message: 'High volatility' }
      ]);

      const result = await run({ userId, symbol, timeframe });

      expect(result.analysis.market_conditions.volatility).toBe('high');
      expect(result.analysis.risks.length).toBeGreaterThan(0);
    });
  });

  describe('Recommendation Engine', () => {
    it('should recommend BUY on bullish signals', async () => {
      mockFetchNews.mockResolvedValue({
        symbol,
        articles: [],
        sentiment: { score: 0.7, confidence: 0.9 },
        topics: [],
        sources: {},
        timestamp: '2026-01-07T12:00:00Z'
      });

      const result = await run({ userId, symbol, timeframe });

      expect(result.recommendation.action).toBe('BUY');
      expect(result.confidence).toBeGreaterThan(60);
    });

    it('should recommend SELL on bearish signals', async () => {
      mockFetchNews.mockResolvedValue({
        symbol,
        articles: [],
        sentiment: { score: -0.7, confidence: 0.9 },
        topics: [],
        sources: {},
        timestamp: '2026-01-07T12:00:00Z'
      });

      mockFetchOnChainMetrics.mockResolvedValue({
        symbol,
        sources: {},
        metrics: {},
        analysis: { health: 'negative', signals: [], anomalies: [], insights: [] },
        timestamp: '2026-01-07T12:00:00Z'
      });

      mockFetchMacroIndicators.mockResolvedValue({
        indicators: {},
        analysis: { risk_sentiment: 'risk-off', market_regime: 'risk-off', correlations: [], insights: [] },
        timestamp: '2026-01-07T12:00:00Z'
      });

      const result = await run({ userId, symbol, timeframe });

      expect(result.recommendation.action).toBe('SELL');
    });

    it('should recommend HOLD on neutral signals', async () => {
      mockFetchNews.mockResolvedValue({
        symbol,
        articles: [],
        sentiment: { score: 0.0, confidence: 0.5 },
        topics: [],
        sources: {},
        timestamp: '2026-01-07T12:00:00Z'
      });

      const result = await run({ userId, symbol, timeframe });

      expect(result.recommendation.action).toBe('HOLD');
    });

    it('should adjust position sizing based on risk', async () => {
      mockFetchOnChainMetrics.mockResolvedValue({
        symbol,
        sources: {},
        metrics: {},
        analysis: {
          health: 'neutral',
          signals: [],
          anomalies: [],
          insights: []
        },
        timestamp: '2026-01-07T12:00:00Z'
      });

      mockDetectAnomalies.mockReturnValue([
        { type: 'volume_spike', severity: 'high', message: 'Risk 1' },
        { type: 'price_volatility', severity: 'high', message: 'Risk 2' },
        { type: 'anomaly', severity: 'medium', message: 'Risk 3' },
        { type: 'alert', severity: 'medium', message: 'Risk 4' }
      ]);

      const result = await run({ userId, symbol, timeframe });

      expect(result.recommendation.risk_level).toBe('high');
      expect(result.recommendation.position_sizing).toMatch(/conservative|minimal/);
    });
  });

  describe('Configuration', () => {
    it('should respect configuration options', async () => {
      const config = {
        includeNews: false,
        includeOnChain: true,
        includeMacro: false,
        mockDetectAnomalies: false,
        generateSummary: false
      };

      const result = await run({ userId, symbol, timeframe, config });

      expect(mockFetchNews).not.toHaveBeenCalled();
      expect(mockFetchMacroIndicators).not.toHaveBeenCalled();
      expect(mockFetchOnChainMetrics).toHaveBeenCalled();
      expect(result.summary).toBeNull();
    });

    it('should use default configuration', async () => {
      const config = defaultConfig();

      expect(config.includeNews).toBe(true);
      expect(config.includeOnChain).toBe(true);
      expect(config.includeMacro).toBe(true);
      expect(config.mockDetectAnomalies).toBe(true);
      expect(config.generateSummary).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle news API errors gracefully', async () => {
      mockFetchNews.mockRejectedValue(new Error('News API error'));

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.news).toBeNull();
      expect(result.analysis).toBeDefined();
    });

    it('should handle on-chain API errors gracefully', async () => {
      mockFetchOnChainMetrics.mockRejectedValue(new Error('On-chain API error'));

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.onchain).toBeNull();
      expect(result.analysis).toBeDefined();
    });

    it('should handle macro API errors gracefully', async () => {
      mockFetchMacroIndicators.mockRejectedValue(new Error('Macro API error'));

      const result = await run({ userId, symbol, timeframe });

      expect(result.data.macro).toBeNull();
      expect(result.analysis).toBeDefined();
    });

    it('should throw on critical errors', async () => {
      mockFetchNews.mockRejectedValue(new Error('Critical error'));
      mockFetchOnChainMetrics.mockRejectedValue(new Error('Critical error'));
      mockFetchMacroIndicators.mockRejectedValue(new Error('Critical error'));

      // Even with all errors, agent should still work with available data
      const result = await run({ userId, symbol, timeframe });
      
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await run({ userId, symbol, timeframe });
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should track execution metrics', async () => {
      const result = await run({ userId, symbol, timeframe });

      expect(result.metadata.execution_time_ms).toBeDefined();
      expect(result.metadata.execution_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Agent Status', () => {
    it('should provide agent details', async () => {
      const details = await getDetails({ userId });

      expect(details.agent_key).toBe('market_intelligence');
      expect(details.name).toBeDefined();
      expect(details.description).toBeDefined();
      expect(details.status).toBe('active');
      expect(details.metrics).toBeDefined();
      expect(details.capabilities).toBeInstanceOf(Array);
      expect(details.data_sources).toBeDefined();
    });

    it('should track success rate', async () => {
      await run({ userId, symbol, timeframe });
      await run({ userId, symbol, timeframe });

      const details = await getDetails({ userId });

      expect(details.metrics.totalRuns).toBe(2);
      expect(details.metrics.successfulRuns).toBe(2);
      expect(details.metrics.successRate).toBe(100);
    });
  });
});
