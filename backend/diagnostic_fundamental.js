import fetch from 'node-fetch';
import { logger } from './services/logger.js';

const API_URL = 'https://titan.zala.ir/api';

async function diagnose() {
  logger.info('🔍 Fundamental Agent Diagnostic\n');
  
  // 1) Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@123456' })
  });
  const { token } = await loginRes.json();
  logger.info('✅ Login successful\n');

  // 2) Get agent list
  const agentsRes = await fetch(`${API_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { agents } = await agentsRes.json();
  const fund = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fund) {
    logger.info('❌ Fundamental agent not found in agents list!');
    return;
  }
  
  logger.info('📊 Agent Card Data:');
  logger.info(`- ID: ${fund.id}`);
  logger.info(`- Name: ${fund.name}`);
  logger.info(`- Status: ${fund.status}`);
  logger.info(`- Accuracy: ${fund.accuracy}%`);
  logger.info(`- Decisions: ${fund.decisions}`);
  logger.info(`- Learning Time: ${fund.learningTime}`);
  logger.info(`- Knowledge: ${fund.knowledgeSize}\n`);

  // 3) Test /run endpoint
  logger.info('🚀 Testing /run endpoint...');
  const runRes = await fetch(`${API_URL}/ai-agents/${fund.id}/run`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symbol: 'BTCUSDT' })
  });
  
  if (!runRes.ok) {
    logger.info(`❌ Run failed: ${runRes.status} ${runRes.statusText}`);
    const error = await runRes.text();
    logger.info(`Error: ${error}\n`);
  } else {
    const result = await runRes.json();
    logger.info('✅ Run successful');
    logger.info('Response keys:', Object.keys(result));
    logger.info(`- Symbol: ${result.symbol || 'N/A'}`);
    logger.info(`- Confidence: ${result.confidence || 'N/A'}`);
    logger.info(`- Decision: ${result.decision || result.signal || 'N/A'}`);
    logger.info(`- Source: ${result._meta?.source || 'N/A'}\n`);
  }

  // 4) Check details endpoint
  logger.info('📋 Testing /details endpoint...');
  const detailsRes = await fetch(`${API_URL}/ai-agents/${fund.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!detailsRes.ok) {
    logger.info(`❌ Details failed: ${detailsRes.status}`);
  } else {
    const details = await detailsRes.json();
    logger.info('✅ Details retrieved');
    logger.info('Top-level keys:', Object.keys(details));
    if (details.agent) logger.info('Agent keys:', Object.keys(details.agent));
    if (details.metrics) logger.info('Metrics keys:', Object.keys(details.metrics));
    if (details.lastAnalysis) logger.info('LastAnalysis keys:', Object.keys(details.lastAnalysis));
  }
}

diagnose().catch(console.error);
