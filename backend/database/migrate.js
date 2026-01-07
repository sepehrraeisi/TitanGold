#!/usr/bin/env node
/**
 * Database Migration Script
 * Task: DATABASE-006
 * 
 * Wrapper around node-pg-migrate for running migrations
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

const command = process.argv[2] || 'up';
const args = process.argv.slice(3);

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env file');
  console.error('Please add: DATABASE_URL=postgresql://user@host:port/database');
  process.exit(1);
}

console.log('🔄 Running migration:', command);
console.log('Database:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
console.log('');

try {
  // Build the node-pg-migrate command
  const npmBin = 'npx';
  const migrateBin = 'node-pg-migrate';
  
  let cmd;
  switch (command) {
    case 'up':
      cmd = `${npmBin} ${migrateBin} up`;
      break;
    case 'down':
      cmd = `${npmBin} ${migrateBin} down`;
      break;
    case 'create':
      const name = args[0];
      if (!name) {
        console.error('❌ Migration name required: npm run migrate:create <name>');
        process.exit(1);
      }
      cmd = `${npmBin} ${migrateBin} create ${name}`;
      break;
    case 'status':
      // Custom status implementation since node-pg-migrate doesn't have a status command
      await showMigrationStatus();
      process.exit(0);
      break;
    case 'redo':
      cmd = `${npmBin} ${migrateBin} redo`;
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error('Available commands: up, down, create, status, redo');
      process.exit(1);
  }
  
  // Execute the migration command
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env },
  });
  
  console.log('\n✅ Migration command completed');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}

async function showMigrationStatus() {
  try {
    const { rows } = await query(`
      SELECT name, run_on 
      FROM pgmigrations 
      ORDER BY run_on DESC
    `);
    
    console.log('📊 Migration Status');
    console.log('═'.repeat(70));
    console.log(`\nTotal migrations applied: ${rows.length}\n`);
    
    if (rows.length > 0) {
      console.log('Recent migrations:');
      rows.slice(0, 10).forEach((row, index) => {
        const date = new Date(row.run_on).toISOString();
        console.log(`  ${index + 1}. ${row.name}`);
        console.log(`     Applied: ${date}`);
      });
      
      if (rows.length > 10) {
        console.log(`\n  ... and ${rows.length - 10} more`);
      }
    } else {
      console.log('No migrations have been applied yet.');
    }
    
    console.log('\n' + '═'.repeat(70));
  } catch (error) {
    console.error('❌ Failed to get migration status:', error.message);
    throw error;
  }
}
