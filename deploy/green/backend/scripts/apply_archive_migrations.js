#!/usr/bin/env node
/**
 * Apply Archive Migrations
 */

import { getClient } from '../database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigrations() {
  const client = await getClient();
  
  try {
    console.log('🚀 Applying archive migrations...\n');
    
    // Step 1: Create archive tables
    console.log('📋 Step 1: Creating archive tables...');
    const migration1Path = path.join(__dirname, '../database/migrations/008_create_archive_tables.sql');
    const migration1SQL = fs.readFileSync(migration1Path, 'utf8');
    
    await client.query(migration1SQL);
    console.log('✅ Archive tables created\n');
    
    // Step 2: Create maintenance functions
    console.log('📋 Step 2: Creating maintenance functions...');
    const migration2Path = path.join(__dirname, '../database/migrations/archive_maintenance.sql');
    const migration2SQL = fs.readFileSync(migration2Path, 'utf8');
    
    await client.query(migration2SQL);
    console.log('✅ Maintenance functions created\n');
    
    // Verify
    console.log('📊 Verification:\n');
    
    // Check archive table
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'ai_decisions_archive'
      )
    `);
    console.log(`  Archive table exists: ${tableCheck.rows[0].exists ? '✅' : '❌'}`);
    
    // Check view
    const viewCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE viewname = 'ai_decisions_all'
      )
    `);
    console.log(`  Union view exists: ${viewCheck.rows[0].exists ? '✅' : '❌'}`);
    
    // Check functions
    const funcCheck = await client.query(`
      SELECT COUNT(*) as func_count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname IN ('archive_old_decisions', 'restore_from_archive', 'check_archive_health')
    `);
    console.log(`  Archive functions: ${funcCheck.rows[0].func_count}/3 created ${funcCheck.rows[0].func_count === '3' ? '✅' : '❌'}`);
    
    // List partitions
    const partitions = await client.query(`
      SELECT * FROM list_archive_partitions()
    `);
    console.log(`  Archive partitions: ${partitions.rows.length} created\n`);
    
    if (partitions.rows.length > 0) {
      console.table(partitions.rows.map(row => ({
        Partition: row.partition_name,
        Rows: row.row_count,
        Size: row.size
      })));
    }
    
    console.log('\n✅ All migrations applied successfully!\n');
    
    console.log('📝 Next steps:');
    console.log('  1. Test archival: SELECT * FROM archive_old_decisions(90);');
    console.log('  2. Check health: node scripts/check_archive_health.js');
    console.log('  3. Query view: SELECT COUNT(*), data_source FROM ai_decisions_all GROUP BY data_source;');
    console.log('  4. Set up cron: crontab -e\n');
    
    client.release();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    client.release();
    process.exit(1);
  }
}

applyMigrations();
