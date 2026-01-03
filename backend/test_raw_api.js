import fetch from 'node-fetch';

const BASE_URL = 'https://titan.zala.ir/api';

async function test() {
  // Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();
  
  // Get agents
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  const arbitrage = agents.find(a => a.agent_key === 'arbitrage');
  
  // Run
  const runRes = await fetch(`${BASE_URL}/ai-agents/${arbitrage.id}/run`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    }
  });
  const result = await runRes.json();
  
  console.log('Response Keys:', Object.keys(result));
  console.log('\nFirst Opportunity:', result.opportunities?.[0] ? JSON.stringify(result.opportunities[0], null, 2) : 'No opportunities');
}

test();
