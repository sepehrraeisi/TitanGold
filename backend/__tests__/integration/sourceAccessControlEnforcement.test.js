/**
 * DH-ACCESSCONTROL-P2 — integration tests for server-side ACL enforcement.
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('DH-ACCESSCONTROL-P2 enforcement', () => {
    let app;
    let query;
    let pool;
    let getRedisClient;
    let evaluateSourceAccess;
    let datahubAutomationService;
    let telegramPublisherService;

    let testUserId;
    let validToken;
    let createdSourceId;
    let collectedId;

    beforeAll(async () => {
        const serverModule = await import('../../server.js');
        app = serverModule.default;

        const dbModule = await import('../../database/db.js');
        query = dbModule.query;
        pool = dbModule.default;

        const redisModule = await import('../../utils/redis.js');
        getRedisClient = redisModule.getRedisClient;

        const aclModule = await import('../../services/sourceAccessControlService.js');
        evaluateSourceAccess = aclModule.evaluateSourceAccess;

        datahubAutomationService = await import('../../services/datahubAutomationService.js');
        telegramPublisherService = await import('../../services/telegramPublisherService.js');

        const userResult = await query(
            `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
             RETURNING id`,
            ['test-acl-p2@titangold.com', 'test_acl_p2', 'hashed_password', 'Test ACL P2', 'admin', true],
        );
        testUserId = userResult.rows[0].id;

        validToken = jwt.sign(
            { userId: testUserId, email: 'test-acl-p2@titangold.com', role: 'admin' },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' },
        );

        await query(
            `INSERT INTO user_sessions (user_id, token, expires_at, last_activity_at)
             VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())
             ON CONFLICT (token) DO UPDATE SET token = EXCLUDED.token`,
            [testUserId, validToken],
        );

        const sourceResult = await query(
            `INSERT INTO data_sources (name, type, category, config, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING id`,
            ['Test ACL P2 Source', 'api', 'market_data', JSON.stringify({})],
        );
        createdSourceId = sourceResult.rows[0].id;

        const cd = await query(
            `INSERT INTO collected_data (source_id, raw_data, normalized_data, status, collected_at, metadata)
             VALUES ($1, $2, $3, 'processed', NOW(), $4)
             RETURNING id`,
            [
                createdSourceId,
                JSON.stringify({ price: 1 }),
                JSON.stringify({ title: 'acl test', content: 'body' }),
                JSON.stringify({ data_type: 'price' }),
            ],
        );
        collectedId = cd.rows[0].id;
    }, 60000);

    afterAll(async () => {
        try {
            if (createdSourceId) {
                await query('DELETE FROM source_access_controls WHERE source_id = $1', [createdSourceId]);
                await query('DELETE FROM collected_data WHERE source_id = $1', [createdSourceId]);
                await query('DELETE FROM data_sources WHERE id = $1', [createdSourceId]);
            }
            if (testUserId) {
                await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
                await query('DELETE FROM users WHERE id = $1', [testUserId]);
            }
            const redis = await getRedisClient();
            if (redis && redis.isOpen) await redis.quit();
            await new Promise(resolve => setTimeout(resolve, 500));
            await pool.end();
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }, 15000);

    beforeEach(async () => {
        await query('DELETE FROM source_access_controls WHERE source_id = $1', [createdSourceId]);
    });

    test('default allow when no ACL', async () => {
        const decision = await evaluateSourceAccess({
            sourceId: createdSourceId,
            agentKey: 'technical',
            action: 'read',
        }, { audit: false });

        expect(decision.allowed).toBe(true);
    });

    test('blocked agent denied', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, [], ['publisher']],
        );

        const decision = await evaluateSourceAccess({
            sourceId: createdSourceId,
            agentKey: 'publisher',
            action: 'publish',
        }, { audit: false });

        expect(decision.allowed).toBe(false);
    });

    test('allow-list restricts unlisted agent', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], []],
        );

        const technical = await evaluateSourceAccess({
            sourceId: createdSourceId,
            agentKey: 'technical',
            action: 'read',
        }, { audit: false });
        const sentiment = await evaluateSourceAccess({
            sourceId: createdSourceId,
            agentKey: 'sentiment',
            action: 'read',
        }, { audit: false });

        expect(technical.allowed).toBe(true);
        expect(sentiment.allowed).toBe(false);
    });

    test('admin source listing unaffected by ACL', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], ['publisher']],
        );

        const listRes = await request(app)
            .get('/api/v1/data-hub/access-control')
            .set('Authorization', `Bearer ${validToken}`);

        expect(listRes.status).toBe(200);
        const rule = listRes.body.rules.find(r => r.source_id === createdSourceId);
        expect(rule).toBeDefined();
        expect(rule.has_custom_rule).toBe(true);
    });

    test('collected data API enforces ACL when agentKey present', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], []],
        );

        const allowed = await request(app)
            .get(`/api/v1/data-sources/collected/${collectedId}?agentKey=technical`)
            .set('Authorization', `Bearer ${validToken}`);

        const denied = await request(app)
            .get(`/api/v1/data-sources/collected/${collectedId}?agentKey=sentiment`)
            .set('Authorization', `Bearer ${validToken}`);

        expect(allowed.status).toBe(200);
        expect(denied.status).toBe(403);
    });

    test('collected data API without agentKey is not filtered (admin path)', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], []],
        );

        const res = await request(app)
            .get(`/api/v1/data-sources/collected/${collectedId}`)
            .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(collectedId);
    });

    test('publisher respects ACL', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], ['publisher']],
        );

        const pub = await query(
            `INSERT INTO telegram_publishers (name, channel_id, is_active)
             VALUES ('ACL Test Pub', '-1001', true)
             RETURNING id`,
        );
        const publisherId = pub.rows[0].id;

        await expect(
            telegramPublisherService.runPublisherPublish(
                publisherId,
                {
                    message: 'blocked',
                    content_type: 'test',
                    confirm_publish: true,
                    source_id: createdSourceId,
                },
                testUserId,
            ),
        ).rejects.toMatchObject({ status: 403 });

        await query('DELETE FROM telegram_publishers WHERE id = $1', [publisherId]);
    });

    test('publisher API blocks publisher ACL even in dry_run', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], ['publisher']],
        );

        const pub = await query(
            `INSERT INTO telegram_publishers (name, channel_id, is_active)
             VALUES ('ACL API Blocked Pub', '-1002', true)
             RETURNING id`,
        );
        const publisherId = pub.rows[0].id;

        const res = await request(app)
            .post(`/api/v1/data-hub/telegram-publishers/${publisherId}/publish`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                message: 'blocked dry run',
                content_type: 'test',
                confirm_publish: true,
                source_id: createdSourceId,
                data_type: 'price',
            });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SOURCE_ACCESS_DENIED');

        const history = await query(
            'SELECT COUNT(*)::int AS c FROM publisher_delivery_history WHERE publisher_id = $1',
            [publisherId],
        );
        expect(history.rows[0].c).toBe(0);

        await query('DELETE FROM telegram_publishers WHERE id = $1', [publisherId]);
    });

    test('publisher API allows publisher when source ACL allows publisher', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['publisher'], []],
        );

        const pub = await query(
            `INSERT INTO telegram_publishers (name, channel_id, is_active)
             VALUES ('ACL API Allowed Pub', '-1003', true)
             RETURNING id`,
        );
        const publisherId = pub.rows[0].id;

        const res = await request(app)
            .post(`/api/v1/data-hub/telegram-publishers/${publisherId}/publish`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                message: 'allowed dry run',
                content_type: 'test',
                confirm_publish: true,
                source_id: createdSourceId,
                data_type: 'price',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.dry_run).toBe(true);

        await query('DELETE FROM publisher_delivery_history WHERE publisher_id = $1', [publisherId]);
        await query('DELETE FROM telegram_publishers WHERE id = $1', [publisherId]);
    });

    test('publisher API requires source_id', async () => {
        const pub = await query(
            `INSERT INTO telegram_publishers (name, channel_id, is_active)
             VALUES ('ACL API Missing Source Pub', '-1004', true)
             RETURNING id`,
        );
        const publisherId = pub.rows[0].id;

        const res = await request(app)
            .post(`/api/v1/data-hub/telegram-publishers/${publisherId}/publish`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                message: 'missing source',
                content_type: 'test',
                confirm_publish: true,
            });

        expect(res.status).toBe(400);

        await query('DELETE FROM telegram_publishers WHERE id = $1', [publisherId]);
    });

    test('legacy data-sources publish-telegram route blocks publisher ACL', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], ['publisher']],
        );

        const res = await request(app)
            .post('/api/v1/data-sources/publish-telegram')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                message: 'blocked legacy publish',
                source_id: createdSourceId,
                data_type: 'price',
            });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SOURCE_ACCESS_DENIED');
    });

    test('legacy data-sources publish-telegram route requires source_id', async () => {
        const res = await request(app)
            .post('/api/v1/data-sources/publish-telegram')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                message: 'missing legacy source',
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BAD_REQUEST');
    });

    test('AI agent run respects gateway ACL', async () => {
        await query(
            `INSERT INTO source_access_controls (source_id, allowed_agents, blocked_agents)
             VALUES ($1, $2, $3)`,
            [createdSourceId, ['technical'], []],
        );

        const agents = await query(
            `SELECT id, agent_key FROM ai_agents
             WHERE agent_key IN ('technical', 'sentiment')`,
        );
        const technicalId = agents.rows.find(row => row.agent_key === 'technical')?.id;
        const sentimentId = agents.rows.find(row => row.agent_key === 'sentiment')?.id;
        expect(technicalId).toBeTruthy();
        expect(sentimentId).toBeTruthy();

        const allowed = await request(app)
            .post(`/api/v1/ai-agents/${technicalId}/run`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                symbol: 'BTCUSDT',
                timeframe: '1h',
                config: { source_id: createdSourceId },
            });

        const denied = await request(app)
            .post(`/api/v1/ai-agents/${sentimentId}/run`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                symbol: 'BTCUSDT',
                timeframe: '1h',
                config: { source_id: createdSourceId },
            });

        expect(allowed.status).toBe(200);
        expect(denied.status).toBe(403);
        expect(denied.body.code).toBe('SOURCE_ACCESS_DENIED');
    }, 60000);

    test('registry agents endpoint returns ai_agents', async () => {
        const res = await request(app)
            .get('/api/v1/data-hub/access-control/agents/registry')
            .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.agents.some(a => a.agent_key === 'technical')).toBe(true);
        expect(res.body.agents.some(a => a.agent_key === 'publisher')).toBe(true);
    });
});
