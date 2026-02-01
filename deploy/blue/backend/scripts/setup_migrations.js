#!/usr/bin/env node
/**
 * Database Migration Tool Setup Script
 * Task: DATABASE-006
 * 
 * This script sets up node-pg-migrate and converts existing migrations
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { query } from '../database/db.js';

const MIGRATIONS_DIR = 'database/migrations';

async function setupMigrationSystem() {
  console.log('🔧 Setting up migration system (DATABASE-006)...\n');
  
  try {
    // Step 1: Create pgmigrations table
    console.log('Step 1: Creating pgmigrations table...');
    await query(`
      CREATE TABLE IF NOT EXISTS pgmigrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ pgmigrations table created\n');
    
    // Step 2: Check existing migrations
    console.log('Step 2: Checking existing migrations...');
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .filter(f => !f.includes('test_') && !f.includes('maintenance'))
      .sort();
    
    console.log(`Found ${files.length} migration files:`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');
    
    // Step 3: Check which migrations have been run
    console.log('Step 3: Recording existing migrations...');
    const { rows: existingMigrations } = await query('SELECT name FROM pgmigrations ORDER BY name');
    const alreadyRecorded = new Set(existingMigrations.map(r => r.name));
    
    console.log(`Already recorded: ${alreadyRecorded.size} migrations`);
    console.log('');
    
    // Step 4: Record all existing migrations as completed
    console.log('Step 4: Recording migrations as completed...');
    let recorded = 0;
    
    for (const file of files) {
      const migrationName = basename(file, '.sql');
      
      if (!alreadyRecorded.has(migrationName)) {
        await query(
          'INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())',
          [migrationName]
        );
        console.log(`  ✅ Recorded: ${migrationName}`);
        recorded++;
      } else {
        console.log(`  ⏭️  Already recorded: ${migrationName}`);
      }
    }
    
    console.log(`\nRecorded ${recorded} new migrations\n`);
    
    // Step 5: Show migration status
    console.log('Step 5: Current migration status:');
    const { rows: allMigrations } = await query(`
      SELECT name, run_on 
      FROM pgmigrations 
      ORDER BY run_on DESC 
      LIMIT 10
    `);
    
    console.log('\nLast 10 migrations:');
    allMigrations.forEach(m => {
      console.log(`  ${m.name} - ${m.run_on.toISOString()}`);
    });
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ Migration system setup complete!');
    console.log('═'.repeat(70));
    console.log('\nNext steps:');
    console.log('  - Use: npm run migrate:up    # Run pending migrations');
    console.log('  - Use: npm run migrate:down  # Rollback last migration');
    console.log('  - Use: npm run migrate:create <name>  # Create new migration');
    console.log('  - Use: npm run migrate:status  # Show migration status');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setupMigrationSystem();
