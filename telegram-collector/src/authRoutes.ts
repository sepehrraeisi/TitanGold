import express from 'express';
import { TelegramClient, errors, Api } from 'gramjs';
import { StringSession } from 'gramjs/sessions/index.js';
import { v4 as uuidv4 } from 'uuid';
import { config, getSessionFilePath, persistSessionString } from './config.ts';
import { logger } from './logger.ts';
import { TelegramCollector } from './telegramCollector.ts';

type PendingLogin = {
    client: TelegramClient;
    phoneNumber: string;
    phoneCodeHash: string;
};

const pendingLogins = new Map<string, PendingLogin>();

const createAuthRoutes = (collector: TelegramCollector) => {
    const router = express.Router();
    const sessionFilePath = getSessionFilePath();

    const cleanup = async (authId: string) => {
        const pending = pendingLogins.get(authId);
        if (pending) {
            try {
                await pending.client.disconnect();
            } catch (error) {
                logger.warn('[Auth] Failed to disconnect pending Telegram client', { error });
            }
            pendingLogins.delete(authId);
        }
    };

    router.post('/login/start', async (req, res) => {
        const { apiId = config.telegram.apiId, apiHash = config.telegram.apiHash, phoneNumber } = req.body || {};

        if (!apiId || !apiHash || !phoneNumber) {
            return res.status(400).json({
                ok: false,
                error: 'apiId, apiHash و phoneNumber الزامی هستند.',
            });
        }

        const client = new TelegramClient(new StringSession(''), Number(apiId), apiHash, {
            connectionRetries: 5,
        });

        try {
            await client.connect();
            const result = await client.invoke(
                new Api.auth.SendCode({
                    phoneNumber,
                    apiId: Number(apiId),
                    apiHash,
                    settings: new Api.CodeSettings({}),
                }),
            );

            const authId = uuidv4();
            pendingLogins.set(authId, {
                client,
                phoneNumber,
                phoneCodeHash: result.phoneCodeHash,
            });

            logger.info('[Auth] Telegram login started', { phoneNumber, authId });

            return res.json({
                ok: true,
                authId,
                isCodeViaApp: result.type?.className === 'auth.SentCodeTypeApp',
                timeout: result.timeout,
            });
        } catch (error) {
            await client.disconnect();
            logger.error('[Auth] Failed to start Telegram login', {
                error: error instanceof Error ? error.message : String(error),
            });
            return res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : 'خطا در شروع لاگین تلگرام',
            });
        }
    });

    router.post('/login/confirm', async (req, res) => {
        const { authId, code, password } = req.body || {};

        if (!authId || !code) {
            return res.status(400).json({
                ok: false,
                error: 'authId و code الزامی هستند.',
            });
        }

        const pending = pendingLogins.get(authId);
        if (!pending) {
            return res.status(400).json({
                ok: false,
                error: 'authId معتبر نیست یا منقضی شده است.',
            });
        }

        try {
            await pending.client.signIn({
                phoneNumber: pending.phoneNumber,
                phoneCodeHash: pending.phoneCodeHash,
                phoneCode: code,
            });
        } catch (error) {
            if (error instanceof errors.SessionPasswordNeededError || (error as any)?.errorMessage === 'SESSION_PASSWORD_NEEDED') {
                if (!password) {
                    return res.status(401).json({
                        ok: false,
                        error: 'رمز دوم مورد نیاز است.',
                        code: 'SESSION_PASSWORD_NEEDED',
                    });
                }
                try {
                    await pending.client.checkPassword(password);
                } catch (passwordError) {
                    await cleanup(authId);
                    logger.error('[Auth] Incorrect 2FA password', { error: passwordError });
                    return res.status(401).json({
                        ok: false,
                        error: 'رمز دوم اشتباه است.',
                    });
                }
            } else {
                await cleanup(authId);
                logger.error('[Auth] Code confirmation failed', { error });
                return res.status(500).json({
                    ok: false,
                    error: error instanceof Error ? error.message : 'خطا در تایید کد',
                });
            }
        }

        const sessionString = pending.client.session.save();
        try {
            persistSessionString(sessionString);
            await collector.setSessionString(sessionString);
        } catch (persistError) {
            await cleanup(authId);
            logger.error('[Auth] Failed to persist Telegram session', { error: persistError });
            return res.status(500).json({
                ok: false,
                error: 'ذخیره session تلگرام انجام نشد.',
            });
        }

        await cleanup(authId);

        return res.json({
            ok: true,
            sessionStoredAt: sessionFilePath,
        });
    });

    router.post('/login/cancel', async (req, res) => {
        const { authId } = req.body || {};
        if (!authId) {
            return res.status(400).json({
                ok: false,
                error: 'authId الزامی است.',
            });
        }
        await cleanup(authId);
        return res.json({ ok: true });
    });

    return router;
};

export default createAuthRoutes;

