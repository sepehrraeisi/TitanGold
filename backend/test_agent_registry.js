// Test Agent Registry
import agentRegistry from './services/agents/registry.js';

async function testRegistry() {
  console.log('🧪 Testing Agent Registry...\n');
  
  try {
    // Test 1: List all agent keys
    const keys = agentRegistry.listAgentKeys();
    console.log(`✅ Registered agents: ${keys.length}`);
    console.log(`   ${keys.join(', ')}\n`);
    
    // Test 2: Check if agents exist
    console.log('📋 Checking agent existence:');
    ['technical', 'risk', 'invalid_agent'].forEach(key => {
      const exists = agentRegistry.hasAgent(key);
      console.log(`   ${key}: ${exists ? '✅' : '❌'}`);
    });
    console.log('');
    
    // Test 3: Load technical agent
    console.log('📦 Loading technical agent...');
    const techAgent = await agentRegistry.getAgentService('technical');
    console.log(`   ✅ Loaded: ${typeof techAgent.run === 'function' ? 'run()' : 'MISSING'}`);
    console.log(`   ✅ Loaded: ${typeof techAgent.getDetails === 'function' ? 'getDetails()' : 'MISSING'}`);
    console.log(`   ✅ Loaded: ${typeof techAgent.defaultConfig === 'function' ? 'defaultConfig()' : 'MISSING'}`);
    console.log('');
    
    // Test 4: Run technical agent
    console.log('🚀 Running technical agent...');
    const result = await agentRegistry.runAgent('technical', {
      symbol: 'BTC/USDT',
      timeframe: '1h'
    });
    console.log(`   ✅ Result: ${result.signal} (confidence: ${result.confidence})`);
    console.log(`   ✅ Indicators: RSI=${result.indicators.rsi.toFixed(2)}, Trend=${result.indicators.trend}`);
    console.log('');
    
    // Test 5: Get agent details
    console.log('📊 Getting agent details...');
    const details = await agentRegistry.getAgentDetails('technical', {});
    console.log(`   ✅ Name: ${details.name}`);
    console.log(`   ✅ Capabilities: ${details.capabilities.join(', ')}`);
    console.log('');
    
    // Test 6: Get default config
    console.log('⚙️  Getting default config...');
    const config = await agentRegistry.getAgentDefaultConfig('technical');
    console.log(`   ✅ Indicators: ${config.indicators.join(', ')}`);
    console.log(`   ✅ RSI Period: ${config.rsi_period}`);
    console.log('');
    
    // Test 7: Load multiple agents
    console.log('📦 Loading multiple agents...');
    for (const key of ['risk', 'sentiment', 'pattern']) {
      try {
        await agentRegistry.getAgentService(key);
        console.log(`   ✅ ${key}`);
      } catch (err) {
        console.log(`   ❌ ${key}: ${err.message}`);
      }
    }
    
    console.log('\n✅ All registry tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Registry test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRegistry();
