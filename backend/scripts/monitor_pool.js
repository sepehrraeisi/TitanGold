#!/usr/bin/env node
/**
 * Connection Pool Monitoring Script
 * Task: DATABASE-005
 * Provides pool metrics and health check
 */

import { getPoolMetrics, checkConnectionLeaks } from '../database/db.js';

function monitorPool() {
  console.log('📊 Connection Pool Monitoring (DATABASE-005)\n');
  console.log('═'.repeat(70));
  console.log('DATABASE CONNECTION POOL METRICS');
  console.log('═'.repeat(70));
  
  const metrics = getPoolMetrics();
  
  console.log('\n📈 Pool Statistics:');
  console.log(`   Total Connections:  ${metrics.totalConnections}`);
  console.log(`   Active Connections: ${metrics.activeConnections}`);
  console.log(`   Idle Connections:   ${metrics.idleConnections}`);
  console.log(`   Waiting Clients:    ${metrics.waitingClients}`);
  console.log(`   Pool Utilization:   ${metrics.utilization}`);
  
  console.log('\n⚙️  Configuration:');
  console.log(`   Max Pool Size:      ${metrics.config.max}`);
  console.log(`   Min Pool Size:      ${metrics.config.min}`);
  console.log(`   Idle Timeout:       ${metrics.config.idleTimeoutMs}ms (${(metrics.config.idleTimeoutMs / 1000)}s)`);
  console.log(`   Connection Timeout: ${metrics.config.connectionTimeoutMs}ms`);
  console.log(`   Max Lifetime:       ${metrics.config.maxLifetimeSeconds}s (${(metrics.config.maxLifetimeSeconds / 3600).toFixed(1)}h)`);
  
  console.log('\n🔍 Connection Leak Detection:');
  const leakStatus = checkConnectionLeaks();
  
  if (leakStatus.hasLeaks) {
    console.log(`   Status: ⚠️  ${leakStatus.leakCount} leak(s) detected`);
    leakStatus.leaks.forEach((leak, index) => {
      console.log(`   Leak ${index + 1}: Process ID ${leak.client}, held for ${leak.holdTimeMs}ms`);
    });
  } else {
    console.log(`   Status: ✅ No leaks detected`);
  }
  console.log(`   Tracked Connections: ${leakStatus.totalTrackedConnections}`);
  
  console.log('\n📅 Last Updated:');
  console.log(`   ${metrics.lastUpdated.toISOString()}`);
  
  console.log('\n' + '═'.repeat(70));
  
  // Health assessment
  const utilizationPercent = parseFloat(metrics.utilization);
  let healthStatus = '✅ HEALTHY';
  let healthMessage = 'Pool is operating normally';
  
  if (utilizationPercent > 90) {
    healthStatus = '⚠️  WARNING';
    healthMessage = 'Pool utilization >90%, consider increasing pool size';
  } else if (utilizationPercent > 80) {
    healthStatus = '⚠️  CAUTION';
    healthMessage = 'Pool utilization >80%, monitor closely';
  }
  
  if (leakStatus.hasLeaks) {
    healthStatus = '❌ UNHEALTHY';
    healthMessage = 'Connection leaks detected';
  }
  
  if (metrics.waitingClients > 0) {
    healthStatus = '⚠️  WARNING';
    healthMessage += ` | ${metrics.waitingClients} client(s) waiting for connection`;
  }
  
  console.log(`\n🏥 Health Status: ${healthStatus}`);
  console.log(`   ${healthMessage}`);
  console.log('\n' + '═'.repeat(70) + '\n');
  
  process.exit(0);
}

monitorPool();
