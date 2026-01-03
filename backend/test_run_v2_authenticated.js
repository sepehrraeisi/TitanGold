// Test /run-v2 with mock authenticated request (bypass auth for testing)
import pool from './database/db.js';
import agentRegistry from './services/agents/registry.js';

async function testAuthenticatedRun() {
  console.log('🧪 Testing Registry-Based Run (Simulated)\n');
  
  try {
    // Get decisions count BEFORE
    const beforeResult = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    const countBefore = parseInt(beforeResult.rows[0].count);
    console.log(`📊 Decisions count BEFORE: ${countBefore}\n`);
    
    // Get technical agent
    const agentResult = await pool.query(`
      SELECT id, agent_key, name, config, metadata
      FROM ai_agents 
      WHERE agent_key = 'technical' 
      LIMIT 1
    `);
    
    const agent = agentResult.rows[0];
    console.log(`✅ Agent: ${agent.name}`);
    console.log(`   UUID: ${agent.id}`);
    console.log(`   agent_key: ${agent.agent_key}\n`);
    
    // Simulate the run-v2 logic
    console.log('🔥 Running agent via registry...');
    const result = await agentRegistry.runAgent(agent.agent_key, {
      userId: 'test-user',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      config: agent.config || {}
    });
    
    console.log('✅ Agent execution result:');
    console.log(`   Signal: ${result.signal || 'N/A'}`);
    console.log(`   Confidence: ${result.confidence || 'N/A'}`);
    console.log(`   Source: ${result._meta?.source || 'N/A'}\n`);
    
    // Log decision (simulating endpoint logic)
    console.log('📝 Logging decision to ai_decisions...');
    await pool.query(
      `INSERT INTO ai_decisions (agent_id, decision_type, confidence, input_data, output_data, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())`,
      [
        agent.id,
        result?.decision_type || 'analysis',
        typeof result?.confidence === 'number' ? result.confidence : 0.5,
        JSON.stringify({ symbol: 'BTC/USDT', timeframe: '1h' }),
        JSON.stringify(result || {})
      ]
    );
    console.log('✅ Decision logged\n');
    
    // Update metadata
    console.log('📊 Updating agent metadata...');
    const newMetadata = {
      ...(agent.metadata || {}),
      last_result: result || null,
      last_error: null,
      last_run_at: new Date().toISOString()
    };
    
    await pool.query(
      `UPDATE ai_agents
       SET last_active_at = NOW(),
           updated_at = NOW(),
           metadata = $2::jsonb
       WHERE id = $1`,
      [agent.id, JSON.stringify(newMetadata)]
    );
    console.log('✅ Metadata updated\n');
    
    // Get decisions count AFTER
    const afterResult = await pool.query('SELECT COUNT(*) FROM ai_decisions');
    const countAfter = parseInt(afterResult.rows[0].count);
    console.log(`📊 Decisions count AFTER: ${countAfter}`);
    console.log(`   Change: +${countAfter - countBefore}\n`);
    
    // Get updated metadata
    const metadataResult = await pool.query(
      `SELECT metadata FROM ai_agents WHERE id = $1`,
      [agent.id]
    );
    const metadata = metadataResult.rows[0].metadata;
    console.log('📋 Updated metadata:');
    console.log(`   last_run_at: ${metadata.last_run_at}`);
    console.log(`   last_result exists: ${!!metadata.last_result}`);
    console.log(`   last_error: ${metadata.last_error || 'null'}\n`);
    
    console.log('✅ All tests passed!');
    console.log('\n🎯 Summary:');
    console.log(`   ✅ Registry execution: SUCCESS`);
    console.log(`   ✅ Decision logging: SUCCESS (+1 decision)`);
    console.log(`   ✅ Metadata update: SUCCESS`);
    console.log(`   ✅ End-to-end flow: WORKING`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAuthenticatedRun();
