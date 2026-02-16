"use strict";
/**
 * Background Channel Polling Service
 * Periodically fetches new messages from tracked Telegram channels
 * and stores them in the database for Data Hub pipeline processing.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const sessionManager_1 = require("../utils/sessionManager");
const dataValidator_1 = require("../utils/dataValidator");
const metricsCollector_1 = __importDefault(require("../utils/metricsCollector"));
const accountManager_1 = __importDefault(require("../utils/accountManager"));
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'titangold_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
});
class ChannelPollingService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.config = {
            enabled: process.env.TELEGRAM_POLLING_ENABLED === 'true',
            intervalMinutes: parseInt(process.env.TELEGRAM_POLLING_INTERVAL_MINUTES || '1'), // Changed to 1 minute base interval
            batchSize: parseInt(process.env.TELEGRAM_POLLING_BATCH_SIZE || '10'), // Increased for faster polling
            maxMessagesPerChannel: parseInt(process.env.TELEGRAM_POLLING_MAX_MESSAGES || '50'),
            // Priority-based intervals (in minutes)
            priorityIntervals: {
                high: 1,    // 1 minute for HIGH priority (trading critical)
                normal: 3,  // 3 minutes for NORMAL priority
                low: 5      // 5 minutes for LOW priority
            }
        };
    }
    /**
     * Get active channels from database that are due for polling based on priority
     */
    async getActiveChannels() {
        try {
            // Get priority intervals in minutes
            const highInterval = this.config.priorityIntervals.high;
            const normalInterval = this.config.priorityIntervals.normal;
            const lowInterval = this.config.priorityIntervals.low;
            
            const result = await pool.query(`
                SELECT id, channel_id, username, title, last_synced_at, config, account_id, priority
                FROM telegram_channels
                WHERE is_active = true
                AND (
                    -- Never synced channels (highest priority)
                    last_synced_at IS NULL
                    OR
                    -- HIGH priority: poll every 1 minute
                    (priority = 'high' AND last_synced_at < NOW() - INTERVAL '${highInterval} minutes')
                    OR
                    -- NORMAL priority: poll every 3 minutes
                    ((priority = 'normal' OR priority IS NULL) AND last_synced_at < NOW() - INTERVAL '${normalInterval} minutes')
                    OR
                    -- LOW priority: poll every 5 minutes
                    (priority = 'low' AND last_synced_at < NOW() - INTERVAL '${lowInterval} minutes')
                )
                ORDER BY 
                    CASE WHEN last_synced_at IS NULL THEN 0 ELSE 1 END,
                    CASE 
                        WHEN priority = 'high' THEN 1
                        WHEN priority = 'normal' OR priority IS NULL THEN 2
                        WHEN priority = 'low' THEN 3
                        ELSE 4
                    END,
                    last_synced_at ASC NULLS FIRST
                LIMIT $1
            `, [this.config.batchSize]);
            
            return result.rows.map(row => ({
                id: row.id,
                channel_id: BigInt(row.channel_id),
                username: row.username,
                title: row.title,
                last_synced_at: row.last_synced_at,
                config: row.config || {},
                account_id: row.account_id || null,
                priority: row.priority || 'normal'
            }));
        }
        catch (error) {
            console.error('❌ Error fetching active channels:', error);
            return [];
        }
    }
    /**
     * Get Telegram client with session, optionally for a specific account
     */
    async getTelegramClient(accountId) {
        const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
        const apiHash = process.env.TELEGRAM_API_HASH || '';
        if (!apiId || !apiHash) {
            throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured');
        }
        let sessionString = null;
        // 1) If specific account_id is provided, try to use that account
        if (accountId) {
            try {
                const accountSession = await accountManager_1.default.getDecryptedSessionForAccount(accountId);
                sessionString = accountSession.sessionString;
            }
            catch (error) {
                console.warn(`⚠️  Could not load session for account ${accountId}:`, error.message);
                // fall through to primary/legacy
            }
        }
        // 2) If no specific session yet, try primary account
        if (!sessionString) {
            try {
                const primary = await accountManager_1.default.getPrimaryAccountSession();
                if (primary && primary.sessionString) {
                    sessionString = primary.sessionString;
                }
            }
            catch (error) {
                console.warn('⚠️  Could not load primary account session:', error.message);
            }
        }
        // 3) Fallback to legacy session manager
        if (!sessionString) {
            const dbSession = await (0, sessionManager_1.getSessionFromDB)('telegram-collector');
            if (!dbSession || !dbSession.sessionString) {
                throw new Error('No active Telegram session found. Please complete login first.');
            }
            sessionString = dbSession.sessionString;
        }
        const session = new sessions_1.StringSession(sessionString);
        const client = new telegram_1.TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5,
        });
        return client;
    }
    /**
     * Fetch new messages from a channel
     */
    async fetchChannelMessages(client, channelId, channelUsername, limit) {
        try {
            // Use channel_id (numeric) or username
            const channelIdentifier = channelUsername || channelId.toString();
            const messages = await client.getMessages(channelIdentifier, { limit });
            // Process and normalize messages
            const formattedMessages = messages.map((msg) => ({
                id: msg.id,
                text: msg.message || null,
                date: msg.date,
                views: msg.views,
                forwards: msg.forwards,
                media: msg.media ? { type: msg.media.className } : undefined,
                replyTo: msg.replyTo?.replyToMsgId,
                edited: msg.editDate
            }));
            // Batch process for validation and normalization
            const batchResults = (0, dataValidator_1.batchProcessMessages)(formattedMessages);
            // Return only valid, normalized messages
            return batchResults
                .filter(r => r.validation.valid && r.normalized)
                .map((r, index) => {
                const msg = formattedMessages[index];
                return {
                    message_id: BigInt(msg.id),
                    message_text: msg.text,
                    message_type: msg.media ? 'media' : 'text',
                    has_media: !!msg.media,
                    telegram_created_at: msg.date,
                    sender_id: null, // Telegram channels don't have sender info
                    sender_username: null,
                    normalized: (0, dataValidator_1.enrichMessage)(r.normalized)
                };
            });
        }
        catch (error) {
            console.error(`❌ Error fetching messages from channel ${channelId}:`, error.message);
            throw error;
        }
    }
    /**
     * Save messages to database
     */
    async saveMessages(channelDbId, messages) {
        if (messages.length === 0)
            return 0;
        try {
            // Use INSERT ... ON CONFLICT to avoid duplicates
            const values = messages.map((msg, index) => {
                const base = index * 8;
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
            }).join(', ');
            const params = [];
            messages.forEach(msg => {
                params.push(channelDbId, msg.message_id.toString(), msg.sender_id?.toString() || null, msg.sender_username || null, msg.message_text, msg.message_type, msg.has_media, msg.telegram_created_at);
            });
            const query = `
                INSERT INTO telegram_messages 
                    (channel_id, message_id, sender_id, sender_username, message_text, message_type, has_media, telegram_created_at)
                VALUES ${values}
                ON CONFLICT (message_id, channel_id) DO NOTHING
                RETURNING id
            `;
            const result = await pool.query(query, params);
            return result.rowCount || 0;
        }
        catch (error) {
            console.error('❌ Error saving messages to database:', error);
            throw error;
        }
    }
    /**
     * Update channel last_synced_at timestamp
     */
    async updateChannelSyncTime(channelDbId) {
        try {
            await pool.query('UPDATE telegram_channels SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1', [channelDbId]);
        }
        catch (error) {
            console.error(`❌ Error updating sync time for channel ${channelDbId}:`, error);
        }
    }
    /**
     * Poll a single channel
     */
    async pollChannel(channel) {
        let client = null;
        try {
            console.log(`📡 Polling channel: ${channel.title} (${channel.username || channel.channel_id})`);
            client = await this.getTelegramClient(channel.account_id);
            await client.connect();
            // Fetch messages
            const messages = await this.fetchChannelMessages(client, channel.channel_id, channel.username, this.config.maxMessagesPerChannel);
            if (messages.length === 0) {
                console.log(`   ℹ️  No new messages found`);
                await this.updateChannelSyncTime(channel.id);
                return { success: true, messagesCount: 0 };
            }
            // Save to database
            const savedCount = await this.saveMessages(channel.id, messages);
            await this.updateChannelSyncTime(channel.id);
            console.log(`   ✅ Saved ${savedCount} new messages`);
            return { success: true, messagesCount: savedCount };
        }
        catch (error) {
            console.error(`   ❌ Error polling channel ${channel.title}:`, error.message);
            // حتی در صورت خطا هم زمان آخرین تلاش برای sync را ثبت می‌کنیم
            // تا در UI ستون "Last Synced" از حالت "never" خارج شود و نشان دهد
            // آخرین بار چه زمانی تلاش شده است.
            try {
                await this.updateChannelSyncTime(channel.id);
            }
            catch (e) {
                // خطای به‌روزرسانی زمان sync نباید کل polling را از کار بیندازد
                console.error(`   ⚠️ Failed to update last_synced_at for channel ${channel.id}:`, e.message || e);
            }
            return {
                success: false,
                messagesCount: 0,
                error: error.message
            };
        }
        finally {
            if (client) {
                try {
                    await client.disconnect();
                }
                catch (e) {
                    // Ignore disconnect errors
                }
            }
        }
    }
    /**
     * Run one polling cycle
     */
    async runPollingCycle() {
        if (this.isRunning) {
            console.log('⏸️  Polling cycle already running, skipping...');
            return;
        }
        this.isRunning = true;
        const startTime = Date.now();
        try {
            console.log('\n🔄 Starting channel polling cycle...');
            // Get active channels
            const channels = await this.getActiveChannels();
            if (channels.length === 0) {
                console.log('ℹ️  No active channels to poll');
                return;
            }
            console.log(`📋 Found ${channels.length} active channel(s) to poll`);
            // Poll each channel
            const results = await Promise.allSettled(channels.map(channel => this.pollChannel(channel)));
            // Summary
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;
            const totalMessages = results
                .filter(r => r.status === 'fulfilled')
                .reduce((sum, r) => sum + (r.value?.messagesCount || 0), 0);
            // Record polling cycle metrics
            metricsCollector_1.default.recordPollingCycle(totalMessages);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✅ Polling cycle completed in ${duration}s`);
            console.log(`   📊 Channels: ${successful} successful, ${failed} failed`);
            console.log(`   📨 Messages: ${totalMessages} new messages saved`);
        }
        catch (error) {
            console.error('❌ Error in polling cycle:', error.message);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start background polling
     */
    start() {
        if (!this.config.enabled) {
            console.log('⏸️  Channel polling is disabled (set TELEGRAM_POLLING_ENABLED=true to enable)');
            return;
        }
        if (this.intervalId) {
            console.log('⚠️  Polling service already started');
            return;
        }
        const intervalMs = this.config.intervalMinutes * 60 * 1000;
        console.log(`🚀 Starting channel polling service (Priority-Based)`);
        console.log(`   Base Check Interval: ${this.config.intervalMinutes} minute(s)`);
        console.log(`   Priority Intervals:`);
        console.log(`     🔴 HIGH:   ${this.config.priorityIntervals.high} minute(s) - Trading Critical`);
        console.log(`     ⚪ NORMAL: ${this.config.priorityIntervals.normal} minute(s) - Standard`);
        console.log(`     ⚫ LOW:    ${this.config.priorityIntervals.low} minute(s) - Less Important`);
        console.log(`   Batch size: ${this.config.batchSize} channels per cycle`);
        console.log(`   Max messages: ${this.config.maxMessagesPerChannel} per channel`);
        // Run immediately on start
        this.runPollingCycle().catch(err => {
            console.error('❌ Error in initial polling cycle:', err);
        });
        // Then run on interval (every 1 minute to check for due channels)
        this.intervalId = setInterval(() => {
            this.runPollingCycle().catch(err => {
                console.error('❌ Error in polling cycle:', err);
            });
        }, intervalMs);
    }
    /**
     * Stop background polling
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Channel polling service stopped');
        }
    }
    /**
     * Get service status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            running: this.isRunning,
            intervalMinutes: this.config.intervalMinutes
        };
    }
}
// Singleton instance
const channelPollingService = new ChannelPollingService();
exports.default = channelPollingService;
