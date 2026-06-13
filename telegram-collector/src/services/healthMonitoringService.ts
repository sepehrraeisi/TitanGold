/**
 * Health Monitoring Service for Telegram Collector
 * 
 * Continuously monitors channel health and sends alerts when issues are detected:
 * - Channels not synced for too long
 * - Persistent polling errors
 * - High error rates
 * - Stale channels (never synced)
 * 
 * Alerts are logged to data_hub_logs and can trigger notifications
 */

import { db } from '../database/db';
import { logger } from '../utils/logger';

// =====================================================================
// Configuration
// =====================================================================

interface MonitoringConfig {
  // Time thresholds (in minutes)
  staleThresholdMinutes: number;      // Channel not synced for this long = stale
  criticalThresholdMinutes: number;   // Channel not synced for this long = critical
  
  // Error thresholds
  maxConsecutiveErrors: number;       // Alert if channel has this many errors in a row
  maxErrorRate: number;               // Alert if error rate exceeds this (0-1)
  
  // Monitoring intervals
  checkIntervalSeconds: number;       // How often to run health checks
  alertCooldownMinutes: number;       // Don't re-alert for same issue within this time
}

const DEFAULT_CONFIG: MonitoringConfig = {
  staleThresholdMinutes: 30,          // 30 min without sync = warning
  criticalThresholdMinutes: 60,       // 1 hour without sync = critical
  maxConsecutiveErrors: 3,            // 3 errors in a row = alert
  maxErrorRate: 0.5,                  // 50% error rate = alert
  checkIntervalSeconds: 300,          // Check every 5 minutes
  alertCooldownMinutes: 15,           // Don't spam alerts within 15 min
};

// =====================================================================
// Alert Types & Severity
// =====================================================================

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

interface Alert {
  id: string;
  severity: AlertSeverity;
  type: 'stale_channel' | 'error_rate' | 'persistent_errors' | 'never_synced' | 'collector_down';
  channelId?: string;
  channelHandle?: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

// =====================================================================
// Monitoring Service
// =====================================================================

class HealthMonitoringService {
  private config: MonitoringConfig;
  private isRunning: boolean = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private recentAlerts: Map<string, Date> = new Map(); // alertKey -> lastAlertTime

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the monitoring service
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Health monitoring service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`🔍 Starting health monitoring service (check every ${this.config.checkIntervalSeconds}s)`);

    // Run first check immediately
    this.performHealthCheck().catch(err => {
      logger.error('Error in initial health check:', err);
    });

    // Schedule periodic checks
    this.intervalHandle = setInterval(() => {
      this.performHealthCheck().catch(err => {
        logger.error('Error in periodic health check:', err);
      });
    }, this.config.checkIntervalSeconds * 1000);
  }

  /**
   * Stop the monitoring service
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('Health monitoring service is not running');
      return;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.isRunning = false;
    logger.info('🛑 Health monitoring service stopped');
  }

  /**
   * Perform a complete health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    logger.debug('🔍 Starting health check...');

    try {
      // Get all active channels
      const channels = await this.getActiveChannels();
      
      if (channels.length === 0) {
        logger.warn('⚠️ No active channels found in database');
        return;
      }

      logger.debug(`Checking health of ${channels.length} channels...`);

      const alerts: Alert[] = [];

      // Check 1: Stale channels (not synced recently)
      const staleAlerts = await this.checkStaleChannels(channels);
      alerts.push(...staleAlerts);

      // Check 2: Channels with persistent errors
      const errorAlerts = await this.checkPersistentErrors(channels);
      alerts.push(...errorAlerts);

      // Check 3: Never-synced channels (been active for a while but never synced)
      const neverSyncedAlerts = await this.checkNeverSyncedChannels(channels);
      alerts.push(...neverSyncedAlerts);

      // Check 4: Overall collector health
      const collectorAlerts = await this.checkCollectorHealth(channels);
      alerts.push(...collectorAlerts);

      // Log and save alerts
      await this.processAlerts(alerts);

      const duration = Date.now() - startTime;
      logger.info(`✅ Health check complete (${duration}ms, ${alerts.length} alerts)`);

    } catch (error) {
      logger.error('❌ Health check failed:', error);
    }
  }

  /**
   * Get all active channels from database
   */
  private async getActiveChannels(): Promise<any[]> {
    const result = await db.query(`
      SELECT 
        id,
        channel_id,
        username,
        title,
        is_active,
        last_synced_at,
        created_at,
        config
      FROM telegram_channels
      WHERE is_active = true
      ORDER BY last_synced_at ASC NULLS FIRST
    `);

    return result.rows;
  }

  /**
   * Check for channels that haven't synced recently
   */
  private async checkStaleChannels(channels: any[]): Promise<Alert[]> {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - this.config.staleThresholdMinutes * 60 * 1000);
    const criticalThreshold = new Date(now.getTime() - this.config.criticalThresholdMinutes * 60 * 1000);
    
    const alerts: Alert[] = [];

    for (const channel of channels) {
      if (!channel.last_synced_at) {
        // Handle by checkNeverSyncedChannels
        continue;
      }

      const lastSync = new Date(channel.last_synced_at);
      const minutesSinceSync = Math.floor((now.getTime() - lastSync.getTime()) / (60 * 1000));

      // Critical: Not synced for over 1 hour
      if (lastSync < criticalThreshold) {
        const alertKey = `stale_critical_${channel.id}`;
        if (this.shouldSendAlert(alertKey)) {
          alerts.push({
            id: this.generateAlertId(),
            severity: 'critical',
            type: 'stale_channel',
            channelId: channel.id,
            channelHandle: channel.username,
            message: `Channel "${channel.title || channel.username}" has not synced for ${minutesSinceSync} minutes (critical threshold: ${this.config.criticalThresholdMinutes} min)`,
            details: {
              lastSyncedAt: channel.last_synced_at,
              minutesSinceSync,
              threshold: this.config.criticalThresholdMinutes,
            },
            timestamp: now,
            resolved: false,
          });
          this.markAlertSent(alertKey);
        }
      }
      // Warning: Not synced for over 30 minutes
      else if (lastSync < staleThreshold) {
        const alertKey = `stale_warning_${channel.id}`;
        if (this.shouldSendAlert(alertKey)) {
          alerts.push({
            id: this.generateAlertId(),
            severity: 'warning',
            type: 'stale_channel',
            channelId: channel.id,
            channelHandle: channel.username,
            message: `Channel "${channel.title || channel.username}" has not synced for ${minutesSinceSync} minutes (threshold: ${this.config.staleThresholdMinutes} min)`,
            details: {
              lastSyncedAt: channel.last_synced_at,
              minutesSinceSync,
              threshold: this.config.staleThresholdMinutes,
            },
            timestamp: now,
            resolved: false,
          });
          this.markAlertSent(alertKey);
        }
      }
    }

    return alerts;
  }

  /**
   * Check for channels with persistent errors
   */
  private async checkPersistentErrors(channels: any[]): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // In Phase 2, we'll add error_count and last_error fields
    // For now, we can check logs or implement basic tracking
    
    // TODO: Implement after adding error tracking fields to telegram_channels

    return alerts;
  }

  /**
   * Check for channels that have never synced (but should have)
   */
  private async checkNeverSyncedChannels(channels: any[]): Promise<Alert[]> {
    const now = new Date();
    const alerts: Alert[] = [];

    // Only alert if channel has been active for at least 15 minutes
    const minAgeThreshold = new Date(now.getTime() - 15 * 60 * 1000);

    for (const channel of channels) {
      if (channel.last_synced_at === null) {
        const createdAt = new Date(channel.created_at);
        
        if (createdAt < minAgeThreshold) {
          const minutesSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (60 * 1000));
          
          const alertKey = `never_synced_${channel.id}`;
          if (this.shouldSendAlert(alertKey)) {
            alerts.push({
              id: this.generateAlertId(),
              severity: 'error',
              type: 'never_synced',
              channelId: channel.id,
              channelHandle: channel.username,
              message: `Channel "${channel.title || channel.username}" has never synced (active for ${minutesSinceCreation} minutes)`,
              details: {
                createdAt: channel.created_at,
                minutesSinceCreation,
              },
              timestamp: now,
              resolved: false,
            });
            this.markAlertSent(alertKey);
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Check overall collector health
   */
  private async checkCollectorHealth(channels: any[]): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const now = new Date();
    
    const totalChannels = channels.length;
    const syncedChannels = channels.filter(ch => ch.last_synced_at !== null).length;
    const neverSyncedChannels = totalChannels - syncedChannels;
    
    const syncRate = totalChannels > 0 ? syncedChannels / totalChannels : 0;

    // Alert if sync rate is below 70%
    if (syncRate < 0.7 && totalChannels > 5) {
      const alertKey = 'collector_low_sync_rate';
      if (this.shouldSendAlert(alertKey)) {
        alerts.push({
          id: this.generateAlertId(),
          severity: 'warning',
          type: 'collector_down',
          message: `Low sync rate: ${Math.round(syncRate * 100)}% of channels synced (${syncedChannels}/${totalChannels})`,
          details: {
            totalChannels,
            syncedChannels,
            neverSyncedChannels,
            syncRate,
          },
          timestamp: now,
          resolved: false,
        });
        this.markAlertSent(alertKey);
      }
    }

    // Alert if too many never-synced channels
    if (neverSyncedChannels > totalChannels * 0.5 && totalChannels > 5) {
      const alertKey = 'collector_many_never_synced';
      if (this.shouldSendAlert(alertKey)) {
        alerts.push({
          id: this.generateAlertId(),
          severity: 'error',
          type: 'collector_down',
          message: `Too many never-synced channels: ${neverSyncedChannels}/${totalChannels} (${Math.round((neverSyncedChannels/totalChannels)*100)}%)`,
          details: {
            totalChannels,
            syncedChannels,
            neverSyncedChannels,
          },
          timestamp: now,
          resolved: false,
        });
        this.markAlertSent(alertKey);
      }
    }

    return alerts;
  }

  /**
   * Process and log alerts
   */
  private async processAlerts(alerts: Alert[]): Promise<void> {
    if (alerts.length === 0) {
      return;
    }

    logger.info(`📢 Processing ${alerts.length} alerts...`);

    for (const alert of alerts) {
      // Log to console
      const logLevel = this.getLogLevel(alert.severity);
      const emoji = this.getSeverityEmoji(alert.severity);
      logger[logLevel](
        `${emoji} [${alert.severity.toUpperCase()}] ${alert.message}`,
        alert.details
      );

      // Save to database (data_hub_logs)
      try {
        await this.saveAlertToDatabase(alert);
      } catch (error) {
        logger.error('Failed to save alert to database:', error);
      }

      // TODO: Send notification (Telegram, email, etc.)
      // await this.sendNotification(alert);
    }
  }

  /**
   * Save alert to data_hub_logs table
   */
  private async saveAlertToDatabase(alert: Alert): Promise<void> {
    try {
      const status =
        alert.severity === 'error' || alert.severity === 'critical'
          ? 'failure'
          : alert.severity === 'warning' || alert.severity === 'warn'
            ? 'warning'
            : 'success';
      await db.query(
        `INSERT INTO data_hub_logs (source_id, action, status, message, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          null,
          'collector_health',
          status,
          alert.message,
          JSON.stringify({
            alertId: alert.id,
            channelId: alert.channelId,
            channelHandle: alert.channelHandle,
            alertType: alert.type,
            severity: alert.severity,
            ...alert.details,
          }),
        ],
      );
    } catch (error) {
      // If table doesn't exist, just log to console
      logger.debug('Could not save alert to database (table may not exist):', error);
    }
  }

  /**
   * Check if we should send an alert (respects cooldown)
   */
  private shouldSendAlert(alertKey: string): boolean {
    const lastAlertTime = this.recentAlerts.get(alertKey);
    
    if (!lastAlertTime) {
      return true; // Never sent before
    }

    const now = new Date();
    const cooldownMs = this.config.alertCooldownMinutes * 60 * 1000;
    const timeSinceLastAlert = now.getTime() - lastAlertTime.getTime();

    return timeSinceLastAlert > cooldownMs;
  }

  /**
   * Mark an alert as sent
   */
  private markAlertSent(alertKey: string): void {
    this.recentAlerts.set(alertKey, new Date());
    
    // Clean up old alerts (older than 2x cooldown)
    const cleanupThreshold = new Date(Date.now() - this.config.alertCooldownMinutes * 2 * 60 * 1000);
    for (const [key, time] of this.recentAlerts.entries()) {
      if (time < cleanupThreshold) {
        this.recentAlerts.delete(key);
      }
    }
  }

  /**
   * Generate a unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: AlertSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'error':
        return 'error';
      case 'warning':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Get emoji for severity
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get current monitoring status
   */
  public getStatus(): { isRunning: boolean; config: MonitoringConfig; recentAlerts: number } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      recentAlerts: this.recentAlerts.size,
    };
  }
}

// =====================================================================
// Export singleton instance
// =====================================================================

export const healthMonitoringService = new HealthMonitoringService();

// Export types for external use
export type { MonitoringConfig, Alert, AlertSeverity };
