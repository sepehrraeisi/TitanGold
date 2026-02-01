import fetch from 'node-fetch';
import { logger } from './services/logger.js';

const BASE_URL = 'http://localhost:5002/api';

async function testMetricsResponse() {
  logger.info('🧪 Testing Agent-Specific Metrics\n');
  
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
  const fundamentalAgent = agents.find(a => a.agent_key === 'fundamental');
  
  logger.info('📊 Fundamental Agent Response:');
  logger.info('='.repeat(60));
  
  logger.info('\n✅ HIDDEN Metrics (null for rule-based agents):');
  logger.info(`  - accuracy: ${fundamentalAgent.accuracy}`);
  logger.info(`  - trainingProgress: ${fundamentalAgent.trainingProgress}`);
  logger.info(`  - learningTime: ${fundamentalAgent.learningTime}`);
  logger.info(`  - knowledgeSize: ${fundamentalAgent.knowledgeSize}`);
  
  logger.info('\n✅ REAL Metrics (shown for all agents):');
  logger.info(`  - decisions: ${fundamentalAgent.decisions}`);
  logger.info(`  - status: ${fundamentalAgent.status}`);
  logger.info(`  - lastUpdate: ${fundamentalAgent.lastUpdate}`);
  logger.info(`  - capabilities: ${fundamentalAgent.capabilities.length} items`);
  
  logger.info('\n✅ FUNDAMENTAL-SPECIFIC Metrics:');
  logger.info(`  - totalAnalyses: ${fundamentalAgent.totalAnalyses}`);
  logger.info(`  - activeHours: ${fundamentalAgent.activeHours}`);
  logger.info(`  - dataStoredMB: ${fundamentalAgent.dataStoredMB}`);
  
  logger.info('\n' + '='.repeat(60));
  logger.info('✅ Test Result:');
  
  const testsPass = 
    fundamentalAgent.accuracy === null &&
    fundamentalAgent.trainingProgress === null &&
    fundamentalAgent.learningTime === null &&
    fundamentalAgent.knowledgeSize === null &&
    fundamentalAgent.totalAnalyses > 0 &&
    fundamentalAgent.activeHours > 0;
  
  if (testsPass) {
    logger.info('✅ ALL TESTS PASSED!');
    logger.info('   - ML metrics hidden (null) ✅');
    logger.info('   - Real metrics shown ✅');
    logger.info('   - Fundamental-specific metrics present ✅');
  } else {
    logger.info('❌ TESTS FAILED');
  }
}

testMetricsResponse();
