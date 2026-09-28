#!/usr/bin/env node
/**
 * Database Migration Tool Setup Script
 * Task: DATABASE-006 (R4 reconciled)
 *
 * Creates the node-pg-migrate ledger table (`pgmigrations`) ONLY.
 *
 * CRITICAL (R4): This script MUST NOT mark migrations as applied without
 * executing their SQL. LEDGERED_APPLIED must never mean NOT_EXECUTED.
 *
 * Canonical execution path: `npm run migrate:up` (backend/database/migrate.js
 * → node-pg-migrate against database/migrations).
 */

import { query } from '../database/db.js';

async function setupMigrationSystem() {
  console.log('🔧 Setting up migration ledger (pgmigrations) only...\n');

  try {
    console.log('Step 1: Creating pgmigrations table...');
    await query(`
      CREATE TABLE IF NOT EXISTS pgmigrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ pgmigrations table ready\n');

    const { rows: existingMigrations } = await query(
      'SELECT name, run_on FROM pgmigrations ORDER BY name'
    );
    console.log(`Ledger rows present: ${existingMigrations.length}`);
    if (existingMigrations.length > 0) {
      console.log('Last recorded names (up to 10):');
      existingMigrations.slice(-10).forEach((m) => {
        console.log(`  ${m.name} - ${m.run_on.toISOString()}`);
      });
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ Migration ledger setup complete (NO mark-without-execute).');
    console.log('═'.repeat(70));
    console.log('\nInvariant: LEDGERED_APPLIED requires SQL execution via migrate:up.');
    console.log('This script does NOT insert migration names into pgmigrations.');
    console.log('\nNext steps:');
    console.log('  - Use: npm run migrate:up      # Execute pending migrations then ledger');
    console.log('  - Use: npm run migrate:status  # Show migration status');
    console.log('  - Use: npm run migrate:down    # Rollback last migration');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setupMigrationSystem();
