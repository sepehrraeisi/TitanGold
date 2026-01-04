import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5002/api';

async function testAllSections() {
  console.log('🧪 Testing All Settings Sections (One by One)');
  console.log('='.repeat(60));
  
  // Step 1: Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser',
      password: 'Test@123456'
    })
  });
  
  if (!loginRes.ok) {
    console.error('❌ Login failed');
    process.exit(1);
  }
  
  const { token } = await loginRes.json();
  console.log('✅ Login successful\n');
  
  // Step 2: Get Fundamental Agent
  const agentsRes = await fetch(`${BASE_URL}/ai-agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const agentsData = await agentsRes.json();
  const agents = agentsData.agents || agentsData;
  const fundamentalAgent = agents.find(a => a.agent_key === 'fundamental');
  
  if (!fundamentalAgent) {
    console.error('❌ No fundamental agent found');
    process.exit(1);
  }
  
  console.log(`✅ Found Fundamental Agent: ${fundamentalAgent.id}\n`);
  
  // Step 3: Get current config
  const detailsRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const detailsData = await detailsRes.json();
  
  console.log('📊 Raw details response:', JSON.stringify(detailsData, null, 2).substring(0, 500));
  
  const currentConfig = detailsData.config || detailsData.agent?.config;
  
  if (!currentConfig) {
    console.error('❌ No config found in details response');
    console.log('Available keys:', Object.keys(detailsData));
    process.exit(1);
  }
  
  console.log('📊 Current Config:');
  console.log('  - dataSources:', currentConfig.dataSources);
  console.log('  - weights:', currentConfig.weights);
  console.log('  - thresholds:', currentConfig.thresholds);
  console.log('  - alertChannels:', currentConfig.alertChannels);
  console.log('  - integrationSettings:', currentConfig.integrationSettings);
  console.log('\n');
  
  // ========================================
  // TEST 1: Data Sources
  // ========================================
  console.log('🧪 TEST 1: Data Sources');
  console.log('-'.repeat(60));
  
  const newDataSources = {
    ...currentConfig.dataSources,
    macro: !currentConfig.dataSources?.macro,  // Toggle
    funding: !currentConfig.dataSources?.funding,  // Toggle
  };
  
  console.log('💾 Saving NEW data sources:', newDataSources);
  
  const ds_saveRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/config`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      config: {
        ...currentConfig,
        dataSources: newDataSources
      }
    })
  });
  
  if (!ds_saveRes.ok) {
    const error = await ds_saveRes.text();
    console.error('❌ Save failed:', error);
    process.exit(1);
  }
  
  console.log('✅ Save successful');
  
  // Refetch
  const ds_afterRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const ds_afterData = await ds_afterRes.json();
  const ds_afterConfig = ds_afterData.config || ds_afterData.agent?.config;
  
  console.log('📊 Config AFTER save:');
  console.log('  - dataSources:', ds_afterConfig.dataSources);
  
  const ds_success = 
    ds_afterConfig.dataSources?.macro === newDataSources.macro &&
    ds_afterConfig.dataSources?.funding === newDataSources.funding;
  
  if (ds_success) {
    console.log('✅ TEST 1 PASSED: Data Sources persisted!\n');
  } else {
    console.log('❌ TEST 1 FAILED: Data Sources did NOT persist!\n');
    process.exit(1);
  }
  
  // ========================================
  // TEST 2: Weights
  // ========================================
  console.log('🧪 TEST 2: Weights');
  console.log('-'.repeat(60));
  
  const newWeights = {
    ...currentConfig.weights,
    macro: 0.35,  // Change
    funding: 0.25,  // Change
  };
  
  console.log('💾 Saving NEW weights:', newWeights);
  
  const w_saveRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/config`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      config: {
        ...ds_afterConfig,  // Use latest config
        weights: newWeights
      }
    })
  });
  
  if (!w_saveRes.ok) {
    const error = await w_saveRes.text();
    console.error('❌ Save failed:', error);
    process.exit(1);
  }
  
  console.log('✅ Save successful');
  
  // Refetch
  const w_afterRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const w_afterData = await w_afterRes.json();
  const w_afterConfig = w_afterData.config || w_afterData.agent?.config;
  
  console.log('📊 Config AFTER save:');
  console.log('  - weights:', w_afterConfig.weights);
  
  const w_success = 
    w_afterConfig.weights?.macro === 0.35 &&
    w_afterConfig.weights?.funding === 0.25;
  
  if (w_success) {
    console.log('✅ TEST 2 PASSED: Weights persisted!\n');
  } else {
    console.log('❌ TEST 2 FAILED: Weights did NOT persist!\n');
    process.exit(1);
  }
  
  // ========================================
  // TEST 3: Thresholds
  // ========================================
  console.log('🧪 TEST 3: Thresholds');
  console.log('-'.repeat(60));
  
  const newThresholds = {
    ...currentConfig.thresholds,
    bullish: 75,  // Change
    bearish: 35,  // Change
  };
  
  console.log('💾 Saving NEW thresholds:', newThresholds);
  
  const t_saveRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/config`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      config: {
        ...w_afterConfig,  // Use latest config
        thresholds: newThresholds
      }
    })
  });
  
  if (!t_saveRes.ok) {
    const error = await t_saveRes.text();
    console.error('❌ Save failed:', error);
    process.exit(1);
  }
  
  console.log('✅ Save successful');
  
  // Refetch
  const t_afterRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const t_afterData = await t_afterRes.json();
  const t_afterConfig = t_afterData.config || t_afterData.agent?.config;
  
  console.log('📊 Config AFTER save:');
  console.log('  - thresholds:', t_afterConfig.thresholds);
  
  const t_success = 
    t_afterConfig.thresholds?.bullish === 75 &&
    t_afterConfig.thresholds?.bearish === 35;
  
  if (t_success) {
    console.log('✅ TEST 3 PASSED: Thresholds persisted!\n');
  } else {
    console.log('❌ TEST 3 FAILED: Thresholds did NOT persist!\n');
    process.exit(1);
  }
  
  // ========================================
  // TEST 4: Alert Channels
  // ========================================
  console.log('🧪 TEST 4: Alert Channels');
  console.log('-'.repeat(60));
  
  const newAlertChannels = {
    ...currentConfig.alertChannels,
    dashboard: !currentConfig.alertChannels?.dashboard,  // Toggle
    email: !currentConfig.alertChannels?.email,  // Toggle
  };
  
  console.log('💾 Saving NEW alert channels:', newAlertChannels);
  
  const a_saveRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/config`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      config: {
        ...t_afterConfig,  // Use latest config
        alertChannels: newAlertChannels
      }
    })
  });
  
  if (!a_saveRes.ok) {
    const error = await a_saveRes.text();
    console.error('❌ Save failed:', error);
    process.exit(1);
  }
  
  console.log('✅ Save successful');
  
  // Refetch
  const a_afterRes = await fetch(`${BASE_URL}/ai-agents/${fundamentalAgent.id}/details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const a_afterData = await a_afterRes.json();
  const a_afterConfig = a_afterData.config || a_afterData.agent?.config;
  
  console.log('📊 Config AFTER save:');
  console.log('  - alertChannels:', a_afterConfig.alertChannels);
  
  const a_success = 
    a_afterConfig.alertChannels?.dashboard === newAlertChannels.dashboard &&
    a_afterConfig.alertChannels?.email === newAlertChannels.email;
  
  if (a_success) {
    console.log('✅ TEST 4 PASSED: Alert Channels persisted!\n');
  } else {
    console.log('❌ TEST 4 FAILED: Alert Channels did NOT persist!\n');
    process.exit(1);
  }
  
  // ========================================
  // FINAL SUMMARY
  // ========================================
  console.log('='.repeat(60));
  console.log('🎉 ALL TESTS PASSED!');
  console.log('='.repeat(60));
  console.log('✅ Data Sources persist');
  console.log('✅ Weights persist');
  console.log('✅ Thresholds persist');
  console.log('✅ Alert Channels persist');
  console.log('\n✅ All settings sections are working correctly!');
}

testAllSections();
