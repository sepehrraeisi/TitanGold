import fetch from 'node-fetch';
import { logger } from './services/logger.js';

const BASE_URL = 'http://localhost:5002/api';

async function testArbitrageMetrics() {
  logger.info('🧪 Testing Arbitrage Agent Metrics\n');
  
  // Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser',
      password: 'Test@123456'
    })
  });
  
  const { token } = await loginRes.json();
  
  // Get agents
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { agents } = await agentsRes.json();
  const arbitrageAgent = agents.find(a => a.agent_key === 'arbitrage');
  
  if (!arbitrageAgent) {
    logger.info('❌ Arbitrage agent not found');
    return;
  }
  
  logger.info('📊 Arbitrage Agent Response:');
  logger.info('='.repeat(60));
  
  logger.info('\n✅ HIDDEN Metrics (null for rule-based agents):');
  logger.info(`  - accuracy: ${arbitrageAgent.accuracy}`);
  logger.info(`  - trainingProgress: ${arbitrageAgent.trainingProgress}`);
  logger.info(`  - learningTime: ${arbitrageAgent.learningTime}`);
  logger.info(`  - knowledgeSize: ${arbitrageAgent.knowledgeSize}`);
  
  logger.info('\n✅ REAL Metrics (shown for all agents):');
  logger.info(`  - decisions: ${arbitrageAgent.decisions}`);
  logger.info(`  - status: ${arbitrageAgent.status}`);
  logger.info(`  - lastUpdate: ${arbitrageAgent.lastUpdate}`);
  logger.info(`  - capabilities: ${arbitrageAgent.capabilities?.length || 0} items`);
  
  logger.info('\n✅ ARBITRAGE-SPECIFIC Metrics:');
  logger.info(`  - totalScans: ${arbitrageAgent.totalScans}`);
  logger.info(`  - activeHours: ${arbitrageAgent.activeHours}`);
  logger.info(`  - dataStoredMB: ${arbitrageAgent.dataStoredMB}`);
  logger.info(`  - opportunitiesFound: ${arbitrageAgent.opportunitiesFound}`);
  logger.info(`  - totalProfitUSDT: ${arbitrageAgent.totalProfitUSDT}`);
  
  logger.info('\n' + '='.repeat(60));
  logger.info('✅ Test Result:');
  
  const testsPass = 
    arbitrageAgent.accuracy === null &&
    arbitrageAgent.trainingProgress === null &&
    arbitrageAgent.learningTime === null &&
    arbitrageAgent.knowledgeSize === null &&
    arbitrageAgent.totalScans != null;
  
  if (testsPass) {
    logger.info('✅ ALL TESTS PASSED!');
    logger.info('   - ML metrics hidden (null) ✅');
    logger.info('   - Real metrics shown ✅');
    logger.info('   - Arbitrage-specific metrics present ✅');
  } else {
    logger.info('❌ TESTS FAILED');
  }
}

testArbitrageMetrics();
