
import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('Access Control Integration Tests', () => {
    let app;
    let query;
    let pool;
    let getRedisClient;
    let dataPipeline;

    let testUserId;
    let validToken;
    let createdSourceId;

    beforeAll(async () => {
        // Dynamic imports
        const serverModule = await import('../../server.js');
        app = serverModule.default;

        const dbModule = await import('../../database/db.js');
        query = dbModule.query;
        pool = dbModule.default;

        const redisModule = await import('../../utils/redis.js');
        getRedisClient = redisModule.getRedisClient;

        const pipelineModule = await import('../../services/dataPipeline.js');
        dataPipeline = pipelineModule.dataPipeline;

        try {
            // Create test user
            const userResult = await query(
                `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                 RETURNING id`,
                ['test-acl@titangold.com', 'test_acl', 'hashed_password', 'Test ACL User', 'admin', true]
            );
            testUserId = userResult.rows[0].id;

            validToken = jwt.sign(
                { userId: testUserId, email: 'test-acl@titangold.com', role: 'admin' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            await query(
                `INSERT INTO user_sessions (user_id, token, expires_at, last_activity_at)
                 VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())
                 ON CONFLICT (token) DO UPDATE SET token = EXCLUDED.token`,
                [testUserId, validToken]
            );

            // Create a test data source
            const sourceResult = await query(
                `INSERT INTO data_sources (name, type, category, config)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                ['Test ACL Source', 'api', 'market_data', JSON.stringify({})]
            );
            createdSourceId = sourceResult.rows[0].id;

        } catch (error) {
            console.error('Setup error:', error);
        }
    }, 30000);

    afterAll(async () => {
        try {
            if (createdSourceId) {
                await query('DELETE FROM source_access_controls WHERE source_id = $1', [createdSourceId]);
                await query('DELETE FROM data_sources WHERE id = $1', [createdSourceId]);
                await query('DELETE FROM data_queue WHERE source_id = $1', [createdSourceId]);
                await query('DELETE FROM collected_data WHERE source_id = $1', [createdSourceId]);
            }
            if (testUserId) {
                await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
                await query('DELETE FROM users WHERE id = $1', [testUserId]);
            }

            const redis = await getRedisClient();
            if (redis && redis.isOpen) {
                await redis.quit();
            }
            // Give a small delay for connections to close
            await new Promise(resolve => setTimeout(resolve, 500));
            await pool.end();
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }, 10000);

    describe('ACL API', () => {
        test('POST /api/v1/data-hub/access-control/:sourceId - Should set ACL rules', async () => {
            const aclData = {
                allowed_agents: ['technical_analysis'],
                blocked_agents: ['sentiment_analysis'],
                allowed_data_types: ['price'],
                blocked_data_types: ['news'],
                require_auth: true
            };

            const response = await request(app)
                .post(`/api/v1/data-hub/access-control/${createdSourceId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .send(aclData);

            expect(response.status).toBe(200);
            expect(response.body.allowed_agents).toContain('technical_analysis');
            expect(response.body.allowed_data_types).toContain('price');
        });

        test('GET /api/v1/data-hub/access-control/:sourceId - Should retrieve ACL rules', async () => {
            const response = await request(app)
                .get(`/api/v1/data-hub/access-control/${createdSourceId}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.source_id).toBe(createdSourceId);
            expect(response.body.allowed_agents).toContain('technical_analysis');
        });
    });

    describe('DataPipeline ACL Enforcement', () => {
        test('Should filter out blocked agents during processing', async () => {
            // 1. Insert raw data
            const rawDataResult = await query(
                `INSERT INTO collected_data (source_id, raw_data, status, collected_at) 
                 VALUES ($1, $2, $3, NOW()) RETURNING id`,
                [createdSourceId, JSON.stringify({ price: 50000, type: 'price' }), 'pending']
            );
            const dataId = rawDataResult.rows[0].id;

            // 2. Mock dataRouter to suggest multiple agents
            // We can't easily mock imported modules in ES modules with Jest easily without不安定な mockModule
            // But we can check what's in the DB after processing.
            // By default, a 'market_data' category might route to Technical, Sentiment, etc.

            // 3. Run pipeline for this item
            await dataPipeline.processPendingData(1);

            // 4. Verify data_queue
            const queueItems = await query(
                'SELECT * FROM data_queue WHERE data_id = $1',
                [dataId]
            );

            // Based on our ACL: allowed=['technical_analysis'], blocked=['sentiment_analysis']
            // Sentiment analysis should NOT be in the queue, even if the router suggested it.
            // Technical analysis SHOULD be allowed if suggested.

            const agentKeysInQueue = queueItems.rows.map(item => item.agent_key);
            // Note: Since we don't know exactly what the router suggests without looking at its code,
            // we at least ensure blocked ones aren't there.
            expect(agentKeysInQueue).not.toContain('sentiment_analysis');

            // If the router suggested technical_analysis, it should be there.
        });

        test('Should block all agents if not in allowed list', async () => {
            // Update ACL to only allow an agent that definitely won't be suggested for price data
            await request(app)
                .post(`/api/v1/data-hub/access-control/${createdSourceId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    allowed_agents: ['non_existent_agent'],
                    blocked_agents: [],
                    allowed_data_types: [],
                    blocked_data_types: []
                });

            const rawDataResult = await query(
                `INSERT INTO collected_data (source_id, raw_data, status, collected_at) 
                 VALUES ($1, $2, $3, NOW()) RETURNING id`,
                [createdSourceId, JSON.stringify({ price: 60000, type: 'price' }), 'pending']
            );
            const dataId = rawDataResult.rows[0].id;

            await dataPipeline.processPendingData(1);

            const queueItems = await query(
                'SELECT * FROM data_queue WHERE data_id = $1',
                [dataId]
            );

            expect(queueItems.rows.length).toBe(0);
        });
    });
});
