#!/usr/bin/env node
/**
 * Foreign Key Index Performance Test
 * Tests JOIN queries to verify FK indexes are being used
 * Task: DATABASE-004
 */

import { query } from '../database/db.js';

async function testFKPerformance() {
  console.log('🔍 Testing Foreign Key Index Performance...\n');
  
  try {
    const results = [];
    
    // Test 1: JOIN ai_decisions with ai_agents
    console.log('Test 1: JOIN ai_decisions ⟕ ai_agents (on agent_id)');
    console.log('─'.repeat(60));
    
    const result1 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT 
        ad.id,
        ad.agent_id,
        ad.decision_type,
        ad.confidence,
        aa.agent_key,
        aa.is_enabled
      FROM ai_decisions ad
      JOIN ai_agents aa ON ad.agent_id = aa.id
      WHERE ad.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 100;
    `);
    
    const plan1 = result1.rows[0]['QUERY PLAN'][0];
    const usesIndex1 = JSON.stringify(plan1).includes('idx_ai_decisions_agent_id');
    
    console.log(`  Execution Time: ${plan1['Execution Time'].toFixed(2)}ms`);
    console.log(`  Planning Time: ${plan1['Planning Time'].toFixed(2)}ms`);
    console.log(`  Uses idx_ai_decisions_agent_id: ${usesIndex1 ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    results.push({
      test: 'ai_decisions ⟕ ai_agents',
      executionTime: plan1['Execution Time'],
      usesIndex: usesIndex1
    });
    
    // Test 2: JOIN ai_decisions with users
    console.log('Test 2: JOIN ai_decisions ⟕ users (on user_id)');
    console.log('─'.repeat(60));
    
    const result2 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT 
        ad.id,
        ad.user_id,
        ad.decision_type,
        ad.confidence,
        u.email,
        u.username
      FROM ai_decisions ad
      JOIN users u ON ad.user_id = u.id
      WHERE ad.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 100;
    `);
    
    const plan2 = result2.rows[0]['QUERY PLAN'][0];
    const usesIndex2 = JSON.stringify(plan2).includes('idx_ai_decisions_user_id');
    
    console.log(`  Execution Time: ${plan2['Execution Time'].toFixed(2)}ms`);
    console.log(`  Planning Time: ${plan2['Planning Time'].toFixed(2)}ms`);
    console.log(`  Uses idx_ai_decisions_user_id: ${usesIndex2 ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    results.push({
      test: 'ai_decisions ⟕ users',
      executionTime: plan2['Execution Time'],
      usesIndex: usesIndex2
    });
    
    // Test 3: JOIN ai_learning_events with ai_agents
    console.log('Test 3: JOIN ai_learning_events ⟕ ai_agents (on agent_id)');
    console.log('─'.repeat(60));
    
    const result3 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT 
        ale.id,
        ale.agent_id,
        ale.event_type,
        ale.impact,
        aa.agent_key,
        aa.name
      FROM ai_learning_events ale
      JOIN ai_agents aa ON ale.agent_id = aa.id
      WHERE ale.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 100;
    `);
    
    const plan3 = result3.rows[0]['QUERY PLAN'][0];
    const usesIndex3 = JSON.stringify(plan3).includes('idx_learning_events_agent');
    
    console.log(`  Execution Time: ${plan3['Execution Time'].toFixed(2)}ms`);
    console.log(`  Planning Time: ${plan3['Planning Time'].toFixed(2)}ms`);
    console.log(`  Uses idx_learning_events_agent: ${usesIndex3 ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    results.push({
      test: 'ai_learning_events ⟕ ai_agents',
      executionTime: plan3['Execution Time'],
      usesIndex: usesIndex3
    });
    
    // Test 4: JOIN ai_learning_events with ai_decisions
    console.log('Test 4: JOIN ai_learning_events ⟕ ai_decisions (on decision_id)');
    console.log('─'.repeat(60));
    
    const result4 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT 
        ale.id,
        ale.decision_id,
        ale.event_type,
        ale.impact,
        ad.decision_type,
        ad.confidence
      FROM ai_learning_events ale
      JOIN ai_decisions ad ON ale.decision_id = ad.id
      WHERE ale.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 100;
    `);
    
    const plan4 = result4.rows[0]['QUERY PLAN'][0];
    const usesIndex4 = JSON.stringify(plan4).includes('idx_learning_events_decision');
    
    console.log(`  Execution Time: ${plan4['Execution Time'].toFixed(2)}ms`);
    console.log(`  Planning Time: ${plan4['Planning Time'].toFixed(2)}ms`);
    console.log(`  Uses idx_learning_events_decision: ${usesIndex4 ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    results.push({
      test: 'ai_learning_events ⟕ ai_decisions',
      executionTime: plan4['Execution Time'],
      usesIndex: usesIndex4
    });
    
    // Summary
    console.log('═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    
    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const indexUsageCount = results.filter(r => r.usesIndex).length;
    
    console.log(`Average Execution Time: ${avgTime.toFixed(2)}ms`);
    console.log(`Indexes Used: ${indexUsageCount}/${results.length}`);
    console.log('');
    
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.test}`);
      console.log(`   Time: ${r.executionTime.toFixed(2)}ms | Index: ${r.usesIndex ? '✅' : '❌'}`);
    });
    
    console.log('');
    
    if (indexUsageCount === results.length) {
      console.log('✅ All foreign key indexes are active and being used!');
    } else {
      console.log('⚠️  Some indexes are not being used. Check query plans.');
    }
    
    console.log('');
    console.log('💡 Note: Small datasets may use sequential scans.');
    console.log('   Indexes show greater benefit with >10k rows.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFKPerformance();
