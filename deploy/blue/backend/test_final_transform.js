import agentRegistry from './services/agents/registry.js';
import { logger } from './services/logger.js';

async function testFinalTransform() {
  try {
    logger.info('🧪 Testing Final Transformation Logic\n');

    // Run technical agent
    const rawResult = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'ETH/USDT',
      timeframe: '4h'
    });

    logger.info('📊 Raw Result from Registry:');
    logger.info(JSON.stringify(rawResult, null, 2));

    // Apply transformation (same as endpoint)
    const { symbol, timeframe, confidence, signal, indicators, timestamp, _meta } = rawResult;
    
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

    logger.info('\n✅ UI-Compatible Result:');
    logger.info(JSON.stringify(uiResult, null, 2));

    logger.info('\n📊 Validation Results:');
    logger.info(`   ✓ Indicators count: ${uiResult.indicators.length}`);
    logger.info(`   ✓ Indicators is Array: ${Array.isArray(uiResult.indicators)}`);
    logger.info(`   ✓ Signal format: "${uiResult.signal}" (lowercase)`);
    logger.info(`   ✓ Confidence: ${uiResult.confidence} (number)`);
    logger.info(`   ✓ Timestamp: ${uiResult.timestamp}`);
    logger.info(`   ✓ Reasoning: ${uiResult.reasoning}`);
    
    // Validate each indicator
    logger.info('\n📋 Indicators Validation:');
    uiResult.indicators.forEach((ind, i) => {
      const signalOk = typeof ind.signal === 'string' && ['buy', 'sell', 'neutral'].includes(ind.signal);
      logger.info(`   ${i + 1}. ${ind.indicatorId}:`);
      logger.info(`      - value: ${ind.value.toFixed(2)}`);
      logger.info(`      - signal: "${ind.signal}" ${signalOk ? '✅' : '❌ INVALID'}`);
      logger.info(`      - weight: ${ind.weight}`);
    });

    // Final check
    const allSignalsValid = uiResult.indicators.every(i => 
      typeof i.signal === 'string' && ['buy', 'sell', 'neutral'].includes(i.signal)
    );

    logger.info('\n🎯 Final Verdict:');
    if (allSignalsValid && Array.isArray(uiResult.indicators) && uiResult.indicators.length > 0) {
      logger.info('   ✅ ALL CHECKS PASSED - UI will work!');
    } else {
      logger.info('   ❌ FAILED - UI will break');
      process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFinalTransform();
