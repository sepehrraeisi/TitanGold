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

  const runRes = await fetch(`${API_URL}/ai-agents/${fund.id}/run`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol: 'BTCUSDT' })
  });
  
  const result = await runRes.json();
  
  logger.info('📊 Full Response Structure:\n');
  logger.info('Decision:', result.result?.decision || result.decision);
  logger.info('Confidence:', result.result?.confidence || result.confidence);
  logger.info('\nScores:');
  if (result.result?.score) {
    logger.info('- Total:', result.result.score.total);
    logger.info('- Macro:', result.result.score.macro);
    logger.info('- Funding:', result.result.score.funding);
    logger.info('- OnChain:', result.result.score.onchain);
    logger.info('- News:', result.result.score.news);
  }
  
  logger.info('\nOverview:');
  if (result.result?.overview) {
    const ov = result.result.overview;
    logger.info(`- Price: $${ov.lastPrice}`);
    logger.info(`- 24h Change: ${ov.priceChangePercent}%`);
    logger.info(`- Volume: $${ov.volume24h.toLocaleString()}`);
  }
  
  logger.info('\nSignals:', result.result?.signals?.length || 0);
  if (result.result?.signals) {
    result.result.signals.forEach(s => {
      logger.info(`  - ${s.category}: ${s.signal} (${s.score})`);
    });
  }
}

test().catch(console.error);
