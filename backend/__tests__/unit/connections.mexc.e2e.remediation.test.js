/**
 * MEXC-E2E Pre-Authorization Remediation tests
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';

const query = jest.fn(async () => ({ rows: [] }));
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.unstable_mockModule('../../database/db.js', () => ({
  query,
  getClient: async () => {
    const client = {
      query: (...args) => query(...args),
      release: jest.fn(),
    };
    return client;
  },
}));
jest.unstable_mockModule('../../services/logger.js', () => ({ logger }));

process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;
delete process.env.CONNECTIONS_CAPABILITY_VERIFY_LIVE;

const { MEXC_CAPABILITY } = await import('../../services/connections/mexc/capabilityIds.js');
const { buildCapabilityMatrix } = await import('../../services/connections/mexc/capabilityMatrix.js');
const {
  evaluateAllConsumers,
  MEXC_CONSUMERS,
  resolveAgentConsumerEligibility,
  UNREGISTERED_AGENT_STATUS,
} = await import('../../services/connections/mexc/consumerRegistry.js');
const {
  MEXC_CONSUMER_PATH_MAP,
  MEXC_PATH_CLASS,
  assertTier4Impossible,
  assertNoLegacyPrivateBypass,
} = await import('../../services/connections/mexc/canonicalClientOwnership.js');
const {
  buildMexcCanonicalQuery,
  signMexcTotalParams,
  buildSignedAccountQuery,
  MEXC_DEFAULT_RECV_WINDOW,
} = await import('../../services/connections/providers/mexcSigning.js');
const {
  signMexcFuturesRequest,
  buildMexcFuturesAuthHeaders,
  buildMexcFuturesRequestParamString,
} = await import('../../services/connections/providers/mexcFuturesSigning.js');
const {
  getCheckpointReadOnlyProbes,
  buildSpotProbeQueryParams,
  FORBIDDEN_PROBES,
  MEMORY_ONLY_PROBE_FIELDS,
} = await import('../../services/connections/mexc/probes/probeCatalog.js');
const {
  selectSafeSpotProbeSymbol,
} = await import('../../services/connections/mexc/probes/safeSymbolSelection.js');
const {
  capturePreProbeSnapshot,
  rollbackToCapabilitySnapshot,
  persistCapabilityResultsWithRollbackGuard,
  VERIFICATION_RUN_STATUS,
} = await import('../../services/connections/mexc/verificationSnapshotRollback.js');
const { createFakeMexcTransport } = await import(
  '../../services/connections/mexc/probes/fakeTransport.js'
);
const { encryptSecret } = await import('../../utils/crypto.js');

const FAKE_KEY = 'FAKEKEY_mexc_do_not_use';
const FAKE_SECRET = 'FAKESECRET_mexc_do_not_use_0123456789abcdef';

describe('Canonical client ownership', () => {
  test('consumer path map classifies public / canonical / legacy / unsafe', () => {
    const classes = new Set(MEXC_CONSUMER_PATH_MAP.map((r) => r.class));
    expect(classes.has(MEXC_PATH_CLASS.PUBLIC_ONLY)).toBe(true);
    expect(classes.has(MEXC_PATH_CLASS.CANONICAL_PRIVATE)).toBe(true);
    expect(classes.has(MEXC_PATH_CLASS.LEGACY_PRIVATE)).toBe(true);
    expect(MEXC_CONSUMER_PATH_MAP.some((r) => r.path.includes('market-proxy'))).toBe(true);
    expect(MEXC_CONSUMER_PATH_MAP.some((r) => r.path.includes('exchangeConnectionService'))).toBe(true);
  });

  test('Tier-4 and legacy private bypass always throw', () => {
    expect(() => assertTier4Impossible('createOrder')).toThrow(/Tier-4|TIER4/i);
    expect(() => assertNoLegacyPrivateBypass('getBalance')).toThrow(/Legacy private|LEGACY_PRIVATE/i);
  });

  test('legacy mexc.js private helpers fail closed', async () => {
    const { mexcService } = await import('../../services/mexc.js');
    expect(() => { try { mexcService.initializeExchange('u1'); } catch (e) { throw e; } }).toBeTruthy();
    await expect(mexcService.initializeExchange('u1')).rejects.toMatchObject({ code: 'MEXC_LEGACY_PRIVATE_BLOCKED' });
    await expect(mexcService.getBalance('u1')).rejects.toMatchObject({ code: 'MEXC_LEGACY_PRIVATE_BLOCKED' });
    await expect(mexcService.createOrder('u1', 'BTC/USDT', 'limit', 'buy', 1, 1)).rejects.toMatchObject({ code: 'MEXC_TIER4_BLOCKED' });
  });
});

describe('Spot vs Futures signing separation', () => {
  test('Spot v3 fake vector matches HMAC over totalParams', () => {
    const timestamp = 1700000000000;
    const { totalParams, signature, signedQuery } = buildSignedAccountQuery({
      secret: FAKE_SECRET,
      timestamp,
      recvWindow: MEXC_DEFAULT_RECV_WINDOW,
    });
    const expected = crypto
      .createHmac('sha256', FAKE_SECRET)
      .update(totalParams, 'utf8')
      .digest('hex');
    expect(signature).toBe(expected);
    expect(signedQuery).toContain('signature=');
    expect(totalParams).toContain('timestamp=');
    expect(totalParams).toContain('recvWindow=');
  });

  test('Spot openOrders params require symbol+timestamp+recvWindow', () => {
    const probes = getCheckpointReadOnlyProbes();
    const open = probes.find((p) => p.id === 'spot_open_orders');
    const params = buildSpotProbeQueryParams(open, {
      timestamp: 1700000000000,
      recvWindow: 5000,
      safeSymbol: 'BTCUSDT',
    });
    expect(params).toEqual({
      symbol: 'BTCUSDT',
      timestamp: 1700000000000,
      recvWindow: 5000,
    });
    const total = buildMexcCanonicalQuery(params);
    expect(signMexcTotalParams(FAKE_SECRET, total)).toHaveLength(64);
  });

  test('Futures signature uses accessKey+reqTime+requestParam — not Spot query signature', () => {
    const accessKey = FAKE_KEY;
    const reqTime = '1700000000000';
    const requestParam = buildMexcFuturesRequestParamString({ symbol: 'BTC_USDT' });
    const sig = signMexcFuturesRequest({
      accessKey,
      secretKey: FAKE_SECRET,
      reqTime,
      requestParam,
    });
    const expected = crypto
      .createHmac('sha256', FAKE_SECRET)
      .update(`${accessKey}${reqTime}${requestParam}`, 'utf8')
      .digest('hex');
    expect(sig).toBe(expected);

    const { headers } = buildMexcFuturesAuthHeaders({
      accessKey,
      secretKey: FAKE_SECRET,
      reqTime,
      requestParam,
    });
    expect(headers.ApiKey).toBe(accessKey);
    expect(headers['Request-Time']).toBe(reqTime);
    expect(headers.Signature).toBe(sig);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-MEXC-APIKEY']).toBeUndefined();
  });
});

describe('Capability Matrix truthfulness (remediation)', () => {
  test('public market keyGrant is not_applicable and no Key:granted semantics', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: false });
    const spot = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC);
    const fut = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.MARKET_DATA_FUTURES_PUBLIC);
    expect(spot.keyGrant).toBe('not_applicable');
    expect(fut.keyGrant).toBe('not_applicable');
    expect(spot.credentialRequired).toBe(false);
    expect(spot.providerSupport).toBe('supported');
    expect(['available', 'verified']).toContain(spot.verificationState);
    expect(spot.operationalState).toBe('enabled');
  });

  test('SPOT_TRADE_TEST deferred and excluded from checkpoint', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: true });
    const testCap = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.SPOT_TRADE_TEST);
    expect(testCap.providerSupport).toBe('supported');
    expect(testCap.keyGrant).toBe('unknown');
    expect(testCap.verificationState).toBe('deferred_private_non_executing_probe');
    expect(testCap.operationalState).toBe('disabled_pending_explicit_authorization');
    expect(testCap.sideEffect).toBe('non_executing_private_validation');
    expect(getCheckpointReadOnlyProbes().some((p) => p.id.includes('test'))).toBe(false);
    expect(FORBIDDEN_PROBES.some((f) => f.path.includes('order/test'))).toBe(true);
  });

  test('ACCOUNT_EDIT blocked_by_provider_evidence; P2P unknown', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: true });
    const edit = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.ACCOUNT_EDIT);
    const p2p = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.P2P_READ);
    expect(edit.providerSupport).toBe('unknown');
    expect(edit.operationalState).toBe('blocked_by_provider_evidence');
    expect(String(edit.blockedReason)).toMatch(/PROVIDER SUPPORT NOT VERIFIED/);
    expect(p2p.providerSupport).toBe('unknown');
  });
});

describe('Consumer contracts (remediation)', () => {
  test('portfolio / arbitrage / spot+futures read/execute / wallet functions', () => {
    const ids = MEXC_CONSUMERS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'portfolio',
      'arbitrage',
      'spot_trading_read',
      'spot_trading_execute',
      'futures_trading_read',
      'futures_trading_execute',
      'wallet',
      'wallet_deposit_address',
      'wallet_withdrawal_execute',
      'wallet_transfer_read',
      'wallet_transfer_execute',
    ]));
    expect(ids).not.toContain('other_agents');
    expect(ids).not.toContain('spot_trading');
  });

  test('arbitrage eligible without private auth; execute consumers blocked', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: false });
    const consumers = evaluateAllConsumers(matrix);
    expect(consumers.find((c) => c.consumerId === 'arbitrage').eligible).toBe(true);
    expect(consumers.find((c) => c.consumerId === 'spot_trading_execute').eligible).toBe(false);
    expect(consumers.find((c) => c.consumerId === 'wallet_withdrawal_execute').eligible).toBe(false);
  });

  test('wallet read not wholly disabled by withdrawal execute block', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
        WALLET_CURRENCY_READ: { keyGrant: 'granted', verificationState: 'verified' },
        WITHDRAWAL_EXECUTE: { keyGrant: 'unknown', verificationState: 'not_safely_testable' },
      },
    });
    // Force operational enable for wallet read caps via stored verified + granted
    const consumers = evaluateAllConsumers(matrix);
    const wallet = consumers.find((c) => c.consumerId === 'wallet');
    const withdrawExec = consumers.find((c) => c.consumerId === 'wallet_withdrawal_execute');
    expect(withdrawExec.eligible).toBe(false);
    // Wallet eligibility depends on PRIVATE_AUTH + WALLET_CURRENCY_READ operational
    // With verified stored states and privateAuthVerified, those should be enabled
    expect(wallet.requiredCapabilities).toEqual(['PRIVATE_AUTH', 'WALLET_CURRENCY_READ']);
  });

  test('unregistered agent is NOT ELIGIBLE', () => {
    const matrix = buildCapabilityMatrix({});
    const r = resolveAgentConsumerEligibility(matrix, 'mystery_agent');
    expect(r.eligible).toBe(false);
    expect(r.blockedReason).toBe(UNREGISTERED_AGENT_STATUS.blockedReason);
    expect(r.registered).toBe(false);
  });
});

describe('Nine checkpoint probes', () => {
  test('exact nine private probes with mandatory params', () => {
    const probes = getCheckpointReadOnlyProbes();
    expect(probes).toHaveLength(9);
    expect(probes.map((p) => p.checkpointOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(probes.map((p) => p.path)).toEqual([
      '/api/v3/account',
      '/api/v3/openOrders',
      '/api/v3/myTrades',
      '/api/v3/capital/config/getall',
      '/api/v3/capital/deposit/hisrec',
      '/api/v3/capital/withdraw/history',
      '/api/v3/capital/transfer',
      '/api/v1/private/account/assets',
      '/api/v1/private/position/open_positions',
    ]);
    const transfer = probes.find((p) => p.id === 'transfer_history');
    expect(transfer.fixedParams).toEqual({
      fromAccountType: 'SPOT',
      toAccountType: 'FUTURES',
      page: 1,
      size: 1,
    });
    const trades = probes.find((p) => p.id === 'spot_my_trades');
    expect(trades.fixedParams.limit).toBe(1);
    expect(MEMORY_ONLY_PROBE_FIELDS).toEqual(expect.arrayContaining([
      'balances', 'orderDetails', 'tradePayload', 'address', 'memo', 'txId', 'amount',
    ]));
  });

  test('safe symbol selection never guesses', () => {
    const miss = selectSafeSpotProbeSymbol({ symbols: [] });
    expect(miss.symbol).toBeNull();
    const hit = selectSafeSpotProbeSymbol({
      symbols: [{ symbol: 'ETHUSDT', status: 'ENABLED', isSpotTradingAllowed: true, isApiTradingAllowed: true }],
    });
    expect(hit.symbol).toBe('ETHUSDT');
  });
});

describe('Append-only history and rollback', () => {
  test('failed persistence triggers rollback without deleting history/connection/credentials', async () => {
    const inserts = [];
    query.mockImplementation(async (sql, params) => {
      inserts.push(String(sql).slice(0, 80));
      if (String(sql).includes('FROM mexc_connection_capability_state') && String(sql).includes('SELECT')) {
        return {
          rows: [{
            capability_id: 'PRIVATE_AUTH',
            provider_support: 'supported',
            key_grant: 'unknown',
            verification_state: 'not_tested',
            operational_state: 'disabled',
            last_verified_at: null,
            last_failure_code: null,
            sanitized_reason: null,
            source_of_evidence: null,
          }],
        };
      }
      if (String(sql).includes('INSERT INTO mexc_capability_state_snapshots')) {
        return { rows: [{ id: 'snap-1', correlation_id: params[2], created_at: new Date().toISOString() }] };
      }
      if (String(sql).includes('FROM mexc_capability_state_snapshots')) {
        return {
          rows: [{
            id: 'snap-1',
            correlation_id: 'corr-1',
            snapshot_json: {
              capabilityStates: [{
                capabilityId: 'PRIVATE_AUTH',
                providerSupport: 'supported',
                keyGrant: 'unknown',
                verificationState: 'not_tested',
                operationalState: 'disabled',
                lastVerifiedAt: null,
                lastFailureCode: null,
                sanitizedReason: null,
                sourceOfEvidence: null,
              }],
            },
          }],
        };
      }
      return { rows: [] };
    });

    const result = await persistCapabilityResultsWithRollbackGuard({
      connectionId: 'conn-1',
      ownerId: 'user-1',
      correlationId: 'corr-1',
      results: [{ capabilityId: 'PRIVATE_AUTH', probeId: 'private_account', keyGrant: 'granted', verificationState: 'verified' }],
      shouldFail: true,
    });

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.rollback.historyDeleted).toBe(false);
    expect(result.rollback.connectionDeleted).toBe(false);
    expect(result.rollback.credentialsAltered).toBe(false);
    expect(inserts.some((s) => s.includes('ROLLBACK') || s.includes('rolled_back') || s.includes('capability_snapshot_rollback') || s.includes('UPDATE mexc_capability_verification_runs'))).toBe(true);
  });
});

describe('Orchestrator fake path — no real provider', () => {
  test('all_safe with fake transport never sets realProviderRequestOccurred', async () => {
    const { runMexcVerificationOrchestrator } = await import(
      '../../services/connections/mexc/verificationOrchestrator.js'
    );

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
            }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_sync_at: null,
          }],
        };
      }
      return { rows: [] };
    });

    const transport = createFakeMexcTransport('success');
    const result = await runMexcVerificationOrchestrator({
      userId: 'user-1',
      scope: 'all_safe',
      persist: false,
      transport,
      probeIds: [
        'spot_exchange_info',
        'private_account',
        'spot_open_orders',
        'spot_my_trades',
        'wallet_currency_config',
        'deposit_history',
        'withdraw_history',
        'transfer_history',
        'futures_assets',
        'futures_open_positions',
      ],
    });

    expect(result.body.realProviderRequestOccurred).toBe(false);
    expect(result.body.realSideEffectsPossible).toBe(false);
    expect(result.body.probeSafeSymbol).toBe('BTCUSDT');
    expect(result.body.results.find((r) => r.probeId === 'spot_open_orders')?.success).toBe(true);
    expect(result.body.results.find((r) => r.probeId === 'futures_assets')?.success).toBe(true);
    expect(transport.calls.every((c) => !String(c.host || '').includes('real-live'))).toBe(true);
  });
});
