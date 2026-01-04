import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5002/api';

async function testMetricsResponse() {
  console.log('🧪 Testing Agent-Specific Metrics\n');
  
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
  
  console.log('📊 Fundamental Agent Response:');
  console.log('='.repeat(60));
  
  console.log('\n✅ HIDDEN Metrics (null for rule-based agents):');
  console.log(`  - accuracy: ${fundamentalAgent.accuracy}`);
  console.log(`  - trainingProgress: ${fundamentalAgent.trainingProgress}`);
  console.log(`  - learningTime: ${fundamentalAgent.learningTime}`);
  console.log(`  - knowledgeSize: ${fundamentalAgent.knowledgeSize}`);
  
  console.log('\n✅ REAL Metrics (shown for all agents):');
  console.log(`  - decisions: ${fundamentalAgent.decisions}`);
  console.log(`  - status: ${fundamentalAgent.status}`);
  console.log(`  - lastUpdate: ${fundamentalAgent.lastUpdate}`);
  console.log(`  - capabilities: ${fundamentalAgent.capabilities.length} items`);
  
  console.log('\n✅ FUNDAMENTAL-SPECIFIC Metrics:');
  console.log(`  - totalAnalyses: ${fundamentalAgent.totalAnalyses}`);
  console.log(`  - activeHours: ${fundamentalAgent.activeHours}`);
  console.log(`  - dataStoredMB: ${fundamentalAgent.dataStoredMB}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Result:');
  
  const testsPass = 
    fundamentalAgent.accuracy === null &&
    fundamentalAgent.trainingProgress === null &&
    fundamentalAgent.learningTime === null &&
    fundamentalAgent.knowledgeSize === null &&
    fundamentalAgent.totalAnalyses > 0 &&
    fundamentalAgent.activeHours > 0;
  
  if (testsPass) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('   - ML metrics hidden (null) ✅');
    console.log('   - Real metrics shown ✅');
    console.log('   - Fundamental-specific metrics present ✅');
  } else {
    console.log('❌ TESTS FAILED');
  }
}

testMetricsResponse();
