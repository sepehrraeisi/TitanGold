#!/usr/bin/env node
/**
 * Partition Health Check Script
 * Task: DATABASE-001
 * 
 * Monitors ai_decisions table partitions and alerts if partitions are missing.
 * Should be run via cron job or CI/CD pipeline.
 * 
 * Exit codes:
 * - 0: All partitions healthy
 * - 1: Missing partitions detected and created
 * - 2: Error occurred
 */

import { query, getClient } from '../database/db.js';

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

async function checkPartitions() {
  const client = await getClient();
  
  try {
    log('🔍 Checking ai_decisions partitions...', 'blue');
    log('='.repeat(60), 'blue');
    
    // Check for missing partitions
    const checkResult = await client.query('SELECT check_missing_partitions()');
    const status = checkResult.rows[0].check_missing_partitions;
    
    console.log(status);
    
    // If issues detected, auto-create partitions
    if (status.includes('ALERT') || status.includes('WARNING')) {
      log('\n🔧 Auto-creating missing partitions...', 'yellow');
      
      const createResult = await client.query('SELECT create_future_partitions(12)');
      const createStatus = createResult.rows[0].create_future_partitions;
      
      console.log(createStatus);
      
      // Verify after creation
      const verifyResult = await client.query('SELECT check_missing_partitions()');
      const verifyStatus = verifyResult.rows[0].check_missing_partitions;
      
      if (verifyStatus.includes('ALERT') || verifyStatus.includes('WARNING')) {
        log('\n❌ Failed to create all required partitions!', 'red');
        console.log(verifyStatus);
        client.release();
        process.exit(2);
      }
      
      log('\n✅ Partitions created successfully', 'green');
      client.release();
      process.exit(1); // Exit 1 to indicate action was taken
    }
    
    // List all partitions
    log('\n📊 Partition Summary:', 'blue');
    const listResult = await client.query('SELECT * FROM list_partitions()');
    
    if (listResult.rows.length === 0) {
      log('⚠️  No partitions found!', 'yellow');
    } else {
      console.table(listResult.rows.map(row => ({
        Partition: row.partition_name,
        Rows: row.row_count,
        Size: row.size,
      })));
      
      const totalRows = listResult.rows.reduce((sum, row) => sum + parseInt(row.row_count), 0);
      log(`\n📈 Total rows across all partitions: ${totalRows}`, 'green');
    }
    
    log('\n✅ All partitions healthy!', 'green');
    client.release();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking partitions:', error);
    client.release();
    process.exit(2);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkPartitions();
}

export default checkPartitions;
