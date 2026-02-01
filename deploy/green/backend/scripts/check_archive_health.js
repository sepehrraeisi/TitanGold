#!/usr/bin/env node
/**
 * Archive Health Check Script
 * Task: DATABASE-003
 * Date: 2026-01-07
 * 
 * Monitors ai_decisions archival system and alerts on issues.
 * 
 * Exit codes:
 * - 0: Healthy
 * - 1: Warning or Error detected
 * - 2: Script error
 */

import { query } from '../database/db.js';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function checkArchiveHealth() {
  try {
    log('🔍 Checking archive system health...', 'blue');
    log('='.repeat(60), 'blue');
    console.log();
    
    // Run health check function
    const result = await query('SELECT * FROM check_archive_health()');
    
    if (!result.rows || result.rows.length === 0) {
      log('⚠️  No health data available', 'yellow');
      process.exit(1);
    }
    
    const health = result.rows[0];
    
    // Display statistics
    log('📊 Archive Statistics:', 'blue');
    console.log(`  Active Records: ${health.active_records}`);
    console.log(`  Archived Records: ${health.archived_records}`);
    console.log(`  Oldest Active: ${health.oldest_active_date || 'N/A'}`);
    console.log(`  Last Archive Run: ${health.last_archive_date || 'Never'}`);
    console.log(`  Days Since Run: ${health.days_since_last_archive ?? 'N/A'} days`);
    console.log(`  Last Run Status: ${health.last_archive_success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Records Pending: ${health.records_pending_archive}`);
    console.log();
    
    // Display detailed archive history
    log('📋 Recent Archive History:', 'blue');
    const historyResult = await query(`
      SELECT 
        archive_date,
        records_archived,
        execution_time_ms,
        success,
        error_message
      FROM ai_decisions_archive_stats
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (historyResult.rows.length > 0) {
      console.table(historyResult.rows.map(row => ({
        Date: row.archive_date,
        Records: row.records_archived,
        'Time (ms)': row.execution_time_ms,
        Success: row.success ? '✅' : '❌',
        Error: row.error_message || '-'
      })));
    } else {
      console.log('  No archive history found');
    }
    console.log();
    
    // Display partition information
    log('📁 Archive Partitions:', 'blue');
    const partitionsResult = await query(`
      SELECT * FROM list_archive_partitions()
    `);
    
    if (partitionsResult.rows.length > 0) {
      console.table(partitionsResult.rows.map(row => ({
        Partition: row.partition_name,
        'Start Date': row.start_date,
        Rows: row.row_count,
        Size: row.size
      })));
    } else {
      console.log('  No partitions found');
    }
    console.log();
    
    // Health status
    log('='.repeat(60), 'blue');
    
    const status = health.status;
    if (status === 'OK') {
      log(`✅ Health Status: ${status}`, 'green');
      log('Archive system is healthy', 'green');
      console.log();
      process.exit(0);
    } else if (status.includes('WARNING')) {
      log(`⚠️  Health Status: ${status}`, 'yellow');
      log('Archive system needs attention', 'yellow');
      
      // Provide recommendations
      if (health.records_pending_archive > 0) {
        console.log();
        log('💡 Recommendation:', 'yellow');
        console.log(`  Run archival to process ${health.records_pending_archive} pending records:`);
        console.log('  ./scripts/archive-old-decisions.sh');
      }
      
      if (health.days_since_last_archive > 30) {
        console.log();
        log('💡 Recommendation:', 'yellow');
        console.log('  Archive has not run in >30 days. Check cron job:');
        console.log('  crontab -l | grep archive');
      }
      
      console.log();
      process.exit(1);
    } else if (status.includes('ERROR')) {
      log(`❌ Health Status: ${status}`, 'red');
      log('CRITICAL: Archive system failure detected!', 'red');
      
      // Show error details
      if (!health.last_archive_success) {
        console.log();
        log('Last archive failed. Check logs:', 'red');
        console.log('  tail -f /var/log/titangold/archive-*.log');
        
        // Show error from stats table
        const errorResult = await query(`
          SELECT error_message, created_at
          FROM ai_decisions_archive_stats
          WHERE success = FALSE
          ORDER BY created_at DESC
          LIMIT 1
        `);
        
        if (errorResult.rows.length > 0) {
          console.log();
          log('Error Details:', 'red');
          console.log(`  Time: ${errorResult.rows[0].created_at}`);
          console.log(`  Error: ${errorResult.rows[0].error_message}`);
        }
      }
      
      console.log();
      process.exit(1);
    } else {
      log(`⚠️  Health Status: ${status}`, 'yellow');
      log('Unknown status - manual investigation needed', 'yellow');
      console.log();
      process.exit(1);
    }
    
  } catch (error) {
    log('❌ Error checking archive health:', 'red');
    console.error(error);
    console.log();
    log('Possible issues:', 'yellow');
    console.log('  1. Archive tables not created - run migration 008');
    console.log('  2. Archive functions not installed - run archive_maintenance.sql');
    console.log('  3. Database connection issues');
    console.log();
    process.exit(2);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkArchiveHealth();
}

export default checkArchiveHealth;
