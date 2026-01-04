import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'titan',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const BASE_URL = 'http://localhost:5002/api';

async function checkFundamentalMetrics() {
  console.log('🔍 Checking Fundamental Agent Metrics');
  console.log('='.repeat(60));
  
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
  console.log('✅ Login successful\n');
  
  // Step 2: Get Fundamental Agent from API
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const agentsData = await agentsRes.json();
  const agents = agentsData.agents || agentsData;
  const fundamentalAgent = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fundamentalAgent) {
    console.error('❌ No fundamental agent found');
    process.exit(1);
  }
  
  console.log('📊 Fundamental Agent from API:');
  console.log(`  - ID: ${fundamentalAgent.id}`);
  console.log(`  - Name: ${fundamentalAgent.name}`);
  console.log(`  - Status: ${fundamentalAgent.status}`);
  console.log(`  - Accuracy: ${fundamentalAgent.accuracy}`);
  console.log(`  - Training Progress: ${fundamentalAgent.trainingProgress}`);
  console.log(`  - Decisions: ${fundamentalAgent.decisions}`);
  console.log(`  - Learning Time: ${fundamentalAgent.learningTime}`);
  console.log(`  - Knowledge Size: ${fundamentalAgent.knowledgeSize}`);
  console.log(`  - Capabilities: ${fundamentalAgent.capabilities.join(', ')}`);
  console.log('\n');
  
  // Step 3: Check DB directly
  const dbQuery = await pool.query(
    `SELECT 
      id,
      name,
      agent_key,
      accuracy,
      total_decisions,
      successful_decisions
    FROM ai_agents
    WHERE agent_key = 'fundamental'`
  );
  
  const dbAgent = dbQuery.rows[0];
  
  console.log('📊 Fundamental Agent from DB (ai_agents table):');
  console.log(`  - accuracy: ${dbAgent.accuracy}`);
  console.log(`  - total_decisions: ${dbAgent.total_decisions}`);
  console.log(`  - successful_decisions: ${dbAgent.successful_decisions}`);
  console.log('\n');
  
  // Step 4: Check ai_decisions table
  const decisionsQuery = await pool.query(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE was_successful = true) as successful,
      EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/3600 as learning_hours,
      MIN(created_at) as first_decision,
      MAX(created_at) as last_decision
    FROM ai_decisions
    WHERE agent_id = $1`,
    [fundamentalAgent.id]
  );
  
  const decisionStats = decisionsQuery.rows[0];
  
  console.log('📊 ai_decisions table stats:');
  console.log(`  - Total decisions: ${decisionStats.total}`);
  console.log(`  - Successful: ${decisionStats.successful}`);
  console.log(`  - Learning hours: ${parseFloat(decisionStats.learning_hours || 0).toFixed(1)}`);
  console.log(`  - First decision: ${decisionStats.first_decision || 'N/A'}`);
  console.log(`  - Last decision: ${decisionStats.last_decision || 'N/A'}`);
  console.log('\n');
  
  // Step 5: Analysis
  console.log('📊 Analysis:');
  console.log('='.repeat(60));
  
  const isReal = parseInt(decisionStats.total) > 0;
  
  if (isReal) {
    console.log('✅ Metrics are REAL (based on actual decisions)');
    console.log(`   - Accuracy: Calculated from ${decisionStats.successful}/${decisionStats.total} successful decisions`);
    console.log(`   - Decisions: ${decisionStats.total} recorded in ai_decisions table`);
    console.log(`   - Learning Time: ${parseFloat(decisionStats.learning_hours || 0).toFixed(1)}h between first and last decision`);
    const knowledgeMB = ((parseInt(decisionStats.total) * 2) / 1024).toFixed(1);
    console.log(`   - Knowledge: ${knowledgeMB}MB (estimated at 2KB per decision)`);
  } else {
    console.log('⚠️  Metrics are PLACEHOLDER (no decisions recorded yet)');
    console.log('   - Accuracy: 0% (no decisions)');
    console.log('   - Decisions: 0');
    console.log('   - Learning Time: 0h');
    console.log('   - Knowledge: 0.0MB');
    console.log('   - Training Progress: 0 (agent never run)');
  }
  
  console.log('\n📋 Recommendation:');
  if (isReal) {
    console.log('✅ Keep showing these metrics - they are based on real data');
  } else {
    console.log('⚠️  Options:');
    console.log('   1. Hide metrics until first run (cleaner UX)');
    console.log('   2. Show "0" with tooltip: "No analyses performed yet"');
    console.log('   3. Run analysis once to populate metrics');
  }
  
  await pool.end();
}

checkFundamentalMetrics();
