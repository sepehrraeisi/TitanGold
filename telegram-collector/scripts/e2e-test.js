#!/usr/bin/env node
/**
 * Telegram Collector E2E Testing Script (Phase 5)
 * 
 * Automated end-to-end tests for the Telegram Collector system:
 * 1. Health check - Verify collector is responding
 * 2. Channel polling test - Test message fetching
 * 3. Database verification - Check messages are saved
 * 4. Error detection - Identify and alert on failures
 * 
 * Run: node telegram-collector/scripts/e2e-test.js [--verbose]
 */

const { Pool } = require('pg');

// Configuration
const COLLECTOR_BASE_URL = process.env.COLLECTOR_URL || 'http://127.0.0.1:3002';
const TEST_CHANNEL = process.env.TEST_CHANNEL || 'bbcpersian'; // High-priority test channel
const VERBOSE = process.argv.includes('--verbose');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'titangold_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

// Helper functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '  ℹ️ ',
    success: '  ✅',
    error: '  ❌',
    warning: '  ⚠️ ',
    debug: '  🔍'
  }[level] || '  ';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function addTestResult(name, passed, message, warning = false) {
  testResults.tests.push({ name, passed, message, warning });
  if (warning) {
    testResults.warnings++;
  } else if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function runTest(name, testFn) {
  try {
    log(`Running: ${name}`, 'info');
    await testFn();
  } catch (error) {
    log(`Test failed: ${name} - ${error.message}`, 'error');
    addTestResult(name, false, error.message);
  }
}

// Test 1: Health Check
async function testHealthCheck() {
  const response = await fetch(`${COLLECTOR_BASE_URL}/api/telegram-collector/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  // Health endpoint returns {status, service, version} not {success}
  if (!data.status || data.status !== 'healthy') {
    throw new Error(`Health check returned status: ${data.status || 'unknown'}`);
  }
  
  log(`Health check passed: ${data.service} v${data.version} is ${data.status}`, 'success');
  addTestResult('Health Check', true, `Collector service is ${data.status}`);
  
  return data;
}

// Test 2: Collector Channels API
async function testCollectorChannelsAPI() {
  const response = await fetch(`${COLLECTOR_BASE_URL}/api/telegram-collector/collector-channels`);
  
  if (!response.ok) {
    throw new Error(`Channels API failed: HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success || !Array.isArray(data.channels)) {
    throw new Error('Channels API returned invalid data structure');
  }
  
  const channelCount = data.channels.length;
  const syncedCount = data.channels.filter(ch => ch.lastSyncedAt).length;
  const errorCount = data.channels.filter(ch => ch.errorCount > 0).length;
  const syncRate = channelCount > 0 ? (syncedCount / channelCount * 100).toFixed(1) : 0;
  
  log(`Channels API passed: ${channelCount} channels, ${syncedCount} synced (${syncRate}%), ${errorCount} with errors`, 'success');
  addTestResult('Collector Channels API', true, `${channelCount} channels tracked, sync rate ${syncRate}%`);
  
  // Warning if sync rate is low
  if (parseFloat(syncRate) < 50) {
    log(`Low sync rate warning: ${syncRate}% < 50%`, 'warning');
    addTestResult('Sync Rate Check', true, `Sync rate ${syncRate}% is below 50%`, true);
  }
  
  return data;
}

// Test 3: Force-Sync Test Channel
async function testForceSyncChannel() {
  log(`Testing force-sync on channel: ${TEST_CHANNEL}`, 'info');
  
  const startTime = Date.now();
  const response = await fetch(`${COLLECTOR_BASE_URL}/api/telegram-collector/channels/${TEST_CHANNEL}/force-sync`, {
    method: 'POST'
  });
  
  const latency = Date.now() - startTime;
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Force-sync failed: ${errorData.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Force-sync returned success=false: ${data.message || 'Unknown error'}`);
  }
  
  log(`Force-sync passed: ${data.messagesFetched || 0} messages fetched, ${data.messagesSaved || 0} saved (${latency}ms)`, 'success');
  addTestResult('Force-Sync Channel', true, `${data.messagesFetched} messages fetched, ${data.messagesSaved} saved in ${latency}ms`);
  
  return data;
}

// Test 4: Database Messages Verification
async function testDatabaseMessages() {
  const result = await pool.query(`
    SELECT COUNT(*) as total_messages,
           COUNT(DISTINCT channel_id) as channels_with_messages,
           MAX(telegram_created_at) as latest_message,
           EXTRACT(EPOCH FROM (NOW() - MAX(telegram_created_at)))/60 as minutes_since_latest
    FROM telegram_messages
  `);
  
  const stats = result.rows[0];
  
  if (parseInt(stats.total_messages) === 0) {
    log('No messages found in database (this may be normal for new setup)', 'warning');
    addTestResult('Database Messages', true, 'No messages in database yet', true);
    return stats;
  }
  
  log(`Database verification passed: ${stats.total_messages} messages from ${stats.channels_with_messages} channels`, 'success');
  log(`  Latest message: ${Math.round(stats.minutes_since_latest)} minutes ago`, 'debug');
  
  addTestResult('Database Messages', true, `${stats.total_messages} messages in database`);
  
  // Warning if latest message is too old
  if (stats.minutes_since_latest > 60) {
    log(`Stale data warning: Latest message is ${Math.round(stats.minutes_since_latest)} minutes old`, 'warning');
    addTestResult('Message Freshness', true, `Latest message ${Math.round(stats.minutes_since_latest)}min old`, true);
  }
  
  return stats;
}

// Test 5: Error Tracking Verification
async function testErrorTracking() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE error_count > 0) as channels_with_errors,
      COUNT(*) FILTER (WHERE error_count >= 3) as critical_error_channels,
      MAX(error_count) as max_error_count,
      COUNT(*) FILTER (WHERE priority = 'high' AND error_count > 0) as high_priority_errors
    FROM telegram_channels
    WHERE is_active = true
  `);
  
  const stats = result.rows[0];
  
  log(`Error tracking check: ${stats.channels_with_errors} channels with errors, ${stats.critical_error_channels} critical`, 'info');
  
  if (parseInt(stats.critical_error_channels) > 0) {
    log(`Critical errors detected: ${stats.critical_error_channels} channels with 3+ errors`, 'warning');
    addTestResult('Error Tracking', true, `${stats.critical_error_channels} critical error channels detected`, true);
  } else {
    addTestResult('Error Tracking', true, 'No critical errors detected');
  }
  
  if (parseInt(stats.high_priority_errors) > 0) {
    log(`High-priority channel errors: ${stats.high_priority_errors} channels`, 'warning');
  }
  
  return stats;
}

// Test 6: Monitoring Service Check
async function testMonitoringService() {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    const { stdout } = await execPromise('pm2 list | grep telegram-collector-monitor');
    
    if (stdout.includes('online')) {
      log('Monitoring service is running', 'success');
      addTestResult('Monitoring Service', true, 'PM2 service telegram-collector-monitor is online');
    } else {
      throw new Error('Monitoring service not online');
    }
  } catch (error) {
    if (error.code === 1 && !error.stdout) {
      throw new Error('Monitoring service not found in PM2');
    }
    throw error;
  }
}

// Main test execution
async function runE2ETests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   🧪 Telegram Collector E2E Test Suite');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  
  try {
    // Test 1: Health Check
    await runTest('Test 1: Health Check', testHealthCheck);
    
    // Test 2: Collector Channels API
    await runTest('Test 2: Collector Channels API', testCollectorChannelsAPI);
    
    // Test 3: Force-Sync Test
    await runTest('Test 3: Force-Sync Test Channel', testForceSyncChannel);
    
    // Test 4: Database Verification
    await runTest('Test 4: Database Messages Verification', testDatabaseMessages);
    
    // Test 5: Error Tracking
    await runTest('Test 5: Error Tracking Verification', testErrorTracking);
    
    // Test 6: Monitoring Service
    await runTest('Test 6: Monitoring Service Check', testMonitoringService);
    
  } catch (error) {
    log(`Unexpected error during tests: ${error.message}`, 'error');
  } finally {
    await pool.end();
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   📊 Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`  Total Tests:    ${testResults.passed + testResults.failed}`);
  console.log(`  ✅ Passed:      ${testResults.passed}`);
  console.log(`  ❌ Failed:      ${testResults.failed}`);
  console.log(`  ⚠️  Warnings:    ${testResults.warnings}`);
  console.log(`  ⏱️  Duration:    ${duration}s`);
  
  if (testResults.failed > 0) {
    console.log('\n  ❌ FAILED TESTS:');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      console.log(`     • ${t.name}: ${t.message}`);
    });
  }
  
  if (testResults.warnings > 0) {
    console.log('\n  ⚠️  WARNINGS:');
    testResults.tests.filter(t => t.warning).forEach(t => {
      console.log(`     • ${t.name}: ${t.message}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  // Exit with appropriate code
  const exitCode = testResults.failed > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    console.log('  🎉 All tests passed!\n');
  } else {
    console.log(`  ⚠️  ${testResults.failed} test(s) failed. Please investigate.\n`);
  }
  
  process.exit(exitCode);
}

// Run tests
runE2ETests().catch(error => {
  console.error('\n❌ Fatal error running E2E tests:', error);
  process.exit(1);
});
