#!/usr/bin/env node

/**
 * Load Test Script for Redis Rate Limiter
 * Tests 1000 req/s sustained load
 */

import http from 'http';

const BASE_URL = 'http://localhost:5002';
const TEST_DURATION_SEC = 10;
const TARGET_RPS = 1000;
const TOTAL_REQUESTS = TEST_DURATION_SEC * TARGET_RPS;

// Get auth token (you'll need to replace this with a real token)
const TOKEN = process.env.TEST_TOKEN || '';

let successCount = 0;
let errorCount = 0;
let rateLimitedCount = 0;
let startTime;
let endTime;

function makeRequest() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5002,
      path: '/api/health', // Using health endpoint for load test
      method: 'GET',
      headers: TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 429) {
        rateLimitedCount++;
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        successCount++;
      } else {
        errorCount++;
      }
      resolve();
    });

    req.on('error', () => {
      errorCount++;
      resolve();
    });

    req.setTimeout(5000, () => {
      req.destroy();
      errorCount++;
      resolve();
    });

    req.end();
  });
}

async function runLoadTest() {
  console.log('🚀 Starting Load Test');
  console.log(`   Target: ${TARGET_RPS} requests/second`);
  console.log(`   Duration: ${TEST_DURATION_SEC} seconds`);
  console.log(`   Total requests: ${TOTAL_REQUESTS.toLocaleString()}`);
  console.log('');

  startTime = Date.now();

  // Create batches to simulate sustained load
  const BATCH_SIZE = 100;
  const BATCH_DELAY = Math.floor((1000 / TARGET_RPS) * BATCH_SIZE);

  for (let batch = 0; batch < TOTAL_REQUESTS / BATCH_SIZE; batch++) {
    const batchPromises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      batchPromises.push(makeRequest());
    }
    
    await Promise.all(batchPromises);
    
    // Progress indicator
    if (batch % 10 === 0) {
      const progress = ((batch * BATCH_SIZE) / TOTAL_REQUESTS * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const currentRPS = Math.floor((batch * BATCH_SIZE) / (elapsed || 1));
      process.stdout.write(`\r   Progress: ${progress}% | ${elapsed}s | ${currentRPS} req/s`);
    }
    
    // Add small delay to maintain target RPS
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
  }

  endTime = Date.now();
  
  console.log('\n');
  console.log('✅ Load Test Complete');
  console.log('');
  console.log('📊 Results:');
  console.log(`   Total requests: ${(successCount + errorCount + rateLimitedCount).toLocaleString()}`);
  console.log(`   Successful: ${successCount.toLocaleString()}`);
  console.log(`   Rate limited (429): ${rateLimitedCount.toLocaleString()}`);
  console.log(`   Errors: ${errorCount.toLocaleString()}`);
  console.log('');
  console.log('⏱️  Performance:');
  const durationSec = (endTime - startTime) / 1000;
  const actualRPS = Math.floor((successCount + rateLimitedCount) / durationSec);
  console.log(`   Duration: ${durationSec.toFixed(2)} seconds`);
  console.log(`   Actual RPS: ${actualRPS.toLocaleString()}`);
  console.log(`   Target RPS: ${TARGET_RPS.toLocaleString()}`);
  console.log(`   Success rate: ${((successCount / (successCount + errorCount + rateLimitedCount)) * 100).toFixed(2)}%`);
  console.log('');

  // Validation
  const passed = actualRPS >= TARGET_RPS * 0.9 && errorCount < TOTAL_REQUESTS * 0.01;
  if (passed) {
    console.log('✅ PASS: System handled target load successfully');
    process.exit(0);
  } else {
    console.log('❌ FAIL: System did not meet performance requirements');
    process.exit(1);
  }
}

// Run the test
runLoadTest().catch(err => {
  console.error('❌ Load test failed:', err);
  process.exit(1);
});
