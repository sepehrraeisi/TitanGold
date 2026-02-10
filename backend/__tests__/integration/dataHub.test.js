
import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock external API calls BEFORE importing app
jest.unstable_mockModule('node-fetch', () => ({
    default: jest.fn()
}));

describe('Data Hub Integration Tests', () => {
    let app;
    let query;
    let pool;
    let getRedisClient;

    let testUserId;
    let validToken;
    let createdCategoryId;
    let createdSourceId;

    // Setup: Import modules and create test user
    beforeAll(async () => {
        // Dynamic imports to ensure mocks are applied
        const serverModule = await import('../../server.js');
        app = serverModule.default;

        const dbModule = await import('../../database/db.js');
        query = dbModule.query;
        pool = dbModule.default;

        const redisModule = await import('../../utils/redis.js');
        getRedisClient = redisModule.getRedisClient;

        try {
            // Create test user
            const userResult = await query(
                `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
                ['test-datahub@titangold.com', 'test_datahub', 'hashed_password', 'Test DataHub User', 'admin', true]
            );
            testUserId = userResult.rows[0].id;

            // Generate valid JWT token
            validToken = jwt.sign(
                { userId: testUserId, email: 'test-datahub@titangold.com', role: 'admin' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            // Create test session
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

    // Cleanup
    afterAll(async () => {
        try {
            if (createdSourceId) {
                await query('DELETE FROM data_sources WHERE id = $1', [createdSourceId]);
            }
            if (createdCategoryId) {
                await query('DELETE FROM data_categories WHERE id = $1', [createdCategoryId]);
            }
            if (testUserId) {
                await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
                // User deletion might fail if other deps exist, but sessions should be gone
            }

            const redis = await getRedisClient();
            if (redis && redis.isOpen) {
                await redis.quit();
            }

            // Close DB pool
            await pool.end();
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }, 10000);

    // Data Categories Tests
    describe('Data Categories API', () => {

        test('POST /api/v1/data-categories - Should create a new category', async () => {
            const response = await request(app)
                .post('/api/v1/data-categories')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test Category',
                    description: 'Integration Test Category',
                    color: '#FF5733',
                    icon: 'test_icon'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe('Test Category');
            createdCategoryId = response.body.id;
        });

        test('POST /api/v1/data-categories - Should prevent duplicate names', async () => {
            const response = await request(app)
                .post('/api/v1/data-categories')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test Category', // Duplicate name from previous test
                    description: 'Duplicate',
                    color: '#000000',
                    icon: 'duplicate'
                });

            // Depending on implementation, might be 400 or 409
            expect([400, 409]).toContain(response.status);
        });

        test('GET /api/v1/data-categories - Should list categories', async () => {
            const response = await request(app)
                .get('/api/v1/data-categories')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            const category = response.body.find(c => c.id === createdCategoryId);
            expect(category).toBeDefined();
        });

        test('PUT /api/v1/data-categories/:id - Should update category', async () => {
            const response = await request(app)
                .put(`/api/v1/data-categories/${createdCategoryId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Updated Test Category'
                });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Updated Test Category');
        });
    });

    // Data Sources Tests
    describe('Data Sources API', () => {

        test('POST /api/v1/data-sources - Should create a new source', async () => {
            // Requires category ID from previous tests
            expect(createdCategoryId).toBeDefined();

            const response = await request(app)
                .post('/api/v1/data-sources')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test Source',
                    type: 'api',
                    category_id: createdCategoryId,
                    url: 'https://api.example.com',
                    method: 'GET',
                    refresh_interval: 60,
                    is_active: true,
                    config: { key: 'value' }
                });

            expect(response.status).toBe(201);
            createdSourceId = response.body.id;
        });

        test('GET /api/v1/data-sources - Should list sources', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            const source = response.body.find(s => s.id === createdSourceId);
            expect(source).toBeDefined();
        });

        test('PUT /api/v1/data-sources/:id - Should update source', async () => {
            const response = await request(app)
                .put(`/api/v1/data-sources/${createdSourceId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Updated Test Source'
                });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Updated Test Source');
        });
    });

    // DELETE Scenarios (TASK-QA-005)
    describe('Data Sources DELETE Scenarios', () => {
        let sourceToDelete;

        beforeEach(async () => {
            // Create a fresh source for each delete test
            const response = await request(app)
                .post('/api/v1/data-sources')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Source to Delete',
                    type: 'api',
                    category_id: createdCategoryId,
                    url: 'https://api.delete-test.com',
                    is_active: true
                });
            sourceToDelete = response.body.id;
        });

        test('DELETE /api/v1/data-sources/:id - Should soft-delete source (set is_active=false)', async () => {
            const response = await request(app)
                .delete(`/api/v1/data-sources/${sourceToDelete}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(204);

            // Verify source still exists in DB but is_active = false
            const dbResult = await query('SELECT * FROM data_sources WHERE id = $1', [sourceToDelete]);
            expect(dbResult.rows.length).toBe(1);
            expect(dbResult.rows[0].is_active).toBe(false);
        });

        test('DELETE /api/v1/data-sources/:id - Soft-deleted sources should not appear in list', async () => {
            // Soft-delete the source
            await request(app)
                .delete(`/api/v1/data-sources/${sourceToDelete}`)
                .set('Authorization', `Bearer ${validToken}`);

            // Get list of sources
            const response = await request(app)
                .get('/api/v1/data-sources')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            const sources = Array.isArray(response.body) ? response.body : response.body.data;
            const deletedSource = sources.find(s => s.id === sourceToDelete);
            expect(deletedSource).toBeUndefined();
        });

        test('PATCH /api/v1/data-sources/:id/restore - Should restore soft-deleted source', async () => {
            // First soft-delete
            await request(app)
                .delete(`/api/v1/data-sources/${sourceToDelete}`)
                .set('Authorization', `Bearer ${validToken}`);

            // Then restore
            const response = await request(app)
                .patch(`/api/v1/data-sources/${sourceToDelete}/restore`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.is_active).toBe(true);

            // Verify in DB
            const dbResult = await query('SELECT * FROM data_sources WHERE id = $1', [sourceToDelete]);
            expect(dbResult.rows[0].is_active).toBe(true);
        });

        test('PATCH /api/v1/data-sources/:id/restore - Should return 400 if source is already active', async () => {
            const response = await request(app)
                .patch(`/api/v1/data-sources/${sourceToDelete}/restore`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('already active');
        });

        test('DELETE /api/v1/data-sources/:id?permanent=true - Should hard-delete source', async () => {
            const response = await request(app)
                .delete(`/api/v1/data-sources/${sourceToDelete}?permanent=true`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(204);

            // Verify source is completely removed from DB
            const dbResult = await query('SELECT * FROM data_sources WHERE id = $1', [sourceToDelete]);
            expect(dbResult.rows.length).toBe(0);
        });

        test('DELETE /api/v1/data-sources/:id - Should return 404 for non-existent source', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const response = await request(app)
                .delete(`/api/v1/data-sources/${fakeId}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(404);
        });

        test('DELETE /api/v1/data-sources/:id - Should return 400 for invalid UUID', async () => {
            const response = await request(app)
                .delete('/api/v1/data-sources/invalid-uuid')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('DELETE /api/v1/data-sources/:id - Should return 401 without authentication', async () => {
            const response = await request(app)
                .delete(`/api/v1/data-sources/${sourceToDelete}`);

            expect(response.status).toBe(401);
        });
    });

    // Collected Data API (TASK-QA-006)
    describe('Collected Data API', () => {
        let testSourceForCollected;
        let collectedDataIds = [];

        beforeEach(async () => {
            // Create a test source for collected data
            const sourceResponse = await request(app)
                .post('/api/v1/data-sources')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Collected Data Test Source',
                    type: 'api',
                    category_id: createdCategoryId,
                    url: 'https://api.collected-test.com',
                    is_active: true
                });

            expect(sourceResponse.status).toBe(201);
            expect(sourceResponse.body).toHaveProperty('id');
            testSourceForCollected = sourceResponse.body.id;

            // Insert test collected_data records with different statuses and timestamps
            const statuses = ['pending', 'processed', 'error'];
            for (let i = 0; i < 15; i++) {
                const result = await query(
                    `INSERT INTO collected_data (source_id, raw_data, status, collected_at, created_at)
                     VALUES ($1, $2, $3, NOW() - INTERVAL '${i} hours', NOW() - INTERVAL '${i} hours')
                     RETURNING id`,
                    [
                        testSourceForCollected,
                        JSON.stringify({ test: `data_${i}`, index: i }),
                        statuses[i % 3]
                    ]
                );
                collectedDataIds.push(result.rows[0].id);
            }
        });

        afterEach(async () => {
            // Cleanup collected data
            if (collectedDataIds.length > 0) {
                await query('DELETE FROM collected_data WHERE id = ANY($1)', [collectedDataIds]);
                collectedDataIds = [];
            }
            if (testSourceForCollected) {
                await query('DELETE FROM data_sources WHERE id = $1', [testSourceForCollected]);
                testSourceForCollected = null;
            }
        });

        test('GET /api/v1/data-sources/collected - Should return paginated list', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.pagination).toHaveProperty('total');
            expect(response.body.pagination).toHaveProperty('limit');
            expect(response.body.pagination).toHaveProperty('offset');
            expect(response.body.pagination).toHaveProperty('hasMore');
        });

        test('GET /api/v1/data-sources/collected?limit=5&offset=3 - Should respect pagination params', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected?limit=5&offset=3')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.length).toBeLessThanOrEqual(5);
            expect(response.body.pagination.limit).toBe(5);
            expect(response.body.pagination.offset).toBe(3);
        });

        test('GET /api/v1/data-sources/collected?status=processed - Should filter by status', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected?status=processed')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.data)).toBe(true);

            // All returned records should have status 'processed'
            response.body.data.forEach(record => {
                expect(record.status).toBe('processed');
            });
        });

        test('GET /api/v1/data-sources/collected?source_id=... - Should filter by source', async () => {
            const response = await request(app)
                .get(`/api/v1/data-sources/collected?source_id=${testSourceForCollected}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.data)).toBe(true);

            // All returned records should belong to the test source
            response.body.data.forEach(record => {
                expect(record.source_id).toBe(testSourceForCollected);
            });
        });

        test('GET /api/v1/data-sources/collected?start_date=...&end_date=... - Should filter by date range', async () => {
            const now = new Date();
            const startDate = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(); // 10 hours ago
            const endDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

            const response = await request(app)
                .get(`/api/v1/data-sources/collected?start_date=${startDate}&end_date=${endDate}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.data)).toBe(true);

            // All records should be within the date range
            response.body.data.forEach(record => {
                const collectedAt = new Date(record.collected_at);
                expect(collectedAt >= new Date(startDate)).toBe(true);
                expect(collectedAt <= new Date(endDate)).toBe(true);
            });
        });

        test('GET /api/v1/data-sources/collected?start_date=invalid - Should return 400 for invalid date', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected?start_date=invalid-date')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('GET /api/v1/data-sources/collected?start_date=...&end_date=... - Should return 400 if end_date before start_date', async () => {
            const now = new Date();
            const startDate = now.toISOString();
            const endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

            const response = await request(app)
                .get(`/api/v1/data-sources/collected?start_date=${startDate}&end_date=${endDate}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('GET /api/v1/data-sources/collected/:id - Should return single record with details', async () => {
            const testId = collectedDataIds[0];
            const response = await request(app)
                .get(`/api/v1/data-sources/collected/${testId}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id', testId);
            expect(response.body).toHaveProperty('source_id');
            expect(response.body).toHaveProperty('raw_data');
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('collected_at');
        });

        test('GET /api/v1/data-sources/collected/:id - Should return 404 for non-existent ID', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const response = await request(app)
                .get(`/api/v1/data-sources/collected/${fakeId}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(404);
        });

        test('GET /api/v1/data-sources/collected/:id - Should return 400 for invalid UUID', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected/invalid-uuid')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('GET /api/v1/data-sources/collected?limit=200 - Should return 400 for limit > 100', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected?limit=200')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('GET /api/v1/data-sources/collected?offset=-5 - Should return 400 for negative offset', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected?offset=-5')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('GET /api/v1/data-sources/collected?status=invalid - Should return 400 for invalid status', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected?status=invalid')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(400);
        });

        test('GET /api/v1/data-sources/collected - Should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/v1/data-sources/collected');

            expect(response.status).toBe(401);
        });
    });

    // Cleanup Categories (after sources are deleted)
    describe('Data Categories Cleanup', () => {
        test('DELETE /api/v1/data-categories/:id - Should delete category', async () => {
            const response = await request(app)
                .delete(`/api/v1/data-categories/${createdCategoryId}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
        });
    });
});
