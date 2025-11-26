import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const num = (value: string | undefined, fallback: number) => {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const sessionFilePath = process.env.TELEGRAM_SESSION_FILE || path.join(process.cwd(), 'telegram-session.txt');

const readSessionFromFile = () => {
    try {
        if (fs.existsSync(sessionFilePath)) {
            return fs.readFileSync(sessionFilePath, 'utf-8').trim();
        }
    } catch (error) {
        console.warn('[Collector] Failed to read telegram session file:', error);
    }
    return '';
};

const resolvedSessionString = process.env.TELEGRAM_SESSION_STRING || readSessionFromFile();

export const config = {
    port: num(process.env.PORT, 4100),
    cacheTtlMs: num(process.env.CACHE_TTL_MS, 30_000),
    maxMessagesPerChannel: num(process.env.MAX_MESSAGES_PER_CHANNEL, 200),
    telegram: {
        apiId: num(process.env.TELEGRAM_API_ID, 0),
        apiHash: process.env.TELEGRAM_API_HASH || '',
        sessionString: resolvedSessionString,
        phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
        password: process.env.TELEGRAM_PASSWORD,
    },
};

export const getSessionFilePath = () => sessionFilePath;

export const persistSessionString = (sessionString: string) => {
    fs.writeFileSync(sessionFilePath, sessionString, 'utf-8');
    config.telegram.sessionString = sessionString;
    console.log('[Collector] Telegram session string saved to', sessionFilePath);
};

export const validateConfig = () => {
    if (!config.telegram.apiId || !config.telegram.apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required.');
    }
    if (!config.telegram.sessionString) {
        console.warn('[Collector] TELEGRAM_SESSION_STRING not found. Use the login flow to generate one.');
    }
};

