import fetch from 'node-fetch';

const API_URL = 'https://titan.zala.ir/api';

async function test() {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();

  const agentsRes = await fetch(`${API_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  const fund = agents.find(a => a.agent_key === 'fundamental');

  // Test run
  const runRes = await fetch(`${API_URL}/ai-agents/${fund.id}/run`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol: 'BTCUSDT' })
  });
  
  const result = await runRes.json();
  
  console.log('result.result structure:');
  if (result.result) {
    console.log('Keys:', Object.keys(result.result));
    console.log('\naverageScore:', result.result.averageScore);
    console.log('marketSummary:', result.result.marketSummary);
    console.log('alerts:', result.result.alerts);
  }
}

test().catch(console.error);
