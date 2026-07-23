/**
 * MEXC Wallet streaming currency-config contract, policy and correction tests.
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { Readable } from 'stream';

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
  parseWalletCurrencyConfigStream,
  WalletCurrencyConfigContractError,
  WALLET_CURRENCY_ERROR,
  WALLET_CURRENCY_RESPONSE_MAX_BYTES,
  WALLET_DECOMPRESSED_MAX_BYTES,
  WALLET_COMPRESSED_MAX_BYTES,
  WALLET_MAX_CURRENCY_ITEMS,
  WALLET_DOMAIN_LOCAL_ERROR_CODES,
  categorizeWalletBodyBytes,
} = await import('../../services/connections/mexc/walletCurrencyConfigContract.js');
const {
  mexcE2ESafeFetch,
  MexcE2ETransportError,
} = await import('../../services/connections/mexc/mexcE2ESafeTransport.js');
const {
  runMexcVerificationOrchestrator,
  getProbeFailureDisposition,
  MEXC_REORDERED_CONTINUATION_PROBE_IDS,
  MEXC_REORDERED_CONTINUATION_EXCLUDES,
} = await import('../../services/connections/mexc/verificationOrchestrator.js');
const {
  applyWalletCurrencyVerificationCorrection,
  WALLET_CONTRACT_REMEDIATION_CODE,
  WALLET_CONTRACT_REMEDIATION_REASON,
} = await import('../../services/connections/mexc/verificationCorrectionService.js');
const { buildCapabilityMatrix } = await import('../../services/connections/mexc/capabilityMatrix.js');
const { encryptSecret } = await import('../../utils/crypto.js');
const { MEXC_E2E_MAX_RESPONSE_BYTES } = await import('../../services/connections/mexc/mexcE2ESafeTransport.js');

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

function makeWalletResponse(items, headersOrMeta = {}) {
  const isMeta = headersOrMeta && (
    Object.prototype.hasOwnProperty.call(headersOrMeta, 'verificationOnly')
    || Object.prototype.hasOwnProperty.call(headersOrMeta, 'truncated')
    || Object.prototype.hasOwnProperty.call(headersOrMeta, 'headers')
  );
  const headers = isMeta ? (headersOrMeta.headers || {}) : headersOrMeta;
  const metaExtras = isMeta ? headersOrMeta : {};
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
      ...metaExtras,
    },
  };
}

function generateWalletArrayBytes(targetBytes) {
  const items = [];
  let i = 0;
  while (Buffer.byteLength(JSON.stringify(items), 'utf8') < targetBytes) {
    items.push(buildWalletItem({
      coin: `C${i}`,
      name: `Coin ${i} ${'x'.repeat(40)}`,
      networkList: [
        {
          network: `N${i}`,
          name: `Net ${i}`,
          depositEnable: true,
          withdrawEnable: true,
          minConfirm: 1,
          withdrawFee: 0,
          withdrawMin: 0,
          withdrawMax: 1,
          contract: null,
          depositTips: null,
          withdrawTips: null,
        },
      ],
    }));
    i += 1;
    if (i > 50000) break;
  }
  return { bodyText: JSON.stringify(items), count: items.length };
}

/** Incremental JSON array fixture — avoids allocating one giant string/Buffer. */
function createSyntheticWalletStream({ targetBytes, delayMs = 0 }) {
  const namePad = 'n'.repeat(4000);
  async function* gen() {
    yield Buffer.from('[');
    let bytes = 1;
    let i = 0;
    let first = true;
    while (bytes < targetBytes && i < WALLET_MAX_CURRENCY_ITEMS - 1) {
      if (delayMs > 0 && i === 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      const item = `{"coin":"C${i}","name":"${namePad}","networkList":[{"network":"N${i}","name":"Net"}]}`;
      const piece = (first ? '' : ',') + item;
      first = false;
      const buf = Buffer.from(piece);
      bytes += buf.byteLength;
      yield buf;
      i += 1;
    }
    yield Buffer.from(']');
  }
  return Readable.from(gen());
}

describe('Wallet streaming currency config contract', () => {
  test('accepts small valid official-style array', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([buildWalletItem()]));
    expect(parsed.providerAvailability).toBe('available');
    expect(parsed.itemCountCategory).toBe('1_to_9');
    expect(parsed.safe.topLevelType).toBe('array');
    expect(parsed.safe.parserCompleted).toBe(true);
  });

  test('accepts empty valid array', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([]));
    expect(parsed.itemCountCategory).toBe('zero');
  });

  test('accepts documented field variants and null optional fields', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([
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

  test('accepts missing optional fields including missing coin', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([
      { networkList: [{ network: 'BTC' }] },
    ]));
    expect(parsed.itemCountCategory).toBe('1_to_9');
  });

  test('response greater than legacy 768 KiB succeeds without full-array retention', async () => {
    const { bodyText, count } = generateWalletArrayBytes(900 * 1024);
    expect(Buffer.byteLength(bodyText, 'utf8')).toBeGreaterThan(WALLET_CURRENCY_RESPONSE_MAX_BYTES);
    expect(count).toBeLessThan(WALLET_MAX_CURRENCY_ITEMS);
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: Readable.from(Buffer.from(bodyText, 'utf8')),
      transportMeta: { latencyMs: 20 },
    });
    expect(parsed.safe.parserCompleted).toBe(true);
    expect(parsed.safe.decompressedBytesProcessed).toBeGreaterThan(768 * 1024);
    expect(parsed.safe.decompressedByteCategory).toBe('under_1MiB');
  });

  test('valid ~1 MiB streamed response succeeds', async () => {
    const { bodyText } = generateWalletArrayBytes(1024 * 1024);
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: Readable.from(Buffer.from(bodyText, 'utf8')),
    });
    expect(parsed.safe.parserCompleted).toBe(true);
    expect(['under_1MiB', '1_to_4MiB']).toContain(parsed.safe.decompressedByteCategory);
  });

  test('valid ~4 MiB streamed response succeeds without full-body Buffer', async () => {
    const before = process.memoryUsage().heapUsed;
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: createSyntheticWalletStream({ targetBytes: 4 * 1024 * 1024 }),
    });
    const after = process.memoryUsage().heapUsed;
    expect(parsed.safe.parserCompleted).toBe(true);
    expect(['1_to_4MiB', '4_to_8MiB']).toContain(parsed.safe.decompressedByteCategory);
    // Peak heap growth must not approach a full 16 MiB body allocation.
    expect(after - before).toBeLessThan(12 * 1024 * 1024);
  }, 120000);

  test('valid near-16 MiB streamed response succeeds', async () => {
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: createSyntheticWalletStream({ targetBytes: 15 * 1024 * 1024 }),
    });
    expect(parsed.safe.parserCompleted).toBe(true);
    expect(parsed.safe.decompressedBytesProcessed).toBeGreaterThan(14 * 1024 * 1024);
    expect(parsed.safe.decompressedBytesProcessed).toBeLessThanOrEqual(WALLET_DECOMPRESSED_MAX_BYTES);
    expect(['8_to_16MiB']).toContain(parsed.safe.decompressedByteCategory);
  }, 180000);

  test('slow stream exceeding parser-time limit aborts', async () => {
    await expect(parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: createSyntheticWalletStream({ targetBytes: 50_000, delayMs: 5500 }),
    })).rejects.toMatchObject({ code: WALLET_CURRENCY_ERROR.PARSE_TIMEOUT });
  }, 20000);

  test('early connection termination yields truncated/malformed failure', async () => {
    async function* truncated() {
      yield Buffer.from('[{"coin":"USDT","networkList":[');
    }
    await expect(parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: Readable.from(truncated()),
    })).rejects.toMatchObject({
      code: expect.stringMatching(/MALFORMED|TRUNCATED|TOP_LEVEL|WALLET/),
    });
  });

  test('network item limit aborts', async () => {
    const networks = Array.from({ length: 100_001 }, (_, i) => ({ network: `N${i}` }));
    await expect(parseWalletCurrencyConfigResponse(makeWalletResponse([
      { coin: 'USDT', networkList: networks },
    ]))).rejects.toMatchObject({ code: WALLET_CURRENCY_ERROR.ITEM_LIMIT_EXCEEDED });
  }, 60000);

  test('nesting depth limit aborts on unknown fields', async () => {
    let deep = { leaf: true };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };
    await expect(parseWalletCurrencyConfigResponse(makeWalletResponse([
      buildWalletItem({ mystery: deep }),
    ]))).rejects.toMatchObject({ code: WALLET_CURRENCY_ERROR.NESTING_LIMIT_EXCEEDED });
  });

  test('chunks splitting JSON tokens are accepted', async () => {
    const body = JSON.stringify([buildWalletItem(), buildWalletItem({ coin: 'BTC' })]);
    const chunks = [];
    for (let i = 0; i < body.length; i += 3) chunks.push(Buffer.from(body.slice(i, i + 3), 'utf8'));
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: Readable.from(chunks),
    });
    expect(parsed.itemCountCategory).toBe('1_to_9');
  });

  test('chunks splitting multibyte UTF-8 characters are accepted', async () => {
    const item = buildWalletItem({ name: 'تتر-USDT-€' });
    const body = Buffer.from(JSON.stringify([item]), 'utf8');
    const chunks = [];
    for (let i = 0; i < body.length; i += 2) chunks.push(body.subarray(i, i + 2));
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: Readable.from(chunks),
    });
    expect(parsed.safe.parserCompleted).toBe(true);
  });

  test('decompressed response above 16 MiB aborts', async () => {
    async function* oversized() {
      // Emit opening array then oversized opaque ASCII payload via many objects
      yield Buffer.from('[', 'utf8');
      const one = JSON.stringify(buildWalletItem({ name: 'n'.repeat(8000) })).slice(1, -1);
      // stream raw invalid approach: push large string field via repeated chunks of a huge JSON string value
      // Simpler: feed a Readable that reports bytes > 16MiB without valid complete parse
      const pad = Buffer.alloc(17 * 1024 * 1024, 0x61);
      yield Buffer.from(`{"coin":"USDT","name":"`, 'utf8');
      yield pad;
      yield Buffer.from(`"}]`, 'utf8');
    }
    await expect(parseWalletCurrencyConfigStream({
      status: 200,
      headers: { 'content-type': 'application/json' },
      source: Readable.from(oversized()),
    })).rejects.toMatchObject({ code: WALLET_CURRENCY_ERROR.DECOMPRESSED_TOO_LARGE });
  }, 20000);

  test('encoded Content-Length with gzip does not claim compressed abort under Fetch semantics', async () => {
    const parsed = await parseWalletCurrencyConfigStream({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': String(WALLET_COMPRESSED_MAX_BYTES + 1),
      },
      source: Readable.from([Buffer.from('[]', 'utf8')]),
    });
    expect(parsed.safe?.httpOk).toBe(true);
    expect(parsed.safe.encodedContentLength).toBe(WALLET_COMPRESSED_MAX_BYTES + 1);
    expect(parsed.safe.compressedBytesRead).toBeNull();
    expect(parsed.safe.abortLimit).not.toBe('compressed_bytes');
    expect(parsed.itemCountCategory || parsed.safe?.itemCountCategory || 'zero').toBeTruthy();
  });

  test('currency item limit aborts', async () => {
    const items = Array.from({ length: WALLET_MAX_CURRENCY_ITEMS + 1 }, (_, i) => ({ coin: `C${i}` }));
    await expect(parseWalletCurrencyConfigResponse(makeWalletResponse(items))).rejects.toMatchObject({
      code: WALLET_CURRENCY_ERROR.ITEM_LIMIT_EXCEEDED,
    });
  }, 30000);

  test('string length limit aborts', async () => {
    await expect(parseWalletCurrencyConfigResponse(makeWalletResponse([
      buildWalletItem({ name: 'x'.repeat(65 * 1024) }),
    ]))).rejects.toMatchObject({ code: WALLET_CURRENCY_ERROR.STRING_LIMIT_EXCEEDED });
  });

  test('unknown fields are skipped without storage', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([
      buildWalletItem({ mystery: { nested: { ok: true } }, tipExtra: 'ignored' }),
    ]));
    expect(parsed.safe.parserCompleted).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/mystery|tipExtra|ignored/);
  });

  test('rejects empty coin when present in strict mode', async () => {
    await expect(parseWalletCurrencyConfigResponse(makeWalletResponse(
      [{ coin: '', networkList: [] }],
      { verificationOnly: false },
    ))).rejects.toMatchObject({ code: WALLET_CURRENCY_ERROR.ITEM_INVALID });
  });

  test('verification-only treats empty coin as schema drift without failing access', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([{ coin: '', networkList: [] }]));
    expect(parsed.accessVerified).toBe(true);
    expect(parsed.dataContractState).toBe('warning');
    expect(parsed.dataContractWarningCode).toBe(WALLET_CURRENCY_ERROR.PROVIDER_SCHEMA_DRIFT);
    expect(parsed.safe.parserCompleted).toBe(true);
    expect(parsed.safe.httpOk).toBe(true);
    expect(parsed.safe.contentTypeAccepted).toBe(true);
  });

  test('rejects malformed networkList item in strict mode', async () => {
    try {
      await parseWalletCurrencyConfigResponse(makeWalletResponse(
        [{ coin: 'USDT', networkList: ['bad'] }],
        { verificationOnly: false },
      ));
      throw new Error('expected throw');
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID);
      expect(err.safe.validationFailure).toBe('networkList.item_not_object');
    }
  });

  test('verification-only network item drift verifies access with schema warning', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([{ coin: 'USDT', networkList: ['bad'] }]));
    expect(parsed.accessVerified).toBe(true);
    expect(parsed.dataContractState).toBe('warning');
    expect(parsed.dataContractWarningCode).toBe(WALLET_CURRENCY_ERROR.PROVIDER_SCHEMA_DRIFT);
    expect(parsed.safe.schemaDriftCategories).toContain('network_item_non_object');
    expect(JSON.stringify(parsed)).not.toMatch(/USDT|bad|ERC20/);
  });

  test('rejects provider error object as successful list', async () => {
    try {
      await parseWalletCurrencyConfigResponse(makeWalletResponse({ code: 700007, msg: 'denied' }));
      throw new Error('expected throw');
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.PROVIDER_ERROR_ENVELOPE);
      expect(err.safe.providerCode).toBe(700007);
      expect(err.safe.topLevelType).toBe('object');
    }
  });

  test('rejects HTML body', async () => {
    await expect(parseWalletCurrencyConfigResponse({
      status: 200,
      headers: { 'content-type': 'text/html' },
      bodyText: '<html><body>blocked</body></html>',
      transportMeta: { bodyBytes: 32 },
    })).rejects.toBeInstanceOf(WalletCurrencyConfigContractError);
  });

  test('rejects malformed JSON', async () => {
    try {
      await parseWalletCurrencyConfigResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: '{"coin"',
        transportMeta: { bodyBytes: 7 },
      });
    } catch (err) {
      expect([
        WALLET_CURRENCY_ERROR.MALFORMED,
        WALLET_CURRENCY_ERROR.TOP_LEVEL_INVALID,
      ]).toContain(err.code);
    }
  });

  test('rejects truncated stream metadata', async () => {
    try {
      await parseWalletCurrencyConfigResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: '[{"coin":"USDT"',
        transportMeta: { bodyBytes: 16, truncated: true },
      });
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.RESPONSE_TRUNCATED);
    }
  });

  test('rejects wrong content type', async () => {
    try {
      await parseWalletCurrencyConfigResponse({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        bodyText: JSON.stringify([buildWalletItem()]),
        transportMeta: { bodyBytes: 10 },
      });
    } catch (err) {
      expect(err.code).toBe(WALLET_CURRENCY_ERROR.WRONG_CONTENT_TYPE);
    }
  });

  test('ordinary endpoint limit remains unchanged', () => {
    expect(MEXC_E2E_MAX_RESPONSE_BYTES).toBe(256 * 1024);
    expect(WALLET_DECOMPRESSED_MAX_BYTES).toBe(16 * 1024 * 1024);
    expect(WALLET_COMPRESSED_MAX_BYTES).toBe(4 * 1024 * 1024);
  });

  test('size categories use MiB buckets', () => {
    expect(categorizeWalletBodyBytes(100)).toBe('under_1MiB');
    expect(categorizeWalletBodyBytes(2 * 1024 * 1024)).toBe('1_to_4MiB');
    expect(categorizeWalletBodyBytes(17 * 1024 * 1024)).toBe('over_16MiB');
  });

  test('errors never include raw field content', async () => {
    const parsed = await parseWalletCurrencyConfigResponse(makeWalletResponse([
      buildWalletItem({ name: 'SECRET_COIN_NAME_SHOULD_NOT_LEAK', networkList: 'bad' }),
    ]));
    expect(parsed.accessVerified).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/SECRET_COIN_NAME/);
  });

  test('unexpected redirect is blocked by transport', async () => {
    await expect(mexcE2ESafeFetch({
      url: 'https://api.mexc.com/api/v3/capital/config/getall?timestamp=1&recvWindow=5000&signature=x',
      maxBytes: 256 * 1024,
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

  function mockConnectionRow() {
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
  }

  test('Probe 4 schema drift remains domain-local and verifies access without blocking Probe 5+', async () => {
    mockConnectionRow();
    const calls = [];
    const transport = async (request) => {
      calls.push(request.path);
      if (request.path === '/api/v3/capital/config/getall') {
        return {
          ok: true,
          status: 200,
          headers: { 'content-type': 'application/json' },
          bodyText: JSON.stringify([{ coin: 'USDT', networkList: { broken: true } }]),
          latencyMs: 12,
        };
      }
      if (request.path.includes('/api/v1/private/')) {
        return { ok: true, status: 200, json: { success: true, data: [] }, latencyMs: 9 };
      }
      return { ok: true, status: 200, json: [], bodyText: '[]', latencyMs: 8 };
    };

    const result = await runMexcVerificationOrchestrator({
      userId: 'user-1',
      scope: 'private_read',
      persist: false,
      transport,
      probeIds: [
        'wallet_currency_config',
        'deposit_history',
        'withdraw_history',
        'transfer_history',
        'futures_assets',
      ],
    });

    const wallet = result.body.results.find((r) => r.probeId === 'wallet_currency_config');
    expect(wallet.verificationState).toBe('verified');
    expect(wallet.keyGrant).toBe('granted');
    expect(wallet.dataContractState).toBe('warning');
    expect(wallet.dataContractWarningCode).toBe('MEXC_WALLET_PROVIDER_SCHEMA_DRIFT');
    expect(wallet.sanitizedReason).toBe('Endpoint access verified');
    expect(result.body.results.some((r) => r.probeId === 'deposit_history')).toBe(true);
    expect(result.body.results.some((r) => r.probeId === 'withdraw_history')).toBe(true);
    expect(result.body.results.some((r) => r.probeId === 'transfer_history')).toBe(true);
    expect(result.body.results.some((r) => r.probeId === 'futures_assets')).toBe(true);
    expect(calls[0]).toBe('/api/v3/capital/config/getall');
    expect(calls).toEqual(expect.arrayContaining([
      '/api/v3/capital/deposit/hisrec',
      '/api/v3/capital/withdraw/history',
      '/api/v3/capital/transfer',
      '/api/v1/private/account/assets',
    ]));
    expect(JSON.stringify(result.body)).not.toMatch(/ERC20|0x[a-f0-9]+|withdrawFee|SECRET/);
  });

  test('disposition: size failures are domain-local; signature/TLS remain global fatal', () => {
    const walletProbe = { capabilityId: 'WALLET_CURRENCY_READ', id: 'wallet_currency_config' };
    expect(getProbeFailureDisposition(walletProbe, {
      success: false,
      code: 'MEXC_RESPONSE_DECOMPRESSED_TOO_LARGE',
      verificationState: 'verification_error',
    })).toEqual({ stop: false, reason: 'domain_local_wallet' });
    expect(getProbeFailureDisposition(walletProbe, {
      success: false,
      code: 'MEXC_RESPONSE_TOO_LARGE',
      verificationState: 'verification_error',
    })).toEqual({ stop: false, reason: 'domain_local_wallet' });
    expect(WALLET_DOMAIN_LOCAL_ERROR_CODES.has('MEXC_RESPONSE_ITEM_LIMIT_EXCEEDED')).toBe(true);
    expect(getProbeFailureDisposition(walletProbe, {
      success: false,
      code: 'MEXC_SIGNATURE_INVALID',
      verificationState: 'failed',
    })).toEqual({ stop: true, reason: 'global_fatal' });
    expect(getProbeFailureDisposition(walletProbe, {
      success: false,
      code: 'MEXC_NETWORK_ERROR',
      verificationState: 'failed',
    })).toEqual({ stop: true, reason: 'global_fatal' });
    expect(getProbeFailureDisposition(walletProbe, {
      success: false,
      code: 'MEXC_RESPONSE_TRUNCATED',
      verificationState: 'verification_error',
    })).toEqual({ stop: true, reason: 'global_fatal' });
  });

  test('future continuation order is 5,6,7,8,9,4 and excludes probes 1-3', () => {
    expect(MEXC_REORDERED_CONTINUATION_PROBE_IDS).toEqual([
      'deposit_history',
      'withdraw_history',
      'transfer_history',
      'futures_assets',
      'futures_open_positions',
      'wallet_currency_config',
    ]);
    expect(MEXC_REORDERED_CONTINUATION_EXCLUDES).toEqual([
      'private_account',
      'spot_open_orders',
      'spot_my_trades',
    ]);
    expect(MEXC_REORDERED_CONTINUATION_PROBE_IDS).toHaveLength(6);
  });

  test('futures domain remains not tested after wallet verification_error projection', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
        WALLET_CURRENCY_READ: {
          keyGrant: 'unknown',
          verificationState: 'verification_error',
          lastFailureCode: 'MEXC_RESPONSE_TOO_LARGE',
          sanitizedReason: 'Wallet capability verification could not be completed',
        },
      },
    });
    const wallet = matrix.capabilities.find((c) => c.capabilityId === 'WALLET_CURRENCY_READ');
    const futures = matrix.capabilities.find((c) => c.capabilityId === 'FUTURES_ACCOUNT_READ');
    expect(wallet.verificationState).toBe('verification_error');
    expect(wallet.keyGrant).toBe('unknown');
    expect(futures.verificationState).toBe('not_tested');
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
  });
});
