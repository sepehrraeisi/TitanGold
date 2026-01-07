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
import { logger } from '../services/logger.js';

dotenv.config();

const command = process.argv[2] || 'up';
const args = process.argv.slice(3);

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL not set in .env file');
  logger.error('Please add: DATABASE_URL=postgresql://user@host:port/database');
  process.exit(1);
}

logger.info('🔄 Running migration:', command);
logger.info('Database:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
logger.info('');

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
        logger.error('❌ Migration name required: npm run migrate:create <name>');
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
      logger.error(`❌ Unknown command: ${command}`);
      logger.error('Available commands: up, down, create, status, redo');
      process.exit(1);
  }
  
  // Execute the migration command
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env },
  });
  
  logger.info('\n✅ Migration command completed');
} catch (error) {
  logger.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}

async function showMigrationStatus() {
  try {
    const { rows } = await query(`
      SELECT name, run_on 
      FROM pgmigrations 
      ORDER BY run_on DESC
    `);
    
    logger.info('📊 Migration Status');
    logger.info('═'.repeat(70));
    logger.info(`\nTotal migrations applied: ${rows.length}\n`);
    
    if (rows.length > 0) {
      logger.info('Recent migrations:');
      rows.slice(0, 10).forEach((row, index) => {
        const date = new Date(row.run_on).toISOString();
        logger.info(`  ${index + 1}. ${row.name}`);
        logger.info(`     Applied: ${date}`);
      });
      
      if (rows.length > 10) {
        logger.info(`\n  ... and ${rows.length - 10} more`);
      }
    } else {
      logger.info('No migrations have been applied yet.');
    }
    
    logger.info('\n' + '═'.repeat(70));
  } catch (error) {
    logger.error('❌ Failed to get migration status:', error.message);
    throw error;
  }
}
