/**
 * MEXC wallet permission projection, telemetry semantics, auth consistency.
 */
import { describe, expect, test } from '@jest/globals';
import {
  buildProviderPermissionEvidenceFromVerifiedRows,
  canGrantWalletKeyFromSharedPermission,
  MEXC_PROVIDER_PERMISSION,
  PROVIDER_PERMISSION_STATE,
  PROVIDER_PERMISSION_EVIDENCE_TYPE,
  WALLET_PERMISSION_VOLUME_WARNING,
} from '../../services/connections/mexc/providerPermissionEvidence.js';
import { applySharedPermissionEvidenceProjection } from '../../services/connections/mexc/verificationCorrectionService.js';
import {
  MEXC_E2E_TRANSPORT_CLIENT,
  MexcE2ETransportError,
  buildSafeHttpResponseMeta,
  mexcE2ESafeFetchWalletStream,
} from '../../services/connections/mexc/mexcE2ESafeTransport.js';
import {
  WALLET_CURRENCY_ERROR,
  parseWalletCurrencyConfigStream,
} from '../../services/connections/mexc/walletCurrencyConfigContract.js';
import { buildCapabilityMatrix } from '../../services/connections/mexc/capabilityMatrix.js';
import { evaluateConsumerEligibility, MEXC_CONSUMERS } from '../../services/connections/mexc/consumerRegistry.js';
import { toSafeConnectionDto } from '../../services/exchangeConnectionService.js';

// Reason-kind selection is covered in src/__tests__/mexc.permissionProjection.reasons.test.ts

describe('provider permission evidence', () => {
  test('deposit history success grants SPOT_WITHDRAW_READ shared evidence', () => {
    const { providerPermissionEvidence, walletCurrencyProjection } =
      buildProviderPermissionEvidenceFromVerifiedRows({
        verifiedRows: [{
          id: 'dep-1',
          capabilityId: 'DEPOSIT_HISTORY_READ',
          verificationState: 'verified',
          keyGrant: 'granted',
          testedAt: '2026-07-21T12:37:51.940Z',
          correlationId: 'run-a',
        }],
        latestWalletAttempt: {
          id: 'wal-1',
          testedAt: '2026-07-21T14:00:45.518Z',
          lastFailureCode: 'MEXC_RESPONSE_COMPRESSED_TOO_LARGE',
        },
      });

    const withdraw = providerPermissionEvidence.SPOT_WITHDRAW_READ;
    expect(withdraw.state).toBe(PROVIDER_PERMISSION_STATE.GRANTED);
    expect(withdraw.evidenceType).toBe(PROVIDER_PERMISSION_EVIDENCE_TYPE.SHARED_PERMISSION_SUCCESS);
    expect(withdraw.evidenceCapabilityIds).toContain('DEPOSIT_HISTORY_READ');
    expect(walletCurrencyProjection.keyGrant).toBe('granted');
    expect(walletCurrencyProjection.verificationState).toBe('verification_error');
    expect(walletCurrencyProjection.directEndpointVerified).toBe(false);
    expect(walletCurrencyProjection.lastVerifiedAt).toBeNull();
    expect(walletCurrencyProjection.dataContractState).toBe('warning');
    expect(walletCurrencyProjection.dataContractWarningCode).toBe(WALLET_PERMISSION_VOLUME_WARNING);
    expect(walletCurrencyProjection.consumerReadiness).toBe('limited');
  });

  test('withdrawal history success grants SPOT_WITHDRAW_READ shared evidence', () => {
    const { providerPermissionEvidence } = buildProviderPermissionEvidenceFromVerifiedRows({
      verifiedRows: [{
        id: 'wd-1',
        capabilityId: 'WITHDRAWAL_HISTORY_READ',
        verificationState: 'verified',
        keyGrant: 'granted',
        testedAt: '2026-07-21T12:37:52.214Z',
      }],
    });
    expect(providerPermissionEvidence.SPOT_WITHDRAW_READ.state).toBe('granted');
    expect(providerPermissionEvidence.SPOT_WITHDRAW_READ.evidenceCapabilityIds)
      .toEqual(['WITHDRAWAL_HISTORY_READ']);
  });

  test('either shared-permission endpoint can support granted permission', () => {
    const a = buildProviderPermissionEvidenceFromVerifiedRows({
      verifiedRows: [{
        capabilityId: 'DEPOSIT_HISTORY_READ',
        verificationState: 'verified',
        keyGrant: 'granted',
      }],
    });
    const b = buildProviderPermissionEvidenceFromVerifiedRows({
      verifiedRows: [{
        capabilityId: 'WITHDRAWAL_HISTORY_READ',
        verificationState: 'verified',
        keyGrant: 'granted',
      }],
    });
    expect(canGrantWalletKeyFromSharedPermission(a.providerPermissionEvidence)).toBe(true);
    expect(canGrantWalletKeyFromSharedPermission(b.providerPermissionEvidence)).toBe(true);
  });

  test('transfer grants SPOT_TRANSFER_READ only; write permissions stay unknown', () => {
    const { providerPermissionEvidence } = buildProviderPermissionEvidenceFromVerifiedRows({
      verifiedRows: [{
        capabilityId: 'TRANSFER_READ',
        verificationState: 'verified',
        keyGrant: 'granted',
        id: 'tr-1',
      }],
    });
    expect(providerPermissionEvidence.SPOT_TRANSFER_READ.state).toBe('granted');
    expect(providerPermissionEvidence.SPOT_WITHDRAW_READ.state).toBe('unknown');
  });

  test('keyGrant may be granted while endpoint verification remains incomplete', () => {
    const { walletCurrencyProjection } = buildProviderPermissionEvidenceFromVerifiedRows({
      verifiedRows: [
        { capabilityId: 'DEPOSIT_HISTORY_READ', verificationState: 'verified', keyGrant: 'granted', id: 'd' },
        { capabilityId: 'WITHDRAWAL_HISTORY_READ', verificationState: 'verified', keyGrant: 'granted', id: 'w' },
      ],
      latestWalletAttempt: { testedAt: '2026-07-21T14:00:45.518Z', lastFailureCode: 'MEXC_WALLET_NETWORK_ITEM_INVALID' },
    });
    expect(walletCurrencyProjection.keyGrant).toBe('granted');
    expect(walletCurrencyProjection.keyGrantEvidence).toBe(MEXC_PROVIDER_PERMISSION.SPOT_WITHDRAW_READ);
    expect(walletCurrencyProjection.verificationState).toBe('verification_error');
    expect(walletCurrencyProjection.lastAttemptAt).toBe('2026-07-21T14:00:45.518Z');
  });
});

describe('shared permission correction idempotency', () => {
  test('second invocation appends no duplicate and does not call provider', async () => {
    const rows = [];
    const state = { wallet: null, meta: {} };
    const queryFn = async (sql, params = []) => {
      if (/FROM mexc_capability_verifications[\s\S]*probe_id = \$4[\s\S]*LIKE/i.test(sql)) {
        return { rows: rows.filter((r) => r.probe_id === 'shared_permission_evidence_projection') };
      }
      if (/capability_id = ANY/i.test(sql)) {
        return {
          rows: [
            {
              id: 'eda5efe2-6eb9-40ed-b5cd-4faa1a4ae094',
              capability_id: 'DEPOSIT_HISTORY_READ',
              key_grant: 'granted',
              verification_state: 'verified',
              correlation_id: 'run-dep',
              tested_at: '2026-07-21T12:37:51.940Z',
              last_failure_code: null,
            },
            {
              id: 'e3b9c3d6-0150-4028-b28d-47c7d010f761',
              capability_id: 'WITHDRAWAL_HISTORY_READ',
              key_grant: 'granted',
              verification_state: 'verified',
              correlation_id: 'run-wd',
              tested_at: '2026-07-21T12:37:52.214Z',
              last_failure_code: null,
            },
          ],
        };
      }
      if (/probe_id = 'wallet_currency_config'/i.test(sql)) {
        return {
          rows: [{
            id: '5ef47171-9fa4-4a12-a61e-3506104dd96e',
            capability_id: 'WALLET_CURRENCY_READ',
            key_grant: 'unknown',
            verification_state: 'verification_error',
            correlation_id: 'e51b51ef',
            tested_at: '2026-07-21T14:00:45.518Z',
            last_failure_code: 'MEXC_RESPONSE_COMPRESSED_TOO_LARGE',
          }],
        };
      }
      if (/INSERT INTO mexc_capability_verifications/i.test(sql)) {
        const row = {
          id: 'corr-1',
          correlation_id: params[4],
          tested_at: params[11],
          probe_id: params[3],
        };
        rows.push(row);
        return { rows: [row] };
      }
      if (/INSERT INTO mexc_connection_capability_state/i.test(sql)) {
        state.wallet = {
          key_grant: params[3],
          verification_state: params[4],
          operational_state: params[5],
          last_failure_code: params[6],
        };
        return { rows: [] };
      }
      if (/UPDATE exchange_connections/i.test(sql)) {
        state.meta = JSON.parse(params[1]);
        return { rows: [] };
      }
      return { rows: [] };
    };

    const first = await applySharedPermissionEvidenceProjection({
      connectionId: 'e2995df0-af35-4d10-bf23-0ea517a6c272',
      ownerId: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6',
      correctionCorrelationId: 'corr-run-1',
      queryFn,
    });
    expect(first.appended).toBe(true);
    expect(first.keyGrant).toBe('granted');
    expect(first.verificationState).toBe('verification_error');
    expect(first.providerTransport).toBe(0);
    expect(first.credentialDecryption).toBe(0);
    expect(first.signatureGeneration).toBe(0);
    expect(state.wallet.key_grant).toBe('granted');
    expect(state.meta.mexcProviderPermissionEvidence.SPOT_WITHDRAW_READ.state).toBe('granted');

    const second = await applySharedPermissionEvidenceProjection({
      connectionId: 'e2995df0-af35-4d10-bf23-0ea517a6c272',
      ownerId: 'e134c7b1-b183-4e21-9acf-e3d53b9806d6',
      correctionCorrelationId: 'corr-run-2',
      queryFn,
    });
    expect(second.idempotent).toBe(true);
    expect(second.appended).toBe(false);
    expect(rows.filter((r) => r.probe_id === 'shared_permission_evidence_projection')).toHaveLength(1);
  });
});

describe('transport byte semantics', () => {
  test('client is global fetch / undici-backed', () => {
    expect(MEXC_E2E_TRANSPORT_CLIENT.kind).toBe('global_fetch');
    expect(MEXC_E2E_TRANSPORT_CLIENT.autoDecompresses).toBe(true);
    expect(MEXC_E2E_TRANSPORT_CLIENT.exposesRawEncodedBytes).toBe(false);
  });

  test('status and content type retained after body-size abort', async () => {
    const chunks = [Buffer.alloc(1024, 0x61)];
    let reads = 0;
    const fetchImpl = async () => ({
      status: 200,
      ok: true,
      headers: {
        entries: () => [
          ['content-type', 'application/json; charset=utf-8'],
          ['content-encoding', 'gzip'],
          ['content-length', String(5 * 1024 * 1024)],
        ],
      },
      body: {
        getReader: () => ({
          read: async () => {
            if (reads === 0) {
              reads += 1;
              // Force decoded oversize by returning huge chunk repeatedly via decodedMaxBytes
              return { done: false, value: Buffer.alloc(17 * 1024 * 1024) };
            }
            return { done: true, value: undefined };
          },
          cancel: async () => {},
        }),
        cancel: async () => {},
      },
    });

    const streamed = await mexcE2ESafeFetchWalletStream({
      url: 'https://api.mexc.com/api/v3/capital/config/getall',
      fetchImpl,
      decodedMaxBytes: 16 * 1024 * 1024,
    });
    expect(streamed.safeResponseMeta.status).toBe(200);
    expect(streamed.safeResponseMeta.contentTypeAccepted).toBe(true);
    expect(streamed.encodedBytesObserved).toBeNull();
    expect(streamed.streamByteSemantics).toBe('decoded_body_bytes');

    await expect(async () => {
      for await (const _ of streamed.stream) { /* drain */ }
    }).rejects.toMatchObject({
      code: 'MEXC_RESPONSE_TOO_LARGE',
      safeResponseMeta: expect.objectContaining({
        status: 200,
        httpOk: true,
        sanitizedContentType: 'application/json',
        contentTypeAccepted: true,
      }),
    });
  });

  test('Content-Length with encoding does not claim compressed limit via contract', async () => {
    const body = JSON.stringify([{ coin: 'BTC', name: 'Bitcoin', networkList: [{ network: 'BTC', depositEnable: true, withdrawEnable: true }] }]);
    await expect(parseWalletCurrencyConfigStream({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': String(5 * 1024 * 1024),
      },
      source: Buffer.from(body),
      transportMeta: { safeResponseMeta: buildSafeHttpResponseMeta({ status: 200 }, {
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': String(5 * 1024 * 1024),
      }) },
    })).resolves.toMatchObject({
      accessVerified: true,
    });
  });

  test('error context never includes signed URL or credential headers', () => {
    const err = new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'too large', {
      safeResponseMeta: buildSafeHttpResponseMeta({ status: 200 }, {
        'content-type': 'application/json',
      }),
      decodedBodyBytesProcessed: 1,
    });
    const blob = JSON.stringify(err.extra);
    expect(blob).not.toMatch(/signature=/i);
    expect(blob).not.toMatch(/apiKey|apiSecret|Authorization/i);
    expect(blob).not.toMatch(/https:\/\/api\.mexc\.com/);
  });
});

describe('projection and reason selection', () => {
  test('auth verified + not_tested displays Not yet tested / key permission unverified', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
        DEPOSIT_ADDRESS_READ: { keyGrant: 'unknown', verificationState: 'not_tested' },
      },
    });
    const cap = matrix.capabilities.find((c) => c.capabilityId === 'DEPOSIT_ADDRESS_READ');
    expect(cap.blockedReason).toMatch(/Required API-key permission has not yet been verified|Not yet tested/);
    expect(cap.blockedReason).not.toMatch(/Private authentication has not been verified/);
  });

  test('auth unverified + not_tested shows auth pending reason text', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: false,
      storedStates: {},
    });
    const cap = matrix.capabilities.find((c) => c.capabilityId === 'SPOT_ORDER_READ');
    expect(cap.blockedReason).toMatch(/Private authentication has not been verified/);
  });

  test('shared permission granted + endpoint verification error projects correctly', () => {
    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: true,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
        WALLET_CURRENCY_READ: {
          keyGrant: 'granted',
          verificationState: 'verification_error',
          lastAttemptAt: '2026-07-21T14:00:45.518Z',
          lastFailureCode: 'MEXC_RESPONSE_COMPRESSED_TOO_LARGE',
          keyGrantEvidence: 'SPOT_WITHDRAW_READ',
          directEndpointVerified: false,
        },
        DEPOSIT_HISTORY_READ: { keyGrant: 'granted', verificationState: 'verified', operationalState: 'enabled' },
        WITHDRAWAL_HISTORY_READ: { keyGrant: 'granted', verificationState: 'verified', operationalState: 'enabled' },
        TRANSFER_READ: { keyGrant: 'granted', verificationState: 'verified', operationalState: 'enabled' },
      },
      walletDataContract: {
        dataContractState: 'warning',
        dataContractWarningCode: WALLET_PERMISSION_VOLUME_WARNING,
        sanitizedDataContractReason: 'Endpoint permission is available, but the full provider currency configuration is not yet supported safely',
        consumerReadiness: 'limited',
      },
      providerPermissionEvidence: {
        SPOT_WITHDRAW_READ: {
          permissionCode: 'SPOT_WITHDRAW_READ',
          state: 'granted',
          evidenceType: 'shared_permission_success',
          evidenceCapabilityIds: ['DEPOSIT_HISTORY_READ', 'WITHDRAWAL_HISTORY_READ'],
        },
      },
    });
    for (const id of ['DEPOSIT_HISTORY_READ', 'WITHDRAWAL_HISTORY_READ', 'TRANSFER_READ', 'PRIVATE_AUTH', 'SPOT_ACCOUNT_READ']) {
      const c = matrix.capabilities.find((x) => x.capabilityId === id);
      if (c) {
        c.operationalState = 'enabled';
        c.verificationState = 'verified';
        c.keyGrant = 'granted';
      }
    }
    const wallet = matrix.capabilities.find((c) => c.capabilityId === 'WALLET_CURRENCY_READ');
    expect(wallet.keyGrant).toBe('granted');
    expect(wallet.verificationState).toBe('verification_error');
    expect(wallet.lastAttemptAt).toBe('2026-07-21T14:00:45.518Z');
    expect(wallet.lastVerifiedAt).toBeNull();

    const walletConsumer = MEXC_CONSUMERS.find((c) => c.id === 'wallet');
    const evaluated = evaluateConsumerEligibility(walletConsumer, matrix);
    expect(evaluated.consumerReadiness).toBe('limited');
    expect(evaluated.limitedByDataContract).toBe(true);
  });

  test('privateAuthVerified consistent across DTO and matrix when store says verified', () => {
    // Synthetic low-entropy fixtures only — never real credentials.
    // Shape matches isEncrypted() (iv:body:tag hex) so DTO projection stays on the
    // encrypted-storage path; values are derived from obvious unit-test labels.
    const asSyntheticEncrypted = (label) => {
      const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      return `${hex('iv')}:${hex(label)}:${hex('tg')}`;
    };
    const unitTestApiKey = asSyntheticEncrypted('unit-test-api-key');
    const unitTestSecret = asSyntheticEncrypted('unit-test-secret');

    const dto = toSafeConnectionDto({
      id: 'e2995df0-af35-4d10-bf23-0ea517a6c272',
      exchange: 'MEXC',
      api_key: unitTestApiKey,
      api_secret: unitTestSecret,
      is_active: true,
      is_testnet: false,
      metadata: { keyHint: '***TEST', encryptionVersion: 1, credentialStatus: 'configured_unverified' },
      created_at: '2026-07-18T20:18:41.770Z',
      updated_at: '2026-07-21T14:00:49.766Z',
    }, { privateAuthVerified: true });
    expect(dto.privateAuthVerified).toBe(true);
    expect(dto.credentialStatus).toBe('authenticated');
    // Projection must never leak the synthetic storage blobs into the safe DTO.
    expect(JSON.stringify(dto)).not.toContain(unitTestApiKey);
    expect(JSON.stringify(dto)).not.toContain(unitTestSecret);

    const matrix = buildCapabilityMatrix({
      credentialsConfigured: true,
      privateAuthVerified: dto.privateAuthVerified,
      storedStates: {
        PRIVATE_AUTH: { keyGrant: 'granted', verificationState: 'verified' },
      },
    });
    expect(matrix.privateAuthVerified).toBe(true);
    expect(matrix.privateAuthVerified).toBe(dto.privateAuthVerified);
  });
});
