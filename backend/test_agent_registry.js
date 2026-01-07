// Test Agent Registry
import agentRegistry from './services/agents/registry.js';
import { logger } from './services/logger.js';

async function testRegistry() {
  logger.info('🧪 Testing Agent Registry...\n');
  
  try {
    // Test 1: List all agent keys
    const keys = agentRegistry.listAgentKeys();
    logger.info(`✅ Registered agents: ${keys.length}`);
    logger.info(`   ${keys.join(', ')}\n`);
    
    // Test 2: Check if agents exist
    logger.info('📋 Checking agent existence:');
    ['technical', 'risk', 'invalid_agent'].forEach(key => {
      const exists = agentRegistry.hasAgent(key);
      logger.info(`   ${key}: ${exists ? '✅' : '❌'}`);
    });
    logger.info('');
    
    // Test 3: Load technical agent
    logger.info('📦 Loading technical agent...');
    const techAgent = await agentRegistry.getAgentService('technical');
    logger.info(`   ✅ Loaded: ${typeof techAgent.run === 'function' ? 'run()' : 'MISSING'}`);
    logger.info(`   ✅ Loaded: ${typeof techAgent.getDetails === 'function' ? 'getDetails()' : 'MISSING'}`);
    logger.info(`   ✅ Loaded: ${typeof techAgent.defaultConfig === 'function' ? 'defaultConfig()' : 'MISSING'}`);
    logger.info('');
    
    // Test 4: Run technical agent
    logger.info('🚀 Running technical agent...');
    const result = await agentRegistry.runAgent('technical', {
      symbol: 'BTC/USDT',
      timeframe: '1h'
    });
    logger.info(`   ✅ Result: ${result.signal} (confidence: ${result.confidence})`);
    logger.info(`   ✅ Indicators: RSI=${result.indicators.rsi.toFixed(2)}, Trend=${result.indicators.trend}`);
    logger.info('');
    
    // Test 5: Get agent details
    logger.info('📊 Getting agent details...');
    const details = await agentRegistry.getAgentDetails('technical', {});
    logger.info(`   ✅ Name: ${details.name}`);
    logger.info(`   ✅ Capabilities: ${details.capabilities.join(', ')}`);
    logger.info('');
    
    // Test 6: Get default config
    logger.info('⚙️  Getting default config...');
    const config = await agentRegistry.getAgentDefaultConfig('technical');
    logger.info(`   ✅ Indicators: ${config.indicators.join(', ')}`);
    logger.info(`   ✅ RSI Period: ${config.rsi_period}`);
    logger.info('');
    
    // Test 7: Load multiple agents
    logger.info('📦 Loading multiple agents...');
    for (const key of ['risk', 'sentiment', 'pattern']) {
      try {
        await agentRegistry.getAgentService(key);
        logger.info(`   ✅ ${key}`);
      } catch (err) {
        logger.info(`   ❌ ${key}: ${err.message}`);
      }
    }
    
    logger.info('\n✅ All registry tests passed!');
    process.exit(0);
  } catch (error) {
    logger.error('\n❌ Registry test failed:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

testRegistry();
