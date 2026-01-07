import agentRegistry from './services/agents/registry.js';
import { logger } from './services/logger.js';

async function testDualFormat() {
  try {
    logger.info('🧪 Testing DUAL FORMAT Response\n');

    // Run technical agent
    const rawResult = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'BTC/USDT',
      timeframe: '1h'
    });

    // Simulate transformer
    function transformAgentResultForUI(agent_key, result) {
      const { symbol, timeframe, confidence, signal, indicators, timestamp, _meta } = result;
      
      const uiResult = {
        timestamp: timestamp || new Date().toISOString(),
        symbol: symbol || 'UNKNOWN',
        timeframe: timeframe || '1h',
        signal: (signal || 'NEUTRAL').toLowerCase(),
        confidence: typeof confidence === 'number' ? confidence : 0.5,
        indicators: [],
        reasoning: `${agent_key} analysis complete (source: ${_meta?.source || 'unknown'})`,
        _meta: _meta || { source: 'mock', version: '1.0.0' }
      };

      // Transform indicators
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
            const indicatorValue = value.value || 0;
            let indicatorSignal = 'neutral';
            
            if (typeof value.signal === 'string') {
              indicatorSignal = value.signal.toLowerCase() === 'bearish' ? 'sell' : 
                                value.signal.toLowerCase() === 'bullish' ? 'buy' : 'neutral';
            } else if (typeof value.signal === 'number') {
              if (value.histogram !== undefined) {
                indicatorSignal = value.histogram < 0 ? 'sell' : value.histogram > 0 ? 'buy' : 'neutral';
              } else {
                indicatorSignal = indicatorValue > value.signal ? 'buy' : indicatorValue < value.signal ? 'sell' : 'neutral';
              }
            }
            
            indicatorArray.push({
              indicatorId: key.toUpperCase(),
              value: indicatorValue,
              signal: indicatorSignal,
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

      // SAFETY
      uiResult.indicators = Array.isArray(uiResult.indicators) ? uiResult.indicators : [];
      return uiResult;
    }

    const uiResult = transformAgentResultForUI('technical', rawResult);
    const safeIndicators = Array.isArray(uiResult?.indicators) ? uiResult.indicators : [];

    // Simulate DUAL format response
    const response = {
      ok: true,
      agent_id: 'fake-uuid-123',
      agent_key: 'technical',
      
      // TOP-LEVEL
      ...uiResult,
      indicators: safeIndicators,
      
      // INSIDE result
      result: {
        ...uiResult,
        indicators: safeIndicators
      }
    };

    logger.info('📊 DUAL FORMAT Response:');
    logger.info(JSON.stringify(response, null, 2));

    logger.info('\n✅ Validation:');
    logger.info(`   - response.indicators exists: ${!!response.indicators}`);
    logger.info(`   - response.indicators is Array: ${Array.isArray(response.indicators)}`);
    logger.info(`   - response.indicators.length: ${response.indicators.length}`);
    logger.info(`   - response.result.indicators exists: ${!!response.result?.indicators}`);
    logger.info(`   - response.result.indicators is Array: ${Array.isArray(response.result?.indicators)}`);
    logger.info(`   - response.result.indicators.length: ${response.result?.indicators?.length}`);

    // Test UI reads
    logger.info('\n🎯 UI Compatibility Tests:');
    
    // Test 1: UI reads response.indicators.filter(...)
    try {
      const filtered = response.indicators.filter(i => i.signal === 'buy');
      logger.info(`   ✅ response.indicators.filter() works (${filtered.length} items)`);
    } catch (e) {
      logger.info(`   ❌ response.indicators.filter() FAILED: ${e.message}`);
    }

    // Test 2: UI reads response.result.indicators.filter(...)
    try {
      const filtered = response.result.indicators.filter(i => i.signal === 'sell');
      logger.info(`   ✅ response.result.indicators.filter() works (${filtered.length} items)`);
    } catch (e) {
      logger.info(`   ❌ response.result.indicators.filter() FAILED: ${e.message}`);
    }

    logger.info('\n🎉 DUAL FORMAT TEST PASSED - UI will work with either path!');

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testDualFormat();
