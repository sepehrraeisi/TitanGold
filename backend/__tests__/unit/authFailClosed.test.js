/**
 * Authentication fail-closed unit tests
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { authenticate, authorize } = await import('../../middleware/auth.js');
const { roleHasCapability, CAP } = await import('../../services/capabilities.js');

function mockReqRes(headers = {}) {
  const req = { headers, user: undefined, authResolutionFailed: false };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

describe('authenticate fail-closed', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects missing token with 401', async () => {
    const { req, res } = mockReqRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('resolves role from database, not JWT claim', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const token = jwt.sign({ userId, role: 'admin' }, process.env.JWT_SECRET);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ token }] })
      .mockResolvedValueOnce({
        rows: [{ id: userId, email: 'u@test.com', username: 'u', full_name: 'U', role: 'user', is_active: true }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const { req, res } = mockReqRes({ authorization: `Bearer ${token}` });
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('user');
  });

  it('returns 503 when database unavailable', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const token = jwt.sign({ userId, role: 'trader' }, process.env.JWT_SECRET);
    mockQuery.mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'ECONNREFUSED' });

    const { req, res } = mockReqRes({ authorization: `Bearer ${token}` });
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('AUTH_DB_UNAVAILABLE');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects disabled user with 403', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ token }] })
      .mockResolvedValueOnce({
        rows: [{ id: userId, email: 'u@test.com', username: 'u', full_name: 'U', role: 'user', is_active: false }],
      });

    const { req, res } = mockReqRes({ authorization: `Bearer ${token}` });
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('USER_DISABLED');
  });

  it('authorize fails closed when auth resolution failed', () => {
    const { req, res } = mockReqRes();
    req.user = { id: '1', role: 'admin', is_active: true };
    req.authResolutionFailed = true;
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('capabilities', () => {
  it('user can read agents but not execute', () => {
    expect(roleHasCapability('user', CAP.AI_AGENT_READ)).toBe(true);
    expect(roleHasCapability('user', CAP.AI_AGENT_EXECUTE_SAFE)).toBe(false);
  });

  it('trader can execute but not configure', () => {
    expect(roleHasCapability('trader', CAP.AI_AGENT_EXECUTE_SAFE)).toBe(true);
    expect(roleHasCapability('trader', CAP.AI_AGENT_CONFIGURE)).toBe(false);
  });

  it('vip has no extra mutation privilege', () => {
    expect(roleHasCapability('vip', CAP.TOPIC_ROUTING_WRITE)).toBe(false);
    expect(roleHasCapability('vip', CAP.AI_AGENT_EXECUTE_SAFE)).toBe(false);
  });

  it('admin has configure capability', () => {
    expect(roleHasCapability('admin', CAP.AI_AGENT_CONFIGURE)).toBe(true);
  });
});
