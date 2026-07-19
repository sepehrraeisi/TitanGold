/**
 * CONNECTIONS-WP2A-R1 — runtime provenance + live-gate call-count safety
 */

import { jest } from '@jest/globals';

const query = jest.fn();
jest.unstable_mockModule('../../database/db.js', () => ({
  query,
  getClient: jest.fn(),
}));

const decryptSecretMock = jest.fn();
jest.unstable_mockModule('../../utils/crypto.js', () => ({
  encryptSecret: jest.fn((v) => `enc:${v}`),
  decryptSecret: decryptSecretMock,
  isEncrypted: jest.fn(() => true),
  maskSecret: jest.fn(() => '***'),
}));

const signMock = jest.fn();
const transportMock = jest.fn();
const persistMock = jest.fn();

const {
  resolveRuntimeProvenance,
  getRuntimeProvenance,
  resetRuntimeProvenanceCache,
} = await import('../../utils/runtimeProvenance.js');

const { verifyOwnedMexcConnection } = await import(
  '../../services/connections/connectionPrivateVerificationService.js'
);
const { MEXC_AUTH_ERROR, mapMexcProviderFailure, buildSanitizedErrorResult } = await import(
  '../../services/connections/mexcErrorCatalog.js'
);
const { buildSignedAccountQuery } = await import(
  '../../services/connections/providers/mexcSigning.js'
);

describe('WP2A-R1 runtime provenance', () => {
  beforeEach(() => {
    resetRuntimeProvenanceCache();
  });

  test('prefers TITAN_RUNTIME_COMMIT over git lookup', () => {
    const gitShortHeadFn = jest.fn(() => 'deadbeef');
    const result = resolveRuntimeProvenance(
      { TITAN_RUNTIME_COMMIT: '864f95eabcdef0123456789abcdef0123456789a' },
      { gitShortHeadFn, roots: ['/tmp/fake-repo'] },
    );
    expect(result.commit).toBe('864f95e');
    expect(result.source).toBe('env:TITAN_RUNTIME_COMMIT');
    expect(gitShortHeadFn).not.toHaveBeenCalled();
  });

  test('falls back to GIT_COMMIT then GIT_SHA', () => {
    expect(
      resolveRuntimeProvenance({ GIT_COMMIT: '8d320d8' }, { gitShortHeadFn: jest.fn(), roots: [] }).commit,
    ).toBe('8d320d8');
    expect(
      resolveRuntimeProvenance({ GIT_SHA: 'a17ef46' }, { gitShortHeadFn: jest.fn(), roots: [] }).source,
    ).toBe('env:GIT_SHA');
  });

  test('rejects non-sha env values (no secret leakage into commit)', () => {
    const result = resolveRuntimeProvenance(
      { TITAN_RUNTIME_COMMIT: 'sk-live-not-a-sha' },
      { gitShortHeadFn: () => 'abc1234', roots: ['/repo'] },
    );
    expect(result.commit).toBe('abc1234');
    expect(result.source).toBe('git:/repo');
  });

  test('uses git short HEAD when env absent', () => {
    const result = resolveRuntimeProvenance(
      {},
      { gitShortHeadFn: () => '67222cc', roots: ['/home/ubuntu/webapp/TitanGold'] },
    );
    expect(result).toEqual({
      commit: '67222cc',
      fullCommit: null,
      source: 'git:/home/ubuntu/webapp/TitanGold',
    });
  });

  test('cache returns stable value until reset', () => {
    resetRuntimeProvenanceCache();
    const a = getRuntimeProvenance({ TITAN_RUNTIME_COMMIT: '1111111' });
    const b = getRuntimeProvenance({ TITAN_RUNTIME_COMMIT: '2222222' });
    expect(a.commit).toBe('1111111');
    expect(b.commit).toBe('1111111');
    resetRuntimeProvenanceCache();
    const c = getRuntimeProvenance({ TITAN_RUNTIME_COMMIT: '2222222' });
    expect(c.commit).toBe('2222222');
  });
});

describe('WP2A-R1 live-gate terminates before decrypt/sign/transport/persist', () => {
  beforeEach(() => {
    query.mockReset();
    decryptSecretMock.mockReset();
    signMock.mockReset();
    transportMock.mockReset();
    persistMock.mockReset();
    delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;
  });

  test('default-off gate: decrypt/sign/transport/persist call counts are zero', async () => {
    // If gate failed open, these would be hit; keep them throwing to fail loudly.
    decryptSecretMock.mockImplementation(() => {
      throw new Error('decrypt must not run');
    });
    transportMock.mockImplementation(() => {
      throw new Error('transport must not run');
    });
    persistMock.mockImplementation(() => {
      throw new Error('persist must not run');
    });

    // Audit insert may run; keep it safe and secret-free.
    query.mockResolvedValue({ rows: [] });

    const result = await verifyOwnedMexcConnection({
      userId: 'user-gate-1',
      // omit allowProviderCall → uses isPrivateVerifyLiveEnabled() → false
      persist: true,
      persistFn: persistMock,
      transport: transportMock,
      now: () => {
        throw new Error('clock must not run for signing');
      },
    });

    expect(result.httpStatus).toBe(503);
    expect(result.body.code).toBe(MEXC_AUTH_ERROR.CONNECTION_PRIVATE_VERIFY_NOT_LIVE);
    expect(result.body.persisted).toBe(false);
    expect(result.body.authenticated).toBe(false);
    expect(result.body.privateAuthVerified).toBe(false);
    expect(JSON.stringify(result.body)).not.toMatch(/apiSecret|signature|sk-|ciphertext/i);

    expect(decryptSecretMock).toHaveBeenCalledTimes(0);
    expect(transportMock).toHaveBeenCalledTimes(0);
    expect(persistMock).toHaveBeenCalledTimes(0);

    // Audit metadata must not contain secrets (only reason code).
    const auditCalls = query.mock.calls.filter((c) => String(c[0]).includes('audit_logs'));
    for (const call of auditCalls) {
      expect(JSON.stringify(call)).not.toMatch(/apiSecret|signature|FAKESECRET|ciphertext/i);
    }
  });

  test('explicit allowProviderCall false never decrypts even if LIVE env is true', async () => {
    process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE = 'true';
    decryptSecretMock.mockImplementation(() => {
      throw new Error('decrypt must not run');
    });
    query.mockResolvedValue({ rows: [] });

    const result = await verifyOwnedMexcConnection({
      userId: 'user-gate-2',
      allowProviderCall: false,
      persist: false,
      transport: transportMock,
      persistFn: persistMock,
    });

    expect(result.body.code).toBe(MEXC_AUTH_ERROR.CONNECTION_PRIVATE_VERIFY_NOT_LIVE);
    expect(decryptSecretMock).toHaveBeenCalledTimes(0);
    expect(transportMock).toHaveBeenCalledTimes(0);
    expect(persistMock).toHaveBeenCalledTimes(0);
    delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;
  });
});

describe('WP2A-R1 official error mapping completeness', () => {
  test('maps required provider and HTTP codes', () => {
    const cases = [
      [700001, MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID],
      [700002, MEXC_AUTH_ERROR.MEXC_SIGNATURE_INVALID],
      [700003, MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID],
      [700005, MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID],
      [700006, MEXC_AUTH_ERROR.MEXC_IP_RESTRICTED],
      [700007, MEXC_AUTH_ERROR.MEXC_PERMISSION_INSUFFICIENT],
    ];
    for (const [code, expected] of cases) {
      const mapped = mapMexcProviderFailure({ providerCode: code, httpStatus: 400 });
      expect(mapped).toBe(expected);
      const sanitized = buildSanitizedErrorResult(mapped, { providerCode: code });
      expect(sanitized.sanitizedMessage).toBeTruthy();
      expect(JSON.stringify(sanitized)).not.toMatch(/apiSecret|signature=/i);
    }

    expect(mapMexcProviderFailure({ httpStatus: 429 })).toBe(MEXC_AUTH_ERROR.MEXC_RATE_LIMITED);
    expect(mapMexcProviderFailure({ httpStatus: 500 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
    expect(mapMexcProviderFailure({ httpStatus: 503 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
    expect(mapMexcProviderFailure({ httpStatus: 504 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
  });

  test('signing remains deterministic and does not mutate secret', () => {
    const secret = 'fake-secret-do-not-use';
    const a = buildSignedAccountQuery({
      secret,
      timestamp: 1644489390087,
      recvWindow: 5000,
    });
    const b = buildSignedAccountQuery({
      secret,
      timestamp: 1644489390087,
      recvWindow: 5000,
    });
    expect(a.signature).toBe(b.signature);
    expect(a.signature).toMatch(/^[0-9a-f]+$/);
    expect(a.totalParams).toContain('recvWindow=5000');
    expect(a.totalParams).toContain('timestamp=1644489390087');
  });
});
