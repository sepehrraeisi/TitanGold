import agentRegistry from './services/agents/registry.js';
import { logger } from './services/logger.js';

// Test transformer
async function testTransform() {
  try {
    // Run technical agent
    const result = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      config: {}
    });

    logger.info('📊 Raw Result from Registry:');
    logger.info(JSON.stringify(result, null, 2));

    // Simulate transformer
    const { symbol, timeframe, confidence, signal, indicators, timestamp, _meta } = result;
    
    const uiResult = {
      timestamp: timestamp || new Date().toISOString(),
      symbol: symbol || 'UNKNOWN',
      timeframe: timeframe || '1h',
      signal: (signal || 'NEUTRAL').toLowerCase(),
      confidence: typeof confidence === 'number' ? confidence : 0.5,
      indicators: [],
      reasoning: `technical analysis complete (source: ${_meta?.source || 'unknown'})`,
      _meta: _meta || { source: 'mock', version: '1.0.0' }
    };

    // Transform indicators object → array
    if (indicators && typeof indicators === 'object' && !Array.isArray(indicators)) {
      const indicatorArray = [];
      
      Object.entries(indicators).forEach(([key, value]) => {
        if (typeof value === 'number') {
          indicatorArray.push({
            indicatorId: key.toUpperCase(),
            value: value,
            signal: value > 50 ? 'buy' : value < 50 ? 'sell' : 'neutral',
            weight: 50
          });
        } else if (typeof value === 'object' && value !== null) {
          indicatorArray.push({
            indicatorId: key.toUpperCase(),
            value: value.value || 0,
            signal: value.signal || 'neutral',
            weight: value.weight || 50
          });
        } else if (typeof value === 'string') {
          indicatorArray.push({
            indicatorId: key.toUpperCase(),
            value: value === 'bullish' ? 70 : value === 'bearish' ? 30 : 50,
            signal: value === 'bullish' ? 'buy' : value === 'bearish' ? 'sell' : 'neutral',
            weight: 60
          });
        }
      });
      
      uiResult.indicators = indicatorArray;
    }

    logger.info('\n✅ UI-Compatible Result (Transformed):');
    logger.info(JSON.stringify(uiResult, null, 2));
    logger.info('\n📝 Indicators array count:', uiResult.indicators.length);
    logger.info('📝 Signal format:', uiResult.signal);
    logger.info('📝 Confidence:', uiResult.confidence);

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testTransform();
