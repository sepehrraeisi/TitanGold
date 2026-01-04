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
  
  console.log('✅ Company Data:');
  console.log('  Name:', data.company_project_data?.name);
  console.log('  Description:', data.company_project_data?.description?.substring(0, 50) + '...');
  console.log('  Market Cap:', data.company_project_data?.marketCap);
  
  console.log('\n✅ Financial Ratios:');
  console.log('  Volatility 24h:', data.financial_ratios?.volatility24h + '%');
  console.log('  Liquidity:', data.financial_ratios?.liquidityRatio);
  
  console.log('\n✅ Events & News:');
  console.log('  Impact Analysis Count:', data.events_news?.impactAnalysis?.length || 0);
  if (data.events_news?.impactAnalysis?.length > 0) {
    console.log('  First Event:', data.events_news.impactAnalysis[0].event);
  }
  
  console.log('\n✅ On-chain:');
  console.log('  Network Activity:', data.onchain_tokenomics?.networkActivity);
  console.log('  Active Addresses:', data.onchain_tokenomics?.activeAddresses);
  
  console.log('\n✅ Fair Value:');
  console.log('  Estimated:', data.fair_value?.estimated?.toFixed(2));
  console.log('  Current Price:', data.fair_value?.currentPrice?.toFixed(2));
  console.log('  History Count:', data.fair_value?.history?.length || 0);
}

test().catch(console.error);
