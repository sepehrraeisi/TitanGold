import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import input from 'input';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Store active auth sessions
const authSessions = new Map<string, { client: TelegramClient; phoneCodeHash: string }>();

// Helper to get or create Telegram client
async function getTelegramClient(sessionString?: string): Promise<TelegramClient> {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
    const apiHash = process.env.TELEGRAM_API_HASH || '';

    if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured');
    }

    const session = new StringSession(sessionString || '');
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    });

    return client;
}

// Health check endpoints (both paths for compatibility)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'telegram-collector',
        version: '0.2.0',
        timestamp: new Date().toISOString(),
        configured: {
            apiId: !!process.env.TELEGRAM_API_ID,
            apiHash: !!process.env.TELEGRAM_API_HASH,
            session: !!process.env.TELEGRAM_SESSION_STRING
        },
        mtproto: 'enabled'
    });
});

app.get('/api/telegram-collector/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'telegram-collector',
        version: '0.2.0',
        timestamp: new Date().toISOString(),
        configured: {
            apiId: !!process.env.TELEGRAM_API_ID,
            apiHash: !!process.env.TELEGRAM_API_HASH,
            session: !!process.env.TELEGRAM_SESSION_STRING
        },
        mtproto: 'enabled'
    });
});

// Start login flow - send verification code
app.post('/api/telegram-collector/login/start', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ 
                error: 'Phone number is required',
                message: 'Please provide a valid phone number'
            });
        }

        console.log('🚀 Starting real Telegram login for:', phoneNumber);

        // Create new client
        const client = await getTelegramClient();
        await client.connect();

        // Send code
        const result = await client.sendCode({
            apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
            apiHash: process.env.TELEGRAM_API_HASH || ''
        }, phoneNumber);

        const authId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store session for confirmation
        authSessions.set(authId, {
            client,
            phoneCodeHash: result.phoneCodeHash
        });

        console.log('✅ Verification code sent to:', phoneNumber);

        res.json({
            success: true,
            authId,
            message: 'Verification code sent successfully',
            phoneNumber,
            phoneCodeHash: result.phoneCodeHash
        });

    } catch (error: any) {
        console.error('❌ Login start error:', error);
        res.status(500).json({ 
            error: 'Failed to start login',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Confirm login - verify code
app.post('/api/telegram-collector/login/confirm', async (req, res) => {
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

        const { client, phoneCodeHash } = authSession;
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER || '';

        // Sign in with code
        await client.start({
            phoneNumber,
            password: async () => password || '',
            phoneCode: async () => code,
            onError: (err) => console.error('Sign in error:', err)
        });

        // Get session string
        const sessionString = client.session.save() as unknown as string;

        // Clean up auth session
        authSessions.delete(authId);

        console.log('✅ Login confirmed successfully');

        res.json({
            success: true,
            message: 'Login confirmed successfully',
            session: sessionString
        });

    } catch (error: any) {
        console.error('❌ Login confirm error:', error);
        res.status(500).json({ 
            error: 'Failed to confirm login',
            message: error.message || 'Unknown error occurred'
        });
    }
});

// Cancel login
app.post('/api/telegram-collector/login/cancel', async (req, res) => {
    try {
        const { authId } = req.body;

        if (authId && authSessions.has(authId)) {
            const { client } = authSessions.get(authId)!;
            await client.disconnect();
            authSessions.delete(authId);
        }

        res.json({
            success: true,
            message: 'Login cancelled'
        });
    } catch (error: any) {
        console.error('❌ Login cancel error:', error);
        res.status(500).json({ 
            error: 'Failed to cancel login',
            message: error.message 
        });
    }
});

// Get channel messages
app.get('/telegram/:channel/recent', async (req, res) => {
    try {
        const { channel } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        const sessionString = process.env.TELEGRAM_SESSION_STRING;
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }

        console.log('📱 Fetching messages from channel:', channel);

        const client = await getTelegramClient(sessionString);
        await client.connect();

        // Get messages from channel
        const messages = await client.getMessages(channel, { limit });

        const formattedMessages = messages.map((msg: any) => ({
            id: msg.id,
            text: msg.message,
            date: msg.date,
            views: msg.views,
            forwards: msg.forwards
        }));

        await client.disconnect();

        res.json({
            channel,
            messages: formattedMessages,
            count: formattedMessages.length,
            cached: false,
            fetchedAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('❌ Channel fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch channel messages',
            message: error.message 
        });
    }
});

// Get channels list
app.get('/api/telegram-collector/channels', async (req, res) => {
    try {
        const sessionString = process.env.TELEGRAM_SESSION_STRING;
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }

        const client = await getTelegramClient(sessionString);
        await client.connect();

        // Get all dialogs (channels, groups, chats)
        const dialogs = await client.getDialogs({ limit: 100 });
        
        const channels = dialogs
            .filter((dialog: any) => dialog.isChannel)
            .map((dialog: any) => ({
                id: dialog.id,
                title: dialog.title,
                username: dialog.entity?.username
            }));

        await client.disconnect();

        res.json({
            channels,
            count: channels.length
        });
    } catch (error: any) {
        console.error('❌ Channels list error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch channels',
            message: error.message 
        });
    }
});

// Test channel
app.post('/api/telegram-collector/channels/:channelId/test', async (req, res) => {
    try {
        const { channelId } = req.params;

        const sessionString = process.env.TELEGRAM_SESSION_STRING;
        if (!sessionString) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please complete the login process first'
            });
        }

        const startTime = Date.now();
        const client = await getTelegramClient(sessionString);
        await client.connect();

        // Try to get one message to test access
        const messages = await client.getMessages(channelId, { limit: 1 });
        const latency = Date.now() - startTime;

        await client.disconnect();

        res.json({
            success: true,
            channelId,
            channelHandle: `@${channelId}`,
            latency,
            messages: messages.length,
            accessible: messages.length > 0
        });

    } catch (error: any) {
        console.error('❌ Channel test error:', error);
        res.status(500).json({ 
            error: 'Failed to test channel',
            message: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Telegram Collector Service running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`\n✅ MTProto integration enabled with GramJS`);
    console.log(`✅ Real Telegram authentication is now working`);
    
    if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
        console.log(`✅ API Credentials configured`);
    } else {
        console.log(`⚠️  Warning: API Credentials not configured`);
    }
    
    if (process.env.TELEGRAM_SESSION_STRING) {
        console.log(`✅ Session found - Ready to collect data`);
    } else {
        console.log(`⏳ No session found - Login required`);
    }
});

export default app;
