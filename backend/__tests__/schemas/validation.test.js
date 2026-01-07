/**
 * Unit Tests for Validation Middleware
 * Task: API-002
 * 
 * Tests that validation middleware correctly catches validation errors
 * and returns appropriate error messages.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { validateBody, validateQuery, validateParams, validate } from '../../middleware/validation.js';
import { z } from 'zod';

describe('Validation Middleware', () => {
  // Mock request and response objects
  const mockReq = (data = {}) => ({
    body: data.body || {},
    query: data.query || {},
    params: data.params || {},
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBody', () => {
    it('should pass validation with valid data', async () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
      });

      const req = mockReq({ body: { name: 'John', age: 30 } });
      const res = mockRes();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.validatedBody).toEqual({ name: 'John', age: 30 });
    });

    it('should reject validation with invalid data', async () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
      });

      const req = mockReq({ body: { name: '', age: -5 } });
      const res = mockRes();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: expect.any(Array),
          }),
        })
      );
    });

    it('should return clear error messages for specific fields', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
      });

      const req = mockReq({ body: { email: 'invalid-email', password: '123' } });
      const res = mockRes();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.details).toHaveLength(2);
      expect(jsonCall.error.details[0].field).toBe('email');
      expect(jsonCall.error.details[1].field).toBe('password');
    });

    it('should handle missing required fields', async () => {
      const schema = z.object({
        username: z.string(),
        password: z.string(),
      });

      const req = mockReq({ body: {} });
      const res = mockRes();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.details.length).toBeGreaterThan(0);
    });
  });

  describe('validateQuery', () => {
    it('should pass validation with valid query params', async () => {
      const schema = z.object({
        limit: z.coerce.number().int().positive(),
        offset: z.coerce.number().int().nonnegative(),
      });

      const req = mockReq({ query: { limit: '10', offset: '0' } });
      const res = mockRes();

      const middleware = validateQuery(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedQuery).toEqual({ limit: 10, offset: 0 });
    });

    it('should reject invalid query params', async () => {
      const schema = z.object({
        limit: z.coerce.number().int().positive().max(100),
      });

      const req = mockReq({ query: { limit: '500' } });
      const res = mockRes();

      const middleware = validateQuery(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle enum validation in query params', async () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive']),
      });

      const req = mockReq({ query: { status: 'deleted' } });
      const res = mockRes();

      const middleware = validateQuery(schema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.details[0].field).toBe('status');
    });
  });

  describe('validateParams', () => {
    it('should pass validation with valid UUID', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      const req = mockReq({ 
        params: { id: '123e4567-e89b-12d3-a456-426614174000' } 
      });
      const res = mockRes();

      const middleware = validateParams(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedParams.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should reject invalid UUID format', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      const req = mockReq({ params: { id: 'invalid-uuid' } });
      const res = mockRes();

      const middleware = validateParams(schema);
      await middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validate (combined)', () => {
    it('should validate multiple parts of request', async () => {
      const schemas = {
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ include: z.enum(['details', 'summary']) }),
        body: z.object({ name: z.string() }),
      };

      const req = mockReq({
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
        query: { include: 'details' },
        body: { name: 'Test' },
      });
      const res = mockRes();

      const middleware = validate(schemas);
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedParams).toBeDefined();
      expect(req.validatedQuery).toBeDefined();
      expect(req.validatedBody).toBeDefined();
    });

    it('should collect errors from all parts', async () => {
      const schemas = {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ email: z.string().email() }),
      };

      const req = mockReq({
        params: { id: 'invalid' },
        body: { email: 'not-an-email' },
      });
      const res = mockRes();

      const middleware = validate(schemas);
      await middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.details.length).toBe(2);
      expect(jsonCall.error.details.some(e => e.location === 'params')).toBe(true);
      expect(jsonCall.error.details.some(e => e.location === 'body')).toBe(true);
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide field path for nested validation errors', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            age: z.number().positive(),
          }),
        }),
      });

      const req = mockReq({ 
        body: { 
          user: { 
            profile: { 
              age: -5 
            } 
          } 
        } 
      });
      const res = mockRes();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.details[0].field).toBe('user.profile.age');
    });

    it('should include validation code in error details', async () => {
      const schema = z.object({
        count: z.number().min(1).max(100),
      });

      const req = mockReq({ body: { count: 500 } });
      const res = mockRes();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.details[0]).toHaveProperty('code');
    });
  });
});
