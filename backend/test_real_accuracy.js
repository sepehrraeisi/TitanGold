import fetch from 'node-fetch';

const API_URL = 'https://titan.zala.ir/api';

async function test() {
  // 1) Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();
  console.log('✅ Login successful');

  // 2) Get AI agents
  const agentsRes = await fetch(`${API_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  
  const arb = agents.find(a => a.agent_key === 'arbitrage');
  console.log('\n📊 Arbitrage Agent Real Stats:');
  console.log(`- Accuracy: ${arb.accuracy}%`);
  console.log(`- Training Progress: ${arb.trainingProgress}%`);
  console.log(`- Decisions: ${arb.decisions}`);
  console.log(`- Learning Time: ${arb.learningTime}`);
  console.log(`- Knowledge: ${arb.knowledgeSize}`);
  console.log(`- Status: ${arb.status}`);
}

test().catch(console.error);
