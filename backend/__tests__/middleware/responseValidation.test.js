import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateResponse } from '../../middleware/validation.js';
import { z } from 'zod';

// Mock logger
vi.mock('../../services/logger.js', () => ({
    logger: {
        error: vi.fn(),
    },
}));

// To access the mock inside tests, we need to import it
import { logger } from '../../services/logger.js';

describe('Response Validation Middleware', () => {
    const schema = z.object({
        id: z.number(),
        name: z.string(),
    });

    let mockReq;
    let mockRes;
    let mockNext;
    let jsonSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReq = {
            originalUrl: '/test',
            method: 'GET',
        };
        jsonSpy = vi.fn();
        mockRes = {
            statusCode: 200,
            json: jsonSpy,
        };
        mockNext = vi.fn();

        // Simulate environment
        process.env.NODE_ENV = 'development';
    });

    it('should allow valid response data in development', () => {
        const middleware = validateResponse(schema);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();

        const validData = { id: 1, name: 'Test' };
        mockRes.json(validData);

        expect(jsonSpy).toHaveBeenCalledWith(validData);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('should return error response in development if response is invalid', () => {
        const middleware = validateResponse(schema);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();

        const invalidData = { id: 'not-a-number', name: 'Test' };
        mockRes.json(invalidData);

        // In development mode, it should be called with an error object
        expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
            ok: false,
            error: expect.objectContaining({
                code: 'RESPONSE_VALIDATION_ERROR',
                message: 'Internal API response validation failed',
            }),
        }));
        expect(logger.error).toHaveBeenCalled();
    });

    it('should NOT return error in production if response is invalid (only log)', () => {
        process.env.NODE_ENV = 'production';
        const middleware = validateResponse(schema);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();

        const invalidData = { id: 'not-a-number', name: 'Test' };
        mockRes.json(invalidData);

        // In production, it should still return the original data but log the error
        expect(jsonSpy).toHaveBeenCalledWith(invalidData);
        expect(logger.error).toHaveBeenCalled();
    });

    it('should skip validation for non-2xx status codes', () => {
        mockRes.statusCode = 404;
        const middleware = validateResponse(schema);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();

        const invalidData = { error: 'Not Found' };
        mockRes.json(invalidData);

        expect(jsonSpy).toHaveBeenCalledWith(invalidData);
        expect(logger.error).not.toHaveBeenCalled();
    });
});
