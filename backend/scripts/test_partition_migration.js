#!/usr/bin/env node
/**
 * Test Partition Migration (Dry Run)
 * Runs the migration in a transaction and rolls back to verify it works
 */

import { getClient } from '../database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMigration() {
  const client = await getClient();
  
  try {
    console.log('🧪 Testing partition migration (dry run)...\n');
    
    // Start transaction
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/006_partition_ai_decisions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove BEGIN/COMMIT from migration (we control transaction)
    const cleanSQL = migrationSQL
      .replace(/^\s*BEGIN\s*;/gim, '')
      .replace(/^\s*COMMIT\s*;/gim, '');
    
    console.log('📋 Executing migration...\n');
    
    // Execute migration
    await client.query(cleanSQL);
    
    console.log('✅ Migration SQL executed successfully\n');
    
    // Verify results
    console.log('📊 Verifying migration results...\n');
    
    // Check partition count
    const partitionResult = await client.query(`
      SELECT COUNT(*) as partition_count 
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
      AND c.relispartition = true
      AND c.relname LIKE 'ai_decisions_%'
      AND n.nspname = 'public'
    `);
    
    console.log(`  - Partitions created: ${partitionResult.rows[0].partition_count}`);
    
    // Check data migration
    const oldCountResult = await client.query('SELECT COUNT(*) FROM ai_decisions_old');
    const newCountResult = await client.query('SELECT COUNT(*) FROM ai_decisions');
    
    const oldCount = parseInt(oldCountResult.rows[0].count);
    const newCount = parseInt(newCountResult.rows[0].count);
    
    console.log(`  - Old table rows: ${oldCount}`);
    console.log(`  - New table rows: ${newCount}`);
    console.log(`  - Match: ${oldCount === newCount ? '✅' : '❌'}\n`);
    
    // Check indexes
    const indexResult = await client.query(`
      SELECT COUNT(*) as index_count 
      FROM pg_indexes 
      WHERE tablename = 'ai_decisions'
    `);
    
    console.log(`  - Indexes created: ${indexResult.rows[0].index_count}\n`);
    
    // Test insert
    console.log('🧪 Testing insert into partitioned table...\n');
    
    const insertResult = await client.query(`
      INSERT INTO ai_decisions (
        id, agent_id, user_id, decision_type, input_data, output_data,
        confidence, was_successful, execution_time_ms, metadata
      ) VALUES (
        uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(),
        'test_insert', '{"test": true}'::jsonb, '{"result": "success"}'::jsonb,
        0.95, true, 100, '{"test": true}'::jsonb
      ) RETURNING id, created_at
    `);
    
    console.log(`  - Test insert successful: ${insertResult.rows[0].id}`);
    console.log(`  - Created at: ${insertResult.rows[0].created_at}\n`);
    
    // Test partition pruning
    console.log('🧪 Testing partition pruning...\n');
    
    const explainResult = await client.query(`
      EXPLAIN
      SELECT * FROM ai_decisions 
      WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'
      LIMIT 1
    `);
    
    const hasPruning = explainResult.rows.some(row => 
      row['QUERY PLAN'].includes('ai_decisions_2026_01')
    );
    
    console.log(`  - Partition pruning: ${hasPruning ? '✅ Working' : '❌ Not working'}\n`);
    
    // Rollback transaction
    console.log('🔄 Rolling back transaction (dry run complete)...\n');
    await client.query('ROLLBACK');
    
    console.log('✅ Dry run completed successfully!\n');
    console.log('📝 Summary:');
    console.log(`  - Migration SQL: Valid`);
    console.log(`  - Partitions: ${partitionResult.rows[0].partition_count} created`);
    console.log(`  - Data migration: ${oldCount === newCount ? 'Success' : 'Failed'}`);
    console.log(`  - Indexes: ${indexResult.rows[0].index_count} created`);
    console.log(`  - Insert test: Passed`);
    console.log(`  - Partition pruning: ${hasPruning ? 'Working' : 'Not working'}`);
    console.log('\n💡 To apply migration for real, run:');
    console.log('   psql $DATABASE_URL -f database/migrations/006_partition_ai_decisions.sql\n');
    
    client.release();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    await client.query('ROLLBACK');
    client.release();
    process.exit(1);
  }
}

testMigration();
