import request from 'supertest';
import app from '../../server.js';

describe('CORS Integration Tests', () => {
    const allowedOrigin = 'http://localhost:3000';
    const disallowedOrigin = 'http://evil.com';

    it('should allow requests from a whitelisted origin', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', allowedOrigin);

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    });

    it('should allow dynamic sub-origin normalization (trailing slash)', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', allowedOrigin + '/');

        // Whitelist in server.js should handle the slash normalization
        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin + '/');
    });

    it('should block requests from a disallowed origin', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', disallowedOrigin);

        // The CORS middleware returns an error to the callback, which is handled by Express error handler
        // Based on server.js logging, it logs a warning.
        // Supertest might see this as a 500 or just a dropped connection depending on express-cors behavior.
        expect(response.status).toBe(500);
        expect(response.body.error.message).toBe('Not allowed by CORS');
    });

    it('should return correct headers on preflight (OPTIONS) request', async () => {
        const response = await request(app)
            .options('/api/v1/health')
            .set('Origin', allowedOrigin)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'X-Request-ID');

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
        expect(response.headers['access-control-allow-methods']).toContain('POST');
        expect(response.headers['access-control-allow-headers']).toContain('X-Request-ID');
        expect(response.headers['access-control-max-age']).toBe('86400');
    });

    it('should expose essential custom headers', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', allowedOrigin);

        const exposedHeaders = response.headers['access-control-expose-headers'];
        expect(exposedHeaders).toContain('X-API-Version');
        expect(exposedHeaders).toContain('X-Request-ID');
        expect(exposedHeaders).toContain('X-Response-Time');
    });
});
