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
  
  console.log('📊 Full Response Structure:\n');
  console.log('Decision:', result.result?.decision || result.decision);
  console.log('Confidence:', result.result?.confidence || result.confidence);
  console.log('\nScores:');
  if (result.result?.score) {
    console.log('- Total:', result.result.score.total);
    console.log('- Macro:', result.result.score.macro);
    console.log('- Funding:', result.result.score.funding);
    console.log('- OnChain:', result.result.score.onchain);
    console.log('- News:', result.result.score.news);
  }
  
  console.log('\nOverview:');
  if (result.result?.overview) {
    const ov = result.result.overview;
    console.log(`- Price: $${ov.lastPrice}`);
    console.log(`- 24h Change: ${ov.priceChangePercent}%`);
    console.log(`- Volume: $${ov.volume24h.toLocaleString()}`);
  }
  
  console.log('\nSignals:', result.result?.signals?.length || 0);
  if (result.result?.signals) {
    result.result.signals.forEach(s => {
      console.log(`  - ${s.category}: ${s.signal} (${s.score})`);
    });
  }
}

test().catch(console.error);
