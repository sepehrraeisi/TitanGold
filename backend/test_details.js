import fetch from 'node-fetch';
import { logger } from './services/logger.js';

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
  
  logger.info('📊 Details Response Keys:', Object.keys(details));
  logger.info('\n✅ Config Keys:', details.agent?.config ? Object.keys(details.agent.config) : 'NO CONFIG');
  logger.info('\n🔧 Exchanges:', details.agent?.config?.exchanges);
  logger.info('\n📈 Metrics:', details.metrics);
  logger.info('\n🔍 Last Scan Summary:', details.lastScan?.summary);
}

test();
