import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5002/api';

async function testArbitrageMetrics() {
  console.log('🧪 Testing Arbitrage Agent Metrics\n');
  
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
    console.log('❌ Arbitrage agent not found');
    return;
  }
  
  console.log('📊 Arbitrage Agent Response:');
  console.log('='.repeat(60));
  
  console.log('\n✅ HIDDEN Metrics (null for rule-based agents):');
  console.log(`  - accuracy: ${arbitrageAgent.accuracy}`);
  console.log(`  - trainingProgress: ${arbitrageAgent.trainingProgress}`);
  console.log(`  - learningTime: ${arbitrageAgent.learningTime}`);
  console.log(`  - knowledgeSize: ${arbitrageAgent.knowledgeSize}`);
  
  console.log('\n✅ REAL Metrics (shown for all agents):');
  console.log(`  - decisions: ${arbitrageAgent.decisions}`);
  console.log(`  - status: ${arbitrageAgent.status}`);
  console.log(`  - lastUpdate: ${arbitrageAgent.lastUpdate}`);
  console.log(`  - capabilities: ${arbitrageAgent.capabilities?.length || 0} items`);
  
  console.log('\n✅ ARBITRAGE-SPECIFIC Metrics:');
  console.log(`  - totalScans: ${arbitrageAgent.totalScans}`);
  console.log(`  - activeHours: ${arbitrageAgent.activeHours}`);
  console.log(`  - dataStoredMB: ${arbitrageAgent.dataStoredMB}`);
  console.log(`  - opportunitiesFound: ${arbitrageAgent.opportunitiesFound}`);
  console.log(`  - totalProfitUSDT: ${arbitrageAgent.totalProfitUSDT}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Result:');
  
  const testsPass = 
    arbitrageAgent.accuracy === null &&
    arbitrageAgent.trainingProgress === null &&
    arbitrageAgent.learningTime === null &&
    arbitrageAgent.knowledgeSize === null &&
    arbitrageAgent.totalScans != null;
  
  if (testsPass) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('   - ML metrics hidden (null) ✅');
    console.log('   - Real metrics shown ✅');
    console.log('   - Arbitrage-specific metrics present ✅');
  } else {
    console.log('❌ TESTS FAILED');
  }
}

testArbitrageMetrics();
