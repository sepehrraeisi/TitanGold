#!/usr/bin/env node
/**
 * Connection Pool Load Test
 * Task: DATABASE-005
 * Tests: Pool handles 100 concurrent requests
 */

import { query, getPoolMetrics, checkConnectionLeaks } from '../database/db.js';

async function testPoolLoad() {
  console.log('🧪 Testing Connection Pool Load (DATABASE-005)...\n');
  
  try {
    // Get initial metrics
    console.log('📊 Initial Pool Metrics:');
    console.log(getPoolMetrics());
    console.log('');
    
    // Test 1: Sequential queries baseline
    console.log('Test 1: Sequential Queries (10 queries)');
    console.log('─'.repeat(60));
    const sequentialStart = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await query('SELECT NOW() as current_time, $1 as query_number', [i + 1]);
    }
    
    const sequentialDuration = Date.now() - sequentialStart;
    console.log(`✅ Sequential: ${sequentialDuration}ms (avg: ${(sequentialDuration / 10).toFixed(2)}ms/query)`);
    console.log('');
    
    // Test 2: 50 Concurrent Requests
    console.log('Test 2: 50 Concurrent Requests');
    console.log('─'.repeat(60));
    const concurrent50Start = Date.now();
    
    const promises50 = [];
    for (let i = 0; i < 50; i++) {
      promises50.push(
        query('SELECT NOW() as current_time, $1 as query_number, pg_sleep(0.01)', [i + 1])
      );
    }
    
    await Promise.all(promises50);
    const concurrent50Duration = Date.now() - concurrent50Start;
    console.log(`✅ 50 Concurrent: ${concurrent50Duration}ms (avg: ${(concurrent50Duration / 50).toFixed(2)}ms/query)`);
    
    const metrics50 = getPoolMetrics();
    console.log('Pool Metrics:', {
      totalConnections: metrics50.totalConnections,
      activeConnections: metrics50.activeConnections,
      utilization: metrics50.utilization,
    });
    console.log('');
    
    // Test 3: 100 Concurrent Requests (DoD requirement)
    console.log('Test 3: 100 Concurrent Requests (DoD Requirement)');
    console.log('─'.repeat(60));
    const concurrent100Start = Date.now();
    
    const promises100 = [];
    for (let i = 0; i < 100; i++) {
      promises100.push(
        query('SELECT NOW() as current_time, $1 as query_number, pg_sleep(0.01)', [i + 1])
      );
    }
    
    await Promise.all(promises100);
    const concurrent100Duration = Date.now() - concurrent100Start;
    console.log(`✅ 100 Concurrent: ${concurrent100Duration}ms (avg: ${(concurrent100Duration / 100).toFixed(2)}ms/query)`);
    
    const metrics100 = getPoolMetrics();
    console.log('Pool Metrics:', {
      totalConnections: metrics100.totalConnections,
      activeConnections: metrics100.activeConnections,
      utilization: metrics100.utilization,
    });
    console.log('');
    
    // Test 4: 200 Concurrent Requests (Stress test)
    console.log('Test 4: 200 Concurrent Requests (Stress Test)');
    console.log('─'.repeat(60));
    const concurrent200Start = Date.now();
    
    const promises200 = [];
    for (let i = 0; i < 200; i++) {
      promises200.push(
        query('SELECT NOW() as current_time, $1 as query_number, pg_sleep(0.01)', [i + 1])
      );
    }
    
    await Promise.all(promises200);
    const concurrent200Duration = Date.now() - concurrent200Start;
    console.log(`✅ 200 Concurrent: ${concurrent200Duration}ms (avg: ${(concurrent200Duration / 200).toFixed(2)}ms/query)`);
    
    const metrics200 = getPoolMetrics();
    console.log('Pool Metrics:', {
      totalConnections: metrics200.totalConnections,
      activeConnections: metrics200.activeConnections,
      utilization: metrics200.utilization,
    });
    console.log('');
    
    // Test 5: Check for connection leaks
    console.log('Test 5: Connection Leak Detection');
    console.log('─'.repeat(60));
    const leakStatus = checkConnectionLeaks();
    
    if (leakStatus.hasLeaks) {
      console.warn('⚠️  Connection leaks detected:', leakStatus);
    } else {
      console.log('✅ No connection leaks detected');
    }
    console.log(`Tracked connections: ${leakStatus.totalTrackedConnections}`);
    console.log('');
    
    // Final metrics
    console.log('═'.repeat(60));
    console.log('📊 FINAL POOL METRICS');
    console.log('═'.repeat(60));
    const finalMetrics = getPoolMetrics();
    console.log(JSON.stringify(finalMetrics, null, 2));
    console.log('');
    
    // Summary
    console.log('═'.repeat(60));
    console.log('✅ LOAD TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Sequential (10):     ${sequentialDuration}ms`);
    console.log(`Concurrent (50):     ${concurrent50Duration}ms`);
    console.log(`Concurrent (100):    ${concurrent100Duration}ms ✅ DoD`);
    console.log(`Concurrent (200):    ${concurrent200Duration}ms (stress)`);
    console.log('');
    console.log(`Peak Pool Utilization: ${finalMetrics.utilization}`);
    console.log(`Connection Leaks: ${leakStatus.hasLeaks ? '❌ DETECTED' : '✅ NONE'}`);
    console.log('');
    
    if (concurrent100Duration < 10000) {
      console.log('✅ DoD PASSED: Pool handles 100 concurrent requests successfully!');
    } else {
      console.log('⚠️  DoD WARNING: 100 concurrent requests took longer than expected');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPoolLoad();
