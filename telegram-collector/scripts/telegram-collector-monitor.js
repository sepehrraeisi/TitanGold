#!/usr/bin/env node

/**
 * Standalone Health Monitoring Script for Telegram Collector
 * 
 * Runs independently and monitors collector health:
 * - Checks channel sync status
 * - Alerts on stale channels
 * - Monitors overall collector health
 * 
 * Usage:
 *   node telegram-collector-monitor.js [--once]
 * 
 * Environment Variables:
 *   MONITOR_INTERVAL_SEC       - Check interval in seconds (default: 300 = 5 min)
 *   STALE_THRESHOLD_MIN        - Minutes without sync = warning (default: 30)
 *   CRITICAL_THRESHOLD_MIN     - Minutes without sync = critical (default: 60)
 *   ALERT_COOLDOWN_MIN         - Minutes between alerts (default: 15)
 */

const http = require('http');
const { execSync } = require('child_process');

// =====================================================================
// Configuration
// =====================================================================

const CONFIG = {
  collectorBaseUrl: 'http://127.0.0.1:3002',
  
  // Time thresholds (in minutes)
  staleThresholdMin: parseInt(process.env.STALE_THRESHOLD_MIN || '30'),
  criticalThresholdMin: parseInt(process.env.CRITICAL_THRESHOLD_MIN || '60'),
  
  // Monitoring interval
  checkIntervalSec: parseInt(process.env.MONITOR_INTERVAL_SEC || '300'), // 5 minutes
  
  // Alert cooldown
  alertCooldownMin: parseInt(process.env.ALERT_COOLDOWN_MIN || '15'),
  
  // Run once mode (for testing)
  runOnce: process.argv.includes('--once'),
};

// =====================================================================
// State
// =====================================================================

const recentAlerts = new Map(); // alertKey -> lastAlertTime

// =====================================================================
// HTTP Helper
// =====================================================================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

// =====================================================================
// Alert Management
// =====================================================================

function shouldSendAlert(alertKey) {
  const lastAlertTime = recentAlerts.get(alertKey);
  
  if (!lastAlertTime) {
    return true;
  }

  const now = Date.now();
  const cooldownMs = CONFIG.alertCooldownMin * 60 * 1000;
  const timeSinceLastAlert = now - lastAlertTime;

  return timeSinceLastAlert > cooldownMs;
}

function markAlertSent(alertKey) {
  recentAlerts.set(alertKey, Date.now());
  
  // Clean up old alerts
  const cleanupThreshold = Date.now() - CONFIG.alertCooldownMin * 2 * 60 * 1000;
  for (const [key, time] of recentAlerts.entries()) {
    if (time < cleanupThreshold) {
      recentAlerts.delete(key);
    }
  }
}

function logAlert(severity, message, details = {}) {
  const timestamp = new Date().toISOString();
  const emoji = { critical: '🔴', error: '❌', warning: '⚠️', info: 'ℹ️' }[severity] || '📢';
  
  console.log(`[${timestamp}] ${emoji} [${severity.toUpperCase()}] ${message}`);
  if (Object.keys(details).length > 0) {
    console.log(`  Details:`, JSON.stringify(details, null, 2));
  }
  
  // TODO: Save to database or send notification
}

// =====================================================================
// Health Checks
// =====================================================================

async function checkCollectorHealth() {
  try {
    const health = await httpGet(`${CONFIG.collectorBaseUrl}/api/telegram-collector/health`);
    return { success: true, data: health };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getChannels() {
  try {
    const response = await httpGet(`${CONFIG.collectorBaseUrl}/api/telegram-collector/collector-channels`);
    return { success: true, channels: response.channels || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function checkStaleChannels(channels) {
  const now = Date.now();
  const staleThreshold = now - CONFIG.staleThresholdMin * 60 * 1000;
  const criticalThreshold = now - CONFIG.criticalThresholdMin * 60 * 1000;
  
  const alerts = [];

  for (const channel of channels) {
    if (!channel.lastSyncedAt) {
      // Handle by checkNeverSyncedChannels
      continue;
    }

    const lastSync = new Date(channel.lastSyncedAt).getTime();
    const minutesSinceSync = Math.floor((now - lastSync) / (60 * 1000));

    // Critical: Not synced for over 1 hour
    if (lastSync < criticalThreshold) {
      const alertKey = `stale_critical_${channel.id}`;
      if (shouldSendAlert(alertKey)) {
        alerts.push({
          severity: 'critical',
          message: `Channel "${channel.title || channel.username}" has not synced for ${minutesSinceSync} minutes`,
          details: {
            channelId: channel.id,
            channelHandle: channel.username,
            lastSyncedAt: channel.lastSyncedAt,
            minutesSinceSync,
            threshold: CONFIG.criticalThresholdMin,
          },
        });
        markAlertSent(alertKey);
      }
    }
    // Warning: Not synced for over 30 minutes
    else if (lastSync < staleThreshold) {
      const alertKey = `stale_warning_${channel.id}`;
      if (shouldSendAlert(alertKey)) {
        alerts.push({
          severity: 'warning',
          message: `Channel "${channel.title || channel.username}" has not synced for ${minutesSinceSync} minutes`,
          details: {
            channelId: channel.id,
            channelHandle: channel.username,
            lastSyncedAt: channel.lastSyncedAt,
            minutesSinceSync,
            threshold: CONFIG.staleThresholdMin,
          },
        });
        markAlertSent(alertKey);
      }
    }
  }

  return alerts;
}

function checkNeverSyncedChannels(channels) {
  const now = Date.now();
  const alerts = [];

  // Only alert if channel has been active for at least 15 minutes
  const minAgeThreshold = now - 15 * 60 * 1000;

  for (const channel of channels) {
    if (!channel.lastSyncedAt) {
      const createdAt = new Date(channel.createdAt || channel.created_at || 0).getTime();
      
      if (createdAt > 0 && createdAt < minAgeThreshold) {
        const minutesSinceCreation = Math.floor((now - createdAt) / (60 * 1000));
        
        const alertKey = `never_synced_${channel.id}`;
        if (shouldSendAlert(alertKey)) {
          alerts.push({
            severity: 'error',
            message: `Channel "${channel.title || channel.username}" has never synced (active for ${minutesSinceCreation} minutes)`,
            details: {
              channelId: channel.id,
              channelHandle: channel.username,
              createdAt: channel.createdAt || channel.created_at,
              minutesSinceCreation,
            },
          });
          markAlertSent(alertKey);
        }
      }
    }
  }

  return alerts;
}

function checkOverallHealth(channels) {
  const alerts = [];
  
  const totalChannels = channels.length;
  const syncedChannels = channels.filter(ch => ch.lastSyncedAt).length;
  const neverSyncedChannels = totalChannels - syncedChannels;
  
  const syncRate = totalChannels > 0 ? syncedChannels / totalChannels : 0;

  // Alert if sync rate is below 70%
  if (syncRate < 0.7 && totalChannels > 5) {
    const alertKey = 'collector_low_sync_rate';
    if (shouldSendAlert(alertKey)) {
      alerts.push({
        severity: 'warning',
        message: `Low sync rate: ${Math.round(syncRate * 100)}% of channels synced (${syncedChannels}/${totalChannels})`,
        details: {
          totalChannels,
          syncedChannels,
          neverSyncedChannels,
          syncRate: Math.round(syncRate * 100) / 100,
        },
      });
      markAlertSent(alertKey);
    }
  }

  // Alert if too many never-synced channels
  if (neverSyncedChannels > totalChannels * 0.5 && totalChannels > 5) {
    const alertKey = 'collector_many_never_synced';
    if (shouldSendAlert(alertKey)) {
      alerts.push({
        severity: 'error',
        message: `Too many never-synced channels: ${neverSyncedChannels}/${totalChannels} (${Math.round((neverSyncedChannels/totalChannels)*100)}%)`,
        details: {
          totalChannels,
          syncedChannels,
          neverSyncedChannels,
        },
      });
      markAlertSent(alertKey);
    }
  }

  return alerts;
}

// =====================================================================
// Phase 2: Priority & Error Tracking
// =====================================================================

function checkPersistentErrors(channels) {
  const alerts = [];
  const minErrorCount = 3; // Alert after 3 consecutive errors
  
  for (const channel of channels) {
    const errorCount = channel.errorCount || 0;
    
    if (errorCount >= minErrorCount) {
      const priority = channel.priority || 'normal';
      const severity = priority === 'high' ? 'critical' : 'error';
      
      const alertKey = `persistent_error_${channel.id}`;
      if (shouldSendAlert(alertKey)) {
        alerts.push({
          severity,
          message: `Channel "${channel.title || channel.username}" has ${errorCount} consecutive errors (${priority} priority)`,
          details: {
            channelId: channel.id,
            channelHandle: channel.username,
            priority,
            errorCount,
            lastError: channel.lastError,
            lastErrorAt: channel.lastErrorAt,
          },
        });
        markAlertSent(alertKey);
      }
    }
  }
  
  return alerts;
}

function checkHighPriorityChannels(channels) {
  const alerts = [];
  const now = Date.now();
  const highPriorityThreshold = 10 * 60 * 1000; // 10 minutes for high priority
  
  const highPriorityChannels = channels.filter(ch => ch.priority === 'high');
  
  for (const channel of highPriorityChannels) {
    if (!channel.lastSyncedAt) {
      const alertKey = `high_priority_never_synced_${channel.id}`;
      if (shouldSendAlert(alertKey)) {
        alerts.push({
          severity: 'critical',
          message: `HIGH PRIORITY channel "${channel.title || channel.username}" has never synced`,
          details: {
            channelId: channel.id,
            channelHandle: channel.username,
            priority: 'high',
          },
        });
        markAlertSent(alertKey);
      }
    } else {
      const lastSync = new Date(channel.lastSyncedAt).getTime();
      const minutesSinceSync = Math.floor((now - lastSync) / (60 * 1000));
      
      if (now - lastSync > highPriorityThreshold) {
        const alertKey = `high_priority_stale_${channel.id}`;
        if (shouldSendAlert(alertKey)) {
          alerts.push({
            severity: 'critical',
            message: `HIGH PRIORITY channel "${channel.title || channel.username}" hasn't synced for ${minutesSinceSync} minutes`,
            details: {
              channelId: channel.id,
              channelHandle: channel.username,
              priority: 'high',
              lastSyncedAt: channel.lastSyncedAt,
              minutesSinceSync,
              threshold: 10,
            },
          });
          markAlertSent(alertKey);
        }
      }
    }
  }
  
  return alerts;
}

// =====================================================================
// Main Health Check
// =====================================================================

async function performHealthCheck() {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Starting health check at ${new Date().toISOString()}`);
  console.log(`${'='.repeat(70)}`);

  try {
    // Check collector is running
    const healthResult = await checkCollectorHealth();
    if (!healthResult.success) {
      logAlert('critical', 'Telegram Collector is not responding', { error: healthResult.error });
      return;
    }

    console.log('✅ Collector is healthy:', healthResult.data.status);

    // Get all channels
    const channelsResult = await getChannels();
    if (!channelsResult.success) {
      logAlert('error', 'Failed to fetch channels', { error: channelsResult.error });
      return;
    }

    const channels = channelsResult.channels;
    console.log(`📊 Found ${channels.length} channels`);

    if (channels.length === 0) {
      console.log('⚠️  No channels to monitor');
      return;
    }

    // Run all checks
    const allAlerts = [];
    
    // Check 1: Stale channels
    const staleAlerts = checkStaleChannels(channels);
    allAlerts.push(...staleAlerts);
    
    // Check 2: Never synced channels
    const neverSyncedAlerts = checkNeverSyncedChannels(channels);
    allAlerts.push(...neverSyncedAlerts);
    
    // Check 3: Overall health
    const overallAlerts = checkOverallHealth(channels);
    allAlerts.push(...overallAlerts);
    
    // Check 4: Phase 2 - Persistent errors
    const persistentErrorAlerts = checkPersistentErrors(channels);
    allAlerts.push(...persistentErrorAlerts);
    
    // Check 5: Phase 2 - High priority channels
    const highPriorityAlerts = checkHighPriorityChannels(channels);
    allAlerts.push(...highPriorityAlerts);

    // Log alerts
    if (allAlerts.length === 0) {
      console.log('✅ No issues detected');
    } else {
      console.log(`\n📢 ${allAlerts.length} alert(s) detected:`);
      for (const alert of allAlerts) {
        logAlert(alert.severity, alert.message, alert.details);
      }
    }

    // Summary
    const syncedCount = channels.filter(ch => ch.lastSyncedAt).length;
    const syncRate = Math.round((syncedCount / channels.length) * 100);
    
    // Phase 2: Priority & Error stats
    const highPriorityCount = channels.filter(ch => ch.priority === 'high').length;
    const normalPriorityCount = channels.filter(ch => ch.priority === 'normal').length;
    const lowPriorityCount = channels.filter(ch => ch.priority === 'low').length;
    const channelsWithErrors = channels.filter(ch => (ch.errorCount || 0) > 0).length;
    const persistentErrors = channels.filter(ch => (ch.errorCount || 0) >= 3).length;
    
    console.log(`\n📈 Summary:`);
    console.log(`  Total channels: ${channels.length}`);
    console.log(`  Synced: ${syncedCount} (${syncRate}%)`);
    console.log(`  Never synced: ${channels.length - syncedCount}`);
    console.log(`  Priority: high=${highPriorityCount}, normal=${normalPriorityCount}, low=${lowPriorityCount}`);
    console.log(`  Errors: ${channelsWithErrors} channels (${persistentErrors} with 3+ errors)`);
    console.log(`  Alerts: ${allAlerts.length}`);

    const duration = Date.now() - startTime;
    console.log(`\n✅ Health check complete (${duration}ms)`);
    console.log(`${'='.repeat(70)}\n`);

  } catch (error) {
    logAlert('critical', 'Health check failed', { error: error.message, stack: error.stack });
  }
}

// =====================================================================
// Main
// =====================================================================

async function main() {
  console.log('\n🚀 Telegram Collector Health Monitor starting...');
  console.log(`📋 Configuration:`);
  console.log(`  Check interval: ${CONFIG.checkIntervalSec}s`);
  console.log(`  Stale threshold: ${CONFIG.staleThresholdMin} min`);
  console.log(`  Critical threshold: ${CONFIG.criticalThresholdMin} min`);
  console.log(`  Alert cooldown: ${CONFIG.alertCooldownMin} min`);
  console.log(`  Run once: ${CONFIG.runOnce}`);

  // Run first check immediately
  await performHealthCheck();

  if (CONFIG.runOnce) {
    console.log('\n✅ One-time check complete. Exiting.');
    process.exit(0);
  }

  // Schedule periodic checks
  console.log(`\n⏰ Scheduling checks every ${CONFIG.checkIntervalSec} seconds...`);
  setInterval(async () => {
    await performHealthCheck();
  }, CONFIG.checkIntervalSec * 1000);
}

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
