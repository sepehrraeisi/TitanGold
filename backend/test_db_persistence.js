import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
import { logger } from './services/logger.js';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'titan',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const BASE_URL = 'http://localhost:5002/api';

async function testDBPersistence() {
  logger.info('🔬 Testing DB Persistence (SELECT after UPDATE)');
  
  // Step 1: Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser',
      password: 'Test@123456'
    })
  });
  
  if (!loginRes.ok) {
    logger.error('❌ Login failed');
    process.exit(1);
  }
  
  const { token } = await loginRes.json();
  logger.info('✅ Login successful');
  
  // Step 2: Get Fundamental Agent
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const agentsData = await agentsRes.json();
  const agents = agentsData.agents || agentsData;  // Handle both formats
  const fundamentalAgent = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fundamentalAgent) {
    logger.error('❌ No fundamental agent found');
    process.exit(1);
  }
  
  logger.info(`✅ Found Fundamental Agent: ${fundamentalAgent.id}`);
  
  // Step 3: Check DB BEFORE save
  const beforeQuery = await pool.query(
    `SELECT config FROM ai_agents WHERE id = $1`,
    [fundamentalAgent.id]
  );
  
  const configBefore = beforeQuery.rows[0].config;
  logger.info('\n📊 DB Config BEFORE save:');
  logger.info('  - shareWithArtemis:', configBefore.integrationSettings?.shareWithArtemis ?? 'undefined');
  logger.info('  - syncWithPortfolio:', configBefore.integrationSettings?.syncWithPortfolio ?? 'undefined');
  logger.info('  - forwardToDashboard:', configBefore.integrationSettings?.forwardToDashboard ?? 'undefined');
  logger.info('  - dashboard alert:', configBefore.alertChannels?.dashboard ?? 'undefined');
  logger.info('  - email alert:', configBefore.alertChannels?.email ?? 'undefined');
  
  // Step 4: Update config via API
  const newConfig = {
    ...configBefore,
    integrationSettings: {
      ...configBefore.integrationSettings,
      shareWithArtemis: true,  // ← Change to true
      syncWithPortfolio: true,  // ← Change to true
      forwardToDashboard: true, // ← Change to true
    },
    alertChannels: {
      ...configBefore.alertChannels,
      dashboard: true,  // ← Change to true
      email: false,     // ← Change to false
    }
  };
  
  logger.info('\n💾 Saving NEW config via API...');
  logger.info('  - shareWithArtemis: true (changed)');
  logger.info('  - syncWithPortfolio: true (changed)');
  logger.info('  - forwardToDashboard: true (changed)');
  logger.info('  - dashboard: true (changed)');
  logger.info('  - email: false (changed)');
  
  const saveRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/config`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ config: newConfig })
  });
  
  if (!saveRes.ok) {
    const error = await saveRes.text();
    logger.error('❌ Save failed:', error);
    process.exit(1);
  }
  
  const saveResult = await saveRes.json();
  logger.info('✅ Save successful');
  
  // Step 5: Check DB AFTER save (direct query)
  const afterQuery = await pool.query(
    `SELECT config FROM ai_agents WHERE id = $1`,
    [fundamentalAgent.id]
  );
  
  const configAfter = afterQuery.rows[0].config;
  logger.info('\n📊 DB Config AFTER save (direct SELECT):');
  logger.info('  - shareWithArtemis:', configAfter.integrationSettings?.shareWithArtemis);
  logger.info('  - syncWithPortfolio:', configAfter.integrationSettings?.syncWithPortfolio);
  logger.info('  - forwardToDashboard:', configAfter.integrationSettings?.forwardToDashboard);
  logger.info('  - dashboard alert:', configAfter.alertChannels?.dashboard);
  logger.info('  - email alert:', configAfter.alertChannels?.email);
  
  // Step 6: Verify
  const isCorrect = 
    configAfter.integrationSettings?.shareWithArtemis === true &&
    configAfter.integrationSettings?.syncWithPortfolio === true &&
    configAfter.integrationSettings?.forwardToDashboard === true &&
    configAfter.alertChannels?.dashboard === true &&
    configAfter.alertChannels?.email === false;
  
  if (isCorrect) {
    logger.info('\n✅ ✅ ✅ TEST PASSED! DB persisted changes correctly!\n');
  } else {
    logger.info('\n❌ ❌ ❌ TEST FAILED! DB did NOT persist changes!\n');
    process.exit(1);
  }
  
  await pool.end();
}

testDBPersistence();
