/**
 * Username/password login integration — disposable DB user, no token injection.
 * @jest-environment node
 */
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import app from '../../server.js';
import { query } from '../../database/db.js';
import { STAGING_PUBLIC_ORIGIN } from '../../utils/corsOrigins.js';

dotenv.config();

const FIXTURE_EMAIL = 'auth-login-fixture@titangold.test';
const FIXTURE_USERNAME = 'auth_login_fixture';
const FIXTURE_PASSWORD = 'FixturePass123!';

/** @type {string|null} */
let fixtureUserId = null;

describe('Auth login integration', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 10);
    const result = await query(
      `INSERT INTO users (email, username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'user', TRUE)
       ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             is_active = TRUE
       RETURNING id`,
      [FIXTURE_EMAIL, FIXTURE_USERNAME, passwordHash, 'Auth Login Fixture'],
    );
    fixtureUserId = result.rows[0].id;
  });

  afterAll(async () => {
    if (fixtureUserId) {
      await query('DELETE FROM user_sessions WHERE user_id = $1', [fixtureUserId]).catch(() => {});
      await query('DELETE FROM users WHERE id = $1', [fixtureUserId]).catch(() => {});
    }
  }, 30000);

  it('valid disposable user login succeeds', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ username: FIXTURE_USERNAME, password: FIXTURE_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.username).toBe(FIXTURE_USERNAME);
    expect(response.body.user.password_hash).toBeUndefined();
  });

  it('wrong password fails with generic error', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: FIXTURE_USERNAME, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
    expect(JSON.stringify(response.body)).not.toMatch(/password_mismatch|user_not_found/);
  });

  it('unknown user fails with generic error', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'no_such_user_fixture', password: 'anything' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
  });

  it('disabled user fails with generic error', async () => {
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [fixtureUserId]);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: FIXTURE_USERNAME, password: FIXTURE_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
    await query('UPDATE users SET is_active = TRUE WHERE id = $1', [fixtureUserId]);
  });

  it('allows Staging browser origin when TITAN_DEPLOY_ENV=staging', async () => {
    const previous = process.env.TITAN_DEPLOY_ENV;
    process.env.TITAN_DEPLOY_ENV = 'staging';
    delete process.env.CORS_ALLOWED_ORIGINS;

    const mod = await import('../../utils/corsOrigins.js');
    expect(mod.isOriginAllowed(STAGING_PUBLIC_ORIGIN, process.env)).toBe(true);

    process.env.TITAN_DEPLOY_ENV = previous;
  });

  it('does not leak internal failure reasons publicly', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: '__missing_user__', password: 'x' });

    expect(response.status).toBe(401);
    const body = JSON.stringify(response.body);
    expect(body).not.toMatch(/user_not_found|account_disabled|unsupported_hash/);
  });
});
