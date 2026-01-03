import fetch from 'node-fetch';

const BASE_URL = 'https://titan.zala.ir/api';

async function test() {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();
  
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  const arbitrage = agents.find(a => a.agent_key === 'arbitrage');
  
  const detailsRes = await fetch(`${BASE_URL}/ai-agents/${arbitrage.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const details = await detailsRes.json();
  
  console.log('📢 Notifications:', JSON.stringify(details.agent.config.notifications, null, 2));
}

test();
