import fetch from 'node-fetch';
import { logger } from './services/logger.js';

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
  
  const config = details.agent.config;
  
  logger.info('✅ Config Keys:', Object.keys(config));
  logger.info('\n📊 Strategies[0]:', JSON.stringify(config.strategies[0], null, 2));
  logger.info('\n⚙️  Execution:', JSON.stringify(config.execution, null, 2));
  logger.info('\n🛡️  Risk Controls:', JSON.stringify(config.riskControls, null, 2));
  logger.info('\n💰 Settlement:', JSON.stringify(config.settlement, null, 2));
}

test();
