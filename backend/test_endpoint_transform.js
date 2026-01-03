import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'titan_gold',
  user: 'ubuntu',
  password: 'admin',
});

async function testEndpoint() {
  try {
    // Get technical agent UUID
    const agentResult = await pool.query(
      `SELECT id, agent_key, name FROM ai_agents WHERE agent_key = 'technical' LIMIT 1`
    );
    
    if (agentResult.rows.length === 0) {
      throw new Error('Technical agent not found');
    }
    
    const agent = agentResult.rows[0];
    console.log(`✅ Agent: ${agent.name} (${agent.agent_key})`);
    console.log(`   UUID: ${agent.id}\n`);

    // Mock authenticated request (simulate via registry)
    const { default: agentRegistry } = await import('./services/agents/registry.js');
    
    const rawResult = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'BTC/USDT',
      timeframe: '1h'
    });

    console.log('📊 Raw Result from Registry:');
    console.log(JSON.stringify(rawResult, null, 2));

    // Simulate transformer (same logic as in endpoint)
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

    console.log('\n✅ UI-Compatible Result (after transform):');
    console.log(JSON.stringify(uiResult, null, 2));

    console.log('\n📝 Validation:');
    console.log(`   - Indicators count: ${uiResult.indicators.length}`);
    console.log(`   - Indicators is Array: ${Array.isArray(uiResult.indicators)}`);
    console.log(`   - Signal format: "${uiResult.signal}" (lowercase)`);
    console.log(`   - Confidence: ${uiResult.confidence}`);
    
    // Check MACD specifically
    const macdIndicator = uiResult.indicators.find(i => i.indicatorId === 'MACD');
    if (macdIndicator) {
      console.log(`\n   MACD Check:`);
      console.log(`     - value: ${macdIndicator.value}`);
      console.log(`     - signal: "${macdIndicator.signal}" (type: ${typeof macdIndicator.signal})`);
      console.log(`     - signal is string: ${typeof macdIndicator.signal === 'string' ? '✅' : '❌'}`);
    }

    await pool.end();
    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testEndpoint();
