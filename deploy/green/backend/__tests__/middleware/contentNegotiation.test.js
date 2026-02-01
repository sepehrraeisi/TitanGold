/**
 * Unit Tests for Content Negotiation Middleware (API-005)
 * Tests JSON and CSV export formats for agent results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { contentNegotiation, toCSV } from '../../middleware/contentNegotiation.js';

describe('Content Negotiation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      get: vi.fn(),
      params: { id: 'agent-1' }
    };
    
    res = {
      json: vi.fn(),
      send: vi.fn(),
      set: vi.fn()
    };
    
    next = vi.fn();
  });

  describe('Format Detection', () => {
    it('should default to JSON format when no Accept header', () => {
      req.get.mockReturnValue(null);
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      expect(req.responseFormat).toBe('json');
      expect(next).toHaveBeenCalled();
    });

    it('should detect JSON format from Accept: application/json', () => {
      req.get.mockReturnValue('application/json');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      expect(req.responseFormat).toBe('json');
    });

    it('should detect CSV format from Accept: text/csv', () => {
      req.get.mockReturnValue('text/csv');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      expect(req.responseFormat).toBe('csv');
    });

    it('should detect CSV format from Accept: application/csv', () => {
      req.get.mockReturnValue('application/csv');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      expect(req.responseFormat).toBe('csv');
    });

    it('should handle Accept: */* as JSON', () => {
      req.get.mockReturnValue('*/*');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      expect(req.responseFormat).toBe('json');
    });

    it('should ignore unsupported formats', () => {
      req.get.mockReturnValue('text/xml');
      
      const middleware = contentNegotiation(['json']);
      middleware(req, res, next);
      
      expect(req.responseFormat).toBe('json');
    });
  });

  describe('JSON Response', () => {
    it('should return JSON normally when format is json', () => {
      req.get.mockReturnValue('application/json');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      const data = { signal: 'BUY', confidence: 85 };
      
      // Store original json function to verify it's called
      const originalJson = res.json;
      res.json(data);
      
      // Should not set CSV headers
      expect(res.set).not.toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      // Should not call send (which is used for CSV)
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  describe('CSV Response', () => {
    it('should convert to CSV when format is csv', () => {
      req.get.mockReturnValue('text/csv');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      const data = {
        agent_key: 'technical',
        signal: 'BUY',
        confidence: 85,
        symbol: 'BTCUSDT',
        timestamp: '2024-01-01T00:00:00Z'
      };
      
      res.json(data);
      
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.set).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="agent-result-'));
      expect(res.send).toHaveBeenCalled();
      
      const csvOutput = res.send.mock.calls[0][0];
      expect(csvOutput).toContain('# TitanGold Agent Analysis Export');
      expect(csvOutput).toContain('Signal,"BUY"');
      expect(csvOutput).toContain('Confidence,85');
    });

    it('should handle agent result with indicators in CSV', () => {
      req.get.mockReturnValue('text/csv');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      const data = {
        agent_key: 'technical',
        signal: 'BUY',
        confidence: 85,
        symbol: 'BTCUSDT',
        indicators: [
          { indicatorId: 'RSI', value: 65, signal: 'buy', weight: 70 },
          { indicatorId: 'MACD', value: 0.5, signal: 'buy', weight: 80 }
        ],
        timestamp: '2024-01-01T00:00:00Z'
      };
      
      res.json(data);
      
      const csvOutput = res.send.mock.calls[0][0];
      expect(csvOutput).toContain('## Indicators');
      expect(csvOutput).toContain('RSI,65,"buy",70');
      expect(csvOutput).toContain('MACD,0.5,"buy",80');
    });

    it('should handle arbitrage opportunities in CSV', () => {
      req.get.mockReturnValue('text/csv');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      const data = {
        agent_key: 'arbitrage',
        opportunities: [
          {
            buyExchange: 'Binance',
            sellExchange: 'Coinbase',
            profitBps: 15,
            volumeUsdt: 10000,
            buyPrice: 50000,
            sellPrice: 50075,
            type: 'spot'
          }
        ],
        timestamp: '2024-01-01T00:00:00Z'
      };
      
      res.json(data);
      
      const csvOutput = res.send.mock.calls[0][0];
      expect(csvOutput).toContain('## Arbitrage Opportunities');
      expect(csvOutput).toContain('Binance→Coinbase');
      expect(csvOutput).toContain('15');
      expect(csvOutput).toContain('10000');
    });

    it('should handle fundamental scores in CSV', () => {
      req.get.mockReturnValue('text/csv');
      
      const middleware = contentNegotiation(['json', 'csv']);
      middleware(req, res, next);
      
      const data = {
        agent_key: 'fundamental',
        score: {
          total: 75,
          macro: 80,
          funding: 70,
          onchain: 75,
          news: 72
        },
        timestamp: '2024-01-01T00:00:00Z'
      };
      
      res.json(data);
      
      const csvOutput = res.send.mock.calls[0][0];
      expect(csvOutput).toContain('## Fundamental Scores');
      expect(csvOutput).toContain('"total",75');
      expect(csvOutput).toContain('"macro",80');
    });
  });

  describe('CSV Conversion Helpers', () => {
    it('should convert array of objects to CSV', () => {
      const data = [
        { id: 1, name: 'Agent 1', accuracy: 85 },
        { id: 2, name: 'Agent 2', accuracy: 90 }
      ];
      
      const csv = toCSV(data, 'test');
      
      expect(csv).toContain('id,name,accuracy');
      expect(csv).toContain('"1","Agent 1","85"');
      expect(csv).toContain('"2","Agent 2","90"');
    });

    it('should handle empty array', () => {
      const csv = toCSV([], 'test');
      expect(csv).toBe('No data available\n');
    });

    it('should handle null values', () => {
      const data = [
        { id: 1, name: 'Agent 1', value: null },
        { id: 2, name: null, value: 100 }
      ];
      
      const csv = toCSV(data, 'test');
      
      expect(csv).toContain('""'); // Empty string for null
    });

    it('should handle nested objects', () => {
      const data = [
        { id: 1, config: { threshold: 0.5, enabled: true } }
      ];
      
      const csv = toCSV(data, 'test');
      
      expect(csv).toContain('config');
      expect(csv).toContain('threshold'); // JSON stringified
    });

    it('should escape quotes in values', () => {
      const data = [
        { id: 1, message: 'This "quote" needs escaping' }
      ];
      
      const csv = toCSV(data, 'test');
      
      expect(csv).toContain('This ""quote"" needs escaping');
    });
  });

  describe('Agent Result CSV Format', () => {
    it('should include summary section', () => {
      const result = {
        agent_key: 'technical',
        signal: 'BUY',
        confidence: 85,
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: '2024-01-01T00:00:00Z'
      };
      
      const csv = toCSV(result, 'technical');
      
      expect(csv).toContain('## Summary');
      expect(csv).toContain('Signal,"BUY"');
      expect(csv).toContain('Confidence,85');
    });

    it('should include indicators section when present', () => {
      const result = {
        signal: 'BUY',
        indicators: [
          { indicatorId: 'RSI', value: 65, signal: 'buy', weight: 70 }
        ]
      };
      
      const csv = toCSV(result, 'technical');
      
      expect(csv).toContain('## Indicators');
      expect(csv).toContain('Indicator ID,Value,Signal,Weight');
      expect(csv).toContain('RSI,65,"buy",70');
    });

    it('should include reasoning section when present', () => {
      const result = {
        signal: 'BUY',
        reasoning: 'Strong bullish momentum with high volume'
      };
      
      const csv = toCSV(result, 'technical');
      
      expect(csv).toContain('## Reasoning');
      expect(csv).toContain('Strong bullish momentum');
    });

    it('should include metadata section when present', () => {
      const result = {
        signal: 'BUY',
        _meta: {
          source: 'real',
          version: '1.0.0',
          executionTime: 250
        }
      };
      
      const csv = toCSV(result, 'technical');
      
      expect(csv).toContain('## Metadata');
      expect(csv).toContain('"source","real"');
      expect(csv).toContain('"version","1.0.0"');
    });

    it('should handle missing optional fields gracefully', () => {
      const result = {
        signal: 'NEUTRAL'
      };
      
      const csv = toCSV(result, 'test');
      
      expect(csv).toContain('Signal,"NEUTRAL"');
      expect(csv).toContain('Confidence,0'); // Default value
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', () => {
      const csv = toCSV(null, 'test');
      expect(csv).toBe('No data available\n');
    });

    it('should handle undefined data', () => {
      const csv = toCSV(undefined, 'test');
      expect(csv).toBe('No data available\n');
    });

    it('should handle conversion errors', () => {
      // Create circular reference
      const circular = { a: 1 };
      circular.self = circular;
      
      const csv = toCSV(circular, 'test');
      
      // Should not throw, but handle gracefully
      expect(csv).toBeDefined();
    });
  });
});
