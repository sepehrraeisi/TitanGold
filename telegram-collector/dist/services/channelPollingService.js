"use strict";
/**
 * Background Channel Polling Service
 * Periodically fetches new messages from tracked Telegram channels
 * and stores them in the database for Data Hub pipeline processing.
 *
 * C1: bounded intra-cycle concurrency, one Telegram client per session
 * identity per cycle, fail-closed TIMEOUT (no immediate application retry).
 * Production cycle path: PollCycleEngine → connectSessionForGroup (one client
 * per identity) → pollChannelWithClient. Compatibility pollChannel() is not
 * the production cycle path.
 *
 * Canonical runtime owner for this service is this committed dist file.
 * There is no corresponding src/services/channelPollingService.ts.
 * telegram-collector/tsconfig.json compiles src/**/* only, so `npm run build`
 * cannot emit or overwrite this file.
 *
 * C1 does not claim to fix GramJS 2.26.22 internal reconnect paths.
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
const { parsePollConcurrency, DEFAULT_POLL_CONCURRENCY } = require("../../services/pollConcurrency");
const {
    isTimeoutError,
    formatCycleSummary,
    PollCycleEngine,
} = require("../../services/pollCycleEngine");
const {
    GRAMJS_EPHEMERAL_CLIENT_OPTIONS,
    resolvePollingSession,
    connectAndProve,
    connectProvenSessionClient,
    disconnectClientSafe,
} = require("../../services/telegramConnectLifecycle");
const pollQueries = require("../../services/pollQueries");

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'titangold_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
});

class ChannelPollingService {
    constructor(options = {}) {
        this.intervalId = null;
        this._createTelegramClient = options.createTelegramClient;
        this._loadAccountSession = options.loadAccountSession;
        this._loadPrimarySession = options.loadPrimarySession;
        this._loadLegacySession = options.loadLegacySession;
        this.config = {
            // Default: enabled. Set TELEGRAM_POLLING_ENABLED=false to disable.
            enabled: process.env.TELEGRAM_POLLING_ENABLED !== 'false',
            intervalMinutes: parseInt(process.env.TELEGRAM_POLLING_INTERVAL_MINUTES || '1'),
            batchSize: parseInt(process.env.TELEGRAM_POLLING_BATCH_SIZE || '10'),
            maxMessagesPerChannel: parseInt(process.env.TELEGRAM_POLLING_MAX_MESSAGES || '50'),
            pollConcurrency: parsePollConcurrency(process.env.TELEGRAM_POLL_CONCURRENCY),
            priorityIntervals: {
                high: 1,
                normal: 3,
                low: 5
            }
        };
        this.cycleEngine = new PollCycleEngine({
            pollConcurrency: this.config.pollConcurrency,
            getActiveChannels: () => this.getActiveChannels(),
            connectSession: (identityKey, channels) => this.connectSessionForGroup(identityKey, channels),
            pollChannel: (client, channel) => this.pollChannelWithClient(client, channel),
            disconnectClient: disconnectClientSafe,
        });
    }

    get isRunning() {
        return this.cycleEngine.isRunning;
    }

    /**
     * Get active channels from database that are due for polling based on priority
     */
    async getActiveChannels() {
        try {
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
     * Get Telegram client with session, optionally for a specific account.
     * Does not connect. Caller owns connect/disconnect for the session identity.
     *
     * Explicit account_id groups fail closed when that account session cannot be
     * loaded. Primary/legacy fallback is only for the shared-primary group.
     */
    async getTelegramClient(accountId) {
        const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
        const apiHash = process.env.TELEGRAM_API_HASH || '';
        if (!apiId || !apiHash) {
            throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured');
        }
        const resolved = await resolvePollingSession({
            requestedAccountId: accountId,
            loadAccountSession: this._loadAccountSession
                || ((id) => accountManager_1.default.getDecryptedSessionForAccount(id)),
            loadPrimarySession: this._loadPrimarySession
                || (() => accountManager_1.default.getPrimaryAccountSession()),
            loadLegacySession: this._loadLegacySession
                || (() => (0, sessionManager_1.getSessionFromDB)('telegram-collector')),
        });
        const session = new sessions_1.StringSession(resolved.sessionString);
        const createClient = this._createTelegramClient
            || ((sess, id, hash, opts) => new telegram_1.TelegramClient(sess, id, hash, opts));
        return createClient(session, apiId, apiHash, { ...GRAMJS_EPHEMERAL_CLIENT_OPTIONS });
    }

    async connectSessionForGroup(identityKey, channels) {
        return connectProvenSessionClient(
            identityKey,
            channels,
            (accountId) => this.getTelegramClient(accountId)
        );
    }

    async getLastMessageIdForChannel(channelDbId) {
        return pollQueries.getLastMessageIdForChannel(
            (text, params) => pool.query(text, params),
            channelDbId
        );
    }

    async fetchChannelMessages(client, channelId, channelUsername, limit, minId = 0) {
        try {
            const channelIdentifier = channelUsername || channelId.toString();
            const opts = { limit };
            if (minId > 0) {
                opts.minId = minId;
            }
            const messages = await client.getMessages(channelIdentifier, opts);
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
            const batchResults = (0, dataValidator_1.batchProcessMessages)(formattedMessages);
            return batchResults
                .filter(r => r.validation.valid && r.normalized)
                .map((r, index) => {
                const msg = formattedMessages[index];
                let messageDate;
                try {
                    if (typeof msg.date === 'number' && msg.date > 0 && msg.date < 2147483647) {
                        messageDate = new Date(msg.date * 1000);
                    } else {
                        console.warn(`⚠️ Invalid timestamp for message ${msg.id}: ${msg.date}, using current time`);
                        messageDate = new Date();
                    }
                } catch (e) {
                    console.error(`❌ Error converting timestamp for message ${msg.id}:`, e);
                    messageDate = new Date();
                }

                return {
                    message_id: BigInt(msg.id),
                    message_text: msg.text,
                    message_type: msg.media ? 'media' : 'text',
                    has_media: !!msg.media,
                    telegram_created_at: messageDate,
                    sender_id: null,
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

    async saveMessages(channelDbId, messages) {
        return pollQueries.saveMessages(
            (text, params) => pool.query(text, params),
            channelDbId,
            messages
        );
    }

    async updateChannelSyncTime(channelDbId) {
        try {
            await pool.query('UPDATE telegram_channels SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1', [channelDbId]);
        }
        catch (error) {
            console.error(`❌ Error updating sync time for channel ${channelDbId}:`, error);
        }
    }

    /**
     * Poll a single channel using an already-connected client for this session identity.
     * Does not connect, disconnect, or retry.
     */
    async pollChannelWithClient(client, channel) {
        try {
            const lastId = await this.getLastMessageIdForChannel(channel.id);
            const messages = await this.fetchChannelMessages(
                client,
                channel.channel_id,
                channel.username,
                this.config.maxMessagesPerChannel,
                lastId
            );
            if (messages.length === 0) {
                await this.updateChannelSyncTime(channel.id);
                return { success: true, messagesCount: 0 };
            }
            const savedCount = await this.saveMessages(channel.id, messages);
            await this.updateChannelSyncTime(channel.id);
            return { success: true, messagesCount: savedCount };
        }
        catch (error) {
            const timeout = isTimeoutError(error);
            if (!timeout) {
                console.error(`   ❌ Error polling channel ${channel.title}:`, error.message);
            }
            try {
                await this.updateChannelSyncTime(channel.id);
            }
            catch (e) {
                console.error(`   ⚠️ Failed to update last_synced_at for channel ${channel.id}:`, e.message || e);
            }
            return {
                success: false,
                messagesCount: 0,
                timeout,
                error: timeout ? 'TIMEOUT' : (error && error.message)
            };
        }
    }

    /**
     * Compatibility wrapper only. Production polling uses runPollingCycle →
     * PollCycleEngine → one connectSessionForGroup per identity →
     * pollChannelWithClient. This one-off path must not become the cycle owner.
     */
    async pollChannel(channel) {
        let client = null;
        try {
            client = await this.getTelegramClient(channel.account_id);
            await connectAndProve(client);
            return await this.pollChannelWithClient(client, channel);
        }
        catch (error) {
            const timeout = isTimeoutError(error);
            if (!timeout) {
                console.error(`   ❌ Error polling channel ${channel.title}:`, error.message);
            }
            try {
                await this.updateChannelSyncTime(channel.id);
            }
            catch (e) {
                console.error(`   ⚠️ Failed to update last_synced_at for channel ${channel.id}:`, e.message || e);
            }
            return {
                success: false,
                messagesCount: 0,
                timeout,
                error: timeout ? 'TIMEOUT' : (error && error.message)
            };
        }
        finally {
            await disconnectClientSafe(client);
        }
    }

    async runPollingCycle() {
        try {
            const outcome = await this.cycleEngine.runPollingCycle();
            if (outcome.skipped) {
                console.log('⏸️  Polling cycle already running, skipping...');
                return outcome;
            }

            const totalMessages = (outcome.results || [])
                .filter((r) => r.status === 'fulfilled')
                .reduce((sum, r) => sum + (r.value?.messagesCount || 0), 0);
            metricsCollector_1.default.recordPollingCycle(totalMessages);
            console.log(formatCycleSummary(outcome.summary));
            return outcome;
        }
        catch (error) {
            console.error('❌ Error in polling cycle:', error.message);
            return { skipped: false, error: error.message };
        }
    }

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
        console.log(`   Poll concurrency: ${this.config.pollConcurrency} (default ${DEFAULT_POLL_CONCURRENCY})`);
        console.log(`   Max messages: ${this.config.maxMessagesPerChannel} per channel`);
        this.runPollingCycle().catch(err => {
            console.error('❌ Error in initial polling cycle:', err);
        });
        this.intervalId = setInterval(() => {
            this.runPollingCycle().catch(err => {
                console.error('❌ Error in polling cycle:', err);
            });
        }, intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Channel polling service stopped');
        }
    }

    getStatus() {
        return {
            enabled: this.config.enabled,
            running: this.isRunning,
            intervalMinutes: this.config.intervalMinutes,
            pollConcurrency: this.config.pollConcurrency
        };
    }
}

const channelPollingService = new ChannelPollingService();
exports.default = channelPollingService;
exports.ChannelPollingService = ChannelPollingService;
