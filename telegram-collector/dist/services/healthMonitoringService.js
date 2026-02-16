"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthMonitoringService = void 0;
const db_1 = require("../database/db");
const logger_1 = require("../utils/logger");
const DEFAULT_CONFIG = {
    staleThresholdMinutes: 30, // 30 min without sync = warning
    criticalThresholdMinutes: 60, // 1 hour without sync = critical
    maxConsecutiveErrors: 3, // 3 errors in a row = alert
    maxErrorRate: 0.5, // 50% error rate = alert
    checkIntervalSeconds: 300, // Check every 5 minutes
    alertCooldownMinutes: 15, // Don't spam alerts within 15 min
};
// =====================================================================
// Monitoring Service
// =====================================================================
class HealthMonitoringService {
    constructor(config = {}) {
        this.isRunning = false;
        this.intervalHandle = null;
        this.recentAlerts = new Map(); // alertKey -> lastAlertTime
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Start the monitoring service
     */
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('Health monitoring service is already running');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info(`🔍 Starting health monitoring service (check every ${this.config.checkIntervalSeconds}s)`);
        // Run first check immediately
        this.performHealthCheck().catch(err => {
            logger_1.logger.error('Error in initial health check:', err);
        });
        // Schedule periodic checks
        this.intervalHandle = setInterval(() => {
            this.performHealthCheck().catch(err => {
                logger_1.logger.error('Error in periodic health check:', err);
            });
        }, this.config.checkIntervalSeconds * 1000);
    }
    /**
     * Stop the monitoring service
     */
    stop() {
        if (!this.isRunning) {
            logger_1.logger.warn('Health monitoring service is not running');
            return;
        }
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        this.isRunning = false;
        logger_1.logger.info('🛑 Health monitoring service stopped');
    }
    /**
     * Perform a complete health check
     */
    async performHealthCheck() {
        const startTime = Date.now();
        logger_1.logger.debug('🔍 Starting health check...');
        try {
            // Get all active channels
            const channels = await this.getActiveChannels();
            if (channels.length === 0) {
                logger_1.logger.warn('⚠️ No active channels found in database');
                return;
            }
            logger_1.logger.debug(`Checking health of ${channels.length} channels...`);
            const alerts = [];
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
            logger_1.logger.info(`✅ Health check complete (${duration}ms, ${alerts.length} alerts)`);
        }
        catch (error) {
            logger_1.logger.error('❌ Health check failed:', error);
        }
    }
    /**
     * Get all active channels from database
     */
    async getActiveChannels() {
        const result = await db_1.db.query(`
      SELECT 
        id,
        channel_id,
        username,
        title,
        is_active,
        last_synced_at,
        created_at,
        priority,
        error_count,
        last_error,
        last_error_at,
        config
      FROM telegram_channels
      WHERE is_active = true
      ORDER BY last_synced_at ASC NULLS FIRST
    `);
        return result.rows;
    }
    /**
     * Check for channels that haven't synced recently (priority-based thresholds)
     */
    async checkStaleChannels(channels) {
        const now = new Date();
        const alerts = [];
        
        // Priority-based thresholds (in minutes)
        const thresholds = {
            high: { warning: 2, critical: 5 },      // HIGH: warn after 2min, critical after 5min
            normal: { warning: 6, critical: 10 },    // NORMAL: warn after 6min, critical after 10min
            low: { warning: 10, critical: 15 }       // LOW: warn after 10min, critical after 15min
        };
        
        for (const channel of channels) {
            if (!channel.last_synced_at) {
                // Handle by checkNeverSyncedChannels
                continue;
            }
            
            const priority = channel.priority || 'normal';
            const threshold = thresholds[priority] || thresholds.normal;
            
            const lastSync = new Date(channel.last_synced_at);
            const minutesSinceSync = Math.floor((now.getTime() - lastSync.getTime()) / (60 * 1000));
            
            const warningThreshold = new Date(now.getTime() - threshold.warning * 60 * 1000);
            const criticalThreshold = new Date(now.getTime() - threshold.critical * 60 * 1000);
            
            // Critical: Not synced beyond critical threshold
            if (lastSync < criticalThreshold) {
                const alertKey = `stale_critical_${channel.id}`;
                if (this.shouldSendAlert(alertKey)) {
                    const priorityLabel = priority === 'high' ? '🔴 HIGH' : priority === 'low' ? '⚫ LOW' : '⚪ NORMAL';
                    alerts.push({
                        id: this.generateAlertId(),
                        severity: 'critical',
                        type: 'stale_channel',
                        channelId: channel.id,
                        channelHandle: channel.username,
                        message: `[${priorityLabel}] Channel "${channel.title || channel.username}" has not synced for ${minutesSinceSync} minutes (critical threshold: ${threshold.critical} min)`,
                        details: {
                            lastSyncedAt: channel.last_synced_at,
                            minutesSinceSync,
                            threshold: threshold.critical,
                            priority: priority
                        },
                        timestamp: now,
                        resolved: false,
                    });
                    this.markAlertSent(alertKey);
                }
            }
            // Warning: Not synced beyond warning threshold
            else if (lastSync < warningThreshold) {
                const alertKey = `stale_warning_${channel.id}`;
                if (this.shouldSendAlert(alertKey)) {
                    const priorityLabel = priority === 'high' ? '🔴 HIGH' : priority === 'low' ? '⚫ LOW' : '⚪ NORMAL';
                    alerts.push({
                        id: this.generateAlertId(),
                        severity: 'warning',
                        type: 'stale_channel',
                        channelId: channel.id,
                        channelHandle: channel.username,
                        message: `[${priorityLabel}] Channel "${channel.title || channel.username}" has not synced for ${minutesSinceSync} minutes (threshold: ${threshold.warning} min)`,
                        details: {
                            lastSyncedAt: channel.last_synced_at,
                            minutesSinceSync,
                            threshold: threshold.warning,
                            priority: priority
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
    async checkPersistentErrors(channels) {
        const alerts = [];
        // In Phase 2, we'll add error_count and last_error fields
        // For now, we can check logs or implement basic tracking
        // TODO: Implement after adding error tracking fields to telegram_channels
        return alerts;
    }
    /**
     * Check for channels that have never synced (but should have)
     */
    async checkNeverSyncedChannels(channels) {
        const now = new Date();
        const alerts = [];
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
    async checkCollectorHealth(channels) {
        const alerts = [];
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
                    message: `Too many never-synced channels: ${neverSyncedChannels}/${totalChannels} (${Math.round((neverSyncedChannels / totalChannels) * 100)}%)`,
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
    async processAlerts(alerts) {
        if (alerts.length === 0) {
            return;
        }
        logger_1.logger.info(`📢 Processing ${alerts.length} alerts...`);
        for (const alert of alerts) {
            // Log to console
            const logLevel = this.getLogLevel(alert.severity);
            const emoji = this.getSeverityEmoji(alert.severity);
            logger_1.logger[logLevel](`${emoji} [${alert.severity.toUpperCase()}] ${alert.message}`, alert.details);
            // Save to database (data_hub_logs)
            try {
                await this.saveAlertToDatabase(alert);
            }
            catch (error) {
                logger_1.logger.error('Failed to save alert to database:', error);
            }
            // TODO: Send notification (Telegram, email, etc.)
            // await this.sendNotification(alert);
        }
    }
    /**
     * Save alert to data_hub_logs table
     */
    async saveAlertToDatabase(alert) {
        try {
            await db_1.db.query(`
        INSERT INTO data_hub_logs (
          level,
          source,
          category,
          message,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
                alert.severity,
                'telegram-collector-monitor',
                alert.type,
                alert.message,
                JSON.stringify({
                    alertId: alert.id,
                    channelId: alert.channelId,
                    channelHandle: alert.channelHandle,
                    ...alert.details,
                }),
            ]);
        }
        catch (error) {
            // If table doesn't exist, just log to console
            logger_1.logger.debug('Could not save alert to database (table may not exist):', error);
        }
    }
    /**
     * Check if we should send an alert (respects cooldown)
     */
    shouldSendAlert(alertKey) {
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
    markAlertSent(alertKey) {
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
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get log level for severity
     */
    getLogLevel(severity) {
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
    getSeverityEmoji(severity) {
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
    getStatus() {
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
exports.healthMonitoringService = new HealthMonitoringService();
