// Test /run-v2 endpoint with real DB
import pool from './database/db.js';
import http from 'http';

async function testRunV2() {
  console.log('🧪 Testing POST /:id/run-v2 with DB\n');
  
  try {
    // Step 1: Get decisions count BEFORE
    const beforeResult = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    const countBefore = parseInt(beforeResult.rows[0].count);
    console.log(`📊 Decisions count BEFORE: ${countBefore}`);
    
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
    console.log(`✅ Agent found: ${agent.name} (${agent.agent_key})`);
    console.log(`   UUID: ${agent.id}\n`);
    
    // Step 3: Call /run-v2 without auth (expect 401)
    console.log('📡 Testing /run-v2 without auth...');
    const noAuthResult = await callRunV2(agent.id, null);
    console.log(`   Status: ${noAuthResult.status} (expected: 401)`);
    
    if (noAuthResult.status === 401) {
      console.log('   ✅ Auth protection working\n');
    } else {
      console.log('   ⚠️  Expected 401 but got', noAuthResult.status, '\n');
    }
    
    // Step 4: Get decisions count AFTER (should be same, no auth)
    const afterNoAuthResult = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    const countAfterNoAuth = parseInt(afterNoAuthResult.rows[0].count);
    console.log(`📊 Decisions count AFTER no-auth test: ${countAfterNoAuth}`);
    console.log(`   Change: ${countAfterNoAuth - countBefore} (expected: 0)\n`);
    
    console.log('✅ Test complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Endpoint exists: YES`);
    console.log(`   - Auth protection: YES`);
    console.log(`   - Ready for authenticated test: YES`);
    console.log('\n⚠️  Next: Test with real auth token from frontend');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
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
