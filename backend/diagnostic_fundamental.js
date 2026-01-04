import fetch from 'node-fetch';

const API_URL = 'https://titan.zala.ir/api';

async function diagnose() {
  console.log('🔍 Fundamental Agent Diagnostic\n');
  
  // 1) Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();
  console.log('✅ Login successful\n');

  // 2) Get agent list
  const agentsRes = await fetch(`${API_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  const fund = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fund) {
    console.log('❌ Fundamental agent not found in agents list!');
    return;
  }
  
  console.log('📊 Agent Card Data:');
  console.log(`- ID: ${fund.id}`);
  console.log(`- Name: ${fund.name}`);
  console.log(`- Status: ${fund.status}`);
  console.log(`- Accuracy: ${fund.accuracy}%`);
  console.log(`- Decisions: ${fund.decisions}`);
  console.log(`- Learning Time: ${fund.learningTime}`);
  console.log(`- Knowledge: ${fund.knowledgeSize}\n`);

  // 3) Test /run endpoint
  console.log('🚀 Testing /run endpoint...');
  const runRes = await fetch(`${API_URL}/ai-agents/${fund.id}/run`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol: 'BTCUSDT' })
  });
  
  if (!runRes.ok) {
    console.log(`❌ Run failed: ${runRes.status} ${runRes.statusText}`);
    const error = await runRes.text();
    console.log(`Error: ${error}\n`);
  } else {
    const result = await runRes.json();
    console.log('✅ Run successful');
    console.log('Response keys:', Object.keys(result));
    console.log(`- Symbol: ${result.symbol || 'N/A'}`);
    console.log(`- Confidence: ${result.confidence || 'N/A'}`);
    console.log(`- Decision: ${result.decision || result.signal || 'N/A'}`);
    console.log(`- Source: ${result._meta?.source || 'N/A'}\n`);
  }

  // 4) Check details endpoint
  console.log('📋 Testing /details endpoint...');
  const detailsRes = await fetch(`${API_URL}/ai-agents/${fund.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!detailsRes.ok) {
    console.log(`❌ Details failed: ${detailsRes.status}`);
  } else {
    const details = await detailsRes.json();
    console.log('✅ Details retrieved');
    console.log('Top-level keys:', Object.keys(details));
    if (details.agent) console.log('Agent keys:', Object.keys(details.agent));
    if (details.metrics) console.log('Metrics keys:', Object.keys(details.metrics));
    if (details.lastAnalysis) console.log('LastAnalysis keys:', Object.keys(details.lastAnalysis));
  }
}

diagnose().catch(console.error);
