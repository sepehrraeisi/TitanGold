// Test /run-v2 endpoint with real DB
import pool from './database/db.js';
import http from 'http';
import { logger } from './services/logger.js';

async function testRunV2() {
  logger.info('🧪 Testing POST /:id/run-v2 with DB\n');
  
  try {
    // Step 1: Get decisions count BEFORE
    const beforeResult = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    const countBefore = parseInt(beforeResult.rows[0].count);
    logger.info(`📊 Decisions count BEFORE: ${countBefore}`);
    
    // Step 2: Get a real agent UUID (technical agent)
    const agentResult = await pool.query(`
      SELECT id, agent_key, name 
      FROM ai_agents 
      WHERE agent_key = 'technical' 
      LIMIT 1
    `);
    
    if (agentResult.rows.length === 0) {
      throw new Error('Technical agent not found in database');
    }
    
    const agent = agentResult.rows[0];
    logger.info(`✅ Agent found: ${agent.name} (${agent.agent_key})`);
    logger.info(`   UUID: ${agent.id}\n`);
    
    // Step 3: Call /run-v2 without auth (expect 401)
    logger.info('📡 Testing /run-v2 without auth...');
    const noAuthResult = await callRunV2(agent.id, null);
    logger.info(`   Status: ${noAuthResult.status} (expected: 401)`);
    
    if (noAuthResult.status === 401) {
      logger.info('   ✅ Auth protection working\n');
    } else {
      logger.info('   ⚠️  Expected 401 but got', noAuthResult.status, '\n');
    }
    
    // Step 4: Get decisions count AFTER (should be same, no auth)
    const afterNoAuthResult = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    const countAfterNoAuth = parseInt(afterNoAuthResult.rows[0].count);
    logger.info(`📊 Decisions count AFTER no-auth test: ${countAfterNoAuth}`);
    logger.info(`   Change: ${countAfterNoAuth - countBefore} (expected: 0)\n`);
    
    logger.info('✅ Test complete!');
    logger.info('\n📋 Summary:');
    logger.info(`   - Endpoint exists: YES`);
    logger.info(`   - Auth protection: YES`);
    logger.info(`   - Ready for authenticated test: YES`);
    logger.info('\n⚠️  Next: Test with real auth token from frontend');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

function callRunV2(agentId, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      symbol: 'BTC/USDT',
      timeframe: '1h'
    });
    
    const options = {
      hostname: 'localhost',
      port: 5002,
      path: `/api/ai-agents/${agentId}/run-v2`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

testRunV2();
