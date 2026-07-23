/**
 * Frontend login API contract — real fetch shape, no session injection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loginWithBackend } from '../../../services/api-auth';

describe('loginWithBackend', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits canonical v1 login request fields', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'jwt-token',
        user: {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'user@test.com',
          username: 'fixture_user',
          full_name: 'Fixture User',
          role: 'admin',
          created_at: new Date().toISOString(),
        },
      }),
    });

    const user = await loginWithBackend('fixture_user', 'secret-pass');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'fixture_user', password: 'secret-pass' }),
      }),
    );
    expect(user?.username).toBe('fixture_user');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('titan_token', 'jwt-token');
  });

  it('returns null and does not store token for invalid login', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    const user = await loginWithBackend('fixture_user', 'wrong');
    expect(user).toBeNull();
    expect(sessionStorage.setItem).not.toHaveBeenCalledWith('titan_token', expect.any(String));
  });

  it('returns null when response is missing token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: '1', email: 'a@b.c', username: 'u', role: 'user' } }),
    });

    const user = await loginWithBackend('fixture_user', 'secret-pass');
    expect(user).toBeNull();
  });
});
