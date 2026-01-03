// Test Registry-Based Run
import agentRegistry from './services/agents/registry.js';

async function testRun() {
  console.log('🧪 Testing Registry-Based Agent Run\n');
  
  try {
    // Test 1: Run technical agent
    console.log('=== Test 1: Technical Agent ===');
    const result = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      config: {}
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('');
    
    // Test 2: Run risk agent
    console.log('=== Test 2: Risk Agent ===');
    const riskResult = await agentRegistry.runAgent('risk', {
      userId: 'test-user',
      symbol: 'ETH/USDT',
      timeframe: '4h',
      config: {}
    });
    
    console.log('✅ Result:', JSON.stringify(riskResult, null, 2));
    console.log('');
    
    // Test 3: Invalid agent
    console.log('=== Test 3: Invalid Agent ===');
    try {
      await agentRegistry.runAgent('invalid_agent', {});
      console.log('❌ Should have thrown error');
    } catch (err) {
      console.log('✅ Expected error:', err.message);
    }
    
    console.log('\n✅ All registry run tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRun();
