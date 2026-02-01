#!/usr/bin/env node
/**
 * Apply JSONB Indexes Migration
 */

import { getClient } from '../database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const client = await getClient();
  
  try {
    console.log('🚀 Applying JSONB indexes migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/007_add_jsonb_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Creating GIN indexes (this may take a few moments)...\n');
    
    const startTime = Date.now();
    
    // Execute migration (includes BEGIN/COMMIT)
    await client.query(migrationSQL);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Migration completed in ${duration}ms\n`);
    
    // Verify results
    console.log('📊 Verifying indexes...\n');
    
    // Check indexes exist
    const indexResult = await client.query(`
      SELECT 
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE indexrelname IN (
        'idx_ai_agents_config_gin',
        'idx_ai_agents_metadata_gin',
        'idx_ai_decisions_input_data_gin',
        'idx_ai_decisions_output_data_gin'
      )
      ORDER BY relname, indexrelname
    `);
    
    console.log('✅ GIN Indexes Created:\n');
    console.table(indexResult.rows.map(row => ({
      Table: row.tablename,
      Index: row.indexname,
      Size: row.index_size
    })));
    
    // Count partition indexes
    const partitionIndexResult = await client.query(`
      SELECT COUNT(*) as partition_index_count
      FROM pg_stat_user_indexes
      WHERE (
        indexrelname LIKE '%input_data%gin%' 
        OR indexrelname LIKE '%output_data%gin%'
      )
      AND relname LIKE 'ai_decisions_%'
    `);
    
    console.log(`\n✅ Partition Indexes: ${partitionIndexResult.rows[0].partition_index_count} indexes inherited by partitions`);
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('  1. Run performance test: node scripts/test_jsonb_performance.js');
    console.log('  2. Compare with baseline performance');
    console.log('  3. Verify >50% improvement in query times\n');
    
    client.release();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    client.release();
    process.exit(1);
  }
}

applyMigration();
