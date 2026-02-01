/**
 * Cleanup Fake Agents Script
 * Purpose: Remove duplicate/fake agents that don't have proper agent_key mapping
 * Date: 2026-02-01
 * 
 * This script removes agents that were mistakenly created by seed_ai_agents.js
 * Only agents with valid agent_key from the 15 real agents will be kept.
 */

import pool from '../database/db.js';

// These are the ONLY 15 real agent keys that are connected to the system
const REAL_AGENT_KEYS = [
  'technical',
  'risk',
  'sentiment',
  'pattern',
  'price_prediction',
  'arbitrage',
  'portfolio',
  'liquidity',
  'trend',
  'optimization',
  'order',
  'fundamental',
  'market_intelligence',
  'volume',
  'timing'
];

async function cleanupFakeAgents() {
  console.log('🧹 TitanGold - Fake Agents Cleanup Script');
  console.log('=========================================\n');

  try {
    // Step 1: Count total agents before cleanup
    const totalBefore = await pool.query('SELECT COUNT(*) as count FROM ai_agents');
    console.log(`📊 Total agents before cleanup: ${totalBefore.rows[0].count}`);

    // Step 2: Count real agents (with valid agent_key)
    const realAgentsQuery = await pool.query(`
      SELECT COUNT(*) as count 
      FROM ai_agents 
      WHERE agent_key = ANY($1::text[])
    `, [REAL_AGENT_KEYS]);
    console.log(`✅ Real agents (with valid agent_key): ${realAgentsQuery.rows[0].count}`);

    // Step 3: Count fake agents (without agent_key or invalid agent_key)
    const fakeAgentsQuery = await pool.query(`
      SELECT COUNT(*) as count 
      FROM ai_agents 
      WHERE agent_key IS NULL 
         OR agent_key NOT IN (${REAL_AGENT_KEYS.map((_, i) => `$${i+1}`).join(',')})
    `, REAL_AGENT_KEYS);
    const fakeCount = parseInt(fakeAgentsQuery.rows[0].count);
    console.log(`❌ Fake agents (to be removed): ${fakeCount}\n`);

    if (fakeCount === 0) {
      console.log('✅ No fake agents found! Database is clean.');
      process.exit(0);
    }

    // Step 4: List fake agents before deletion
    console.log('📋 Fake agents to be removed:');
    console.log('─────────────────────────────────────────────────────');
    const fakeAgentsList = await pool.query(`
      SELECT id, name, type, agent_key, created_at 
      FROM ai_agents 
      WHERE agent_key IS NULL 
         OR agent_key NOT IN (${REAL_AGENT_KEYS.map((_, i) => `$${i+1}`).join(',')})
      ORDER BY created_at
    `, REAL_AGENT_KEYS);

    fakeAgentsList.rows.forEach((agent, index) => {
      console.log(`${index + 1}. Name: ${agent.name}`);
      console.log(`   Type: ${agent.type}`);
      console.log(`   Agent Key: ${agent.agent_key || '(null)'}`);
      console.log(`   Created: ${agent.created_at}`);
      console.log('   ---');
    });
    console.log('─────────────────────────────────────────────────────\n');

    // Step 5: Confirm deletion (in production, you might want to require confirmation)
    console.log('⚠️  WARNING: About to delete fake agents...');
    console.log('🔄 Starting deletion in 2 seconds...\n');
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Delete fake agents
    const deleteResult = await pool.query(`
      DELETE FROM ai_agents 
      WHERE agent_key IS NULL 
         OR agent_key NOT IN (${REAL_AGENT_KEYS.map((_, i) => `$${i+1}`).join(',')})
      RETURNING id, name, type
    `, REAL_AGENT_KEYS);

    console.log(`🗑️  Deleted ${deleteResult.rowCount} fake agents:`);
    deleteResult.rows.forEach(agent => {
      console.log(`   ✓ ${agent.name} (${agent.type})`);
    });
    console.log('');

    // Step 7: Verify final count
    const totalAfter = await pool.query('SELECT COUNT(*) as count FROM ai_agents');
    console.log(`📊 Total agents after cleanup: ${totalAfter.rows[0].count}`);

    // Step 8: List remaining real agents
    console.log('\n✅ Remaining real agents:');
    console.log('─────────────────────────────────────────────────────');
    const realAgentsListAfter = await pool.query(`
      SELECT agent_key, name, role, status 
      FROM ai_agents 
      ORDER BY agent_key
    `);

    realAgentsListAfter.rows.forEach((agent, index) => {
      console.log(`${index + 1}. [${agent.agent_key}] ${agent.name}`);
      console.log(`   Role: ${agent.role} | Status: ${agent.status}`);
    });
    console.log('─────────────────────────────────────────────────────\n');

    // Step 9: Final verification
    if (realAgentsListAfter.rows.length === 15) {
      console.log('✅ SUCCESS: Database now has exactly 15 real agents!');
      console.log('✅ All agents have valid agent_key mapping.');
      console.log('✅ Cleanup completed successfully!\n');
    } else {
      console.log(`⚠️  WARNING: Expected 15 agents, but found ${realAgentsListAfter.rows.length}`);
      console.log('   Please verify the database manually.\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR during cleanup:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the cleanup
cleanupFakeAgents();
