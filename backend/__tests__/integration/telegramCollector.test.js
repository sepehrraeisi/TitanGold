/**
 * Telegram Collector + Data Hub integration tests (TASK-TC-015)
 * Tests backend endpoints: telegram-sync, telegram-transfer-messages, telegram-account-metrics.
 * Full UI E2E scenarios are in TELEGRAM_E2E_TEST_PLAN.md.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.unstable_mockModule('node-fetch', () => ({
    default: jest.fn()
}));

describe('Telegram Collector / Data Hub Integration', () => {
    let app;
    let query;
    let pool;
    let getRedisClient;
    let testUserId;
    let validToken;

    beforeAll(async () => {
        const serverModule = await import('../../server.js');
        app = serverModule.default;

        const dbModule = await import('../../database/db.js');
        query = dbModule.query;
        pool = dbModule.default;

        const redisModule = await import('../../utils/redis.js');
        getRedisClient = redisModule.getRedisClient;

        try {
            const userResult = await query(
                `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                 RETURNING id`,
                ['test-telegram@titangold.com', 'test_telegram', 'hash', 'Test Telegram User', 'admin', true]
            );
            testUserId = userResult.rows[0].id;

            validToken = jwt.sign(
                { userId: testUserId, email: 'test-telegram@titangold.com', role: 'admin' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            await query(
                `INSERT INTO user_sessions (user_id, token, expires_at, last_activity_at)
                 VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())
                 ON CONFLICT (token) DO UPDATE SET token = EXCLUDED.token`,
                [testUserId, validToken]
            );
        } catch (error) {
            console.error('Setup error:', error);
        }
    }, 30000);

    afterAll(async () => {
        try {
            if (testUserId) {
                await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
            }
            const redis = await getRedisClient();
            if (redis && redis.isOpen) await redis.quit();
            await pool.end();
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }, 10000);

    describe('POST /api/v1/data-sources/telegram-sync', () => {
        test('should return 200 and sync summary with auth', async () => {
            const response = await request(app)
                .post('/api/v1/data-sources/telegram-sync')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Content-Type', 'application/json')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('totalChannels');
            expect(response.body).toHaveProperty('processed');
        });

        test('should return 401 without auth', async () => {
            const response = await request(app)
                .post('/api/v1/data-sources/telegram-sync')
                .set('Content-Type', 'application/json')
                .send({});

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/v1/data-sources/telegram-transfer-messages', () => {
        test('should return 200 and transfer summary with auth', async () => {
            const response = await request(app)
                .post('/api/v1/data-sources/telegram-transfer-messages')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Content-Type', 'application/json')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('totalMessages');
            expect(response.body).toHaveProperty('transferred');
        });

        test('should accept optional batchSize and return 200', async () => {
            const response = await request(app)
                .post('/api/v1/data-sources/telegram-transfer-messages')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Content-Type', 'application/json')
                .send({ batchSize: 10 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should return 401 without auth', async () => {
            const response = await request(app)
                .post('/api/v1/data-sources/telegram-transfer-messages')
                .set('Content-Type', 'application/json')
                .send({});

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/v1/data-sources/telegram-account-metrics', () => {
        test('should return 200 and metrics object with auth', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/telegram-account-metrics')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('metrics');
            expect(typeof response.body.metrics).toBe('object');
        });

        test('should return 401 without auth', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/telegram-account-metrics');

            expect(response.status).toBe(401);
        });
    });
});
