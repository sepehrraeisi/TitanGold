/**
 * MEXC Wallet currency config response contract and correction tests.
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const query = jest.fn(async () => ({ rows: [] }));
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.unstable_mockModule('../../database/db.js', () => ({
  query,
}));
jest.unstable_mockModule('../../services/logger.js', () => ({ logger }));

process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;
delete process.env.CONNECTIONS_CAPABILITY_VERIFY_LIVE;

const {
  parseWalletCurrencyConfigResponse,
  WalletCurrencyConfigContractError,
  WALLET_CURRENCY_ERROR,
  WALLET_CURRENCY_RESPONSE_MAX_BYTES,
} = await import('../../services/connections/mexc/walletCurrencyConfigContract.js');
const {
  mexcE2ESafeFetch,
  MexcE2ETransportError,
} = await import('../../services/connections/mexc/mexcE2ESafeTransport.js');
const {
  runMexcVerificationOrchestrator,
} = await import('../../services/connections/mexc/verificationOrchestrator.js');
const {
  applyWalletCurrencyVerificationCorrection,
  WALLET_CONTRACT_REMEDIATION_CODE,
  WALLET_CONTRACT_REMEDIATION_REASON,
} = await import('../../services/connections/mexc/verificationCorrectionService.js');
const { buildCapabilityMatrix } = await import('../../services/connections/mexc/capabilityMatrix.js');
const { encryptSecret } = await import('../../utils/crypto.js');

const FAKE_KEY = 'FAKEKEY_mexc_do_not_use';
const FAKE_SECRET = 'FAKESECRET_mexc_do_not_use_0123456789abcdef';

function buildWalletItem(overrides = {}) {
  return {
    coin: 'USDT',
    name: 'Tether',
    networkList: [
      {
        network: 'ERC20',
        name: 'Ethereum',
        depositEnable: true,
        withdrawEnable: true,
        minConfirm: 12,
        withdrawFee: 1,
        withdrawMin: 10,
        withdrawMax: 100000,
        contract: null,
        depositTips: null,
        withdrawTips: null,
      },
    ],
    ...overrides,
  };
}

function makeWalletResponse(items, headers = {}) {
  const bodyText = typeof items === 'string' ? items : JSON.stringify(items);
  return {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    bodyText,
    transportMeta: {
      bodyBytes: Buffer.byteLength(bodyText, 'utf8'),
      truncated: false,
      latencyMs: 15,
    },
  };
}

describe('Wallet currency config contract', () => {
  test('accepts small valid official-style array', () => {
    const parsed = parseWalletCurrencyConfigResponse(makeWalletResponse([buildWalletItem()]));
    expect(parsed.providerAvailability).toBe('available');
    expect(parsed.itemCountCategory).toBe('1_to_9');
    expect(parsed.safe.topLevelType).toBe('array');
  });

  test('accepts empty valid array', () => {
    const parsed = parseWalletCurrencyConfigResponse(makeWalletResponse([]));
    expect(parsed.itemCountCategory).toBe('zero');
  });

  test('accepts documented field variants and null optional fields', () => {
    const parsed = parseWalletCurrencyConfigResponse(makeWalletResponse([
      buildWalletItem({
        Name: 'Tether Alt',
        name: null,
        networkList: [
          {
            Name: 'Ethereum Alt',
            netWork: 'ERC20',
            depositEnable: true,
            withdrawEnable: null,
            minConfirm: null,
            withdrawFee: 1,
            withdrawMin: null,
            withdrawMax: null,
            contract: null,
            depositTips: null,
            withdrawTips: null,
          },
        ],
      }),
    ]));
    expect(parsed.safe.topLevelType).toBe('array');
  });

  test('accepts missing optional fields', () => {
    const parsed = parseWalletCurrencyConfigResponse(makeWalletResponse([
      { coin: 'BTC', networkList: [{ network: 'BTC' }] },
    ]));
    expect(parsed.itemCountCategory).toBe('1_to_9');
  });

  test('large valid array above legacy 64KiB remains valid under endpoint-specific contract', () => {
    const items = Array.from({ length: 320 }, (_, i) => buildWalletItem({ coin: `C${i}` }));
    const bodyText = JSON.stringify(items);
    expect(Buffer.byteLength(bodyText, 'utf8')).toBeGreaterThan(64 * 1024);
    const parsed = parseWalletCurrencyConfigResponse({
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText,
      transportMeta: { bodyBytes: Buffer.byteLength(bodyText, 'utf8'), truncated: false },
    });
    expect(parsed.safe.bodyByteCategory).toBe('64KiB_to_256KiB');
    expect(parsed.safe.itemCountCategory).toBe('100_plus');
  });

  test('near-limit valid response is accepted by bounded transport', async () => {
    const chunk = JSON.stringify(Array.from({ length: 900 }, (_, i) => buildWalletItem({ coin: `N${i}` })));
    const bytes = Buffer.byteLength(chunk, 'utf8');
    expect(bytes).toBeLessThan(WALLET_CURRENCY_RESPONSE_MAX_BYTES);
    const res = await mexcE2ESafeFetch({
      url: 'https://api.mexc.com/api/v3/capital/config/getall?timestamp=1&recvWindow=5000&signature=x',
      maxBytes: WALLET_CURRENCY_RESPONSE_MAX_BYTES,
      fetchImpl: async () => new Response(chunk, { status: 200, headers: { 'content-type': 'application/json' } }),
    });
    expect(res.bodyBytes).toBe(bytes);
    expect(res.bodyByteCategory === '256KiB_to_1MiB' || res.bodyByteCategory === '64KiB_to_256KiB').toBe(true);
  });

  test('response exceeding endpoint-specific maximum is aborted safely', async () => {
    const oversized = JSON.stringify(Array.from({ length: 4200 }, (_, i) => buildWalletItem({ coin: `X${i}` })));
    expect(Buffer.byteLength(oversized, 'utf8')).toBeGreaterThan(WALLET_CURRENCY_RESPONSE_MAX_BYTES);
    await expect(mexcE2ESafeFetch({
      url: 'https://api.mexc.com/api/v3/capital/config/getall?timestamp=1&recvWindow=5000&signature=x',
      maxBytes: WALLET_CURRENCY_RESPONSE_MAX_BYTES,
      fetchImpl: async () => new Response(oversized, { status: 200, headers: { 'content-type': 'application/json' } }),
    })).rejects.toMatchObject({ code: 'MEXC_RESPONSE_TOO_LARGE' });
  });

  test('rejects malformed item', () => {
    expect(() => parseWalletCurrencyConfigResponse(makeWalletResponse([{ networkList: [] }]))).toThrow(
      WalletCurrencyConfigContractError,
    );
    try {
      parseWalletCurrencyConfigResponse(makeWalletResponse([{ networkList: [] }]));
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.ITEM_INVALID);
      expect(err.safe.schemaPath).toBe('[0].coin');
    }
  });

  test('rejects malformed networkList item', () => {
    try {
      parseWalletCurrencyConfigResponse(makeWalletResponse([{ coin: 'USDT', networkList: ['bad'] }]));
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID);
      expect(err.safe.validationFailure).toBe('networkList.item_not_object');
    }
  });

  test('rejects provider error object as successful list', () => {
    try {
      parseWalletCurrencyConfigResponse(makeWalletResponse({ code: 700007, msg: 'denied' }));
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.PROVIDER_ERROR);
      expect(err.safe.providerCode).toBe(700007);
      expect(err.safe.topLevelType).toBe('object');
    }
  });

  test('rejects HTML body', () => {
    expect(() => parseWalletCurrencyConfigResponse({
      status: 200,
      headers: { 'content-type': 'text/html' },
      bodyText: '<html><body>blocked</body></html>',
      transportMeta: { bodyBytes: 32 },
    })).toThrow(WalletCurrencyConfigContractError);
  });

  test('rejects invalid JSON', () => {
    try {
      parseWalletCurrencyConfigResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: '{"coin"',
        transportMeta: { bodyBytes: 7 },
      });
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.JSON_INVALID);
    }
  });

  test('rejects truncated JSON explicitly', () => {
    try {
      parseWalletCurrencyConfigResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: '[{"coin":"USDT"',
        transportMeta: { bodyBytes: 16, truncated: true },
      });
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.RESPONSE_TRUNCATED);
    }
  });

  test('rejects wrong content type', () => {
    try {
      parseWalletCurrencyConfigResponse({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        bodyText: JSON.stringify([buildWalletItem()]),
        transportMeta: { bodyBytes: 10 },
      });
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.CONTENT_TYPE_INVALID);
    }
  });

  test('unexpected redirect is blocked by transport', async () => {
    await expect(mexcE2ESafeFetch({
      url: 'https://api.mexc.com/api/v3/capital/config/getall?timestamp=1&recvWindow=5000&signature=x',
      maxBytes: WALLET_CURRENCY_RESPONSE_MAX_BYTES,
      fetchImpl: async () => {
        throw new Error('redirect mode is set to error: followed redirect');
      },
    })).rejects.toMatchObject({ code: 'MEXC_REDIRECT_BLOCKED' });
  });
});

describe('Wallet probe orchestration semantics', () => {
  beforeEach(() => {
    query.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();
    logger.info.mockReset();
  });

  test('local schema defect does not become permission denied and stops wallet sequence only', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM exchange_connections')) {
        return {
          rows: [{
            id: 'conn-1',
            user_id: 'user-1',
            exchange: 'MEXC',
            api_key: encryptSecret(FAKE_KEY),
            api_secret: encryptSecret(FAKE_SECRET),
            is_active: true,
            is_testnet: false,
            permissions: [],
            account_info: {},
            metadata: JSON.stringify({
              credentialStatus: 'configured_unverified',
              keyHint: '****USE',
              encryptionVersion: 1,
              mexcProbeSafeSymbol: 'BTCUSDT',
            }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_sync_at: null,
          }],
        };
      }
      return { rows: [] };
    });

    const calls = [];
    const transport = async (request) => {
      calls.push(request.path);
      if (request.path === '/api/v3/account') {
        return { ok: true, status: 200, json: { balances: [], accountType: 'SPOT', canTrade: true }, latencyMs: 10 };
      }
      if (request.path === '/api/v3/capital/config/getall') {
        return {
          ok: true,
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: [{ coin: 'USDT', networkList: { broken: true } }],
          latencyMs: 12,
        };
      }
      return { ok: true, status: 200, json: [], latencyMs: 8 };
    };

    const result = await runMexcVerificationOrchestrator({
      userId: 'user-1',
      scope: 'all_safe',
      persist: false,
      transport,
      probeIds: [
        'private_account',
        'wallet_currency_config',
        'deposit_history',
        'withdraw_history',
        'transfer_history',
        'futures_assets',
      ],
    });

    const wallet = result.body.results.find((r) => r.probeId === 'wallet_currency_config');
    expect(wallet.verificationState).toBe('verification_error');
    expect(wallet.keyGrant).toBe('unknown');
    expect(wallet.code).toBe('MEXC_WALLET_NETWORK_LIST_INVALID');
    expect(wallet.safeResponseEvidence.validationFailure).toBe('networkList.not_array');
    expect(result.body.results.some((r) => r.capabilityId === 'DEPOSIT_HISTORY_READ')).toBe(false);
    expect(result.body.results.some((r) => r.capabilityId === 'FUTURES_ACCOUNT_READ')).toBe(false);
    expect(calls).toEqual(['/api/v3/account', '/api/v3/capital/config/getall']);
    expect(JSON.stringify(result.body)).not.toMatch(/ERC20|0x[a-f0-9]+|withdrawFee|withdrawMin|withdrawMax/);
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/0x|ERC20|withdrawFee/), expect.anything());
  });

  test('futures domain remains not tested for future continuation after wallet correction state', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
        WALLET_CURRENCY_READ: {
          keyGrant: 'unknown',
          verificationState: 'verification_error',
          lastFailureCode: WALLET_CONTRACT_REMEDIATION_CODE,
          sanitizedReason: WALLET_CONTRACT_REMEDIATION_REASON,
        },
      },
    });
    const wallet = matrix.capabilities.find((c) => c.capabilityId === 'WALLET_CURRENCY_READ');
    const futures = matrix.capabilities.find((c) => c.capabilityId === 'FUTURES_ACCOUNT_READ');
    expect(wallet.verificationState).toBe('verification_error');
    expect(wallet.keyGrant).toBe('unknown');
    expect(futures.verificationState).toBe('not_tested');
    expect(futures.keyGrant).toBe('unknown');
  });
});

describe('Append-only correction event', () => {
  beforeEach(() => {
    query.mockReset();
  });

  test('preserves original history row and updates current-state projection', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'evt-1', correlation_id: 'corr-fix-1', tested_at: '2026-07-21T10:00:00.000Z' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await applyWalletCurrencyVerificationCorrection({
      connectionId: 'conn-1',
      ownerId: 'user-1',
      originalCorrelationId: '37aa6d2a-e9eb-4c86-b39f-9b5ed243c014',
      correctionCorrelationId: 'corr-fix-1',
      testedAt: '2026-07-21T10:00:00.000Z',
    });

    expect(result.appended).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.lastFailureCode).toBe('MEXC_VERIFICATION_CONTRACT_ERROR');
    expect(result.supersessionType).toBe('current_projection_correction');
    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[0][0])).toMatch(/SELECT id, correlation_id, tested_at/);
    expect(String(query.mock.calls[1][0])).toMatch(/INSERT INTO mexc_capability_verifications/);
    expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining([
      'WALLET_CURRENCY_READ',
      'wallet_currency_config_correction',
      'corr-fix-1',
      'unknown',
      'verification_error',
      'disabled',
      WALLET_CONTRACT_REMEDIATION_CODE,
      WALLET_CONTRACT_REMEDIATION_REASON,
      'engineering_correction:37aa6d2a-e9eb-4c86-b39f-9b5ed243c014',
    ]));
    expect(String(query.mock.calls[2][0])).toMatch(/INSERT INTO mexc_connection_capability_state/);
  });

  test('rerunning correction is idempotent and does not append a duplicate', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'evt-1', correlation_id: 'corr-fix-1', tested_at: '2026-07-21T10:00:00.000Z' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await applyWalletCurrencyVerificationCorrection({
      connectionId: 'conn-1',
      ownerId: 'user-1',
      originalCorrelationId: '37aa6d2a-e9eb-4c86-b39f-9b5ed243c014',
      correctionCorrelationId: 'corr-fix-2',
    });

    expect(result.appended).toBe(false);
    expect(result.idempotent).toBe(true);
    expect(result.correctionEventId).toBe('evt-1');
    expect(query.mock.calls.some((c) => String(c[0]).includes('INSERT INTO mexc_capability_verifications'))).toBe(false);
    expect(query.mock.calls.some((c) => String(c[0]).includes('INSERT INTO mexc_connection_capability_state'))).toBe(true);
  });
});
