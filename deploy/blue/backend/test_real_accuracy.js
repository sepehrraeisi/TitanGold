import fetch from 'node-fetch';
import { logger } from './services/logger.js';

const API_URL = 'https://titan.zala.ir/api';

async function test() {
  // 1) Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();
  logger.info('✅ Login successful');

  // 2) Get AI agents
  const agentsRes = await fetch(`${API_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  
  const arb = agents.find(a => a.agent_key === 'arbitrage');
  logger.info('\n📊 Arbitrage Agent Real Stats:');
  logger.info(`- Accuracy: ${arb.accuracy}%`);
  logger.info(`- Training Progress: ${arb.trainingProgress}%`);
  logger.info(`- Decisions: ${arb.decisions}`);
  logger.info(`- Learning Time: ${arb.learningTime}`);
  logger.info(`- Knowledge: ${arb.knowledgeSize}`);
  logger.info(`- Status: ${arb.status}`);
}

test().catch(console.error);
