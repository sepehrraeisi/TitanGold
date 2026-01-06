#!/usr/bin/env node
/**
 * Check JSONB Columns and Existing Indexes
 */

import { query } from '../database/db.js';

async function checkJSONB() {
  try {
    console.log('🔍 Checking JSONB columns...\n');
    
    // Get all JSONB columns
    const columnsResult = await query(`
      SELECT 
        table_name, 
        column_name, 
        data_type 
      FROM information_schema.columns 
      WHERE data_type = 'jsonb' 
      AND table_schema = 'public'
      ORDER BY table_name, column_name
    `);
    
    console.log('📋 JSONB Columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}.${row.column_name}`);
    });
    
    // Check existing GIN indexes
    console.log('\n🔍 Checking existing GIN indexes...\n');
    
    const indexResult = await query(`
      SELECT 
        schemaname, 
        tablename, 
        indexname, 
        indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexdef LIKE '%gin%' 
      ORDER BY tablename, indexname
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('📇 Existing GIN Indexes:');
      indexResult.rows.forEach(row => {
        console.log(`  - ${row.tablename}.${row.indexname}`);
        console.log(`    ${row.indexdef}\n`);
      });
    } else {
      console.log('ℹ️  No GIN indexes found\n');
    }
    
    // Check specifically for the indexes we want to create
    console.log('🎯 Target indexes for DATABASE-002:\n');
    
    const targetIndexes = [
      'idx_ai_agents_config_gin',
      'idx_ai_agents_metadata_gin',
      'idx_ai_decisions_input_data_gin',
      'idx_ai_decisions_output_data_gin'
    ];
    
    for (const indexName of targetIndexes) {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = $1
        )
      `, [indexName]);
      
      const status = exists.rows[0].exists ? '✅ EXISTS' : '❌ MISSING';
      console.log(`  ${status} - ${indexName}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkJSONB();
