import request from 'supertest';
import app from '../../server.js';

describe('Cache Headers Integration Tests', () => {
    it('GET /health should have no-cache and must-revalidate headers', async () => {
        const response = await request(app).get('/health');

        expect(response.headers['cache-control']).toBe('no-cache, must-revalidate');
    });

    it('POST /api/v1/auth/login should have no-store and no-cache headers', async () => {
        // We don't need valid credentials just to check the header set by middleware
        const response = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@test.com', password: 'password' });

        expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });

    it('GET /uploads/test.txt should have long-lived cache headers', async () => {
        // The path starts with /uploads, middleware should trigger even if file doesn't exist
        // Express static might 404, but middleware runs before it
        const response = await request(app).get('/uploads/test.txt');

        expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    });

    it('PUT /api/v1/users/profile should have no-store headers', async () => {
        const response = await request(app).put('/api/v1/users/profile');

        expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });
});
