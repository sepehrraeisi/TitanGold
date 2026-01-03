import agentRegistry from './services/agents/registry.js';

async function testFinalTransform() {
  try {
    console.log('🧪 Testing Final Transformation Logic\n');

    // Run technical agent
    const rawResult = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'ETH/USDT',
      timeframe: '4h'
    });

    console.log('📊 Raw Result from Registry:');
    console.log(JSON.stringify(rawResult, null, 2));

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

    console.log('\n✅ UI-Compatible Result:');
    console.log(JSON.stringify(uiResult, null, 2));

    console.log('\n📊 Validation Results:');
    console.log(`   ✓ Indicators count: ${uiResult.indicators.length}`);
    console.log(`   ✓ Indicators is Array: ${Array.isArray(uiResult.indicators)}`);
    console.log(`   ✓ Signal format: "${uiResult.signal}" (lowercase)`);
    console.log(`   ✓ Confidence: ${uiResult.confidence} (number)`);
    console.log(`   ✓ Timestamp: ${uiResult.timestamp}`);
    console.log(`   ✓ Reasoning: ${uiResult.reasoning}`);
    
    // Validate each indicator
    console.log('\n📋 Indicators Validation:');
    uiResult.indicators.forEach((ind, i) => {
      const signalOk = typeof ind.signal === 'string' && ['buy', 'sell', 'neutral'].includes(ind.signal);
      console.log(`   ${i + 1}. ${ind.indicatorId}:`);
      console.log(`      - value: ${ind.value.toFixed(2)}`);
      console.log(`      - signal: "${ind.signal}" ${signalOk ? '✅' : '❌ INVALID'}`);
      console.log(`      - weight: ${ind.weight}`);
    });

    // Final check
    const allSignalsValid = uiResult.indicators.every(i => 
      typeof i.signal === 'string' && ['buy', 'sell', 'neutral'].includes(i.signal)
    );

    console.log('\n🎯 Final Verdict:');
    if (allSignalsValid && Array.isArray(uiResult.indicators) && uiResult.indicators.length > 0) {
      console.log('   ✅ ALL CHECKS PASSED - UI will work!');
    } else {
      console.log('   ❌ FAILED - UI will break');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFinalTransform();
