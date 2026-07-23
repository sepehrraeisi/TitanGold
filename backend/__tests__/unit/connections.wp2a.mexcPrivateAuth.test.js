/**
 * CONNECTIONS-WP2A — signing, transport, adapter, verification tests
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';

const query = jest.fn();
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.unstable_mockModule('../../database/db.js', () => ({ query }));
jest.unstable_mockModule('../../services/logger.js', () => ({ logger }));

process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;

const {
  buildMexcCanonicalQuery,
  encodeMexcParamValue,
  signMexcTotalParams,
  buildSignedAccountQuery,
} = await import('../../services/connections/providers/mexcSigning.js');

const {
  mexcSafeFetch,
  buildMexcHttpsUrl,
  MexcTransportError,
} = await import('../../services/connections/providers/mexcSafeTransport.js');

const {
  verifyMexcPrivateAccountRead,
  redactForLogs,
} = await import('../../services/connections/providers/mexcPrivateAuthAdapter.js');

const {
  mapMexcProviderFailure,
  MEXC_AUTH_ERROR,
  buildSanitizedErrorResult,
} = await import('../../services/connections/mexcErrorCatalog.js');

const { encryptSecret } = await import('../../utils/crypto.js');
const { verifyOwnedMexcConnection } = await import(
  '../../services/connections/connectionPrivateVerificationService.js'
);

const FAKE_KEY = 'FAKEKEY_mexc_do_not_use';
const FAKE_SECRET = 'FAKESECRET_mexc_do_not_use_0123456789abcdef';

describe('WP2A MEXC signing contract', () => {
  test('deterministic signature for fixed timestamp', () => {
    const total = buildMexcCanonicalQuery({ recvWindow: 5000, timestamp: 1644489390087 });
    expect(total).toBe('recvWindow=5000&timestamp=1644489390087');
    const sig1 = signMexcTotalParams(FAKE_SECRET, total);
    const sig2 = signMexcTotalParams(FAKE_SECRET, total);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]+$/);
    expect(sig1).toBe(
      crypto.createHmac('sha256', FAKE_SECRET).update(total, 'utf8').digest('hex'),
    );
  });

  test('timestamp units are millisecond integers and recvWindow included', () => {
    const { signedQuery, totalParams, signature } = buildSignedAccountQuery({
      secret: FAKE_SECRET,
      timestamp: 1644489390087,
      recvWindow: 5000,
    });
    expect(totalParams).toContain('timestamp=1644489390087');
    expect(totalParams).toContain('recvWindow=5000');
    expect(signedQuery).toBe(`${totalParams}&signature=${signature}`);
    expect(() => buildSignedAccountQuery({ secret: FAKE_SECRET, timestamp: 1.5 })).toThrow();
  });

  test('uppercase percent-encoding for special characters', () => {
    expect(encodeMexcParamValue('a,b')).toBe('a%2Cb');
    const q = buildMexcCanonicalQuery({
      recvWindow: 5000,
      timestamp: 1000,
      note: 'a,b',
    });
    expect(q).toContain('note=a%2Cb');
  });

  test('canonical ordering is stable with extra keys', () => {
    const a = buildMexcCanonicalQuery({ timestamp: 1, recvWindow: 5, z: '1', a: '2' });
    const b = buildMexcCanonicalQuery({ a: '2', z: '1', recvWindow: 5, timestamp: 1 });
    expect(a).toBe(b);
    expect(a.startsWith('recvWindow=5&timestamp=1&')).toBe(true);
  });
});

describe('WP2A MEXC transport security', () => {
  test('rejects HTTP and non-allowlisted host and user URL tricks', () => {
    expect(() => buildMexcHttpsUrl('http://evil', '')).toThrow();
    expect(buildMexcHttpsUrl('/api/v3/account', 'x=1')).toContain('https://api.mexc.com/api/v3/account');
    expect(() => buildMexcHttpsUrl('https://evil.com/x', '')).toThrow();
    expect(() => buildMexcHttpsUrl('/../escape', 'a=1')).toThrow(MexcTransportError);
  });

  test('rejects http scheme via fetch wrapper', async () => {
    await expect(
      mexcSafeFetch({ url: 'http://api.mexc.com/api/v3/account', fetchImpl: async () => ({}) }),
    ).rejects.toMatchObject({ code: 'MEXC_NETWORK_ERROR' });
  });

  test('timeout maps to abort error', async () => {
    const fetchImpl = () =>
      new Promise((_, reject) => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    await expect(
      mexcSafeFetch({
        url: 'https://api.mexc.com/api/v3/account',
        fetchImpl,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: 'MEXC_TIMEOUT' });
  });

  test('oversized response rejected', async () => {
    const big = 'x'.repeat(70 * 1024);
    const fetchImpl = async () => ({
      status: 200,
      headers: { entries: () => [] },
      text: async () => big,
      body: null,
    });
    await expect(
      mexcSafeFetch({ url: 'https://api.mexc.com/api/v3/account', fetchImpl }),
    ).rejects.toMatchObject({ code: 'MEXC_RESPONSE_INVALID' });
  });

  test('redirect mode is error (no follow)', async () => {
    let seen;
    const fetchImpl = async (_url, init) => {
      seen = init.redirect;
      return { status: 200, headers: { entries: () => [] }, text: async () => '{}', body: null };
    };
    await mexcSafeFetch({ url: 'https://api.mexc.com/api/v3/account', fetchImpl });
    expect(seen).toBe('error');
  });
});

describe('WP2A error mapping', () => {
  const cases = [
    [700001, 'MEXC_CREDENTIAL_INVALID'],
    [700002, 'MEXC_SIGNATURE_INVALID'],
    [700003, 'MEXC_TIMESTAMP_INVALID'],
    [700007, 'MEXC_PERMISSION_INSUFFICIENT'],
    [700006, 'MEXC_IP_RESTRICTED'],
  ];
  for (const [code, expected] of cases) {
    test(`maps provider code ${code}`, () => {
      expect(mapMexcProviderFailure({ httpStatus: 400, providerCode: code })).toBe(expected);
    });
  }
  test('maps rate limit and timeout', () => {
    expect(mapMexcProviderFailure({ httpStatus: 429 })).toBe(MEXC_AUTH_ERROR.MEXC_RATE_LIMITED);
    expect(mapMexcProviderFailure({ timeout: true })).toBe(MEXC_AUTH_ERROR.MEXC_TIMEOUT);
    expect(mapMexcProviderFailure({ network: true })).toBe(MEXC_AUTH_ERROR.MEXC_NETWORK_ERROR);
    expect(mapMexcProviderFailure({ httpStatus: 503 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
  });
  test('sanitized errors never include secrets', () => {
    const r = buildSanitizedErrorResult(MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID);
    const s = JSON.stringify(r);
    expect(s).not.toMatch(/FAKESECRET|signature=/i);
    expect(r.sanitizedMessage).toBeTruthy();
    expect(r.correctiveAction).toBeTruthy();
  });
});

describe('WP2A adapter with fake transport', () => {
  test('successful fake private read does not assert trading unless canTrade true', async () => {
    const transport = async () => ({
      status: 200,
      headers: {},
      bodyText: JSON.stringify({
        canTrade: false,
        accountType: 'SPOT',
        balances: [],
        permissions: ['SPOT'],
      }),
    });
    const result = await verifyMexcPrivateAccountRead({
      apiKey: FAKE_KEY,
      apiSecret: FAKE_SECRET,
      now: () => 1644489390087,
      transport,
    });
    expect(result.authenticated).toBe(true);
    expect(result.accountReadPermission).toBe('verified');
    expect(result.tradingPermission).toBe('denied');
    expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
    expect(JSON.stringify(result)).not.toContain('signature=');
  });

  test('maps fake official-style error responses', async () => {
    const scenarios = [
      { code: 700001, expect: MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID },
      { code: 700002, expect: MEXC_AUTH_ERROR.MEXC_SIGNATURE_INVALID },
      { code: 700003, expect: MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID },
      { code: 700007, expect: MEXC_AUTH_ERROR.MEXC_PERMISSION_INSUFFICIENT },
      { code: 700006, expect: MEXC_AUTH_ERROR.MEXC_IP_RESTRICTED },
    ];
    for (const sc of scenarios) {
      const transport = async () => ({
        status: 400,
        headers: {},
        bodyText: JSON.stringify({ code: sc.code, msg: 'RAW SENSITIVE SHOULD NOT LEAK' }),
      });
      const result = await verifyMexcPrivateAccountRead({
        apiKey: FAKE_KEY,
        apiSecret: FAKE_SECRET,
        now: () => 1644489390087,
        transport,
      });
      expect(result.normalizedErrorCode).toBe(sc.expect);
      expect(JSON.stringify(result)).not.toContain('RAW SENSITIVE');
      expect(result.authenticated).toBe(false);
    }
  });

  test('rate limit unavailable timeout network malformed', async () => {
    let r = await verifyMexcPrivateAccountRead({
      apiKey: FAKE_KEY,
      apiSecret: FAKE_SECRET,
      now: () => 1,
      transport: async () => ({ status: 429, headers: {}, bodyText: '{}' }),
    });
    expect(r.normalizedErrorCode).toBe(MEXC_AUTH_ERROR.MEXC_RATE_LIMITED);

    r = await verifyMexcPrivateAccountRead({
      apiKey: FAKE_KEY,
      apiSecret: FAKE_SECRET,
      now: () => 1,
      transport: async () => ({ status: 503, headers: {}, bodyText: '{}' }),
    });
    expect(r.normalizedErrorCode).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);

    r = await verifyMexcPrivateAccountRead({
      apiKey: FAKE_KEY,
      apiSecret: FAKE_SECRET,
      now: () => 1,
      transport: async () => {
        const err = new MexcTransportError('MEXC_TIMEOUT', 't');
        throw err;
      },
    });
    expect(r.normalizedErrorCode).toBe(MEXC_AUTH_ERROR.MEXC_TIMEOUT);
    expect(r.retryable).toBe(true);

    r = await verifyMexcPrivateAccountRead({
      apiKey: FAKE_KEY,
      apiSecret: FAKE_SECRET,
      now: () => 1,
      transport: async () => ({ status: 200, headers: {}, bodyText: 'not-json' }),
    });
    expect(r.normalizedErrorCode).toBe(MEXC_AUTH_ERROR.MEXC_RESPONSE_INVALID);
  });

  test('no retry on credential error — transport called once', async () => {
    let calls = 0;
    const transport = async () => {
      calls += 1;
      return { status: 401, headers: {}, bodyText: JSON.stringify({ code: 700001 }) };
    };
    await verifyMexcPrivateAccountRead({
      apiKey: FAKE_KEY,
      apiSecret: FAKE_SECRET,
      now: () => 1,
      transport,
    });
    expect(calls).toBe(1);
  });

  test('redactForLogs strips signature and secrets', () => {
    const red = redactForLogs({
      url: 'https://api.mexc.com/api/v3/account?signature=abc123',
      apiSecret: 'secret',
      apiKey: 'key',
    });
    expect(red).not.toContain('abc123');
    expect(red).toContain('REDACTED');
  });
});

describe('WP2A verification service persistence separation', () => {
  beforeEach(() => {
    query.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();
  });

  function mockConfiguredRow() {
    const encKey = encryptSecret(FAKE_KEY);
    const encSecret = encryptSecret(FAKE_SECRET);
    const connectionRow = {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: 'user-1',
      exchange: 'MEXC',
      api_key: encKey,
      api_secret: encSecret,
      is_active: false,
      is_testnet: false,
      metadata: {
        encryptionVersion: 1,
        credentialStatus: 'configured_unverified',
        keyHint: '***_use',
        privateAuthVerified: false,
      },
      permissions: [],
      account_info: {},
    };
    query.mockImplementation(async (sql) => {
      const text = String(sql || '');
      if (text.includes('mexc_connection_capability_state')) {
        return { rows: [] };
      }
      if (text.includes('FROM exchange_connections') && text.includes('api_secret') && text.includes('account_info')) {
        return { rows: [connectionRow] };
      }
      if (text.includes('FROM exchange_connections') && text.includes('api_secret')) {
        return {
          rows: [{
            id: connectionRow.id,
            user_id: connectionRow.user_id,
            exchange: 'MEXC',
            api_key: encKey,
            api_secret: encSecret,
            is_active: false,
            metadata: { credentialStatus: 'configured_unverified' },
          }],
        };
      }
      return { rows: [] };
    });
  }

  test('live gate blocks without decrypt when CONNECTIONS_PRIVATE_VERIFY_LIVE unset', async () => {
    query.mockResolvedValue({ rows: [] });
    const result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: false,
      persist: false,
    });
    expect(result.body.code).toBe(MEXC_AUTH_ERROR.CONNECTION_PRIVATE_VERIFY_NOT_LIVE);
    expect(result.body.persisted).toBe(false);
  });

  test('successful fake private read proposes authenticated without persistence', async () => {
    mockConfiguredRow();
    const transport = async () => ({
      status: 200,
      headers: {},
      bodyText: JSON.stringify({ canTrade: true, balances: [], accountType: 'SPOT' }),
    });
    const result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport,
      now: () => 1644489390087,
    });
    expect(result.body.authenticated).toBe(true);
    expect(result.body.proposedTransition.proposedStatus).toBe('authenticated');
    expect(result.body.tradingPermission).toBe('verified');
    expect(result.body.persisted).toBe(false);
    expect(result.body.isConnected).toBe(false);
    expect(result.body.privateAuthVerified).toBe(false);
  });

  test('read-only canTrade false does not assert trading permission', async () => {
    mockConfiguredRow();
    const result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport: async () => ({
        status: 200,
        headers: {},
        bodyText: JSON.stringify({ canTrade: false, balances: [], accountType: 'SPOT' }),
      }),
      now: () => 1,
    });
    expect(result.body.authenticated).toBe(true);
    expect(result.body.tradingPermission).toBe('denied');
  });

  test('invalid credentials propose failed; permission limited; unavailable does not revoke', async () => {
    mockConfiguredRow();
    let result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport: async () => ({
        status: 400,
        headers: {},
        bodyText: JSON.stringify({ code: 700001 }),
      }),
      now: () => 1,
    });
    expect(result.body.proposedTransition.proposedStatus).toBe('failed');
    expect(result.body.proposedTransition.revokeCredentials).toBe(false);

    mockConfiguredRow();
    result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport: async () => ({
        status: 400,
        headers: {},
        bodyText: JSON.stringify({ code: 700007 }),
      }),
      now: () => 1,
    });
    expect(result.body.proposedTransition.proposedStatus).toBe('permission_limited');

    mockConfiguredRow();
    result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport: async () => ({ status: 503, headers: {}, bodyText: '{}' }),
      now: () => 1,
    });
    expect(result.body.proposedTransition.proposedStatus).toBe('verification_inconclusive');
    expect(result.body.proposedTransition.revokeCredentials).toBe(false);
  });

  test('timestamp error proposes failed with corrective action; timeout retryable', async () => {
    mockConfiguredRow();
    let result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport: async () => ({
        status: 400,
        headers: {},
        bodyText: JSON.stringify({ code: 700003 }),
      }),
      now: () => 1,
    });
    expect(result.body.code).toBe(MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID);
    expect(result.body.correctiveAction).toMatch(/clock/i);

    mockConfiguredRow();
    result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      transport: async () => {
        throw new MexcTransportError('MEXC_TIMEOUT', 't');
      },
      now: () => 1,
    });
    expect(result.body.retryable).toBe(true);
  });

  test('persist=false never calls persistFn; persist with fake updates then rollback on failure', async () => {
    mockConfiguredRow();
    const persistFn = jest.fn().mockResolvedValue(undefined);
    let result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: false,
      persistFn,
      transport: async () => ({
        status: 200,
        headers: {},
        bodyText: JSON.stringify({ canTrade: true, balances: [] }),
      }),
      now: () => 1,
    });
    expect(persistFn).not.toHaveBeenCalled();
    expect(result.body.persisted).toBe(false);

    mockConfiguredRow();
    persistFn.mockRejectedValueOnce(new Error('db fail'));
    result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
      persist: true,
      persistFn,
      transport: async () => ({
        status: 200,
        headers: {},
        bodyText: JSON.stringify({ canTrade: true, balances: [] }),
      }),
      now: () => 1,
    });
    expect(persistFn).toHaveBeenCalled();
    expect(result.body.persisted).toBe(false);
  });

  test('unsupported provider and not configured fail closed', async () => {
    let result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      provider: 'Binance',
      allowProviderCall: true,
    });
    expect(result.body.code).toBe(MEXC_AUTH_ERROR.CONNECTION_PROVIDER_UNSUPPORTED);

    query.mockResolvedValueOnce({ rows: [] }); // getConnection empty
    result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
    });
    expect(result.body.code).toBe(MEXC_AUTH_ERROR.CONNECTION_NOT_CONFIGURED);
  });

  test('disabled metadata fails closed', async () => {
    const encKey = encryptSecret(FAKE_KEY);
    const encSecret = encryptSecret(FAKE_SECRET);
    const connectionRow = {
      id: '11111111-1111-1111-1111-111111111111',
      exchange: 'MEXC',
      api_key: encKey,
      api_secret: encSecret,
      is_active: false,
      is_testnet: false,
      metadata: { credentialStatus: 'configured_unverified', disabled: true, keyHint: '***' },
      permissions: [],
      account_info: {},
    };
    query.mockImplementation(async (sql) => {
      const text = String(sql || '');
      if (text.includes('mexc_connection_capability_state')) {
        return { rows: [] };
      }
      if (text.includes('FROM exchange_connections') && text.includes('account_info')) {
        return { rows: [connectionRow] };
      }
      if (text.includes('FROM exchange_connections')) {
        return {
          rows: [{
            id: connectionRow.id,
            api_key: encKey,
            api_secret: encSecret,
            metadata: { disabled: true },
          }],
        };
      }
      return { rows: [] };
    });
    const result = await verifyOwnedMexcConnection({
      userId: 'user-1',
      allowProviderCall: true,
    });
    expect(result.body.code).toBe(MEXC_AUTH_ERROR.CONNECTION_DISABLED);
  });
});
