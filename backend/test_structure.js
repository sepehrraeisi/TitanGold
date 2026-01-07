import fetch from 'node-fetch';
import { logger } from './services/logger.js';

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
  
  logger.info('result.result structure:');
  if (result.result) {
    logger.info('Keys:', Object.keys(result.result));
    logger.info('\naverageScore:', result.result.averageScore);
    logger.info('marketSummary:', result.result.marketSummary);
    logger.info('alerts:', result.result.alerts);
  }
}

test().catch(console.error);
