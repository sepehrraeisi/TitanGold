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
  const data = result.result || result;
  
  logger.info('✅ Company Data:');
  logger.info('  Name:', data.company_project_data?.name);
  logger.info('  Description:', data.company_project_data?.description?.substring(0, 50) + '...');
  logger.info('  Market Cap:', data.company_project_data?.marketCap);
  
  logger.info('\n✅ Financial Ratios:');
  logger.info('  Volatility 24h:', data.financial_ratios?.volatility24h + '%');
  logger.info('  Liquidity:', data.financial_ratios?.liquidityRatio);
  
  logger.info('\n✅ Events & News:');
  logger.info('  Impact Analysis Count:', data.events_news?.impactAnalysis?.length || 0);
  if (data.events_news?.impactAnalysis?.length > 0) {
    logger.info('  First Event:', data.events_news.impactAnalysis[0].event);
  }
  
  logger.info('\n✅ On-chain:');
  logger.info('  Network Activity:', data.onchain_tokenomics?.networkActivity);
  logger.info('  Active Addresses:', data.onchain_tokenomics?.activeAddresses);
  
  logger.info('\n✅ Fair Value:');
  logger.info('  Estimated:', data.fair_value?.estimated?.toFixed(2));
  logger.info('  Current Price:', data.fair_value?.currentPrice?.toFixed(2));
  logger.info('  History Count:', data.fair_value?.history?.length || 0);
}

test().catch(console.error);
