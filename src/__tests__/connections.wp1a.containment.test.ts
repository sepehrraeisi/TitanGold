/**
 * CONNECTIONS-WP1A frontend containment tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('connectionsApi WP1A', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects legacy key existence without reading the value into UI helpers', async () => {
    localStorage.setItem('titan_mexc_settings', JSON.stringify({ apiKey: 'SHOULD_NOT_BE_READ', apiSecret: 'SECRET' }));
    const { detectLegacyInsecureCredentialKeys } = await import('../../services/connectionsApi.ts');
    const found = detectLegacyInsecureCredentialKeys();
    expect(found).toEqual(['titan_mexc_settings']);
  });

  it('removes only known legacy keys', async () => {
    localStorage.setItem('titan_mexc_settings', 'opaque');
    localStorage.setItem('unrelated_user_pref', 'keep-me');
    localStorage.setItem('titan_token', 'session');
    const { removeLegacyInsecureCredentialKeys } = await import('../../services/connectionsApi.ts');
    const removed = await removeLegacyInsecureCredentialKeys();
    expect(removed).toContain('titan_mexc_settings');
    expect(localStorage.getItem('titan_mexc_settings')).toBeNull();
    expect(localStorage.getItem('unrelated_user_pref')).toBe('keep-me');
    expect(localStorage.getItem('titan_token')).toBe('session');
  });

  it('maps Invalid token / 401 to APP_SESSION_EXPIRED not provider failure', async () => {
    const { mapConnectionApiError } = await import('../../services/connectionsApi.ts');
    const mapped = mapConnectionApiError(401, { error: 'Invalid token', code: 'INVALID_TOKEN' });
    expect(mapped.code).toBe('APP_SESSION_EXPIRED');
    expect(mapped.messageKey).toBe('connections_session_expired');
  });

  it('saveMexcConnection posts via authenticated client and does not write browser secrets', async () => {
    localStorage.setItem('titan_token', 'test-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        isConnected: false,
        code: 'CONNECTION_UNTESTED',
        connection: { provider: 'MEXC', configured: true, isConnected: false },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { saveMexcConnection } = await import('../../services/connectionsApi.ts');
    await saveMexcConnection({
      apiKey: 'FAKE_KEY_FOR_TEST_ONLY_1234',
      apiSecret: 'FAKE_SECRET_FOR_TEST_ONLY_123456789012',
    });
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/connections/exchanges/MEXC');
    expect(String(init.headers.Authorization || '')).toContain('Bearer test-jwt');
    expect(localStorage.getItem('titan_mexc_settings')).toBeNull();
  }, 15000);

  it('legacy testMexcConnection never marks success/connected from public checks', async () => {
    const { testMexcConnection } = await import('../../services/api.ts');
    const result = await testMexcConnection('AAAAAAAAAAAAAAA1', 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
    expect(result.success).toBe(false);
  }, 20000);
});

describe('MultiExchangeSettings source containment', () => {
  it('source file does not read localStorage token key', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'components/settings/MultiExchangeSettings.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/localStorage\.getItem\(['"]token['"]\)/);
    expect(src).toMatch(/connectionsApi/);
  });
});
