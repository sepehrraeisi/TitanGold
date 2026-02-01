#!/usr/bin/env node
/**
 * Apply Foreign Key Indexes Migration
 * Task: DATABASE-004
 */

import { readFileSync } from 'fs';
import { query } from '../database/db.js';

async function applyMigration() {
  console.log('📦 Applying Foreign Key Indexes Migration...\n');
  
  try {
    // Read migration file
    const migrationSQL = readFileSync('database/migrations/009_add_fk_indexes.sql', 'utf8');
    
    console.log('Running migration 009_add_fk_indexes.sql...');
    
    // Execute migration
    await query(migrationSQL);
    
    console.log('\n✅ Migration completed successfully!\n');
    
    // Verify indexes
    const result = await query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_catalog.pg_stat_user_indexes
      WHERE schemaname = 'public' AND (
        (tablename = 'ai_decisions' AND indexname IN ('idx_ai_decisions_agent_id', 'idx_ai_decisions_user_id'))
        OR (tablename = 'ai_learning_events' AND indexname IN ('idx_learning_events_agent', 'idx_learning_events_decision'))
      )
      ORDER BY tablename, indexname;
    `);
    
    console.log('Created/Verified Indexes:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
