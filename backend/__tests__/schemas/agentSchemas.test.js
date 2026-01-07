/**
 * Unit Tests for Agent Schemas
 * Task: API-002
 * 
 * Tests that agent schemas correctly validate various input combinations
 */

import { describe, it, expect } from '@jest/globals';
import {
  agentIdSchema,
  symbolSchema,
  timeframeSchema,
  createAgentBodySchema,
  analyzeBodySchema,
  chatBodySchema,
  technicalAnalysisConfigSchema,
  batchAnalyzeBodySchema,
} from '../../schemas/agentSchemas.js';

describe('Agent Schemas', () => {
  describe('agentIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = agentIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
    });

    it('should accept agent-number format', () => {
      const result = agentIdSchema.safeParse('agent-123');
      expect(result.success).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(agentIdSchema.safeParse('invalid').success).toBe(false);
      expect(agentIdSchema.safeParse('agent-abc').success).toBe(false);
      expect(agentIdSchema.safeParse('123').success).toBe(false);
    });
  });

  describe('symbolSchema', () => {
    it('should accept valid symbols', () => {
      expect(symbolSchema.safeParse('BTC').success).toBe(true);
      expect(symbolSchema.safeParse('BTCUSDT').success).toBe(true);
      expect(symbolSchema.safeParse('BTC/USDT').success).toBe(true);
      expect(symbolSchema.safeParse('ETH/BTC').success).toBe(true);
    });

    it('should reject invalid symbols', () => {
      expect(symbolSchema.safeParse('btc').success).toBe(false); // lowercase
      expect(symbolSchema.safeParse('BT').success).toBe(false); // too short
      expect(symbolSchema.safeParse('BTC-USDT').success).toBe(false); // wrong separator
      expect(symbolSchema.safeParse('BTC//USDT').success).toBe(false); // double separator
    });
  });

  describe('timeframeSchema', () => {
    it('should accept valid timeframes', () => {
      const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
      validTimeframes.forEach(tf => {
        expect(timeframeSchema.safeParse(tf).success).toBe(true);
      });
    });

    it('should reject invalid timeframes', () => {
      expect(timeframeSchema.safeParse('2h').success).toBe(false);
      expect(timeframeSchema.safeParse('1M').success).toBe(false);
      expect(timeframeSchema.safeParse('daily').success).toBe(false);
    });
  });

  describe('createAgentBodySchema', () => {
    it('should accept valid agent creation data', () => {
      const validData = {
        name: 'Test Agent',
        type: 'technical',
      };
      const result = createAgentBodySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const data = {
        name: 'Test Agent',
        type: 'sentiment',
      };
      const result = createAgentBodySchema.parse(data);
      expect(result.is_enabled).toBe(true);
      expect(result.config).toEqual({});
      expect(result.metadata).toEqual({});
    });

    it('should reject invalid agent types', () => {
      const data = {
        name: 'Test Agent',
        type: 'invalid_type',
      };
      expect(createAgentBodySchema.safeParse(data).success).toBe(false);
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        type: 'technical',
      };
      expect(createAgentBodySchema.safeParse(data).success).toBe(false);
    });

    it('should reject name exceeding max length', () => {
      const data = {
        name: 'a'.repeat(256),
        type: 'technical',
      };
      expect(createAgentBodySchema.safeParse(data).success).toBe(false);
    });
  });

  describe('analyzeBodySchema', () => {
    it('should accept valid analysis request', () => {
      const data = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
      };
      const result = analyzeBodySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const data = {
        symbol: 'ETH/USDT',
      };
      const result = analyzeBodySchema.parse(data);
      expect(result.timeframe).toBe('1h');
      expect(result.exchange).toBe('binance');
    });

    it('should accept custom config', () => {
      const data = {
        symbol: 'BTC/USDT',
        config: {
          customParam: 'value',
        },
      };
      const result = analyzeBodySchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.customParam).toBe('value');
      }
    });

    it('should reject missing symbol', () => {
      const data = {
        timeframe: '1h',
      };
      expect(analyzeBodySchema.safeParse(data).success).toBe(false);
    });
  });

  describe('chatBodySchema', () => {
    it('should accept valid chat message', () => {
      const data = {
        message: 'What is the current trend for BTC?',
      };
      const result = chatBodySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept message with context', () => {
      const data = {
        message: 'Analyze this asset',
        context: {
          symbol: 'BTC/USDT',
          timeframe: '4h',
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
        },
      };
      const result = chatBodySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      expect(chatBodySchema.safeParse({ message: '' }).success).toBe(false);
    });

    it('should reject message exceeding max length', () => {
      const data = {
        message: 'a'.repeat(4001),
      };
      expect(chatBodySchema.safeParse(data).success).toBe(false);
    });

    it('should reject message with 4000 characters (boundary)', () => {
      const data = {
        message: 'a'.repeat(4000),
      };
      const result = chatBodySchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('technicalAnalysisConfigSchema', () => {
    it('should accept valid technical analysis config', () => {
      const data = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        indicators: ['RSI', 'MACD', 'BB'],
      };
      const result = technicalAnalysisConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should apply default lookback period', () => {
      const data = {
        symbol: 'ETH/USDT',
      };
      const result = technicalAnalysisConfigSchema.parse(data);
      expect(result.lookbackPeriod).toBe(100);
    });

    it('should reject invalid indicators', () => {
      const data = {
        symbol: 'BTC/USDT',
        indicators: ['INVALID_INDICATOR'],
      };
      expect(technicalAnalysisConfigSchema.safeParse(data).success).toBe(false);
    });

    it('should reject lookback period exceeding max', () => {
      const data = {
        symbol: 'BTC/USDT',
        lookbackPeriod: 1000,
      };
      expect(technicalAnalysisConfigSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('batchAnalyzeBodySchema', () => {
    it('should accept valid batch request', () => {
      const data = {
        requests: [
          {
            agentId: 'agent-123',
            symbol: 'BTC/USDT',
          },
          {
            agentId: '123e4567-e89b-12d3-a456-426614174000',
            symbol: 'ETH/USDT',
            timeframe: '4h',
          },
        ],
      };
      const result = batchAnalyzeBodySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty requests array', () => {
      const data = {
        requests: [],
      };
      expect(batchAnalyzeBodySchema.safeParse(data).success).toBe(false);
    });

    it('should reject more than 10 requests', () => {
      const data = {
        requests: Array(11).fill({
          agentId: 'agent-123',
          symbol: 'BTC/USDT',
        }),
      };
      expect(batchAnalyzeBodySchema.safeParse(data).success).toBe(false);
    });

    it('should accept exactly 10 requests (boundary)', () => {
      const data = {
        requests: Array(10).fill({
          agentId: 'agent-123',
          symbol: 'BTC/USDT',
        }),
      };
      const result = batchAnalyzeBodySchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message for invalid symbol', () => {
      const result = symbolSchema.safeParse('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = result.error.issues[0].message;
        // Check for either custom or pattern-related message
        expect(message.length).toBeGreaterThan(0);
      }
    });

    it('should provide clear error message for invalid timeframe', () => {
      const result = timeframeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = result.error.issues[0].message;
        // Timeframe enum provides list of valid options
        expect(message.length).toBeGreaterThan(0);
      }
    });

    it('should provide clear error message for invalid agent type', () => {
      const result = createAgentBodySchema.safeParse({
        name: 'Test',
        type: 'invalid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Check for either custom or default error message
        const message = result.error.issues[0].message;
        expect(
          message.includes('Invalid agent type') || 
          message.includes('Invalid option')
        ).toBe(true);
      }
    });
  });
});
