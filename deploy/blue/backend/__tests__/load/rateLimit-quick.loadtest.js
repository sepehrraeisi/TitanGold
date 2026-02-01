#!/usr/bin/env node

/**
 * Quick Load Test for Redis Rate Limiter
 * Tests burst load capability
 */

import http from 'http';

const BASE_URL = 'http://localhost:5002';
const TOTAL_REQUESTS = 1000; // Test with 1000 requests
const CONCURRENCY = 100; // Send 100 at a time

let successCount = 0;
let errorCount = 0;
let rateLimitedCount = 0;
let startTime;

function makeRequest() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5002,
      path: '/api/health',
      method: 'GET'
    }, (res) => {
      if (res.statusCode === 429) rateLimitedCount++;
      else if (res.statusCode >= 200 && res.statusCode < 300) successCount++;
      else errorCount++;
      resolve();
    });

    req.on('error', () => {
      errorCount++;
      resolve();
    });

    req.setTimeout(3000, () => {
      req.destroy();
      errorCount++;
      resolve();
    });

    req.end();
  });
}

async function runTest() {
  console.log(`🚀 Load Test: ${TOTAL_REQUESTS} requests with concurrency ${CONCURRENCY}\n`);
  
  startTime = Date.now();
  
  // Send requests in batches
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, TOTAL_REQUESTS - i);
    const promises = Array(batch).fill().map(() => makeRequest());
    await Promise.all(promises);
    process.stdout.write(`\r   Progress: ${i + batch}/${TOTAL_REQUESTS}`);
  }
  
  const duration = (Date.now() - startTime) / 1000;
  const rps = Math.floor(TOTAL_REQUESTS / duration);
  
  console.log('\n\n📊 Results:');
  console.log(`   Success: ${successCount}`);
  console.log(`   Rate limited: ${rateLimitedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Duration: ${duration.toFixed(2)}s`);
  console.log(`   RPS: ${rps}`);
  console.log(`\n${rps >= 900 ? '✅ PASS' : '❌ FAIL'}: Target was 1000 req/s\n`);
  
  process.exit(rps >= 900 ? 0 : 1);
}

runTest().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
