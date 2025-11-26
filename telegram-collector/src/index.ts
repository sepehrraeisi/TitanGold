import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.ts';
import { logger } from './logger.ts';
import { TelegramCollector } from './telegramCollector.ts';
import { channelCache } from './cache.ts';
import createAuthRoutes from './authRoutes.ts';

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

const collector = new TelegramCollector();
const startedAt = Date.now();

app.get('/health', async (_req, res) => {
    res.json({
        status: 'ok',
        uptime: Date.now() - startedAt,
        cache: channelCache.stats(),
    });
});

app.use('/api/telegram-collector', createAuthRoutes(collector));

app.get('/telegram/:channel/recent', async (req, res) => {
    const { channel } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    try {
        const result = await collector.getRecentMessages(channel, limit);
        res.json({
            channel: result.channel,
            limit,
            source: result.source,
            fetchedAt: new Date().toISOString(),
            messages: result.messages,
        });
    } catch (error) {
        logger.error('[HTTP] Failed to fetch Telegram messages', {
            channel,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
            channel,
        });
    }
});

app.listen(config.port, () => {
    logger.info('[HTTP] Telegram collector listening', { port: config.port });
});

