import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock the fetchers to return controlled data
jest.unstable_mockModule('../../services/fetchers/apiFetcher.js', () => ({
    fetchFromApi: jest.fn()
}));

describe('Crawl Scheduling and Incremental Updates', () => {
    let query;
    let pool;
    let dataFetcherService;
    let fetchFromApi;

    let testUserId;
    let testSourceId;

    beforeAll(async () => {
        // Dynamic imports for mocks
        const apiFetcherMock = await import('../../services/fetchers/apiFetcher.js');
        fetchFromApi = apiFetcherMock.fetchFromApi;

        const dbModule = await import('../../database/db.js');
        query = dbModule.query;
        pool = dbModule.default;

        const serviceModule = await import('../../services/dataFetcher.js');
        dataFetcherService = serviceModule.dataFetcherService;

        // Setup test user if needed for auditing columns (updated_by etc.)
        try {
            const userResult = await query(
                `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                 RETURNING id`,
                ['test-scheduling@titangold.com', 'test_scheduling', 'hashed_password', 'Test Scheduling User', 'admin', true]
            );
            testUserId = userResult.rows[0].id;
        } catch (dbError) {
            console.error('Failed to setup test user:', dbError.message);
        }
    }, 60000);

    afterAll(async () => {
        try {
            if (testSourceId) {
                await query('DELETE FROM collected_data WHERE source_id = $1', [testSourceId]);
                await query('DELETE FROM data_sources WHERE id = $1', [testSourceId]);
            }
            if (testUserId) {
                await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
                await query('DELETE FROM users WHERE id = $1', [testUserId]);
            }

            // Give a small delay for any pending async work
            await new Promise(resolve => setTimeout(resolve, 500));

            if (pool) {
                await pool.end();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    beforeEach(async () => {
        // Clear collected_data for the test source to ensure clean counts
        if (testSourceId) {
            await query('DELETE FROM collected_data WHERE source_id = $1', [testSourceId]);
        }
    });

    describe('Scheduling Logic', () => {
        test('Should correctly select sources due for fetching', async () => {
            // Create a source due now
            const res1 = await query(
                `INSERT INTO data_sources (name, type, refresh_interval, next_fetch_at, is_active)
                 VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute', true)
                 RETURNING id`,
                ['Due Source', 'api', 60]
            );
            const dueId = res1.rows[0].id;

            // Create a source NOT due yet
            const res2 = await query(
                `INSERT INTO data_sources (name, type, refresh_interval, next_fetch_at, is_active)
                 VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', true)
                 RETURNING id`,
                ['Not Due Source', 'api', 60]
            );
            const notDueId = res2.rows[0].id;

            // Run the scheduler selection query
            const result = await query(
                `SELECT id FROM data_sources 
                 WHERE is_active = true 
                 AND (next_fetch_at IS NULL OR next_fetch_at <= NOW())`
            );

            const ids = result.rows.map(r => r.id);
            expect(ids).toContain(dueId);
            expect(ids).not.toContain(notDueId);

            // Cleanup
            await query('DELETE FROM data_sources WHERE id IN ($1, $2)', [dueId, notDueId]);
        });

        test('Should update next_fetch_at after successful fetch', async () => {
            const res = await query(
                `INSERT INTO data_sources (name, type, refresh_interval, next_fetch_at, is_active)
                 VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute', true)
                 RETURNING id`,
                ['Update Test Source', 'api', 15] // 15 mins
            );
            testSourceId = res.rows[0].id;

            fetchFromApi.mockResolvedValue({ some: 'data' });

            await dataFetcherService.fetchSource(testSourceId);

            const updated = await query('SELECT last_fetch_at, next_fetch_at FROM data_sources WHERE id = $1', [testSourceId]);
            const { last_fetch_at, next_fetch_at } = updated.rows[0];

            expect(last_fetch_at).toBeDefined();
            expect(next_fetch_at).toBeDefined();

            const diff = new Date(next_fetch_at) - new Date(last_fetch_at);
            // Should be approx 15 minutes (900,000 ms)
            expect(diff).toBeGreaterThanOrEqual(14 * 60 * 1000);
            expect(diff).toBeLessThanOrEqual(16 * 60 * 1000);
        });
    });

    describe('Incremental Updates (Hashing)', () => {
        test('Should not save duplicate content', async () => {
            fetchFromApi.mockResolvedValue({ unique: 'content' });

            // First fetch
            await dataFetcherService.fetchSource(testSourceId);
            const count1 = await query('SELECT COUNT(*) FROM collected_data WHERE source_id = $1', [testSourceId]);
            expect(parseInt(count1.rows[0].count)).toBe(1);

            // Second fetch with SAME content
            await dataFetcherService.fetchSource(testSourceId);
            const count2 = await query('SELECT COUNT(*) FROM collected_data WHERE source_id = $1', [testSourceId]);
            expect(parseInt(count2.rows[0].count)).toBe(1); // Still 1

            // Third fetch with DIFFERENT content
            fetchFromApi.mockResolvedValue({ unique: 'different content' });
            await dataFetcherService.fetchSource(testSourceId);
            const count3 = await query('SELECT COUNT(*) FROM collected_data WHERE source_id = $1', [testSourceId]);
            expect(parseInt(count3.rows[0].count)).toBe(2); // Now 2
        });

        test('Should handle arrays and deduplicate individual items', async () => {
            // New source
            const res = await query(
                "INSERT INTO data_sources (name, type, refresh_interval, is_active) VALUES ('Array Test', 'api', 60, true) RETURNING id"
            );
            const arraySourceId = res.rows[0].id;

            fetchFromApi.mockResolvedValue([
                { id: 1, text: 'First' },
                { id: 2, text: 'Second' }
            ]);

            // First fetch (2 items)
            await dataFetcherService.fetchSource(arraySourceId);
            const count1 = await query('SELECT COUNT(*) FROM collected_data WHERE source_id = $1', [arraySourceId]);
            expect(parseInt(count1.rows[0].count)).toBe(2);

            // Second fetch (1 old item, 1 new item)
            fetchFromApi.mockResolvedValue([
                { id: 1, text: 'First' }, // Duplicate
                { id: 3, text: 'Third' }  // New
            ]);
            await dataFetcherService.fetchSource(arraySourceId);
            const count2 = await query('SELECT COUNT(*) FROM collected_data WHERE source_id = $1', [arraySourceId]);
            expect(parseInt(count2.rows[0].count)).toBe(3); // 2 + 1 = 3

            // Cleanup
            await query('DELETE FROM collected_data WHERE source_id = $1', [arraySourceId]);
            await query('DELETE FROM data_sources WHERE id = $1', [arraySourceId]);
        });
    });
});
