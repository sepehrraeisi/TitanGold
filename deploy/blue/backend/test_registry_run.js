// Test Registry-Based Run
import agentRegistry from './services/agents/registry.js';
import { logger } from './services/logger.js';

async function testRun() {
  logger.info('🧪 Testing Registry-Based Agent Run\n');
  
  try {
    // Test 1: Run technical agent
    logger.info('=== Test 1: Technical Agent ===');
    const result = await agentRegistry.runAgent('technical', {
      userId: 'test-user',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      config: {}
    });
    
    logger.info('✅ Result:', JSON.stringify(result, null, 2));
    logger.info('');
    
    // Test 2: Run risk agent
    logger.info('=== Test 2: Risk Agent ===');
    const riskResult = await agentRegistry.runAgent('risk', {
      userId: 'test-user',
      symbol: 'ETH/USDT',
      timeframe: '4h',
      config: {}
    });
    
    logger.info('✅ Result:', JSON.stringify(riskResult, null, 2));
    logger.info('');
    
    // Test 3: Invalid agent
    logger.info('=== Test 3: Invalid Agent ===');
    try {
      await agentRegistry.runAgent('invalid_agent', {});
      logger.info('❌ Should have thrown error');
    } catch (err) {
      logger.info('✅ Expected error:', err.message);
    }
    
    logger.info('\n✅ All registry run tests passed!');
    process.exit(0);
  } catch (error) {
    logger.error('\n❌ Test failed:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

testRun();
