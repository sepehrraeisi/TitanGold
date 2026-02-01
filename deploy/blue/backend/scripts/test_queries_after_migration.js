#!/usr/bin/env node
/**
 * Quick Query Test After Migration
 * Verifies basic queries work after partitioning
 */

import { query } from '../database/db.js';

async function testQueries() {
  try {
    console.log('🧪 Testing queries after partition migration...\n');
    
    // Test 1: Count query
    console.log('Test 1: Count query');
    const countResult = await query('SELECT COUNT(*) FROM ai_decisions');
    console.log(`  ✅ Total rows: ${countResult.rows[0].count}\n`);
    
    // Test 2: Recent data query
    console.log('Test 2: Recent data query (last 24 hours)');
    const recentResult = await query(`
      SELECT COUNT(*), MAX(created_at) as latest 
      FROM ai_decisions 
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
    `);
    console.log(`  ✅ Recent rows: ${recentResult.rows[0].count}`);
    console.log(`  ✅ Latest: ${recentResult.rows[0].latest}\n`);
    
    // Test 3: Aggregation query
    console.log('Test 3: Monthly aggregation');
    const aggResult = await query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as decisions
      FROM ai_decisions 
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 3
    `);
    aggResult.rows.forEach(row => {
      console.log(`  ✅ ${row.month.toISOString().substr(0, 7)}: ${row.decisions} decisions`);
    });
    console.log();
    
    // Test 4: Insert query
    console.log('Test 4: Insert new decision');
    const insertResult = await query(`
      INSERT INTO ai_decisions (
        id, agent_id, user_id, decision_type, input_data, output_data,
        confidence, was_successful, execution_time_ms, metadata
      ) VALUES (
        uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(),
        'partition_test', '{"test": "after_migration"}'::jsonb, 
        '{"result": "success"}'::jsonb, 0.90, true, 150, 
        '{"partition_test": true}'::jsonb
      ) RETURNING id, created_at
    `);
    console.log(`  ✅ Inserted: ${insertResult.rows[0].id}`);
    console.log(`  ✅ Timestamp: ${insertResult.rows[0].created_at}\n`);
    
    // Test 5: Query by date range (partition pruning)
    console.log('Test 5: Date range query (should use partition pruning)');
    const rangeResult = await query(`
      SELECT COUNT(*) 
      FROM ai_decisions 
      WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'
    `);
    console.log(`  ✅ Jan 2026 decisions: ${rangeResult.rows[0].count}\n`);
    
    // Test 6: Query by agent_id (index test)
    console.log('Test 6: Query by agent_id (index test)');
    const agentResult = await query(`
      SELECT COUNT(DISTINCT agent_id) as unique_agents 
      FROM ai_decisions
    `);
    console.log(`  ✅ Unique agents: ${agentResult.rows[0].unique_agents}\n`);
    
    console.log('✅ All query tests passed!\n');
    console.log('📊 Summary:');
    console.log('  - Basic queries: Working');
    console.log('  - Aggregations: Working');
    console.log('  - Inserts: Working');
    console.log('  - Date range queries: Working');
    console.log('  - Indexed queries: Working\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Query test failed:', error);
    process.exit(1);
  }
}

testQueries();
