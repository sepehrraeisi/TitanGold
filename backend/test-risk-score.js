#!/usr/bin/env node

/**
 * Test Risk Agent riskScore calculation
 */

import * as riskAgent from './services/risk-agent.js';

async function testRiskAgent() {
  console.log('🧪 Testing Risk Agent riskScore...\n');
  
  // Test 1: Small trade (should be low risk)
  console.log('Test 1: Small Trade (100 USDT)');
  const result1 = await riskAgent.runRiskAssessment({
    symbol: 'BTC/USDT',
    action: 'BUY',
    amount: 100
  }, 'test-agent', 2000); // 2s timeout to force fallback
  
  console.log('Result:', {
    recommendation: result1.recommendation,
    riskLevel: result1.riskLevel,
    riskScore: result1.riskScore,
    riskScoreInMeta: result1._meta.riskScore,
    isFallback: result1._meta.isFallback
  });
  console.log('');
  
  // Test 2: Large trade (should be high risk)
  console.log('Test 2: Large Trade (15,000 USDT)');
  const result2 = await riskAgent.runRiskAssessment({
    symbol: 'BTC/USDT',
    action: 'BUY',
    amount: 15000
  }, 'test-agent', 2000);
  
  console.log('Result:', {
    recommendation: result2.recommendation,
    riskLevel: result2.riskLevel,
    riskScore: result2.riskScore,
    riskScoreInMeta: result2._meta.riskScore,
    isFallback: result2._meta.isFallback
  });
  console.log('');
  
  // Verify blocking rules
  console.log('✅ Verification:');
  console.log(`   Test 1 riskScore: ${result1.riskScore} (should be <80)`);
  console.log(`   Test 2 riskScore: ${result2.riskScore} (should be >=60, ideally >=80 for blocking)`);
  console.log(`   Both have riskScore in root: ${result1.riskScore !== undefined && result2.riskScore !== undefined ? '✅' : '❌'}`);
  console.log(`   Both have riskScore in _meta: ${result1._meta.riskScore !== undefined && result2._meta.riskScore !== undefined ? '✅' : '❌'}`);
  
  process.exit(0);
}

testRiskAgent().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
