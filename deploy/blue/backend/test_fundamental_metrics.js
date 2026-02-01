import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
import { logger } from './services/logger.js';

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
  logger.info('🔍 Checking Fundamental Agent Metrics');
  logger.info('='.repeat(60));
  
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
  logger.info('✅ Login successful\n');
  
  // Step 2: Get Fundamental Agent from API
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const agentsData = await agentsRes.json();
  const agents = agentsData.agents || agentsData;
  const fundamentalAgent = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fundamentalAgent) {
    logger.error('❌ No fundamental agent found');
    process.exit(1);
  }
  
  logger.info('📊 Fundamental Agent from API:');
  logger.info(`  - ID: ${fundamentalAgent.id}`);
  logger.info(`  - Name: ${fundamentalAgent.name}`);
  logger.info(`  - Status: ${fundamentalAgent.status}`);
  logger.info(`  - Accuracy: ${fundamentalAgent.accuracy}`);
  logger.info(`  - Training Progress: ${fundamentalAgent.trainingProgress}`);
  logger.info(`  - Decisions: ${fundamentalAgent.decisions}`);
  logger.info(`  - Learning Time: ${fundamentalAgent.learningTime}`);
  logger.info(`  - Knowledge Size: ${fundamentalAgent.knowledgeSize}`);
  logger.info(`  - Capabilities: ${fundamentalAgent.capabilities.join(', ')}`);
  logger.info('\n');
  
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
  
  logger.info('📊 Fundamental Agent from DB (ai_agents table):');
  logger.info(`  - accuracy: ${dbAgent.accuracy}`);
  logger.info(`  - total_decisions: ${dbAgent.total_decisions}`);
  logger.info(`  - successful_decisions: ${dbAgent.successful_decisions}`);
  logger.info('\n');
  
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
  
  logger.info('📊 ai_decisions table stats:');
  logger.info(`  - Total decisions: ${decisionStats.total}`);
  logger.info(`  - Successful: ${decisionStats.successful}`);
  logger.info(`  - Learning hours: ${parseFloat(decisionStats.learning_hours || 0).toFixed(1)}`);
  logger.info(`  - First decision: ${decisionStats.first_decision || 'N/A'}`);
  logger.info(`  - Last decision: ${decisionStats.last_decision || 'N/A'}`);
  logger.info('\n');
  
  // Step 5: Analysis
  logger.info('📊 Analysis:');
  logger.info('='.repeat(60));
  
  const isReal = parseInt(decisionStats.total) > 0;
  
  if (isReal) {
    logger.info('✅ Metrics are REAL (based on actual decisions)');
    logger.info(`   - Accuracy: Calculated from ${decisionStats.successful}/${decisionStats.total} successful decisions`);
    logger.info(`   - Decisions: ${decisionStats.total} recorded in ai_decisions table`);
    logger.info(`   - Learning Time: ${parseFloat(decisionStats.learning_hours || 0).toFixed(1)}h between first and last decision`);
    const knowledgeMB = ((parseInt(decisionStats.total) * 2) / 1024).toFixed(1);
    logger.info(`   - Knowledge: ${knowledgeMB}MB (estimated at 2KB per decision)`);
  } else {
    logger.info('⚠️  Metrics are PLACEHOLDER (no decisions recorded yet)');
    logger.info('   - Accuracy: 0% (no decisions)');
    logger.info('   - Decisions: 0');
    logger.info('   - Learning Time: 0h');
    logger.info('   - Knowledge: 0.0MB');
    logger.info('   - Training Progress: 0 (agent never run)');
  }
  
  logger.info('\n📋 Recommendation:');
  if (isReal) {
    logger.info('✅ Keep showing these metrics - they are based on real data');
  } else {
    logger.info('⚠️  Options:');
    logger.info('   1. Hide metrics until first run (cleaner UX)');
    logger.info('   2. Show "0" with tooltip: "No analyses performed yet"');
    logger.info('   3. Run analysis once to populate metrics');
  }
  
  await pool.end();
}

checkFundamentalMetrics();
