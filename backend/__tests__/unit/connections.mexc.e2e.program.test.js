/**
 * MEXC End-to-End Program — capability inventory, matrix, orchestrator, gates
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const query = jest.fn(async () => ({ rows: [] }));
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.unstable_mockModule('../../database/db.js', () => ({ query }));
jest.unstable_mockModule('../../services/logger.js', () => ({ logger }));

process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
delete process.env.CONNECTIONS_PRIVATE_VERIFY_LIVE;
delete process.env.CONNECTIONS_CAPABILITY_VERIFY_LIVE;

const { MEXC_CAPABILITY, MEXC_CAPABILITY_IDS } = await import(
  '../../services/connections/mexc/capabilityIds.js'
);
const {
  MEXC_CAPABILITY_INVENTORY,
  getUnverifiedProviderSupportRows,
  MEXC_INVENTORY_META,
} = await import('../../services/connections/mexc/capabilityInventory.js');
const { buildCapabilityMatrix } = await import(
  '../../services/connections/mexc/capabilityMatrix.js'
);
const { evaluateAllConsumers, MEXC_CONSUMERS } = await import(
  '../../services/connections/mexc/consumerRegistry.js'
);
const {
  evaluateSpotTradingGates,
  evaluateFuturesTradingGates,
  evaluateWalletGates,
} = await import('../../services/connections/mexc/consumerGates.js');
const { buildAgentIntegrationStatus } = await import(
  '../../services/connections/mexc/agentConsumerIntegration.js'
);
const { createFakeMexcTransport } = await import(
  '../../services/connections/mexc/probes/fakeTransport.js'
);
const { FORBIDDEN_PROBES, getProposedRealReadOnlyProbes, MEXC_PROBE_CATALOG } = await import(
  '../../services/connections/mexc/probes/probeCatalog.js'
);
const { describeHealthCategory, MEXC_HEALTH_CATEGORY } = await import(
  '../../services/connections/mexc/errorHealthModel.js'
);
const { assertTier4Blocked } = await import(
  '../../services/connections/mexc/connectionCapabilityService.js'
);
const { encryptSecret } = await import('../../utils/crypto.js');

const FAKE_KEY = 'FAKEKEY_mexc_do_not_use';
const FAKE_SECRET = 'FAKESECRET_mexc_do_not_use_0123456789abcdef';

describe('MEXC-E2E Capability Inventory', () => {
  test('inventory has official endpoints and unverified rows marked', () => {
    expect(MEXC_CAPABILITY_INVENTORY.length).toBeGreaterThan(80);
    expect(MEXC_INVENTORY_META.spotHost).toBe('https://api.mexc.com');
    expect(MEXC_INVENTORY_META.futuresHost).toBe('https://contract.mexc.com');
    const unverified = getUnverifiedProviderSupportRows();
    expect(unverified.some((r) => r.name.includes('P2P'))).toBe(true);
    for (const row of MEXC_CAPABILITY_INVENTORY) {
      if (row.implementationState === 'PROVIDER_SUPPORT_NOT_VERIFIED') {
        expect(row.officialEndpoint).toBeFalsy();
      }
    }
  });

  test('canonical capability IDs are complete', () => {
    expect(MEXC_CAPABILITY_IDS).toContain(MEXC_CAPABILITY.PRIVATE_AUTH);
    expect(MEXC_CAPABILITY_IDS).toContain(MEXC_CAPABILITY.WITHDRAWAL_EXECUTE);
    expect(MEXC_CAPABILITY_IDS).toContain(MEXC_CAPABILITY.FUTURES_TRADE_EXECUTE);
    expect(MEXC_CAPABILITY_IDS.length).toBeGreaterThanOrEqual(30);
  });
});

describe('MEXC-E2E Capability Matrix', () => {
  test('does not infer trading from auth success', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      runtimeAllowsSideEffects: false,
    });
    const trade = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.SPOT_TRADE_EXECUTE);
    const withdraw = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.WITHDRAWAL_EXECUTE);
    const auth = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.PRIVATE_AUTH);
    expect(auth.verificationState).toBe('verified');
    expect(auth.keyGrant).toBe('granted');
    expect(trade.keyGrant).toBe('unknown');
    expect(trade.verificationState).toBe('not_safely_testable');
    expect(trade.operationalState).toBe('blocked_by_runtime');
    expect(withdraw.operationalState).toBe('blocked_by_runtime');
    expect(matrix.realSideEffectsAllowed).toBe(false);
  });

  test('futures trade execute is maintenance-aware', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: true });
    const fut = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.FUTURES_TRADE_EXECUTE);
    expect(fut.providerSupport).toBe('maintenance');
    expect(fut.operationalState).toBe('blocked_by_provider');
  });

  test('public market data is enabled without credentials', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: false });
    const spot = matrix.capabilities.find((c) => c.capabilityId === MEXC_CAPABILITY.MARKET_DATA_SPOT_PUBLIC);
    expect(spot.operationalState).toBe('enabled');
  });
});

describe('MEXC-E2E Consumers and Agents', () => {
  test('arbitrage remains eligible on public data without private auth', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: false });
    const consumers = evaluateAllConsumers(matrix);
    const arb = consumers.find((c) => c.consumerId === 'arbitrage');
    expect(arb.eligible).toBe(true);
  });

  test('wallet and spot trading not eligible without verification', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: true, privateAuthVerified: false });
    const consumers = evaluateAllConsumers(matrix);
    expect(consumers.find((c) => c.consumerId === 'wallet').eligible).toBe(false);
    expect(consumers.find((c) => c.consumerId === 'spot_trading_read').eligible).toBe(false);
  });

  test('agent integration never allows credential read or parallel client', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: true, privateAuthVerified: true });
    const agents = buildAgentIntegrationStatus(matrix);
    expect(agents.length).toBeGreaterThan(0);
    for (const a of agents) {
      expect(a.mayReadCredentials).toBe(false);
      expect(a.mayCreateParallelClient).toBe(false);
      expect(a.bypassRuntimeForbidden).toBe(true);
    }
  });

  test('consumer registry covers required modules', () => {
    const ids = MEXC_CONSUMERS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'portfolio', 'arbitrage', 'market_data_agents', 'spot_trading_read',
      'futures_trading_read', 'wallet', 'risk_agents',
    ]));
  });
});

describe('MEXC-E2E Spot / Futures / Wallet gates', () => {
  test('spot real order and wallet withdrawal remain blocked', () => {
    const matrix = buildCapabilityMatrix({ credentialsConfigured: true, privateAuthVerified: true });
    const spot = evaluateSpotTradingGates(matrix.capabilities);
    const wallet = evaluateWalletGates(matrix.capabilities);
    const fut = evaluateFuturesTradingGates(matrix.capabilities);
    expect(spot.publicPriceData).toBe(true);
    expect(spot.realOrderGated.allowed).toBe(false);
    expect(spot.testOrderEligibility).toBe(false);
    expect(wallet.withdrawalExecute.allowed).toBe(false);
    expect(wallet.transferExecute.allowed).toBe(false);
    expect(wallet.usesCanonicalConnection).toBe(true);
    expect(fut.providerMaintenance).toBe(true);
    expect(fut.spotAuthDoesNotGrantFutures).toBe(true);
    expect(fut.realOrderGated.allowed).toBe(false);
  });

  test('assertTier4Blocked always denies', () => {
    const blocked = assertTier4Blocked('withdrawal_execute');
    expect(blocked.allowed).toBe(false);
    expect(blocked.realSideEffectsAllowed).toBe(false);
  });
});

describe('MEXC-E2E Error health model', () => {
  test('categories expose safe user meaning and corrective action', () => {
    const desc = describeHealthCategory(MEXC_HEALTH_CATEGORY.IP_RESTRICTION, {
      affectedCapability: MEXC_CAPABILITY.PRIVATE_AUTH,
    });
    expect(desc.userMeaning).toMatch(/IP/i);
    expect(desc.correctiveAction).toBeTruthy();
    expect(desc.affectedCapability).toBe(MEXC_CAPABILITY.PRIVATE_AUTH);
  });
});

describe('MEXC-E2E Probe catalog safety', () => {
  test('forbidden probes exclude orders withdrawals transfers and test order', () => {
    const reasons = FORBIDDEN_PROBES.map((f) => f.reason + f.path).join(' ');
    expect(reasons).toMatch(/order/i);
    expect(reasons).toMatch(/Withdraw/i);
    expect(reasons).toMatch(/Test New Order/i);
    expect(getProposedRealReadOnlyProbes().every((p) => p.method === 'GET' || p.path.includes('account'))).toBe(true);
    expect(MEXC_PROBE_CATALOG.some((p) => p.path === '/api/v3/order/test')).toBe(false);
  });
});

describe('MEXC-E2E Verification orchestrator (fake)', () => {
  test('private scope without live gate decrypts 0 and returns NOT_LIVE', async () => {
    const { runMexcVerificationOrchestrator } = await import(
      '../../services/connections/mexc/verificationOrchestrator.js'
    );
    const { getConnectionForUser } = await import('../../services/exchangeConnectionService.js');

    // Mock configured connection via query responses used by getConnectionForUser path
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

    const result = await runMexcVerificationOrchestrator({
      userId: 'user-1',
      scope: 'private_read',
      persist: false,
      allowProviderCall: false,
    });

    expect(result.body.code).toBe('CONNECTION_CAPABILITY_VERIFY_NOT_LIVE');
    expect(result.body.decryptCount).toBe(0);
    expect(result.body.signCount).toBe(0);
    expect(result.body.transportCount).toBe(0);
    expect(result.body.realSideEffectsPossible).toBe(false);

    // sanity: DTO still loads
    const dto = await getConnectionForUser('user-1', 'MEXC');
    expect(dto.configured).toBe(true);
  });

  test('fake transport verifies public + private without real provider', async () => {
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
      allowProviderCall: false,
      transport,
      probeIds: ['spot_ping', 'private_account', 'wallet_currency_config'],
    });

    expect(result.body.success).toBe(true);
    expect(result.body.decryptCount).toBe(1);
    expect(result.body.transportCount).toBeGreaterThan(0);
    expect(result.body.results.every((r) => r.providerPayload === undefined)).toBe(true);
    expect(result.body.realSideEffectsPossible).toBe(false);
    expect(transport.calls.length).toBeGreaterThan(0);
  });

  test('permission denial isolates to probed capability', async () => {
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

    const transport = createFakeMexcTransport('permission_denied');
    const result = await runMexcVerificationOrchestrator({
      userId: 'user-1',
      scope: 'private_read',
      persist: false,
      transport,
      probeIds: ['private_account'],
    });

    expect(result.body.results[0].success).toBe(false);
    expect(result.body.results[0].keyGrant).toBe('denied');
  });
});

describe('MEXC-E2E Checkpoint proposal', () => {
  test('proposal excludes financial mutations and test order', async () => {
    const { getCheckpointProposal } = await import(
      '../../services/connections/mexc/verificationOrchestrator.js'
    );
    const proposal = getCheckpointProposal({
      id: 'conn-1',
      configured: true,
      credentialStatus: 'configured_unverified',
      maskedKeyIdentifier: '****USE',
    });
    expect(proposal.userNeedNotPasteSecret).toBe(true);
    expect(proposal.proofNoFinancialMutation.testNewOrderIncluded).toBe(false);
    expect(proposal.proofNoFinancialMutation.withdrawalIncluded).toBe(false);
    expect(proposal.credentialSource).toMatch(/encrypted/);
    expect(proposal.proposedReadOnlyEndpoints.length).toBeGreaterThan(0);
  });
});
