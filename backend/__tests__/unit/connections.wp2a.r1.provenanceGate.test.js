/**
 * CONNECTIONS-WP2A — deployment-injected runtime provenance + gate safety
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

describe('WP2A deployment-injected runtime provenance', () => {
  beforeEach(() => {
    resetRuntimeProvenanceCache();
  });

  test('deployment-injected TITAN_RUNTIME_COMMIT is reported', () => {
    const result = resolveRuntimeProvenance(
      { TITAN_RUNTIME_COMMIT: 'abcdef1' },
      { manifestPaths: [] },
    );
    expect(result.commit).toBe('abcdef1');
    expect(result.source).toBe('env:TITAN_RUNTIME_COMMIT');
    expect(result.verified).toBe(true);
  });

  test('both workers reading the same manifest receive the same value', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-prov-'));
    const manifestPath = path.join(dir, 'runtime-provenance.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        implementationCommit: '111aaaa',
        deployedAt: '2026-07-19T12:00:00Z',
        environment: 'staging',
        sourcePath: dir,
      }),
    );

    const workerA = resolveRuntimeProvenance({}, { manifestPaths: [manifestPath] });
    const workerB = resolveRuntimeProvenance({}, { manifestPaths: [manifestPath] });
    expect(workerA.commit).toBe('111aaaa');
    expect(workerB.commit).toBe(workerA.commit);
    expect(workerA.source).toContain('manifest:');
    expect(workerA.deployedAt).toBe('2026-07-19T12:00:00Z');
    expect(workerA.verified).toBe(true);
  });

  test('documentation-only repository HEAD does not override implementation marker', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-prov-'));
    const manifestPath = path.join(dir, 'runtime-provenance.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ implementationCommit: '864f95e', deployedAt: '2026-07-19T10:00:00Z' }),
    );
    // Docs HEAD would be something like e54a81e — must not win over trusted marker.
    const result = resolveRuntimeProvenance(
      { /* no TITAN_RUNTIME_COMMIT */ },
      { manifestPaths: [manifestPath] },
    );
    expect(result.commit).toBe('864f95e');
    expect(result.commit).not.toBe('e54a81e');
    expect(result.source).toMatch(/^manifest:/);
  });

  test('a new injected backend implementation commit replaces the previous marker', () => {
    expect(
      resolveRuntimeProvenance({ TITAN_RUNTIME_COMMIT: 'aaaaaaa' }, { manifestPaths: [] }).commit,
    ).toBe('aaaaaaa');
    expect(
      resolveRuntimeProvenance({ TITAN_RUNTIME_COMMIT: 'bbbbbbb' }, { manifestPaths: [] }).commit,
    ).toBe('bbbbbbb');
  });

  test('tracked ecosystem must not be required — missing trusted provenance is unknown', () => {
    const result = resolveRuntimeProvenance({}, { manifestPaths: ['/tmp/does-not-exist.json'] });
    expect(result.commit).toBe('unknown');
    expect(result.source).toBe('unverified');
    expect(result.verified).toBe(false);
  });

  test('rejects non-sha env values and does not invent a git commit', () => {
    const result = resolveRuntimeProvenance(
      { TITAN_RUNTIME_COMMIT: 'sk-live-not-a-sha' },
      { manifestPaths: [] },
    );
    expect(result.commit).toBe('unknown');
    expect(result.source).toBe('unverified');
  });

  test('ambient GIT_COMMIT / GIT_SHA are not trusted as deployed implementation', () => {
    const result = resolveRuntimeProvenance(
      { GIT_COMMIT: 'deadbee', GIT_SHA: 'cafebabe' },
      { manifestPaths: [] },
    );
    expect(result.commit).toBe('unknown');
    expect(result.source).toBe('unverified');
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

  test('no literal 864f95e remains as permanent tracked ecosystem configuration', () => {
    const ecosystem = fs.readFileSync(
      path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../ecosystem.config.json'),
      'utf8',
    );
    expect(ecosystem).not.toMatch(/864f95e/);
    expect(ecosystem).not.toMatch(/TITAN_RUNTIME_COMMIT/);
  });
});

describe('WP2A live-gate terminates before decrypt/sign/transport/persist', () => {
  beforeEach(() => {
    query.mockReset();
    decryptSecretMock.mockReset();
    transportMock.mockReset();
    persistMock.mockReset();
    delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;
  });

  test('default-off gate: decrypt/sign/transport/persist call counts are zero', async () => {
    decryptSecretMock.mockImplementation(() => {
      throw new Error('decrypt must not run');
    });
    transportMock.mockImplementation(() => {
      throw new Error('transport must not run');
    });
    persistMock.mockImplementation(() => {
      throw new Error('persist must not run');
    });
    query.mockResolvedValue({ rows: [] });

    const result = await verifyOwnedMexcConnection({
      userId: 'user-gate-1',
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
    expect(JSON.stringify(result.body)).not.toMatch(/apiSecret|signature|sk-|ciphertext/i);
    expect(decryptSecretMock).toHaveBeenCalledTimes(0);
    expect(transportMock).toHaveBeenCalledTimes(0);
    expect(persistMock).toHaveBeenCalledTimes(0);
  });
});

describe('WP2A official error mapping + signing redaction', () => {
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
      expect(JSON.stringify(sanitized)).not.toMatch(/apiSecret|signature=/i);
    }
    expect(mapMexcProviderFailure({ httpStatus: 429 })).toBe(MEXC_AUTH_ERROR.MEXC_RATE_LIMITED);
    expect(mapMexcProviderFailure({ httpStatus: 500 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
    expect(mapMexcProviderFailure({ httpStatus: 503 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
    expect(mapMexcProviderFailure({ httpStatus: 504 })).toBe(MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE);
  });

  test('signing remains deterministic', () => {
    const a = buildSignedAccountQuery({
      secret: 'fake-secret-do-not-use',
      timestamp: 1644489390087,
      recvWindow: 5000,
    });
    const b = buildSignedAccountQuery({
      secret: 'fake-secret-do-not-use',
      timestamp: 1644489390087,
      recvWindow: 5000,
    });
    expect(a.signature).toBe(b.signature);
    expect(a.signature).toMatch(/^[0-9a-f]+$/);
  });
});
