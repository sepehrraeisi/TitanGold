/**
 * CONNECTIONS-WP1A — exchangeConnectionService unit tests
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const query = jest.fn();
jest.unstable_mockModule('../../database/db.js', () => ({ query }));
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { CONNECTION_ERROR, CREDENTIAL_STATUS } = await import('../../services/connectionErrors.js');
const {
  toSafeConnectionDto,
  upsertEncryptedConnection,
  listConnectionsForUser,
  assertSupportedWriteProvider,
  ConnectionServiceError,
} = await import('../../services/exchangeConnectionService.js');

describe('exchangeConnectionService WP1A', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('unsupported provider fails closed', () => {
    expect(() => assertSupportedWriteProvider('Binance')).toThrow(ConnectionServiceError);
    try {
      assertSupportedWriteProvider('Binance');
    } catch (e) {
      expect(e.code).toBe(CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED);
    }
  });

  test('safe DTO never includes secrets or ciphertext', () => {
    const dto = toSafeConnectionDto({
      id: '11111111-1111-1111-1111-111111111111',
      exchange: 'MEXC',
      api_key: 'aabb:ccdd:eeff',
      api_secret: '1122:3344:5566',
      is_active: true,
      is_testnet: false,
      metadata: {
        encryptionVersion: 1,
        credentialStatus: 'configured_unverified',
        keyHint: '***ABCD',
      },
      permissions: ['spot', 'trading'],
      account_info: { currencies: ['USDT'] },
    });

    const json = JSON.stringify(dto);
    expect(json).not.toContain('aabb:ccdd:eeff');
    expect(json).not.toContain('1122:3344:5566');
    expect(dto.isConnected).toBe(false);
    expect(dto.privateAuthVerified).toBe(false);
    expect(dto.configured).toBe(true);
    expect(dto.maskedKeyIdentifier).toBe('***ABCD');
    expect(dto.permissions).toEqual([]);
  });

  test('plaintext legacy row requires re-entry and is not connected', () => {
    const dto = toSafeConnectionDto({
      id: '11111111-1111-1111-1111-111111111111',
      exchange: 'MEXC',
      api_key: 'plaintext-api-key-value',
      api_secret: 'plaintext-secret-value-long',
      is_active: true,
      metadata: {},
    });
    expect(dto.secretReentryRequired).toBe(true);
    expect(dto.configured).toBe(false);
    expect(dto.isConnected).toBe(false);
    expect(dto.credentialStatus).toBe(CREDENTIAL_STATUS.SECRET_REENTRY_REQUIRED);
    expect(JSON.stringify(dto)).not.toContain('plaintext-api-key-value');
    expect(JSON.stringify(dto)).not.toContain('plaintext-secret-value-long');
  });

  test('upsert encrypts and stores inactive unverified connection', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: '22222222-2222-2222-2222-222222222222',
          user_id: 'user-1',
          exchange: 'MEXC',
          api_key: 'aa:bb:cc',
          api_secret: 'dd:ee:ff',
          is_active: false,
          is_testnet: false,
          metadata: {
            encryptionVersion: 1,
            credentialStatus: 'configured_unverified',
            keyHint: '***KEY1',
            privateAuthVerified: false,
          },
          permissions: [],
          account_info: {},
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const dto = await upsertEncryptedConnection({
      userId: 'user-1',
      provider: 'MEXC',
      apiKey: 'TESTAPIKEY123456',
      apiSecret: 'TESTSECRETKEY1234567890123456789012',
    });

    const insertCall = query.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT INTO exchange_connections/);
    expect(insertCall[1][2]).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    expect(insertCall[1][3]).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    expect(insertCall[1][2]).not.toBe('TESTAPIKEY123456');
    expect(dto.isConnected).toBe(false);
    expect(dto.configured).toBe(true);
  });

  test('list returns placeholders for missing providers without secrets', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const list = await listConnectionsForUser('user-1');
    expect(list).toHaveLength(5);
    expect(list.every((c) => c.isConnected === false)).toBe(true);
  });
});
