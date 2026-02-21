"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const retry_1 = require("./utils/retry");
const rateLimitHybrid_1 = require("./utils/rateLimitHybrid");
const rateLimitRedis_1 = require("./utils/rateLimitRedis");
const sessionManager_1 = require("./utils/sessionManager");
const dataValidator_1 = require("./utils/dataValidator");
const accountManager_1 = require("./utils/accountManager");
const sessionRotationService_1 = __importDefault(require("./services/sessionRotationService"));
const channelPollingService_1 = __importDefault(require("./services/channelPollingService"));
const metricsCollector_1 = __importDefault(require("./utils/metricsCollector"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
// Circuit breaker for Telegram API calls
const telegramCircuitBreaker = new retry_1.CircuitBreaker(5, 60000, 2);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Store active auth sessions
const authSessions = new Map();
// Helper to get or create Telegram client
async function getTelegramClient(sessionString) {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured');
    }
    // If no session string provided, try to load from database
    let finalSessionString = sessionString;
    if (!finalSessionString) {
        try {
            const dbSession = await (0, sessionManager_1.getSessionFromDB)('telegram-collector');
            if (dbSession && dbSession.sessionString) {
                // Session is already decrypted by getSessionFromDB
                finalSessionString = dbSession.sessionString;
                console.log('✅ Loaded session from database');
            }
            else {
                // Fallback to .env
                finalSessionString = process.env.TELEGRAM_SESSION_STRING || '';
                if (finalSessionString) {
                    console.log('⚠️  Using session from .env (fallback)');
                }
            }
        }
        catch (error) {
            console.error('❌ Failed to load session from database:', error);
            // Fallback to .env
            finalSessionString = process.env.TELEGRAM_SESSION_STRING || '';
            if (finalSessionString) {
                console.log('⚠️  Using session from .env (fallback after error)');
            }
        }
    }
    const session = new sessions_1.StringSession(finalSessionString || '');
    const client = new telegram_1.TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    });
    return client;
}
// Health check endpoints (both paths for compatibility)
app.get('/health', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    let sessionStats = null;
    try {
        sessionStats = await (0, sessionManager_1.getSessionStats)('telegram-collector');
    }
    catch (error) {
        console.error('⚠️  Could not fetch session stats:', error);
    }
    res.json({
        status: 'healthy',
        service: 'telegram-collector',
        version: '0.5.0',
        timestamp: new Date().toISOString(),
        configured: {
            apiId: !!process.env.TELEGRAM_API_ID,
            apiHash: !!process.env.TELEGRAM_API_HASH,
            session: !!process.env.TELEGRAM_SESSION_STRING
        },
        mtproto: 'enabled',
        circuitBreaker: telegramCircuitBreaker.getStats(),
        rateLimit: {
            globalTokens: rateLimitHybrid_1.globalRateLimiter.getAvailableTokens(),
            stats: (0, rateLimitHybrid_1.getRateLimiterStats)()
        },
        session: {
            in_database: sessionStats?.inDatabase || false,
            last_used: sessionStats?.lastUsed || null
        }
    });
});
// Session Management Endpoints
app.get('/api/telegram-collector/session/status', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    try {
        const dbSession = await (0, sessionManager_1.getSessionFromDB)('telegram-collector');
        if (!dbSession) {
            return res.json({
                stored_in_db: false,
                message: 'No session found in database',
                fallback_to_env: !!process.env.TELEGRAM_SESSION_STRING
            });
        }
        res.json({
            stored_in_db: true,
            service_name: dbSession.serviceName,
            phone_number: dbSession.phoneNumber,
            is_active: dbSession.isActive,
            last_used_at: dbSession.lastUsedAt,
            created_at: dbSession.createdAt,
            has_env_fallback: !!process.env.TELEGRAM_SESSION_STRING
        });
    }
    catch (error) {
        console.error('❌ Error checking session status:', error);
        res.status(500).json({
            error: 'Failed to check session status',
            message: error.message
        });
    }
});
app.post('/api/telegram-collector/session/rotate', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        const { new_session_string } = req.body;
        if (!new_session_string) {
            return res.status(400).json({
                error: 'new_session_string is required'
            });
        }
        const apiId = process.env.TELEGRAM_API_ID;
        const apiHash = process.env.TELEGRAM_API_HASH;
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
        const sessionId = await (0, sessionManager_1.saveSessionToDB)('telegram-collector', new_session_string, phoneNumber, apiId, apiHash);
        res.json({
            success: true,
            message: 'Session rotated successfully',
            session_id: sessionId
        });
    }
    catch (error) {
        console.error('❌ Error rotating session:', error);
        res.status(500).json({
            error: 'Failed to rotate session',
            message: error.message
        });
    }
});
// ============================================================================
// SESSION ROTATION ENDPOINTS (Automatic)
// ============================================================================
/**
 * GET /api/telegram-collector/session/health
 * Get session health status
 */
app.get('/api/telegram-collector/session/health', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    try {
        const health = sessionRotationService_1.default.getHealthStatus();
        res.json({
            success: true,
            health
        });
    }
    catch (error) {
        console.error('❌ Error getting session health:', error);
        res.status(500).json({
            error: 'Failed to get session health',
            message: error.message
        });
    }
});
/**
 * POST /api/telegram-collector/session/check-health
 * Trigger manual health check
 */
app.post('/api/telegram-collector/session/check-health', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        console.log('🏥 Manual health check triggered via API');
        const health = await sessionRotationService_1.default.checkSessionHealth();
        res.json({
            success: true,
            health,
            message: 'Health check completed'
        });
    }
    catch (error) {
        console.error('❌ Error during manual health check:', error);
        res.status(500).json({
            error: 'Failed to perform health check',
            message: error.message
        });
    }
});
/**
 * POST /api/telegram-collector/session/force-rotation
 * Force immediate session rotation
 */
app.post('/api/telegram-collector/session/force-rotation', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        console.log('🔄 Manual session rotation triggered via API');
        const result = await sessionRotationService_1.default.forceRotation();
        if (result.success) {
            res.json({
                success: true,
                result,
                message: 'Session rotation completed successfully'
            });
        }
        else {
            res.status(500).json({
                success: false,
                result,
                error: 'Session rotation failed',
                message: result.error || 'Unknown error'
            });
        }
    }
    catch (error) {
        console.error('❌ Error during forced rotation:', error);
        res.status(500).json({
            error: 'Failed to force session rotation',
            message: error.message
        });
    }
});
app.get('/api/telegram-collector/health', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    let sessionStats = null;
    try {
        sessionStats = await (0, sessionManager_1.getSessionStats)('telegram-collector');
    }
    catch (error) {
        console.error('⚠️  Could not fetch session stats:', error);
    }
    res.json({
        status: 'healthy',
        service: 'telegram-collector',
        version: '0.5.0',
        timestamp: new Date().toISOString(),
        configured: {
            apiId: !!process.env.TELEGRAM_API_ID,
            apiHash: !!process.env.TELEGRAM_API_HASH,
            session: !!process.env.TELEGRAM_SESSION_STRING
        },
        mtproto: 'enabled',
        circuitBreaker: telegramCircuitBreaker.getStats(),
        rateLimit: {
            globalTokens: rateLimitHybrid_1.globalRateLimiter.getAvailableTokens(),
            stats: (0, rateLimitHybrid_1.getRateLimiterStats)()
        },
        session: {
            in_database: sessionStats?.inDatabase || false,
            last_used: sessionStats?.lastUsed || null,
            created_at: sessionStats?.createdAt || null,
            phone_number: sessionStats?.phoneNumber || null
        }
    });
});
// Start login flow - send verification code (multi-account aware)
app.post('/api/telegram-collector/login/start', rateLimitHybrid_1.rateLimiters.auth, async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({
                error: 'Phone number is required',
                message: 'Please provide a valid phone number'
            });
        }
        console.log('🚀 Starting real Telegram login for:', phoneNumber);
        // Check existing account FloodWait / status before sending code
        try {
            const existingAccount = await (0, accountManager_1.getAccountByPhone)(phoneNumber);
            if (existingAccount && existingAccount.status === 'flooded' && existingAccount.last_flood_until) {
                const now = new Date();
                const floodUntil = new Date(existingAccount.last_flood_until);
                if (floodUntil > now) {
                    const remainingSeconds = Math.max(0, Math.round((floodUntil.getTime() - now.getTime()) / 1000));
                    return res.status(429).json({
                        success: false,
                        error: 'FloodWait in effect',
                        code: 'FLOOD_WAIT',
                        retry_after_seconds: remainingSeconds,
                        message: 'Telegram has temporarily limited login attempts for this account. Please try again later.'
                    });
                }
            }
        }
        catch (checkError) {
            console.warn('⚠️  Failed to check existing account before login:', checkError);
        }
        // Create new client
        const client = await getTelegramClient();
        await client.connect();
        // Send code
        const result = await client.sendCode({
            apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
            apiHash: process.env.TELEGRAM_API_HASH || ''
        }, phoneNumber);
        const authId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Store session for confirmation (include phoneNumber for multi-account)
        authSessions.set(authId, {
            client,
            phoneCodeHash: result.phoneCodeHash,
            phoneNumber
        });
        console.log('✅ Verification code sent to:', phoneNumber);
        // Record successful login start
        metricsCollector_1.default.recordLoginAttempt(true, false);
        res.json({
            success: true,
            authId,
            message: 'Verification code sent successfully',
            phoneNumber,
            phoneCodeHash: result.phoneCodeHash
        });
    }
    catch (error) {
        console.error('❌ Login start error:', error);
        // Record failed login attempt
        const isFloodWait = (error === null || error === void 0 ? void 0 : error.message)?.includes('FLOOD') || (error === null || error === void 0 ? void 0 : error.message)?.includes('flood') || error.code === 420;
        metricsCollector_1.default.recordLoginAttempt(false, isFloodWait);
        // Best-effort FloodWait persistence (TASK-TC-008)
        if (isFloodWait && (req.body === null || req.body === void 0 ? void 0 : req.body.phoneNumber)) {
            let seconds = typeof error.seconds === 'number' ? error.seconds : undefined;
            if (seconds == null && error && typeof error.message === 'string') {
                const match = error.message.match(/(\d+)\s*seconds?/i);
                if (match) seconds = parseInt(match[1], 10);
            }
            try {
                await accountManager_1.default.markFloodForPhone(req.body.phoneNumber, seconds);
            }
            catch (persistError) {
                console.warn('⚠️  Failed to persist FloodWait state for account:', persistError);
            }
        }
        res.status(isFloodWait ? 429 : 500).json({
            error: isFloodWait ? 'FloodWait in effect' : 'Failed to start login',
            message: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error occurred',
            code: isFloodWait ? 'FLOOD_WAIT' : undefined,
            retry_after_seconds: (typeof error === 'object' && error && typeof error.seconds === 'number') ? error.seconds : undefined
        });
    }
});
// Confirm login - verify code (multi-account aware)
app.post('/api/telegram-collector/login/confirm', rateLimitHybrid_1.rateLimiters.auth, async (req, res) => {
    try {
        const { authId, code, password } = req.body;
        if (!authId || !code) {
            return res.status(400).json({
                error: 'Auth ID and verification code are required'
            });
        }
        console.log('🔐 Confirming login for authId:', authId);
        const authSession = authSessions.get(authId);
        if (!authSession) {
            return res.status(400).json({
                error: 'Invalid or expired auth session',
                message: 'Please start the login process again'
            });
        }
        const { client, phoneCodeHash, phoneNumber } = authSession;
        if (!phoneNumber) {
            return res.status(500).json({
                error: 'Missing phone number on auth session',
                message: 'Please restart the login process'
            });
        }
        // Sign in with code
        await client.start({
            phoneNumber,
            password: async () => password || '',
            phoneCode: async () => code,
            onError: (err) => console.error('Sign in error:', err)
        });
        // Get session string
        const sessionString = client.session.save();
        // Persist per-account session in telegram_accounts
        try {
            const account = await (0, accountManager_1.upsertAccountSession)(phoneNumber, sessionString, {});
            console.log('✅ Account session saved to telegram_accounts:', account?.id);
        }
        catch (dbError) {
            console.error('⚠️  Failed to save account session in telegram_accounts:', dbError);
        }
        // Optionally keep .env session for backward compatibility (primary account)
        try {
            const fs = require('fs');
            const path = require('path');
            const envPath = path.join(__dirname, '../.env');
            let envContent = fs.readFileSync(envPath, 'utf8');
            // Update or add TELEGRAM_SESSION_STRING (handle commented lines too)
            if (envContent.includes('TELEGRAM_SESSION_STRING=')) {
                envContent = envContent.replace(/^#?\s*TELEGRAM_SESSION_STRING=.*/m, `TELEGRAM_SESSION_STRING=${sessionString}`);
            }
            else {
                envContent += `\nTELEGRAM_SESSION_STRING=${sessionString}\n`;
            }
            fs.writeFileSync(envPath, envContent);
            process.env.TELEGRAM_SESSION_STRING = sessionString;
            console.log('💾 Session saved to .env file (primary fallback)');
        }
        catch (error) {
            console.error('⚠️  Failed to save session to .env:', error);
        }
        // Clean up auth session
        authSessions.delete(authId);
        console.log('✅ Login confirmed successfully');
        // Record successful login
        metricsCollector_1.default.recordLoginAttempt(true, false);
        res.json({
            success: true,
            message: 'Login confirmed successfully',
            session: sessionString,
            phoneNumber
        });
    }
    catch (error) {
        console.error('❌ Login confirm error:', error);
        // Record failed login attempt
        const isFloodWait = (error === null || error === void 0 ? void 0 : error.message)?.includes('FLOOD') || (error === null || error === void 0 ? void 0 : error.message)?.includes('flood') || error.code === 420;
        metricsCollector_1.default.recordLoginAttempt(false, isFloodWait);
        // Best-effort FloodWait persistence (if Telegram enforces it on confirm) - use authSession.phoneNumber (TASK-TC-008)
        const confirmPhone = (req.body && req.body.authId && authSessions.get(req.body.authId))
            ? authSessions.get(req.body.authId).phoneNumber
            : (req.body === null || req.body === void 0 ? void 0 : req.body.phoneNumber);
        if (isFloodWait && confirmPhone) {
            let seconds = typeof error.seconds === 'number' ? error.seconds : undefined;
            if (seconds == null && error && typeof error.message === 'string') {
                const match = error.message.match(/(\d+)\s*seconds?/i);
                if (match) seconds = parseInt(match[1], 10);
            }
            try {
                await accountManager_1.default.markFloodForPhone(confirmPhone, seconds);
            }
            catch (persistError) {
                console.warn('⚠️  Failed to persist FloodWait state for account (confirm):', persistError);
            }
        }
        res.status(isFloodWait ? 429 : 500).json({
            error: isFloodWait ? 'FloodWait in effect' : 'Failed to confirm login',
            message: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error occurred',
            code: isFloodWait ? 'FLOOD_WAIT' : undefined,
            retry_after_seconds: (typeof error === 'object' && error && typeof error.seconds === 'number') ? error.seconds : undefined
        });
    }
});
// Cancel login
app.post('/api/telegram-collector/login/cancel', async (req, res) => {
    try {
        const { authId } = req.body;
        if (authId && authSessions.has(authId)) {
            const { client } = authSessions.get(authId);
            await client.disconnect();
            authSessions.delete(authId);
        }
        res.json({
            success: true,
            message: 'Login cancelled'
        });
    }
    catch (error) {
        console.error('❌ Login cancel error:', error);
        res.status(500).json({
            error: 'Failed to cancel login',
            message: error.message
        });
    }
});
// ============================================================================
// Multi-Account Management Endpoints
// ============================================================================
// List all Telegram MTProto accounts
app.get('/api/telegram-collector/accounts', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    try {
        const accounts = await (0, accountManager_1.getAllAccounts)();
        res.json({
            success: true,
            count: accounts.length,
            accounts
        });
    }
    catch (error) {
        console.error('❌ Failed to list telegram accounts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list accounts',
            message: error.message
        });
    }
});
// Update account (label, status, is_primary)
app.patch('/api/telegram-collector/accounts/:id', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        const { id } = req.params;
        const { label, status, is_primary } = req.body || {};
        const updates = {};
        if (status && !accountManager_1.ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status value'
            });
        }
        if (label !== undefined) {
            updates.label = label;
        }
        if (status !== undefined) {
            updates.status = status;
        }
        if (typeof is_primary === 'boolean') {
            updates.is_primary = is_primary;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }
        const account = await (0, accountManager_1.updateAccount)(id, updates);
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }
        // If this account is now primary, clear primary flag from others
        if (updates.is_primary === true) {
            await (0, accountManager_1.ensureSinglePrimary)(id);
        }
        res.json({
            success: true,
            account
        });
    }
    catch (error) {
        console.error('❌ Failed to update telegram account:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update account',
            message: error.message
        });
    }
});
// Logout / disable a specific account
app.post('/api/telegram-collector/accounts/:id/logout', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        const { id } = req.params;
        const account = await (0, accountManager_1.logoutAccount)(id);
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }
        res.json({
            success: true,
            account,
            message: 'Account logged out and disabled'
        });
    }
    catch (error) {
        console.error('❌ Failed to logout telegram account:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout account',
            message: error.message
        });
    }
});
// Get channel messages
app.get('/telegram/:channel/recent', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        const { channel } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const validate = req.query.validate !== 'false'; // default true
        const normalize = req.query.normalize !== 'false'; // default true
        let sessionString = null;
        // Prefer primary multi-account session if available
        try {
            const primary = await accountManager_1.default.getPrimaryAccountSession();
            if (primary && primary.sessionString) {
                sessionString = primary.sessionString;
            }
        }
        catch (error) {
            console.warn('⚠️  Could not load primary account session for /telegram/:channel/recent:', error.message);
        }
        // Fallback to legacy env/session if needed
        if (!sessionString) {
            sessionString = process.env.TELEGRAM_SESSION_STRING || null;
        }
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }
        console.log('📱 Fetching messages from channel:', channel);
        // Use circuit breaker + retry logic
        const result = await telegramCircuitBreaker.execute(async () => {
            return await (0, retry_1.withRetry)(async () => {
                const client = await getTelegramClient(sessionString);
                await client.connect();
                // Get messages from channel
                const messages = await client.getMessages(channel, { limit });
                const formattedMessages = messages.map((msg) => ({
                    id: msg.id,
                    text: msg.message,
                    date: msg.date,
                    views: msg.views,
                    forwards: msg.forwards,
                    media: msg.media ? { type: msg.media.className } : undefined,
                    replyTo: msg.replyTo?.replyToMsgId,
                    edited: msg.editDate
                }));
                await client.disconnect();
                // Process messages with validation and normalization
                let processedMessages = formattedMessages;
                let validationSummary = null;
                let normalizedData = null;
                if (validate || normalize) {
                    const batchResults = (0, dataValidator_1.batchProcessMessages)(formattedMessages);
                    // Validation summary
                    const validCount = batchResults.filter(r => r.validation.valid).length;
                    const errorCount = batchResults.filter(r => !r.validation.valid).length;
                    const warningCount = batchResults.filter(r => r.validation.warnings.length > 0).length;
                    validationSummary = {
                        total: formattedMessages.length,
                        valid: validCount,
                        invalid: errorCount,
                        warnings: warningCount,
                        errors: batchResults
                            .filter(r => !r.validation.valid)
                            .map(r => ({
                            index: r.index,
                            message_id: formattedMessages[r.index].id,
                            errors: r.validation.errors
                        }))
                    };
                    // Add normalized data if requested
                    if (normalize) {
                        normalizedData = batchResults
                            .filter(r => r.validation.valid && r.normalized)
                            .map(r => ({
                            raw_message_id: formattedMessages[r.index].id,
                            normalized: (0, dataValidator_1.enrichMessage)(r.normalized),
                            content_hash: r.contentHash
                        }));
                    }
                    // Filter out invalid messages if validating
                    if (validate) {
                        processedMessages = formattedMessages.filter((_, index) => batchResults[index].validation.valid);
                    }
                }
                return {
                    channel,
                    messages: processedMessages,
                    count: processedMessages.length,
                    cached: false,
                    fetchedAt: new Date().toISOString(),
                    validation: validationSummary,
                    normalized: normalizedData
                };
            }, {
                maxRetries: 3,
                initialDelayMs: 1000,
                onRetry: (error, attempt) => {
                    console.warn(`🔄 Retry ${attempt}/3 for channel ${channel}: ${error.message}`);
                }
            });
        });
        res.json(result);
    }
    catch (error) {
        console.error('❌ Channel fetch error:', error);
        // Check if circuit breaker is open
        if (error.message?.includes('Circuit breaker is OPEN')) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'Too many failures. Please try again later.',
                circuitBreaker: telegramCircuitBreaker.getStats()
            });
        }
        res.status(500).json({
            error: 'Failed to fetch channel messages',
            message: error.message
        });
    }
});
// Validate message data
app.post('/api/telegram-collector/validate', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    try {
        const { message, batch } = req.body;
        if (batch && Array.isArray(batch)) {
            // Batch validation
            const results = (0, dataValidator_1.batchProcessMessages)(batch);
            const summary = {
                total: batch.length,
                valid: results.filter(r => r.validation.valid).length,
                invalid: results.filter(r => !r.validation.valid).length,
                warnings: results.filter(r => r.validation.warnings.length > 0).length
            };
            return res.json({
                summary,
                results: results.map(r => ({
                    index: r.index,
                    valid: r.validation.valid,
                    errors: r.validation.errors,
                    warnings: r.validation.warnings,
                    content_hash: r.contentHash,
                    normalized: r.normalized ? (0, dataValidator_1.enrichMessage)(r.normalized) : null
                }))
            });
        }
        else if (message) {
            // Single message validation
            const result = (0, dataValidator_1.processMessage)(message);
            return res.json({
                valid: result.validation.valid,
                errors: result.validation.errors,
                warnings: result.validation.warnings,
                content_hash: result.contentHash,
                normalized: result.normalized ? (0, dataValidator_1.enrichMessage)(result.normalized) : null
            });
        }
        else {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Please provide either "message" or "batch" in request body'
            });
        }
    }
    catch (error) {
        console.error('❌ Validation error:', error);
        res.status(500).json({
            error: 'Validation failed',
            message: error.message
        });
    }
});
// Get channels list
app.get('/api/telegram-collector/channels', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const sessionString = process.env.TELEGRAM_SESSION_STRING;
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }
        // Use circuit breaker + retry logic
        const result = await telegramCircuitBreaker.execute(async () => {
            return await (0, retry_1.withRetry)(async () => {
                const client = await getTelegramClient(sessionString);
                await client.connect();
                // Get all dialogs (channels, groups, chats)
                const dialogs = await client.getDialogs({ limit: 100 });
                const channels = dialogs
                    .filter((dialog) => dialog.isChannel)
                    .map((dialog) => ({
                    id: dialog.id,
                    title: dialog.title,
                    username: dialog.entity?.username
                }));
                await client.disconnect();
                return {
                    channels,
                    count: channels.length
                };
            }, {
                maxRetries: 3,
                initialDelayMs: 1000,
                onRetry: (error, attempt) => {
                    console.warn(`🔄 Retry ${attempt}/3 for channels list: ${error.message}`);
                }
            });
        });
        res.json(result);
    }
    catch (error) {
        console.error('❌ Channels list error:', error);
        if (error.message?.includes('Circuit breaker is OPEN')) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'Too many failures. Please try again later.',
                circuitBreaker: telegramCircuitBreaker.getStats()
            });
        }
        res.status(500).json({
            error: 'Failed to fetch channels',
            message: error.message
        });
    }
});
// Test channel (multi-account aware)
app.post('/api/telegram-collector/channels/:channelId/test', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const { channelId } = req.params;
        let sessionString = null;
        // Try to resolve account_id from telegram_channels (if registered)
        try {
            const pg = await Promise.resolve().then(() => __importStar(require('pg')));
            const pool = new pg.Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5433'),
                database: process.env.DB_NAME || 'titangold_db',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || ''
            });
            const channelRow = await pool.query(`
                SELECT account_id 
                FROM telegram_channels 
                WHERE username = $1 OR channel_id::text = $1
                LIMIT 1
            `, [channelId]);
            await pool.end();
            if (channelRow.rows.length > 0 && channelRow.rows[0].account_id) {
                try {
                    const accountSession = await accountManager_1.default.getDecryptedSessionForAccount(channelRow.rows[0].account_id);
                    sessionString = accountSession.sessionString;
                }
                catch (error) {
                    console.warn(`⚠️  Could not load session for channel account ${channelRow.rows[0].account_id}:`, error.message);
                }
            }
        }
        catch (lookupError) {
            console.warn('⚠️  Failed to lookup channel account for test:', lookupError.message);
        }
        // Fallback to primary account if no specific account session
        if (!sessionString) {
            try {
                const primary = await accountManager_1.default.getPrimaryAccountSession();
                if (primary && primary.sessionString) {
                    sessionString = primary.sessionString;
                }
            }
            catch (error) {
                console.warn('⚠️  Could not load primary account session for channel test:', error.message);
            }
        }
        // Final fallback to legacy env session
        if (!sessionString) {
            sessionString = process.env.TELEGRAM_SESSION_STRING || null;
        }
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }
        const startTime = Date.now();
        // Use circuit breaker + retry logic
        const result = await telegramCircuitBreaker.execute(async () => {
            return await (0, retry_1.withRetry)(async () => {
                const client = await getTelegramClient(sessionString);
                await client.connect();
                // Try to get one message to test access
                const messages = await client.getMessages(channelId, { limit: 1 });
                const latency = Date.now() - startTime;
                await client.disconnect();
                return {
                    success: true,
                    channelId,
                    channelHandle: `@${channelId}`,
                    latency,
                    messages: messages.length,
                    accessible: messages.length > 0
                };
            }, {
                maxRetries: 2,
                initialDelayMs: 500,
                onRetry: (error, attempt) => {
                    console.warn(`🔄 Retry ${attempt}/2 for channel test ${channelId}: ${error.message}`);
                }
            });
        });
        // Record channel fetch metrics
        metricsCollector_1.default.recordChannelFetch(channelId, `@${channelId}`, result.success, result.latency || 0);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Channel test error:', error);
        // Record failed channel fetch
        metricsCollector_1.default.recordChannelFetch(req.params.channelId, `@${req.params.channelId}`, false, 0, error.message);
        if (error.message?.includes('Circuit breaker is OPEN')) {
            metricsCollector_1.default.recordCircuitBreakerOpen();
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'Too many failures. Please try again later.',
                circuitBreaker: telegramCircuitBreaker.getStats()
            });
        }
        res.status(500).json({
            error: 'Failed to test channel',
            message: error.message
        });
    }
});
/**
 * GET /api/telegram-collector/channels/:channelId/messages
 * Fetch recent messages from a channel (for View Messages in UI)
 */
app.get('/api/telegram-collector/channels/:channelId/messages', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const { channelId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        let sessionString = null;
        try {
            const primary = await accountManager_1.default.getPrimaryAccountSession();
            if (primary && primary.sessionString) {
                sessionString = primary.sessionString;
            }
        }
        catch (e) {
            // ignore
        }
        if (!sessionString) {
            sessionString = process.env.TELEGRAM_SESSION_STRING || null;
        }
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }
        const client = await getTelegramClient(sessionString);
        await client.connect();
        const messages = await client.getMessages(channelId, { limit });
        await client.disconnect();
        const formattedMessages = messages.map((msg) => ({
            id: msg.id,
            text: msg.message,
            date: msg.date,
            views: msg.views,
            forwards: msg.forwards,
            media: msg.media ? { type: msg.media.className } : undefined,
            replyTo: msg.replyTo?.replyToMsgId,
            edited: msg.editDate
        }));
        res.json({
            success: true,
            messages: formattedMessages,
            count: formattedMessages.length
        });
    }
    catch (error) {
        console.error('❌ Channel messages error:', error);
        res.status(500).json({
            error: 'Failed to fetch channel messages',
            message: error.message
        });
    }
});
/**
 * POST /api/telegram-collector/channels/:id/force-sync
 * Force immediate sync of a specific channel (on-demand polling)
 */
app.post('/api/telegram-collector/channels/:id/force-sync', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const channelId = req.params.id;
        const pg = await Promise.resolve().then(() => __importStar(require('pg')));
        const pool = new pg.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5433'),
            database: process.env.DB_NAME || 'titangold_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        });
        
        // Fetch channel from database
        const channelRow = await pool.query(`
            SELECT id, channel_id, username, title, account_id, is_active, priority
            FROM telegram_channels
            WHERE id::text = $1 OR channel_id::text = $1 OR username = $1
            LIMIT 1
        `, [channelId]);
        
        if (channelRow.rows.length === 0) {
            await pool.end();
            return res.status(404).json({
                error: 'Channel not found',
                message: `Channel with ID ${channelId} not found in database`
            });
        }
        
        const channel = channelRow.rows[0];
        
        // Get session for this channel's account or primary account
        let sessionString = null;
        if (channel.account_id) {
            try {
                const accountSession = await accountManager_1.default.getDecryptedSessionForAccount(channel.account_id);
                sessionString = accountSession.sessionString;
            } catch (error) {
                console.warn(`⚠️  Could not load session for channel account ${channel.account_id}:`, error.message);
            }
        }
        
        // Fallback to primary account
        if (!sessionString) {
            try {
                const primary = await accountManager_1.default.getPrimaryAccountSession();
                if (primary && primary.sessionString) {
                    sessionString = primary.sessionString;
                }
            } catch (error) {
                console.warn('⚠️  Could not load primary account session for force-sync:', error.message);
            }
        }
        
        // Final fallback to legacy env session
        if (!sessionString) {
            sessionString = process.env.TELEGRAM_SESSION_STRING || null;
        }
        
        if (!sessionString) {
            await pool.end();
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }
        
        // Perform force sync
        const startTime = Date.now();
        const client = await getTelegramClient(sessionString);
        await client.connect();
        
        // Fetch recent messages (last 10)
        const channelIdentifier = channel.username || channel.channel_id;
        const messages = await client.getMessages(channelIdentifier, { limit: 10 });
        
        await client.disconnect();
        
        const latency = Date.now() - startTime;
        
        // Save messages to database
        let savedCount = 0;
        const { recordChannelSuccess } = require('./utils/errorTracking');
        
        for (const msg of messages) {
            try {
                await pool.query(`
                    INSERT INTO telegram_messages (
                        channel_id, message_id, telegram_channel_id, message_text,
                        telegram_created_at, has_media, raw_data
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (channel_id, message_id) DO NOTHING
                `, [
                    channel.channel_id,
                    msg.id,
                    channel.channel_id,
                    msg.message || '',
                    msg.date ? new Date(msg.date * 1000) : null,
                    !!msg.media,
                    JSON.stringify({
                        views: msg.views,
                        forwards: msg.forwards,
                        replyTo: msg.replyTo?.replyToMsgId,
                        edited: msg.editDate
                    })
                ]);
                savedCount++;
            } catch (insertError) {
                console.warn(`⚠️  Failed to insert message ${msg.id}:`, insertError.message);
            }
        }
        
        // Update channel sync time and reset errors
        await recordChannelSuccess(channel.id);
        await pool.query(`
            UPDATE telegram_channels
            SET last_synced_at = NOW()
            WHERE id = $1
        `, [channel.id]);
        
        await pool.end();
        
        console.log(`✅ Force-sync completed for channel ${channel.title || channel.username} (${channelId}): ${savedCount} messages saved, ${latency}ms`);
        
        res.json({
            success: true,
            channel: {
                id: channel.id,
                username: channel.username,
                title: channel.title,
                priority: channel.priority
            },
            messagesFetched: messages.length,
            messagesSaved: savedCount,
            latency,
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Force-sync error:', error);
        
        // Record error in database
        try {
            const { recordChannelError } = require('./utils/errorTracking');
            await recordChannelError(req.params.id, error);
        } catch (trackingError) {
            console.warn('⚠️  Failed to record force-sync error:', trackingError.message);
        }
        
        res.status(500).json({
            error: 'Force-sync failed',
            message: error.message
        });
    }
});
/**
 * POST /api/telegram-collector/channels/refresh
 * Refresh channels list from Telegram (optional sync). Returns success for UI.
 */
app.post('/api/telegram-collector/channels/refresh', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        res.json({ success: true, message: 'Channels refresh requested' });
    }
    catch (error) {
        console.error('❌ Channels refresh error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================================
// CHANNEL MANAGEMENT ENDPOINTS
// ============================================================================
/**
 * POST /api/telegram-collector/channels/register
 * Register a channel in database for polling
 */
app.post('/api/telegram-collector/channels/register', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const { channel_id, username, title, description, category, config } = req.body;
        if (!channel_id) {
            return res.status(400).json({
                error: 'channel_id is required'
            });
        }
        const pool = new (await Promise.resolve().then(() => __importStar(require('pg')))).Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5433'),
            database: process.env.DB_NAME || 'titangold_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        });
        // Check if channel already exists
        const existing = await pool.query('SELECT id FROM telegram_channels WHERE channel_id = $1', [channel_id.toString()]);
        if (existing.rows.length > 0) {
            // Update existing channel
            await pool.query(`UPDATE telegram_channels 
                 SET username = COALESCE($1, username),
                     title = COALESCE($2, title),
                     description = COALESCE($3, description),
                     category = COALESCE($4, category),
                     config = COALESCE($5, config),
                     is_active = true,
                     updated_at = NOW()
                 WHERE channel_id = $6
                 RETURNING id`, [username, title, description, category, config ? JSON.stringify(config) : null, channel_id.toString()]);
            return res.json({
                success: true,
                message: 'Channel updated',
                channel_id: existing.rows[0].id
            });
        }
        // Insert new channel
        const result = await pool.query(`INSERT INTO telegram_channels (channel_id, username, title, description, category, config, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             RETURNING id`, [
            channel_id.toString(),
            username || null,
            title || `Channel ${channel_id}`,
            description || null,
            category || null,
            config ? JSON.stringify(config) : null
        ]);
        res.json({
            success: true,
            message: 'Channel registered',
            channel_id: result.rows[0].id
        });
    }
    catch (error) {
        console.error('❌ Error registering channel:', error);
        res.status(500).json({
            error: 'Failed to register channel',
            message: error.message
        });
    }
});
/**
 * GET /api/telegram-collector/collector-channels
 * List registered telegram_channels with optional filters
 * Query params:
 *   - account_id (optional)
 *   - status = enabled | disabled (optional, maps to is_active)
 */
app.get('/api/telegram-collector/collector-channels', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const { account_id, status } = req.query;
        const pg = await Promise.resolve().then(() => __importStar(require('pg')));
        const pool = new pg.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5433'),
            database: process.env.DB_NAME || 'titangold_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        });
        const conditions = [];
        const params = [];
        let idx = 1;
        if (account_id) {
            if (account_id === 'unassigned') {
                conditions.push('account_id IS NULL');
            }
            else {
                conditions.push(`account_id = $${idx++}`);
                params.push(account_id);
            }
        }
        if (status === 'enabled') {
            conditions.push('is_active = TRUE');
        }
        else if (status === 'disabled') {
            conditions.push('is_active = FALSE');
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const query = `
            SELECT 
                id, channel_id, username, title, description, category, 
                is_active, account_id, last_synced_at, config,
                priority, error_count, last_error, last_error_at, consecutive_success_count
            FROM telegram_channels
            ${whereClause}
            ORDER BY priority DESC, title ASC NULLS LAST, channel_id::text ASC
        `;
        const result = await pool.query(query, params);
        await pool.end();
        const channels = result.rows.map(row => ({
            id: row.id,
            channelId: row.channel_id?.toString?.() ?? String(row.channel_id),
            username: row.username,
            title: row.title,
            description: row.description,
            category: row.category,
            isActive: row.is_active,
            accountId: row.account_id,
            lastSyncedAt: row.last_synced_at,
            config: row.config || {},
            // Phase 2: Priority and Error Tracking
            priority: row.priority || 'normal',
            errorCount: row.error_count || 0,
            lastError: row.last_error || null,
            lastErrorAt: row.last_error_at || null,
            consecutiveSuccessCount: row.consecutive_success_count || 0
        }));
        res.json({
            success: true,
            count: channels.length,
            channels
        });
    }
    catch (error) {
        console.error('❌ Error fetching collector channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch collector channels',
            message: error.message
        });
    }
});
/**
 * PATCH /api/telegram-collector/collector-channels/:id
 * Update per-channel settings (is_active, account_id)
 */
app.patch('/api/telegram-collector/collector-channels/:id', rateLimitHybrid_1.rateLimiters.moderate, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active, account_id, priority } = req.body || {};
        const pg = await Promise.resolve().then(() => __importStar(require('pg')));
        const pool = new pg.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5433'),
            database: process.env.DB_NAME || 'titangold_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        });
        const fields = [];
        const params = [];
        let idx = 1;
        if (typeof is_active === 'boolean') {
            fields.push(`is_active = $${idx++}`);
            params.push(is_active);
        }
        if (account_id !== undefined) {
            if (account_id === null) {
                fields.push(`account_id = NULL`);
            }
            else {
                fields.push(`account_id = $${idx++}`);
                params.push(account_id);
            }
        }
        if (priority !== undefined && ['high', 'normal', 'low'].includes(priority)) {
            fields.push(`priority = $${idx++}`);
            params.push(priority);
        }
        if (fields.length === 0) {
            await pool.end();
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }
        fields.push(`updated_at = NOW()`);
        params.push(id);
        const updateQuery = `
            UPDATE telegram_channels
            SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING id, channel_id, username, title, description, category, is_active, account_id, last_synced_at, config, priority, error_count, last_error, last_error_at, consecutive_success_count
        `;
        const result = await pool.query(updateQuery, params);
        await pool.end();
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Channel not found'
            });
        }
        const row = result.rows[0];
        const channel = {
            id: row.id,
            channelId: row.channel_id?.toString?.() ?? String(row.channel_id),
            username: row.username,
            title: row.title,
            description: row.description,
            category: row.category,
            isActive: row.is_active,
            accountId: row.account_id,
            lastSyncedAt: row.last_synced_at,
            config: row.config || {},
            priority: row.priority || 'normal',
            errorCount: row.error_count || 0,
            lastError: row.last_error,
            lastErrorAt: row.last_error_at,
            consecutiveSuccessCount: row.consecutive_success_count || 0
        };
        res.json({
            success: true,
            channel
        });
    }
    catch (error) {
        console.error('❌ Error updating collector channel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update collector channel',
            message: error.message
        });
    }
});
// ============================================================================
// CHANNEL POLLING SERVICE ENDPOINTS
// ============================================================================
/**
 * GET /api/telegram-collector/polling/status
 * Get polling service status
 */
app.get('/api/telegram-collector/polling/status', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    try {
        const status = channelPollingService_1.default.getStatus();
        res.json({
            success: true,
            polling: status
        });
    }
    catch (error) {
        console.error('❌ Error getting polling status:', error);
        res.status(500).json({
            error: 'Failed to get polling status',
            message: error.message
        });
    }
});
/**
 * POST or GET /api/telegram-collector/polling/trigger
 * Manually trigger a polling cycle (GET allowed so browser/link works)
 */
const handlePollingTrigger = async (req, res) => {
    try {
        console.log('🔄 Manual polling cycle triggered via API');
        await channelPollingService_1.default.runPollingCycle();
        res.json({
            success: true,
            message: 'Polling cycle completed'
        });
    }
    catch (error) {
        console.error('❌ Error during manual polling:', error);
        res.status(500).json({
            error: 'Failed to run polling cycle',
            message: error.message
        });
    }
};
app.get('/api/telegram-collector/polling/trigger', rateLimitHybrid_1.rateLimiters.strict, handlePollingTrigger);
app.post('/api/telegram-collector/polling/trigger', rateLimitHybrid_1.rateLimiters.strict, handlePollingTrigger);
/**
 * POST /api/telegram-collector/polling/start
 * Start polling service
 */
app.post('/api/telegram-collector/polling/start', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        channelPollingService_1.default.start();
        res.json({
            success: true,
            message: 'Polling service started'
        });
    }
    catch (error) {
        console.error('❌ Error starting polling service:', error);
        res.status(500).json({
            error: 'Failed to start polling service',
            message: error.message
        });
    }
});
/**
 * POST /api/telegram-collector/polling/stop
 * Stop polling service
 */
app.post('/api/telegram-collector/polling/stop', rateLimitHybrid_1.rateLimiters.strict, async (req, res) => {
    try {
        channelPollingService_1.default.stop();
        res.json({
            success: true,
            message: 'Polling service stopped'
        });
    }
    catch (error) {
        console.error('❌ Error stopping polling service:', error);
        res.status(500).json({
            error: 'Failed to stop polling service',
            message: error.message
        });
    }
});
/**
 * GET /api/telegram-collector/metrics
 * Get observability metrics
 */
app.get('/api/telegram-collector/metrics', rateLimitHybrid_1.rateLimiters.lenient, async (req, res) => {
    try {
        const metrics = metricsCollector_1.default.getMetrics();
        const circuitBreakerStats = telegramCircuitBreaker.getStats();
        const rateLimitStats = (0, rateLimitHybrid_1.getRateLimiterStats)();
        res.json({
            success: true,
            metrics: {
                ...metrics,
                circuitBreaker: circuitBreakerStats,
                rateLimit: rateLimitStats
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Error getting metrics:', error);
        res.status(500).json({
            error: 'Failed to get metrics',
            message: error.message
        });
    }
});

function startServer() {
    app.listen(PORT, async () => {
        console.log(`🚀 Telegram Collector Service running on port ${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/health`);
        console.log(`\n✅ MTProto integration enabled with GramJS`);
        console.log(`✅ Real Telegram authentication is now working`);
        if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
            console.log(`✅ API Credentials configured`);
        }
        else {
            console.log(`⚠️  Warning: API Credentials not configured`);
        }
        if (process.env.TELEGRAM_SESSION_STRING) {
            console.log(`✅ Session found - Ready to collect data`);
        }
        else {
            console.log(`⏳ No session found - Login required`);
        }
        try {
            console.log('\n🔄 Initializing Session Rotation Service...');
            await sessionRotationService_1.default.initialize();
        }
        catch (error) {
            console.error('❌ Failed to initialize Session Rotation Service:', error.message);
        }
        try {
            console.log('\n📡 Starting Channel Polling Service...');
            channelPollingService_1.default.start();
        }
        catch (error) {
            console.error('❌ Failed to start Channel Polling Service:', error.message);
        }
        process.on('SIGTERM', async () => {
            console.log('\n🛑 SIGTERM received, shutting down gracefully...');
            await (0, rateLimitRedis_1.closeRedisRateLimitStore)();
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            console.log('\n🛑 SIGINT received, shutting down gracefully...');
            await (0, rateLimitRedis_1.closeRedisRateLimitStore)();
            process.exit(0);
        });
    });
}

module.exports = { app, startServer };
exports.default = app;
