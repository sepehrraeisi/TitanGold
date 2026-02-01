#!/usr/bin/env node
/**
 * JSONB Index Performance Test - BEFORE Indexes
 * Measures baseline performance without GIN indexes
 */

import { query } from '../database/db.js';

async function testPerformanceBefore() {
  console.log('📊 JSONB Query Performance - BASELINE (Before GIN Indexes)\n');
  console.log('='.repeat(70));
  
  try {
    const results = [];
    
    // Test 1: ai_decisions.input_data filter
    console.log('\n🧪 Test 1: Query ai_decisions with input_data filter');
    console.log('Query: WHERE input_data @> \'{"symbol": "BTCUSDT"}\'');
    
    const result1 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, created_at, input_data
      FROM ai_decisions
      WHERE input_data @> '{"symbol": "BTCUSDT"}'::jsonb
      LIMIT 10;
    `);
    
    const plan1 = result1.rows[0]['QUERY PLAN'][0];
    const executionTime1 = plan1['Execution Time'];
    const planningTime1 = plan1['Planning Time'];
    const usesIndex1 = JSON.stringify(plan1).includes('idx_ai_decisions_input_data_gin');
    const scanType1 = JSON.stringify(plan1).includes('Seq Scan') ? 'Sequential Scan' : 
                      JSON.stringify(plan1).includes('Index Scan') ? 'Index Scan' : 'Unknown';
    
    console.log(`  ⏱️  Execution Time: ${executionTime1.toFixed(2)}ms`);
    console.log(`  📋 Planning Time: ${planningTime1.toFixed(2)}ms`);
    console.log(`  🔍 Scan Type: ${scanType1}`);
    console.log(`  📇 Uses GIN Index: ${usesIndex1 ? '✅ YES' : '❌ NO'}`);
    
    results.push({
      test: 'Test 1: input_data filter',
      executionTime: executionTime1,
      planningTime: planningTime1,
      totalTime: executionTime1 + planningTime1,
      scanType: scanType1,
      usesIndex: usesIndex1
    });
    
    // Test 2: ai_decisions.output_data filter
    console.log('\n🧪 Test 2: Query ai_decisions with output_data filter');
    console.log('Query: WHERE output_data @> \'{"signal": "BUY"}\'');
    
    const result2 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, created_at, output_data
      FROM ai_decisions
      WHERE output_data @> '{"signal": "BUY"}'::jsonb
      LIMIT 10;
    `);
    
    const plan2 = result2.rows[0]['QUERY PLAN'][0];
    const executionTime2 = plan2['Execution Time'];
    const usesIndex2 = JSON.stringify(plan2).includes('idx_ai_decisions_output_data_gin');
    const scanType2 = JSON.stringify(plan2).includes('Seq Scan') ? 'Sequential Scan' : 
                      JSON.stringify(plan2).includes('Index Scan') ? 'Index Scan' : 'Unknown';
    
    console.log(`  ⏱️  Execution Time: ${executionTime2.toFixed(2)}ms`);
    console.log(`  🔍 Scan Type: ${scanType2}`);
    console.log(`  📇 Uses GIN Index: ${usesIndex2 ? '✅ YES' : '❌ NO'}`);
    
    results.push({
      test: 'Test 2: output_data filter',
      executionTime: executionTime2,
      scanType: scanType2,
      usesIndex: usesIndex2
    });
    
    // Test 3: ai_agents.config filter
    console.log('\n🧪 Test 3: Query ai_agents with config filter');
    console.log('Query: WHERE config @> \'{"enabled": true}\'');
    
    const result3 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, agent_key, config
      FROM ai_agents
      WHERE config @> '{"enabled": true}'::jsonb;
    `);
    
    const plan3 = result3.rows[0]['QUERY PLAN'][0];
    const executionTime3 = plan3['Execution Time'];
    const usesIndex3 = JSON.stringify(plan3).includes('idx_ai_agents_config_gin');
    const scanType3 = JSON.stringify(plan3).includes('Seq Scan') ? 'Sequential Scan' : 
                      JSON.stringify(plan3).includes('Index Scan') ? 'Index Scan' : 'Unknown';
    
    console.log(`  ⏱️  Execution Time: ${executionTime3.toFixed(2)}ms`);
    console.log(`  🔍 Scan Type: ${scanType3}`);
    console.log(`  📇 Uses GIN Index: ${usesIndex3 ? '✅ YES' : '❌ NO'}`);
    
    results.push({
      test: 'Test 3: ai_agents.config filter',
      executionTime: executionTime3,
      scanType: scanType3,
      usesIndex: usesIndex3
    });
    
    // Test 4: ai_agents.metadata filter
    console.log('\n🧪 Test 4: Query ai_agents with metadata filter');
    console.log('Query: WHERE metadata ? \'version\'');
    
    const result4 = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, agent_key, metadata
      FROM ai_agents
      WHERE metadata ? 'version';
    `);
    
    const plan4 = result4.rows[0]['QUERY PLAN'][0];
    const executionTime4 = plan4['Execution Time'];
    const usesIndex4 = JSON.stringify(plan4).includes('idx_ai_agents_metadata_gin');
    const scanType4 = JSON.stringify(plan4).includes('Seq Scan') ? 'Sequential Scan' : 
                      JSON.stringify(plan4).includes('Index Scan') ? 'Index Scan' : 'Unknown';
    
    console.log(`  ⏱️  Execution Time: ${executionTime4.toFixed(2)}ms`);
    console.log(`  🔍 Scan Type: ${scanType4}`);
    console.log(`  📇 Uses GIN Index: ${usesIndex4 ? '✅ YES' : '❌ NO'}`);
    
    results.push({
      test: 'Test 4: ai_agents.metadata filter',
      executionTime: executionTime4,
      scanType: scanType4,
      usesIndex: usesIndex4
    });
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 BASELINE SUMMARY (Before GIN Indexes)');
    console.log('='.repeat(70));
    
    results.forEach((r, i) => {
      console.log(`\n${r.test}:`);
      console.log(`  Execution Time: ${r.executionTime.toFixed(2)}ms`);
      console.log(`  Scan Type: ${r.scanType}`);
      console.log(`  Uses GIN Index: ${r.usesIndex ? 'YES' : 'NO'}`);
    });
    
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    
    console.log(`\n📈 Average Execution Time: ${avgExecutionTime.toFixed(2)}ms`);
    console.log(`\n💡 Next step: Apply migration to create GIN indexes`);
    console.log(`   Run: node scripts/apply_jsonb_migration.js`);
    console.log(`   Then: node scripts/test_jsonb_performance.js (to compare)\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPerformanceBefore();
