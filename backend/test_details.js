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
  
  // Get details
  const detailsRes = await fetch(`${BASE_URL}/ai-agents/${arbitrage.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const details = await detailsRes.json();
  
  console.log('📊 Details Response Keys:', Object.keys(details));
  console.log('\n✅ Config Keys:', details.agent?.config ? Object.keys(details.agent.config) : 'NO CONFIG');
  console.log('\n🔧 Exchanges:', details.agent?.config?.exchanges);
  console.log('\n📈 Metrics:', details.metrics);
  console.log('\n🔍 Last Scan Summary:', details.lastScan?.summary);
}

test();
