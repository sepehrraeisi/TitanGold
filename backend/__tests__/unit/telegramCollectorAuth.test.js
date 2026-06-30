/**
 * Telegram Collector write auth middleware tests (P4).
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const collectorAuthPath = path.resolve(__dirname, '../../../telegram-collector/middleware/collectorAuth.js');

const TEST_SECRET = 'test-collector-auth-secret';
const OTHER_SECRET = 'other-secret-for-signature-test';

describe('collectorAuth middleware P4', () => {
    let requireCollectorWrite;
    let resolveJwtSecret;

    beforeEach(async () => {
        process.env.JWT_SECRET = TEST_SECRET;
        delete process.env.COLLECTOR_SERVICE_TOKEN;
        const mod = await import(collectorAuthPath);
        requireCollectorWrite = mod.requireCollectorWrite;
        resolveJwtSecret = mod.resolveJwtSecret;
    });

    afterEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.COLLECTOR_SERVICE_TOKEN;
    });

    function mockReqRes(headers = {}) {
        const req = {
            method: 'POST',
            path: '/api/telegram-collector/login/start',
            headers,
            socket: { remoteAddress: '127.0.0.1' },
        };
        let statusCode = 200;
        let body = null;
        const res = {
            status(code) {
                statusCode = code;
                return this;
            },
            json(payload) {
                body = payload;
                return this;
            },
        };
        return { req, res, getStatus: () => statusCode, getBody: () => body };
    }

    it('returns 401 when unauthenticated write', () => {
        const { req, res, getStatus, getBody } = mockReqRes();
        requireCollectorWrite(req, res, () => {});
        expect(getStatus()).toBe(401);
        expect(getBody()).toEqual({ success: false, error: 'Authentication required' });
    });

    it('allows authenticated admin write', () => {
        const secret = resolveJwtSecret();
        const token = jwt.sign({ userId: 'u1', role: 'admin' }, secret);
        const { req, res, getStatus } = mockReqRes({ authorization: `Bearer ${token}` });
        let nextCalled = false;
        requireCollectorWrite(req, res, () => {
            nextCalled = true;
        });
        expect(nextCalled).toBe(true);
        expect(getStatus()).toBe(200);
        expect(req.collectorUser.role).toBe('admin');
    });

    it('returns 403 for read-only viewer write', () => {
        const secret = resolveJwtSecret();
        const token = jwt.sign({ userId: 'u2', role: 'viewer' }, secret);
        const { req, res, getStatus, getBody } = mockReqRes({ authorization: `Bearer ${token}` });
        requireCollectorWrite(req, res, () => {});
        expect(getStatus()).toBe(403);
        expect(getBody()).toEqual({ success: false, error: 'Insufficient permissions' });
    });

    it('allows internal service token', () => {
        process.env.COLLECTOR_SERVICE_TOKEN = 'svc-token';
        const { req, res, getStatus } = mockReqRes({ 'x-collector-service-token': 'svc-token' });
        let nextCalled = false;
        requireCollectorWrite(req, res, () => {
            nextCalled = true;
        });
        expect(nextCalled).toBe(true);
        expect(getStatus()).toBe(200);
        expect(req.collectorUser.internal).toBe(true);
    });

    it('prefers process.env JWT_SECRET over backend/.env file', () => {
        process.env.JWT_SECRET = TEST_SECRET;
        const secret = resolveJwtSecret();
        expect(secret).toBe(TEST_SECRET);
        const token = jwt.sign({ userId: 'u1', role: 'admin' }, secret);
        const { req, res, getStatus } = mockReqRes({ authorization: `Bearer ${token}` });
        let nextCalled = false;
        requireCollectorWrite(req, res, () => {
            nextCalled = true;
        });
        expect(nextCalled).toBe(true);
        expect(getStatus()).toBe(200);
    });

    it('falls back to backend/.env when process.env JWT_SECRET is unset', () => {
        delete process.env.JWT_SECRET;
        const backendEnv = path.resolve(__dirname, '../../../backend/.env');
        if (!fs.existsSync(backendEnv)) {
            return;
        }
        const fileSecret = resolveJwtSecret();
        expect(fileSecret).toBeTruthy();
        const token = jwt.sign({ userId: 'u1', role: 'admin' }, fileSecret);
        const { req, res, getStatus } = mockReqRes({ authorization: `Bearer ${token}` });
        let nextCalled = false;
        requireCollectorWrite(req, res, () => {
            nextCalled = true;
        });
        expect(nextCalled).toBe(true);
        expect(getStatus()).toBe(200);
    });
});
