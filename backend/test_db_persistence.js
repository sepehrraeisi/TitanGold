import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';

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
  console.log('🔬 Testing DB Persistence (SELECT after UPDATE)');
  
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
    console.error('❌ Login failed');
    process.exit(1);
  }
  
  const { token } = await loginRes.json();
  console.log('✅ Login successful');
  
  // Step 2: Get Fundamental Agent
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const agentsData = await agentsRes.json();
  const agents = agentsData.agents || agentsData;  // Handle both formats
  const fundamentalAgent = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fundamentalAgent) {
    console.error('❌ No fundamental agent found');
    process.exit(1);
  }
  
  console.log(`✅ Found Fundamental Agent: ${fundamentalAgent.id}`);
  
  // Step 3: Check DB BEFORE save
  const beforeQuery = await pool.query(
    `SELECT config FROM ai_agents WHERE id = $1`,
    [fundamentalAgent.id]
  );
  
  const configBefore = beforeQuery.rows[0].config;
  console.log('\n📊 DB Config BEFORE save:');
  console.log('  - shareWithArtemis:', configBefore.integrationSettings?.shareWithArtemis ?? 'undefined');
  console.log('  - syncWithPortfolio:', configBefore.integrationSettings?.syncWithPortfolio ?? 'undefined');
  console.log('  - forwardToDashboard:', configBefore.integrationSettings?.forwardToDashboard ?? 'undefined');
  console.log('  - dashboard alert:', configBefore.alertChannels?.dashboard ?? 'undefined');
  console.log('  - email alert:', configBefore.alertChannels?.email ?? 'undefined');
  
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
  
  console.log('\n💾 Saving NEW config via API...');
  console.log('  - shareWithArtemis: true (changed)');
  console.log('  - syncWithPortfolio: true (changed)');
  console.log('  - forwardToDashboard: true (changed)');
  console.log('  - dashboard: true (changed)');
  console.log('  - email: false (changed)');
  
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
    console.error('❌ Save failed:', error);
    process.exit(1);
  }
  
  const saveResult = await saveRes.json();
  console.log('✅ Save successful');
  
  // Step 5: Check DB AFTER save (direct query)
  const afterQuery = await pool.query(
    `SELECT config FROM ai_agents WHERE id = $1`,
    [fundamentalAgent.id]
  );
  
  const configAfter = afterQuery.rows[0].config;
  console.log('\n📊 DB Config AFTER save (direct SELECT):');
  console.log('  - shareWithArtemis:', configAfter.integrationSettings?.shareWithArtemis);
  console.log('  - syncWithPortfolio:', configAfter.integrationSettings?.syncWithPortfolio);
  console.log('  - forwardToDashboard:', configAfter.integrationSettings?.forwardToDashboard);
  console.log('  - dashboard alert:', configAfter.alertChannels?.dashboard);
  console.log('  - email alert:', configAfter.alertChannels?.email);
  
  // Step 6: Verify
  const isCorrect = 
    configAfter.integrationSettings?.shareWithArtemis === true &&
    configAfter.integrationSettings?.syncWithPortfolio === true &&
    configAfter.integrationSettings?.forwardToDashboard === true &&
    configAfter.alertChannels?.dashboard === true &&
    configAfter.alertChannels?.email === false;
  
  if (isCorrect) {
    console.log('\n✅ ✅ ✅ TEST PASSED! DB persisted changes correctly!\n');
  } else {
    console.log('\n❌ ❌ ❌ TEST FAILED! DB did NOT persist changes!\n');
    process.exit(1);
  }
  
  await pool.end();
}

testDBPersistence();
