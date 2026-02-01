#!/usr/bin/env node

/**
 * Performance Test for Redis Cache
 * Tests that cache reduces response time by >50%
 */

import http from 'http';

const BASE_URL = 'http://localhost:5002';
const AGENT_ID = 'agent-1'; // Technical analysis agent
const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '1h';
const TEST_RUNS = 5;

// Get auth token from environment or prompt
const TOKEN = process.env.TEST_TOKEN || '';

if (!TOKEN) {
  console.log('⚠️  Warning: No TEST_TOKEN provided. Test may fail due to authentication.');
  console.log('   Set TEST_TOKEN environment variable with a valid JWT token.');
  console.log('');
}

let uncachedTimes = [];
let cachedTimes = [];

async function makeRequest(url, token, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ duration, statusCode: res.statusCode, data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Send request body
    req.write(JSON.stringify({
      symbol: SYMBOL,
      timeframe: TIMEFRAME
    }));
    
    req.end();
  });
}

async function clearCache(agentId, symbol) {
  // Make a request to invalidate cache (we need a cache clear endpoint or just wait)
  // For now, we'll rely on the first request being uncached
  console.log(`🗑️  Clearing cache for ${agentId}/${symbol}...`);
  // In production, call DELETE /api/cache/agent/{agentId} endpoint
}

async function runTest() {
  console.log('🚀 Cache Performance Test');
  console.log(`   Agent: ${AGENT_ID}`);
  console.log(`   Symbol: ${SYMBOL}`);
  console.log(`   Timeframe: ${TIMEFRAME}`);
  console.log(`   Test runs: ${TEST_RUNS}`);
  console.log('');

  const url = `${BASE_URL}/api/ai-agents/${AGENT_ID}/run`;

  // Phase 1: Uncached requests (cold cache)
  console.log('📊 Phase 1: Testing UNCACHED performance (cold cache)');
  console.log('   Clearing cache and making fresh requests...');
  
  for (let i = 0; i < TEST_RUNS; i++) {
    try {
      // Wait a bit between requests to simulate cold cache
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6s (longer than cache TTL for test)
      }
      
      const result = await makeRequest(url, TOKEN);
      uncachedTimes.push(result.duration);
      console.log(`   Run ${i + 1}: ${result.duration}ms`);
    } catch (error) {
      console.error(`   Run ${i + 1} FAILED:`, error.message);
      // For auth failures, we can't continue
      if (error.message.includes('401')) {
        console.error('\n❌ Authentication failed. Please set TEST_TOKEN environment variable.');
        process.exit(1);
      }
    }
  }

  const avgUncached = uncachedTimes.reduce((a, b) => a + b, 0) / uncachedTimes.length;
  console.log(`   Average UNCACHED: ${avgUncached.toFixed(2)}ms`);
  console.log('');

  // Phase 2: Cached requests (warm cache)
  console.log('📊 Phase 2: Testing CACHED performance (warm cache)');
  console.log('   Making requests that should hit cache...');
  
  // First request to warm cache
  await makeRequest(url, TOKEN);
  console.log('   Cache warmed up');
  
  // Now test cached requests
  for (let i = 0; i < TEST_RUNS; i++) {
    try {
      const result = await makeRequest(url, TOKEN);
      cachedTimes.push(result.duration);
      console.log(`   Run ${i + 1}: ${result.duration}ms`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   Run ${i + 1} FAILED:`, error.message);
    }
  }

  const avgCached = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;
  console.log(`   Average CACHED: ${avgCached.toFixed(2)}ms`);
  console.log('');

  // Calculate improvement
  const improvement = ((avgUncached - avgCached) / avgUncached * 100);
  const speedup = avgUncached / avgCached;

  console.log('📈 Results:');
  console.log(`   Uncached avg: ${avgUncached.toFixed(2)}ms`);
  console.log(`   Cached avg: ${avgCached.toFixed(2)}ms`);
  console.log(`   Improvement: ${improvement.toFixed(2)}%`);
  console.log(`   Speedup: ${speedup.toFixed(2)}x faster`);
  console.log('');

  // Validate requirement: >50% improvement
  if (improvement >= 50) {
    console.log(`✅ PASS: Cache reduces response time by ${improvement.toFixed(2)}% (target: >50%)`);
    console.log('');
    process.exit(0);
  } else {
    console.log(`❌ FAIL: Cache only reduces response time by ${improvement.toFixed(2)}% (target: >50%)`);
    console.log('');
    console.log('💡 Possible reasons:');
    console.log('   - Agent execution is very fast (not much to cache)');
    console.log('   - Network latency dominates (test from same machine)');
    console.log('   - Redis overhead too high');
    console.log('   - Cache not being hit (check logs)');
    console.log('');
    process.exit(1);
  }
}

// Run the test
runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
