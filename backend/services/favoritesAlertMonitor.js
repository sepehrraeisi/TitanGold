/**
 * ============================================================================
 * Favorites Alert Monitoring Service
 * ============================================================================
 * Monitors price alerts and triggers notifications via Telegram/Browser
 * ============================================================================
 */

import pool from '../database/db.js';
import { telegramService } from './telegram.js';
import axios from 'axios';
import { logger } from '../services/logger.js';

class FavoritesAlertMonitor {
    constructor() {
        this.monitorInterval = null;
        this.CHECK_FREQUENCY = 10000; // 10 seconds
        this.lastCheckedPrices = new Map(); // symbol -> price
    }

    /**
     * Start monitoring alerts
     */
    start() {
        if (this.monitorInterval) {
            logger.warn('⚠️ Alert monitor already running');
            return;
        }

        this.monitorInterval = setInterval(async () => {
            await this.checkAlerts();
        }, this.CHECK_FREQUENCY);

        logger.info(`✅ Favorites Alert Monitor started (checking every ${this.CHECK_FREQUENCY}ms)`);
        
        // Run initial check
        this.checkAlerts();
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            logger.info('🛑 Favorites Alert Monitor stopped');
        }
    }

    /**
     * Check all active alerts
     */
    async checkAlerts() {
        try {
            // Get all active alerts with favorite info
            const result = await pool.query(
                `SELECT 
                    fa.id as alert_id,
                    fa.user_id,
                    fa.condition,
                    fa.target_price,
                    fa.notify_telegram,
                    fa.notify_browser,
                    fa.notify_email,
                    f.asset_id,
                    f.symbol,
                    f.name,
                    u.username,
                    u.email
                FROM favorite_alerts fa
                JOIN favorites f ON fa.favorite_id = f.id
                JOIN users u ON fa.user_id = u.id
                WHERE fa.is_active = true`
            );

            if (result.rows.length === 0) {
                return; // No active alerts
            }

            logger.info(`🔍 Checking ${result.rows.length} active alerts...`);

            // Group alerts by symbol to minimize API calls
            const alertsBySymbol = new Map();
            for (const alert of result.rows) {
                if (!alertsBySymbol.has(alert.asset_id)) {
                    alertsBySymbol.set(alert.asset_id, []);
                }
                alertsBySymbol.get(alert.asset_id).push(alert);
            }

            // Check each symbol
            for (const [assetId, alerts] of alertsBySymbol) {
                await this.checkAlertsForSymbol(assetId, alerts);
            }

        } catch (error) {
            logger.error('❌ Error checking alerts:', error);
        }
    }

    /**
     * Check alerts for a specific symbol
     */
    async checkAlertsForSymbol(assetId, alerts) {
        try {
            // Fetch current price from MEXC
            const currentPrice = await this.fetchPrice(assetId);
            
            if (!currentPrice) {
                logger.warn(`⚠️ Could not fetch price for ${assetId}`);
                return;
            }

            // Check each alert
            for (const alert of alerts) {
                const triggered = this.shouldTriggerAlert(
                    currentPrice,
                    alert.target_price,
                    alert.condition
                );

                if (triggered) {
                    logger.info(`🔔 Alert triggered! ${alert.symbol} ${alert.condition} $${alert.target_price} (current: $${currentPrice})`);
                    await this.triggerAlert(alert, currentPrice);
                }
            }

        } catch (error) {
            logger.error(`❌ Error checking alerts for ${assetId}:`, error);
        }
    }

    /**
     * Check if alert should trigger
     */
    shouldTriggerAlert(currentPrice, targetPrice, condition) {
        if (condition === 'above') {
            return currentPrice >= targetPrice;
        } else if (condition === 'below') {
            return currentPrice <= targetPrice;
        }
        return false;
    }

    /**
     * Trigger an alert - send notifications and update database
     */
    async triggerAlert(alert, currentPrice) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Mark alert as triggered
            await client.query(
                `UPDATE favorite_alerts 
                 SET is_active = false,
                     triggered_at = CURRENT_TIMESTAMP,
                     triggered_price = $1
                 WHERE id = $2`,
                [currentPrice, alert.alert_id]
            );

            await client.query('COMMIT');

            // Send notifications
            await this.sendNotifications(alert, currentPrice);

            logger.info(`✅ Alert ${alert.alert_id} triggered and notifications sent`);

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('❌ Error triggering alert:', error);
        } finally {
            client.release();
        }
    }

    /**
     * Send notifications via configured channels
     */
    async sendNotifications(alert, currentPrice) {
        const message = this.formatAlertMessage(alert, currentPrice);

        // Send Telegram notification
        if (alert.notify_telegram) {
            try {
                // Get user's Telegram config from preferences
                const telegramResult = await pool.query(
                    `SELECT preferences->'notifications'->'telegram' as telegram_config
                     FROM user_preferences
                     WHERE user_id = $1`,
                    [alert.user_id]
                );

                const telegramConfig = telegramResult.rows[0]?.telegram_config;

                if (telegramConfig && telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
                    // Send using user's bot
                    const TelegramBot = (await import('node-telegram-bot-api')).default;
                    const bot = new TelegramBot(telegramConfig.botToken);
                    
                    await bot.sendMessage(
                        telegramConfig.chatId,
                        message,
                        { parse_mode: 'Markdown' }
                    );
                    
                    logger.info(`📱 Telegram notification sent to user ${alert.username} for ${alert.symbol}`);
                } else {
                    logger.warn(`⚠️ Telegram not configured for user ${alert.username}`);
                }
            } catch (error) {
                logger.error('❌ Telegram notification failed:', error);
            }
        }

        // TODO: Browser notification (via WebSocket)
        if (alert.notify_browser) {
            // This would integrate with WebSocket service
            logger.info(`🔔 Browser notification needed for ${alert.symbol}`);
        }

        // TODO: Email notification
        if (alert.notify_email) {
            logger.info(`📧 Email notification needed for ${alert.symbol}`);
        }
    }

    /**
     * Format alert message
     */
    formatAlertMessage(alert, currentPrice) {
        const emoji = alert.condition === 'above' ? '📈' : '📉';
        const direction = alert.condition === 'above' ? 'above' : 'below';
        
        return `
${emoji} *Price Alert Triggered!*

*Asset:* ${alert.name} (${alert.symbol})
*Condition:* ${direction} $${alert.target_price.toFixed(2)}
*Current Price:* $${currentPrice.toFixed(2)}

Your alert has been triggered and deactivated.
        `.trim();
    }

    /**
     * Fetch current price from MEXC
     */
    async fetchPrice(assetId) {
        try {
            const response = await axios.get(
                `https://api.mexc.com/api/v3/ticker/24hr?symbol=${assetId}`,
                { timeout: 5000 }
            );

            if (response.data && response.data.lastPrice) {
                const price = parseFloat(response.data.lastPrice);
                this.lastCheckedPrices.set(assetId, price);
                return price;
            }

            return null;
        } catch (error) {
            logger.warn(`⚠️ Failed to fetch price for ${assetId}:`, error.message);
            
            // Return cached price if available
            return this.lastCheckedPrices.get(assetId) || null;
        }
    }

    /**
     * Get monitor statistics
     */
    getStats() {
        return {
            isRunning: this.monitorInterval !== null,
            checkFrequency: this.CHECK_FREQUENCY,
            cachedPrices: this.lastCheckedPrices.size
        };
    }

    /**
     * Manually check a specific alert (for testing)
     */
    async checkSpecificAlert(alertId) {
        try {
            const result = await pool.query(
                `SELECT 
                    fa.id as alert_id,
                    fa.user_id,
                    fa.condition,
                    fa.target_price,
                    fa.notify_telegram,
                    fa.notify_browser,
                    fa.notify_email,
                    f.asset_id,
                    f.symbol,
                    f.name,
                    u.username,
                    u.email
                FROM favorite_alerts fa
                JOIN favorites f ON fa.favorite_id = f.id
                JOIN users u ON fa.user_id = u.id
                WHERE fa.id = $1 AND fa.is_active = true`,
                [alertId]
            );

            if (result.rows.length === 0) {
                return { success: false, error: 'Alert not found or not active' };
            }

            const alert = result.rows[0];
            const currentPrice = await this.fetchPrice(alert.asset_id);

            if (!currentPrice) {
                return { success: false, error: 'Could not fetch price' };
            }

            const shouldTrigger = this.shouldTriggerAlert(
                currentPrice,
                alert.target_price,
                alert.condition
            );

            return {
                success: true,
                alert,
                currentPrice,
                shouldTrigger,
                message: shouldTrigger 
                    ? 'Alert would trigger at this price'
                    : `Alert not triggered. Current: $${currentPrice}, Target: ${alert.condition} $${alert.target_price}`
            };

        } catch (error) {
            logger.error('Error checking specific alert:', error);
            return { success: false, error: error.message };
        }
    }
}

// Singleton instance
const favoritesAlertMonitor = new FavoritesAlertMonitor();

export default favoritesAlertMonitor;
