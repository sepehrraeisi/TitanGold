#!/usr/bin/env node
/**
 * Apply Partition Migration
 * Applies the partition migration to ai_decisions table
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
    console.log('🚀 Applying partition migration to ai_decisions table...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/006_partition_ai_decisions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration (this may take a few moments)...\n');
    
    const startTime = Date.now();
    
    // Execute migration (includes BEGIN/COMMIT)
    await client.query(migrationSQL);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Migration completed in ${duration}ms\n`);
    
    // Verify results
    console.log('📊 Verifying migration...\n');
    
    // Check partitions
    const partitionResult = await client.query(`
      SELECT COUNT(*) as partition_count 
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
      AND c.relispartition = true
      AND c.relname LIKE 'ai_decisions_%'
      AND n.nspname = 'public'
    `);
    
    console.log(`  ✅ Partitions created: ${partitionResult.rows[0].partition_count}`);
    
    // Check data
    const countResult = await client.query('SELECT COUNT(*) FROM ai_decisions');
    console.log(`  ✅ Rows in partitioned table: ${countResult.rows[0].count}`);
    
    // Check old table exists
    const oldTableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ai_decisions_old'
      )
    `);
    
    console.log(`  ✅ Backup table (ai_decisions_old): ${oldTableExists.rows[0].exists ? 'Preserved' : 'Not found'}`);
    
    // Install maintenance functions
    console.log('\n📋 Installing maintenance functions...\n');
    
    const maintenancePath = path.join(__dirname, '../database/migrations/partition_maintenance.sql');
    const maintenanceSQL = fs.readFileSync(maintenancePath, 'utf8');
    
    await client.query(maintenanceSQL);
    
    console.log('  ✅ Maintenance functions installed\n');
    
    // Test health check
    console.log('🔍 Running health check...\n');
    
    const healthResult = await client.query('SELECT check_missing_partitions()');
    console.log(healthResult.rows[0].check_missing_partitions);
    
    // List partitions
    console.log('\n📊 Partition summary:\n');
    
    const listResult = await client.query('SELECT * FROM list_partitions() LIMIT 10');
    console.table(listResult.rows.map(row => ({
      Partition: row.partition_name,
      Rows: row.row_count,
      Size: row.size,
    })));
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('  1. Monitor application for 24-48 hours');
    console.log('  2. Run test queries: psql $DATABASE_URL -f database/migrations/test_partition_queries.sql');
    console.log('  3. After verification, drop old table: DROP TABLE ai_decisions_old;');
    console.log('  4. Set up cron job: node scripts/check_partitions.js\n');
    
    client.release();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n⚠️  Database may be in inconsistent state. Check ai_decisions_old table for backup.\n');
    client.release();
    process.exit(1);
  }
}

applyMigration();
